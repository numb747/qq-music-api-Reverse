// 端到端验证工具 (smoke test)
// 用法: node --env-file=.env src/cli/verify.js <crypto|public|login|playback|all>
const { createClient } = require('../index');
const { createQQCryptoEngine } = require('../crypto/qqCryptoEngine');
const { maskUin } = require('../util/redact');

const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m);

async function verifyCrypto() {
  console.log('[crypto] VMP 签名/加密产出检查');
  // 注意: ae(请求加密)与 se(响应解密)方向不同,自加密自解不回环(设计如此),
  // 故这里只验证 sign 与 encrypt 能产出有效结果,真实解密由 public/login 项间接覆盖。
  const engine = createQQCryptoEngine();
  const plain = JSON.stringify({ comm: { ct: 24 }, req_1: { module: 'x', method: 'y', param: {} } });
  const sign = engine.sign(plain);
  if (!sign || typeof sign !== 'string') { bad('sign 失败'); return false; }
  ok('sign 长度 ' + sign.length);
  const enc = await engine.encrypt(plain);
  if (!enc || typeof enc !== 'string' || Buffer.from(enc, 'base64').length < 16) { bad('encrypt 产出异常'); return false; }
  ok('encrypt 产出 base64 长度 ' + enc.length);
  return true;
}

async function verifyPublic() {
  console.log('[public] 公开接口(热词/搜索)');
  const client = createClient();
  const hk = await client.getHotkeys();
  hk.code === 0 ? ok('热词 code=0') : bad('热词 code=' + hk.code);
  const s = await client.searchSongs({ query: '周杰伦', pageSize: 2 });
  const n = s.data && s.data.body && s.data.body.song && s.data.body.song.list.length;
  s.code === 0 && n ? ok('搜索返回 ' + n + ' 首') : bad('搜索异常 code=' + s.code);
  return hk.code === 0 && s.code === 0;
}

async function verifyLogin() {
  console.log('[login] 需登录接口(VIP/收藏)');
  const client = createClient();
  if (!client.session.isLoggedIn()) { bad('无登录态, 跳过 (设置 .env 的 QQ_UIN/QQ_KEYST)'); return false; }
  ok('登录态 uin=' + maskUin(client.session.uin));
  const vip = await client.getVipStatus();
  vip.code === 0 ? ok('VIP 查询 code=0') : bad('VIP 查询 code=' + vip.code);
  const fav = await client.getFavorList();
  fav.code === 0 ? ok('收藏列表 code=0') : bad('收藏列表 code=' + fav.code);
  return vip.code === 0 && fav.code === 0;
}

async function verifyPlayback() {
  console.log('[playback] 播放地址解析(用搜索结果真实 filename)');
  const client = createClient();
  const s = await client.searchSongs({ query: '周杰伦', pageSize: 5 });
  const list = (s.data && s.data.body && s.data.body.song && s.data.body.song.list) || [];
  const picked = list.find((song) => song.mid) || null;
  if (!picked) { bad('搜索无结果'); return false; }

  // 缺 filename 必须报 MISSING_SERVER_FILENAME
  try {
    await client.resolvePlaybackUrl({ songmid: picked.mid });
    bad('缺 filename 时未按预期报错');
    return false;
  } catch (e) {
    if (e.code === 'MISSING_SERVER_FILENAME') ok('缺 filename 正确拒绝 (' + e.code + ')');
    else { bad('非预期错误: ' + e.message); return false; }
  }
  console.log('  \x1b[33m·\x1b[0m 提示: 完整 vkey 验证需页面/接口返回的真实 filename, 此处只验证约束');
  return true;
}

const TASKS = { crypto: verifyCrypto, public: verifyPublic, login: verifyLogin, playback: verifyPlayback };

async function main() {
  const which = process.argv[2] || 'all';
  const names = which === 'all' ? Object.keys(TASKS) : [which];
  let allPass = true;
  for (const name of names) {
    const fn = TASKS[name];
    if (!fn) { console.error('未知验证项:', name, '可选:', Object.keys(TASKS).join('/'), 'all'); process.exit(1); }
    try { const pass = await fn(); allPass = allPass && pass; }
    catch (e) { bad(name + ' 抛错: ' + e.message); allPass = false; }
    console.log('');
  }
  console.log(allPass ? '\x1b[32m全部通过\x1b[0m' : '\x1b[31m存在失败项\x1b[0m');
  process.exit(allPass ? 0 : 1);
}

if (require.main === module) main();
