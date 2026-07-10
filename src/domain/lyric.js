// 歌词服务
function getLyric(session, transport, { songMID, songID }) {
  const param = { songMID };
  if (songID != null) param.songID = songID;
  return transport.callQQ(session, 'music.musichallSong.PlayLyricInfo', 'GetPlayLyricInfo', param);
}

module.exports = { getLyric };
