// QQ音乐 web 通用请求客户端 - 调任意接口
// 用法(模块): const { callQQ, callBatch } = require('./qqclient');
//   const r = await callQQ('music.search.SearchCgiService','DoSearchForQQMusicDesktop',{query:'周杰伦',num_per_page:10,page_num:1});
// 用法(命令行): node qqclient.js <module> <method> '<paramJSON>'
//   node qqclient.js music.search.SearchCgiService DoSearchForQQMusicDesktop "{\"query\":\"周杰伦\",\"num_per_page\":5,\"page_num\":1}"
const http = require('http');
const tls = require('tls');
const { getSecuritySign, cgiEncrypt, cgiDecrypt } = require('./qqcrypto');

// ===== 登录态配置(改成你自己的) =====
const CONFIG = {
  uin: process.env.QQ_UIN || '',            // 从环境变量读, 用 --env-file=.env 注入
  qm_keyst: process.env.QQ_KEYST || '',
  host: process.env.QQ_HOST || 'u6.y.qq.com',
  proxy: process.env.QQ_PROXY === 'none' ? null : { host: '127.0.0.1', port: 8085 }, // 走 Burp; QQ_PROXY=none 则直连
};
if (!CONFIG.uin || !CONFIG.qm_keyst) {
  console.error('缺少登录态: 请复制 .env.example 为 .env 填入 QQ_UIN/QQ_KEYST, 并用 `node --env-file=.env ...` 运行');
}

function cookie() {
  return `uin=${CONFIG.uin}; qm_keyst=${CONFIG.qm_keyst}; qqmusic_key=${CONFIG.qm_keyst}; login_type=1; tmeLoginType=2`;
}

// 经 Burp CONNECT 隧道(或直连)发 HTTPS, 返回响应体 Buffer
function send(path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      Cookie: cookie(), 'Content-Type': 'text/plain', Origin: 'https://y.qq.com',
      Referer: 'https://y.qq.com/', Accept: 'application/octet-stream',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0',
    };
    const onSock = (s) => {
      const h = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
      s.write(`POST ${path} HTTP/1.1\r\nHost: ${CONFIG.host}\r\n${h}\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n`);
      s.write(body);
      const chunks = [];
      s.on('data', (d) => chunks.push(d));
      s.on('end', () => { const raw = Buffer.concat(chunks); const i = raw.indexOf('\r\n\r\n'); resolve(raw.slice(i + 4)); });
      s.on('error', reject);
    };
    if (CONFIG.proxy) {
      const c = http.request({ host: CONFIG.proxy.host, port: CONFIG.proxy.port, method: 'CONNECT', path: `${CONFIG.host}:443` });
      c.on('connect', (_r, socket) => onSock(tls.connect({ socket, servername: CONFIG.host, rejectUnauthorized: false })));
      c.on('error', reject); c.end();
    } else {
      onSock(tls.connect({ host: CONFIG.host, port: 443, servername: CONFIG.host, rejectUnauthorized: false }));
    }
  });
}

// 组装 comm 公共参数(带登录态)
function comm() {
  return { cv: 4747474, ct: 24, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8',
    notice: 0, platform: 'yqq.json', needNewCode: 1, uin: CONFIG.uin, g_tk_new_20200303: 5381, g_tk: 5381 };
}

// 批量调用: reqs = { key1:{module,method,param}, key2:{...} }, 返回 { key1:{code,data}, ... }
async function callBatch(reqs) {
  const bodyObj = { comm: comm() };
  Object.assign(bodyObj, reqs);
  const plain = JSON.stringify(bodyObj);
  const sign = getSecuritySign(plain);
  const enc = await cgiEncrypt(plain);
  const buf = await send(`/cgi-bin/musics.fcg?_=${Date.now()}&encoding=ag-1&sign=${sign}`, enc);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const out = cgiDecrypt(ab);
  if (typeof out !== 'string' || out[0] !== '{') throw new Error('解密失败, 前40: ' + String(out).slice(0, 40));
  return JSON.parse(out);
}

// 单接口调用, 返回该接口的 {code, data}
async function callQQ(module, method, param = {}) {
  const r = await callBatch({ req_1: { module, method, param } });
  if (r.code !== 0) throw new Error('顶层错误 code=' + r.code);
  return r.req_1;
}

module.exports = { callQQ, callBatch, CONFIG };

// ===== 命令行入口 =====
if (require.main === module) {
  const [, , mod, method, paramStr] = process.argv;
  if (!mod || !method) {
    console.log('用法: node qqclient.js <module> <method> \'<paramJSON>\'');
    console.log('示例: node qqclient.js music.search.SearchCgiService DoSearchForQQMusicDesktop "{\\"query\\":\\"周杰伦\\",\\"num_per_page\\":5,\\"page_num\\":1}"');
    process.exit(1);
  }
  let param = {};
  if (paramStr) { try { param = JSON.parse(paramStr); } catch (e) { console.error('param 不是合法JSON:', e.message); process.exit(1); } }
  callQQ(mod, method, param)
    .then((r) => { console.log('code:', r.code); console.log(JSON.stringify(r.data, null, 2).slice(0, 2000)); })
    .catch((e) => console.error('出错:', e.message));
}

