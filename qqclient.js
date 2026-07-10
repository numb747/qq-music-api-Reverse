// QQ音乐 web 通用请求客户端 - 调任意接口
// 用法(模块): const { callQQ, callBatch } = require('./qqclient');
//   const r = await callQQ('music.search.SearchCgiService','DoSearchForQQMusicDesktop',{query:'周杰伦',num_per_page:10,page_num:1});
// 用法(命令行): node qqclient.js <module> <method> '<paramJSON>'
//   node qqclient.js music.search.SearchCgiService DoSearchForQQMusicDesktop "{\"query\":\"周杰伦\",\"num_per_page\":5,\"page_num\":1}"
const { sessionFromEnv, hash33 } = require('./src/session/qqSession');
const { createTransport } = require('./src/transport/qqMusicTransport');

// ===== 登录态配置(改成你自己的) =====
const CONFIG = {
  uin: process.env.QQ_UIN || '',            // 从环境变量读, 用 --env-file=.env 注入
  qm_keyst: process.env.QQ_KEYST || '',
  host: process.env.QQ_HOST || 'u6.y.qq.com',
  proxy: process.env.QQ_PROXY === 'none' ? null : { host: '127.0.0.1', port: 8085 }, // 走 Burp; QQ_PROXY=none 则直连
};
if (!CONFIG.uin || !CONFIG.qm_keyst) {
  console.error('缺少登录态: 请复制 .env.example 为 .env 填入 QQ_UIN/QQ_KEYST, 或先运行 `node qqlogin.js`; 用 `node --env-file=.env ...` 运行');
}

const session = sessionFromEnv();
const transport = createTransport();

// 批量调用: reqs = { key1:{module,method,param}, key2:{...} }, 返回 { key1:{code,data}, ... }
async function callBatch(reqs) {
  return transport.callBatch(session, reqs);
}

// 单接口调用, 返回该接口的 {code, data}
async function callQQ(module, method, param = {}) {
  return transport.callQQ(session, module, method, param);
}

module.exports = { callQQ, callBatch, CONFIG, hash33 };

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
