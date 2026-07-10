// 歌词服务
// 实测: GetPlayLyricInfo 返回的 lyric/trans/roma 都是 base64 编码的 LRC 文本。
function decodeB64(s) {
  if (!s || typeof s !== 'string') return '';
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return ''; }
}

async function getLyric(session, transport, { songMID, songID }) {
  const param = { songMID };
  if (songID != null) param.songID = songID;
  const r = await transport.callQQ(session, 'music.musichallSong.PlayLyricInfo', 'GetPlayLyricInfo', param);
  const d = r.data || {};
  // 附带解码后的明文,前端可直接用;保留原始 raw 供需要时核对。
  return {
    code: r.code,
    data: {
      songName: d.songName,
      singerName: d.singerName,
      lyric: decodeB64(d.lyric),   // 明文 LRC
      trans: decodeB64(d.trans),   // 翻译(可能空)
      roma: decodeB64(d.roma),     // 罗马音(可能空)
      raw: { lyric: d.lyric, trans: d.trans, roma: d.roma },
    },
  };
}

module.exports = { getLyric, decodeB64 };
