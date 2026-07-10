// 本地协议网关: 把领域服务暴露成 HTTP JSON API, 供 Android MVP 等前端调用
// 用法: node --env-file=.env src/server/protocolServer.js  (默认 127.0.0.1:5178)
// 安全: 仅建议本地/自托管; 日志脱敏; 不代理支付, 只返回官方入口。
const http = require('http');
const { createClient } = require('../index');
const { maskUin } = require('../util/redact');

const HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const PORT = Number(process.env.GATEWAY_PORT || 5178);

const client = createClient();

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

// 路由表: key = "METHOD /path", value = async (body) => data
const routes = {
  'POST /api/search/songs': (b) => client.searchSongs({ query: b.query, page: b.page, pageSize: b.pageSize }),
  'POST /api/search': (b) => client.search({ query: b.query, type: b.type, searchType: b.searchType, page: b.page, pageSize: b.pageSize }),
  'POST /api/track/info': (b) => client.getTrackInfo({ ids: b.ids, types: b.types }),
  'POST /api/playback/resolve': (b) => client.resolvePlaybackUrl({ songmid: b.songmid, songtype: b.songtype, filename: b.filename, guid: b.guid }),
  'POST /api/lyric': (b) => client.getLyric({ songMID: b.songMID, songID: b.songID }),
  'POST /api/playlist/detail': (b) => client.getPlaylistDetail({ disstid: b.disstid, offset: b.offset, limit: b.limit }),
  'GET /api/user/vip': () => client.getVipStatus(),
  'GET /api/payment/vip-entry': () => client.getOfficialVipEntry(),
  'GET /api/health': () => ({ ok: true, loggedIn: client.session.isLoggedIn(), uin: maskUin(client.session.uin) }),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];
  console.log(`${new Date().toISOString()} ${key}`); // 只记路径, 不记 body(可能含 uin)
  if (!handler) return send(res, 404, { error: 'NOT_FOUND', path: url.pathname });
  try {
    const body = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
    const data = await handler(body);
    send(res, 200, { ok: true, data });
  } catch (e) {
    send(res, 500, { ok: false, error: e.code || 'ERROR', message: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`协议网关已启动: http://${HOST}:${PORT}`);
    console.log('登录态:', client.session.isLoggedIn() ? `uin=${maskUin(client.session.uin)}` : '匿名(仅公开接口)');
    console.log('路由:', Object.keys(routes).join(' | '));
  });
}

module.exports = { server, routes };
