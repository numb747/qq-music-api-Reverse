// 歌单服务
function getPlaylistDetail(session, transport, { disstid, offset = 0, limit = 10 }) {
  return transport.callQQ(session, 'music.srfDissInfo.aiDissInfo', 'uniform_get_Dissinfo', {
    song_begin: offset,
    song_num: limit,
    disstid,
    ctx: 1,
  });
}

function isPlaylistFav(session, transport, { tid }) {
  return transport.callQQ(session, 'music.musicasset.PlaylistFavRead', 'IsPlaylistFan', {
    v_tid: [tid],
  });
}

module.exports = { getPlaylistDetail, isPlaylistFav };
