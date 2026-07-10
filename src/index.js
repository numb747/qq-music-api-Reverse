// 协议内核聚合入口: 组装 session + transport + 领域服务, 供 CLI / 网关 / 未来 Android 网关复用
const { createSession, sessionFromEnv, hash33 } = require('./session/qqSession');
const { createTransport } = require('./transport/qqMusicTransport');
const search = require('./domain/search');
const track = require('./domain/track');
const playback = require('./domain/playback');
const lyric = require('./domain/lyric');
const playlist = require('./domain/playlist');
const user = require('./domain/user');
const payment = require('./domain/payment');

function createClient({ session, env } = {}) {
  const sess = session || sessionFromEnv(env);
  const transport = createTransport();

  return {
    session: sess,
    transport,

    // 搜索
    search: (opts) => search.search(sess, transport, opts),
    searchSongs: (opts) => search.searchSongs(sess, transport, opts),
    getHotkeys: () => search.getHotkeys(sess, transport),

    // 歌曲/音质
    getTrackInfo: (opts) => track.getTrackInfo(sess, transport, opts),

    // 播放
    resolvePlaybackUrl: (opts) => playback.resolvePlaybackUrl(sess, transport, opts),

    // 歌词
    getLyric: (opts) => lyric.getLyric(sess, transport, opts),

    // 歌单
    getPlaylistDetail: (opts) => playlist.getPlaylistDetail(sess, transport, opts),

    // 用户/VIP
    getVipStatus: (opts) => user.getVipStatus(sess, transport, opts),
    getUserBaseInfo: (opts) => user.getUserBaseInfo(sess, transport, opts),
    getFavorList: (opts) => user.getFavorList(sess, transport, opts),

    // 支付入口
    getOfficialVipEntry: () => payment.getOfficialVipEntry(),
    getChargeAccount: () => payment.getChargeAccount(sess, transport),

    // 原始批量/单发
    callQQ: (module, method, param) => transport.callQQ(sess, module, method, param),
    callBatch: (reqs) => transport.callBatch(sess, reqs),
  };
}

module.exports = {
  createClient,
  createSession,
  sessionFromEnv,
  hash33,
  domain: { search, track, playback, lyric, playlist, user, payment },
};
