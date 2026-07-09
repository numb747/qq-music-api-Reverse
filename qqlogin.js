// QQ音乐 web 扫码登录 -> 自动换取 uin / qm_keyst -> 写回 .env
// 复现浏览器完整登录链路(QQ互联OAuth2.0), 全程无需已有登录态。
// 用法: node qqlogin.js         (默认走 Burp 代理; 直连设 QQ_PROXY=none)
//   扫码: 运行后终端直接渲染二维码(带倒计时), 用手机QQ扫码并确认; 失效自动刷新。
//   渲染失败时回退存 qrcode.png。
// 链路见 memory: qqmusic-web-login (ptqrshow/ptqrlogin/check_sig/authorize/QQLogin)
const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const zlib = require('zlib');
const { URL } = require('url');

const PROXY = process.env.QQ_PROXY === 'none' ? null : { host: '127.0.0.1', port: 8085 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

// QQ互联固定参数(QQ音乐)
const APPID = '716027609';       // ptlogin aid/appid
const DAID = '383';
const PT_3RD_AID = '100497308';  // QQ音乐在QQ互联的 client_id
const U1 = 'https://graph.qq.com/oauth2.0/login_jump';
const REDIRECT_URI = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F';

// ===== QQ 系 hash33 变体 =====
// g_tk: 5381 起始; ptqrtoken(qrsig): 0 起始。两者只差 seed。
function hash33(t, seed = 5381) {
  let n = seed;
  for (let i = 0; i < t.length; i++) n += (n << 5) + t.charCodeAt(i);
  return n & 0x7fffffff;
}
function qrToken(qrsig) {
  return hash33(qrsig, 0);
}

// ===== 解析 PNG(灰度/调色板, 无隔行) -> 二值点阵 bits[y][x] (1=黑) =====
function decodePngToBits(buf) {
  // 读 IHDR
  let p = 8; // 跳过 PNG 签名
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
  // 每像素通道数
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
    for (let i = 0; i < rowBytes; i++) { // 反滤波
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
      else { const base = x * bpp; lum = cur[base]; } // 灰度/RGB 取首通道
      row.push(lum < 128 ? 1 : 0); // 1=黑
    }
    bits.push(row);
    cur.copy(prev);
  }
  return { bits, width, height };
}

// 找到二维码有效区域 + 模块像素大小, 采样成 N×N 逻辑矩阵
function bitsToModules(bits, width, height) {
  // 裁掉四周纯白边
  let top = 0, bot = height - 1, left = 0, right = width - 1;
  const rowHasBlack = (y) => bits[y].some((v) => v);
  const colHasBlack = (x) => bits.some((r) => r[x]);
  while (top < bot && !rowHasBlack(top)) top++;
  while (bot > top && !rowHasBlack(bot)) bot--;
  while (left < right && !colHasBlack(left)) left++;
  while (right > left && !colHasBlack(right)) right--;
  const w = right - left + 1;
  // 估模块大小: 扫首行黑白游程取最小
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

// 用半块字符渲染: 上下两行合成一个字符行(▀), 黑=前景, 白=背景
function renderQr(mat) {
  const n = mat.length;
  const QZ = 2; // quiet zone
  const get = (r, c) => (r < 0 || c < 0 || r >= n || c >= n) ? 0 : mat[r][c]; // 界外=白
  // 用真彩 ANSI: 白底黑码, 保证任意终端主题都能扫
  const WHITE = '\x1b[47m', RESET = '\x1b[0m';
  const lines = [];
  for (let r = -QZ; r < n + QZ; r += 2) {
    let line = '';
    for (let c = -QZ; c < n + QZ; c++) {
      const topBlack = get(r, c), botBlack = get(r + 1, c);
      // 前景色=字符颜色(上半块), 背景色=下半块
      const fg = topBlack ? 30 : 97;   // 30黑 97亮白
      const bg = botBlack ? 40 : 107;  // 40黑 107亮白
      line += `\x1b[${fg};${bg}m▀`;
    }
    lines.push(line + RESET);
  }
  return lines.join('\n');
}

function printQrFromPng(pngBuf) {
  const { bits, width, height } = decodePngToBits(pngBuf);
  const mat = bitsToModules(bits, width, height);
  console.log('\n' + renderQr(mat) + '\n');
}

// ===== 简易 cookie jar: 无脑累积, 每次请求全带上(QQ服务端容忍多余cookie) =====
const jar = {};
function setCookiesFrom(headers) {
  const sc = headers['set-cookie'];
  if (!sc) return;
  for (const line of sc) {
    const kv = line.split(';')[0];
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1).trim();
    if (!k) continue;
    // 同名 cookie 跨域下发时, 不让空值覆盖已有的非空值(p_skey 隔离机制会下发空 p_skey)
    if (v === '' && jar[k]) continue;
    jar[k] = v;
  }
}
function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ===== 底层请求: 走 Burp CONNECT 隧道 或 直连, 不自动跟随重定向 =====
// 返回 { status, headers, body(Buffer), location }
function request(method, urlStr, { body = null, headers = {} } = {}) {
  const u = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const base = {
      'User-Agent': UA,
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept-Encoding': 'identity', // 关掉压缩, 省去 gunzip
      Cookie: cookieHeader(),
      ...headers,
    };
    if (body != null) base['Content-Length'] = Buffer.byteLength(body);
    const path = u.pathname + u.search;
    const onSock = (sock) => {
      const hdr = `${method} ${path} HTTP/1.1\r\nHost: ${u.hostname}\r\n` +
        Object.entries(base).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        `\r\nConnection: close\r\n\r\n`;
      sock.write(hdr);
      if (body != null) sock.write(body);
      const chunks = [];
      sock.on('data', (d) => chunks.push(d));
      sock.on('end', () => {
        const raw = Buffer.concat(chunks);
        const sep = raw.indexOf('\r\n\r\n');
        const head = raw.slice(0, sep).toString('latin1');
        const bodyBuf = raw.slice(sep + 4);
        const lines = head.split('\r\n');
        const status = parseInt(lines[0].split(' ')[1], 10);
        const headers = {};
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].indexOf(':');
          const k = lines[i].slice(0, c).toLowerCase().trim();
          const v = lines[i].slice(c + 1).trim();
          if (k === 'set-cookie') (headers[k] = headers[k] || []).push(v);
          else headers[k] = v;
        }
        setCookiesFrom(headers);
        resolve({ status, headers, body: bodyBuf, location: headers['location'] });
      });
      sock.on('error', reject);
    };
    if (PROXY) {
      const c = http.request({ host: PROXY.host, port: PROXY.port, method: 'CONNECT', path: `${u.hostname}:443` });
      c.on('connect', (_r, socket) => onSock(tls.connect({ socket, servername: u.hostname, rejectUnauthorized: false })));
      c.on('error', reject);
      c.end();
    } else {
      onSock(tls.connect({ host: u.hostname, port: 443, servername: u.hostname, rejectUnauthorized: false }));
    }
  });
}

// 跟随重定向(check_sig 会 302 到 login_jump), 累积 cookie
async function follow(urlStr, max = 5) {
  let cur = urlStr;
  for (let i = 0; i < max; i++) {
    const r = await request('GET', cur, { headers: { Accept: 'text/html', Referer: 'https://xui.ptlogin2.qq.com/' } });
    if (r.status >= 300 && r.status < 400 && r.location) {
      cur = r.location.startsWith('http') ? r.location : new URL(r.location, cur).href;
      continue;
    }
    return r;
  }
  throw new Error('重定向次数过多');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function unescapePtUrl(s) {
  if (!s) return s;
  return s
    .replace(/\\\//g, '/')
    .replace(/\\x26/g, '&')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');
}

// ① 打开登录页, 种下 pt_login_sig 等基础 cookie
async function step1_xlogin() {
  const url = `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${APPID}&daid=${DAID}` +
    `&style=33&hide_title_bar=1&hide_border=1&target=self` +
    `&s_url=${encodeURIComponent(U1)}&pt_3rd_aid=${PT_3RD_AID}&theme=2`;
  await request('GET', url, { headers: { Accept: 'text/html', Referer: 'https://graph.qq.com/' } });
  const loginSig = jar['pt_login_sig'];
  if (!loginSig) throw new Error('未拿到 pt_login_sig, 无法继续');
  return loginSig;
}

// ② 拉二维码 PNG + qrsig, 存盘
async function step2_qrshow() {
  const t = Math.random();
  const url = `https://xui.ptlogin2.qq.com/ssl/ptqrshow?appid=${APPID}&e=2&l=M&s=3&d=72&v=4` +
    `&t=${t}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}&u1=${encodeURIComponent(U1)}`;
  const r = await request('GET', url, { headers: { Referer: 'https://xui.ptlogin2.qq.com/', Accept: 'image/*,*/*;q=0.8' } });
  const qrsig = jar['qrsig'];
  if (!qrsig || r.body.length < 100) throw new Error('二维码获取失败');
  try {
    printQrFromPng(r.body);
  } catch (e) {
    fs.writeFileSync('qrcode.png', r.body);
    console.log('终端渲染失败(' + e.message + '), 已存 qrcode.png 备用');
  }
  return { qrsig, ptqrtoken: qrToken(qrsig) };
}

// ③ 轮询扫码状态; 返回成功后的 check_sig 回跳 url
async function step3_poll(loginSig, ptqrtoken) {
  const VALID = 110; // QQ二维码有效期约110秒
  const started = Date.now();
  console.log('请用手机QQ扫描上方二维码并确认 (有效期约' + VALID + '秒)...');
  for (let i = 0; i < 60; i++) { // 最多轮询 ~3 分钟
    const left = VALID - Math.floor((Date.now() - started) / 1000);
    const action = `0-0-${Date.now()}`;
    const url = `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?u1=${encodeURIComponent(U1)}` +
      `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
      `&action=${action}&js_ver=26030415&js_type=1&login_sig=${loginSig}` +
      `&pt_uistyle=40&aid=${APPID}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}&`;
    const r = await request('GET', url, { headers: { Referer: 'https://xui.ptlogin2.qq.com/' } });
    const text = r.body.toString('utf8');
    // ptuiCB('0','0','<check_sig_url>','0','登录成功!', 'nick')
    const m = text.match(/ptuiCB\((.*)\)/);
    const args = m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')) : [];
    const code = args[0];
    const tag = `剩余 ${left > 0 ? left : 0}s`;
    if (code === '0') {
      console.log('\n扫码成功:', args[5] || '');
      return unescapePtUrl(args[2]);
    }
    if (code === '65') { console.log('\n二维码已失效, 自动刷新...'); return null; }
    if (left <= 0) { console.log('\n二维码超时, 自动刷新...'); return null; }
    if (code === '67') process.stdout.write(`\r已扫码, 等待手机确认... (${tag})   `);
    else if (code === '66') process.stdout.write(`\r等待扫码... (${tag})   `);
    await sleep(3000);
  }
  throw new Error('轮询超时');
}

// ④ 跟随 check_sig, 种下 p_skey / p_uin 等 QQ 登录态
async function step4_checkSig(checkSigUrl) {
  const r = await follow(checkSigUrl);
  if (!jar['p_skey']) {
    throw new Error('未拿到 p_skey, check_sig 失败 (最终 status=' + r.status + ')');
  }
  return { pSkey: jar['p_skey'], pUin: jar['p_uin'] };
}

// ⑤ OAuth 授权, 换 code
async function step5_authorize(pSkey) {
  const gtk = hash33(pSkey);
  const ui = (jar['ui'] || '').toUpperCase() || '';
  const body = `response_type=code&client_id=${PT_3RD_AID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=get_user_info%2Cget_app_friends&state=state&switch=&from_ptlogin=1` +
    `&src=1&update_auth=1&openapi=1010_1030&g_tk=${gtk}&auth_time=${Date.now()}&ui=${ui}`;
  const r = await request('POST', 'https://graph.qq.com/oauth2.0/authorize', {
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://graph.qq.com', Referer: 'https://graph.qq.com/', Accept: 'text/html',
    },
  });
  const loc = r.location || '';
  const m = loc.match(/[?&]code=([^&]+)/);
  if (!m) throw new Error('未拿到 OAuth code, Location=' + loc);
  return decodeURIComponent(m[1]);
}

// ⑥ code 换 qm_keyst (明文 musicu.fcg, 不加密!)
async function step6_qqlogin(code) {
  const key = jar['qqmusic_key'] || jar['p_skey'] || jar['skey'] || '';
  const bodyObj = {
    comm: { g_tk: hash33(key), platform: 'yqq', ct: 24, cv: 0 },
    req: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } },
  };
  const r = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
    body: JSON.stringify(bodyObj),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://y.qq.com', Referer: 'https://y.qq.com/', Accept: '*/*',
    },
  });
  const json = JSON.parse(r.body.toString('utf8'));
  const data = json.req && json.req.data;
  if (!data || !data.musickey) throw new Error('QQLogin 失败: ' + r.body.toString('utf8').slice(0, 200));
  return { uin: String(data.musicid), qm_keyst: data.musickey, expiresIn: data.keyExpiresIn };
}

// 写回 .env (保留 QQ_PROXY 等其它行)
function writeEnv({ uin, qm_keyst }) {
  let env = {};
  try {
    fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach((l) => {
      const i = l.indexOf('='); if (i > 0) env[l.slice(0, i)] = l.slice(i + 1);
    });
  } catch (_) {}
  env['QQ_UIN'] = uin;
  env['QQ_KEYST'] = qm_keyst;
  if (!('QQ_PROXY' in env)) env['QQ_PROXY'] = '';
  fs.writeFileSync('.env', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

async function main() {
  const loginSig = await step1_xlogin();
  let checkSigUrl = null;
  for (let attempt = 0; attempt < 5 && !checkSigUrl; attempt++) {
    const { ptqrtoken } = await step2_qrshow();
    checkSigUrl = await step3_poll(loginSig, ptqrtoken);
  }
  if (!checkSigUrl) throw new Error('多次刷新仍未扫码, 退出');
  const { pSkey } = await step4_checkSig(checkSigUrl);
  const code = await step5_authorize(pSkey);
  const cred = await step6_qqlogin(code);
  console.log('\n登录成功!');
  console.log('  QQ_UIN   =', cred.uin);
  console.log('  QQ_KEYST =', cred.qm_keyst);
  console.log('  有效期   =', (cred.expiresIn / 86400).toFixed(0), '天');
  writeEnv(cred);
  console.log('已写回 .env, 现在可直接跑: node --env-file=.env qqclient.js ...');
  try { fs.unlinkSync('qrcode.png'); } catch (_) {}
}

if (require.main === module) {
  main().catch((e) => { console.error('\n出错:', e.message); process.exit(1); });
}

module.exports = { hash33, main };



