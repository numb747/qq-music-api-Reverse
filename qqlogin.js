// QQ音乐 web 扫码登录 -> 自动换取 uin / qm_keyst -> 写回 .env
// 复现浏览器完整登录链路(QQ互联OAuth2.0), 全程无需已有登录态。
// 用法: node qqlogin.js         (默认走 Burp 代理; 直连设 QQ_PROXY=none)
//   扫码: 运行后终端直接渲染二维码(带倒计时), 用手机QQ扫码并确认; 失效自动刷新。
//   渲染失败时回退存 qrcode.png。
const fs = require('fs');
const zlib = require('zlib');
const { runQrLogin } = require('./src/login/qrLoginFlow');
const { writeEnvToken } = require('./src/session/envTokenStore');
const { hash33 } = require('./src/session/qqSession');

// ===== 解析 PNG(灰度/调色板, 无隔行) -> 二值点阵 bits[y][x] (1=黑) =====
function decodePngToBits(buf) {
  let p = 8;
  let width, height, bitDepth, colorType;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const bpp = Math.ceil((bitDepth * ch) / 8);
  const rowBytes = Math.ceil((width * bitDepth * ch) / 8);
  const cur = Buffer.alloc(rowBytes);
  const prev = Buffer.alloc(rowBytes);
  const bits = [];
  let off = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[off++];
    raw.copy(cur, 0, off, off + rowBytes); off += rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (filter === 1) v += a; else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 0xff;
    }
    const row = [];
    for (let x = 0; x < width; x++) {
      let lum;
      if (bitDepth === 1) lum = (cur[x >> 3] >> (7 - (x & 7))) & 1 ? 255 : 0;
      else { const base = x * bpp; lum = cur[base]; }
      row.push(lum < 128 ? 1 : 0);
    }
    bits.push(row);
    cur.copy(prev);
  }
  return { bits, width, height };
}

function bitsToModules(bits, width, height) {
  let top = 0, bot = height - 1, left = 0, right = width - 1;
  const rowHasBlack = (y) => bits[y].some((v) => v);
  const colHasBlack = (x) => bits.some((r) => r[x]);
  while (top < bot && !rowHasBlack(top)) top++;
  while (bot > top && !rowHasBlack(bot)) bot--;
  while (left < right && !colHasBlack(left)) left++;
  while (right > left && !colHasBlack(right)) right--;
  const w = right - left + 1;
  let run = 0, minRun = w;
  let last = bits[top][left];
  for (let x = left; x <= right; x++) {
    const v = bits[top][x];
    if (v === last) run++;
    else { if (run < minRun) minRun = run; run = 1; last = v; }
  }
  const mod = Math.max(1, minRun);
  const n = Math.round(w / mod);
  const mat = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const y = top + Math.floor((r + 0.5) * mod);
      const x = left + Math.floor((c + 0.5) * mod);
      row.push((bits[y] && bits[y][x]) ? 1 : 0);
    }
    mat.push(row);
  }
  return mat;
}

function renderQr(mat) {
  const n = mat.length;
  const qz = 2;
  const get = (r, c) => (r < 0 || c < 0 || r >= n || c >= n) ? 0 : mat[r][c];
  const reset = '\x1b[0m';
  const lines = [];
  for (let r = -qz; r < n + qz; r += 2) {
    let line = '';
    for (let c = -qz; c < n + qz; c++) {
      const topBlack = get(r, c), botBlack = get(r + 1, c);
      const fg = topBlack ? 30 : 97;
      const bg = botBlack ? 40 : 107;
      line += `\x1b[${fg};${bg}m▀`;
    }
    lines.push(line + reset);
  }
  return lines.join('\n');
}

function printQrFromPng(pngBuf) {
  const { bits, width, height } = decodePngToBits(pngBuf);
  const mat = bitsToModules(bits, width, height);
  console.log('\n' + renderQr(mat) + '\n');
}

function handleQrPng(png) {
  try {
    printQrFromPng(png);
  } catch (e) {
    fs.writeFileSync('qrcode.png', png);
    console.log('终端渲染失败(' + e.message + '), 已存 qrcode.png 备用');
  }
}

function handleStatus(s) {
  if (s.type === 'waiting-scan') process.stdout.write(`\r等待扫码... (剩余 ${s.left || 0}s)   `);
  else if (s.type === 'confirmed-waiting') process.stdout.write(`\r已扫码, 等待手机确认... (剩余 ${s.left || 0}s)   `);
  else if (s.type === 'expired') console.log('\n二维码已失效, 自动刷新...');
  else if (s.type === 'success') console.log('\n扫码成功:', s.nick || '');
}

async function main() {
  console.log('请用手机QQ扫描二维码并确认...');
  const cred = await runQrLogin({ onQrPng: handleQrPng, onStatus: handleStatus });
  console.log('\n登录成功!');
  console.log('  QQ_UIN   =', cred.uin);
  console.log('  QQ_KEYST =', cred.qmKeyst);
  console.log('  有效期   =', (cred.expiresIn / 86400).toFixed(0), '天');
  writeEnvToken(cred);
  console.log('已写回 .env, 现在可直接跑: node --env-file=.env qqclient.js ...');
  try { fs.unlinkSync('qrcode.png'); } catch (_) {}
}

if (require.main === module) {
  main().catch((e) => { console.error('\n出错:', e.message); process.exit(1); });
}

module.exports = { hash33, main };
