// 播放地址解析
//
// filename 规则(实证确证,2026-07-10, 歌单 5/5 首可播):
//   filename = 音质前缀 + song.vs[0] + 扩展名
//   - 中段 = 歌曲对象的 vs[0](搜索/歌单/CgiGetTrackInfo 的 song 顶层都有 vs 数组),
//     不是 songmid,也不是 file.media_mid。
//   - 前缀 = 音质码;本账号实测 RS02 普遍可播。资料常见前缀见 QUALITIES。
//   - 若拿不到 vs,则必须由调用方直接透传浏览器实际使用的 filename。
const { getTrackInfo } = require('./track');

// 音质: 前缀 / 扩展名 / file 里对应 size 字段
const QUALITIES = [
  { name: 'master', prefix: 'RS02', ext: '.mp3', sizeKey: null },   // 实测本账号普遍可播
  { name: 'flac', prefix: 'F000', ext: '.flac', sizeKey: 'size_flac' },
  { name: '320mp3', prefix: 'M800', ext: '.mp3', sizeKey: 'size_320mp3' },
  { name: '128mp3', prefix: 'M500', ext: '.mp3', sizeKey: 'size_128mp3' },
  { name: '96aac', prefix: 'C400', ext: '.m4a', sizeKey: 'size_96aac' },
];
const QUALITY_BY_NAME = Object.fromEntries(QUALITIES.map((q) => [q.name, q]));
const DEFAULT_ORDER = ['master', '320mp3', '128mp3', '96aac'];

class MissingFilenameError extends Error {
  constructor() {
    super('MISSING_FILENAME: 需要 filename,或提供 vs(vs[0]) / songId(由服务端取 vs) 以拼接');
    this.code = 'MISSING_FILENAME';
  }
}

function randomGuid() {
  return String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

function buildFilename(vsFirst, quality) {
  const q = QUALITY_BY_NAME[quality];
  if (!q) throw new Error('未知音质: ' + quality);
  if (!vsFirst) throw new Error('缺少 vs[0]');
  return q.prefix + vsFirst + q.ext;
}

// 单次 GetEVkey: filename 现成,或 vs+quality 拼出
async function resolvePlaybackUrl(session, transport, { songmid, songtype = 0, filename, vs, quality, guid = randomGuid() }) {
  const vsFirst = Array.isArray(vs) ? vs[0] : vs;
  const finalName = filename || (vsFirst && quality ? buildFilename(vsFirst, quality) : null);
  if (!finalName) throw new MissingFilenameError();
  const r = await transport.callQQ(session, 'music.vkey.GetEVkey', 'GetUrl', {
    guid,
    songmid: [songmid],
    songtype: [songtype],
    uin: session.uin,
    loginflag: session.isLoggedIn() ? 1 : 0,
    platform: '20',
    xcdn: 1,
    filename: [finalName],
  });
  const data = r.data || {};
  const info = data.midurlinfo && data.midurlinfo[0];
  const purl = info && info.purl;
  return {
    code: r.code,
    filename: finalName,
    sip: data.sip || [],
    purl: purl || '',
    url: purl && data.sip && data.sip.length ? data.sip[0] + purl : '',
  };
}

// 一步到位: 给 songId 取 vs, 按音质降级返回第一个可播地址
async function resolvePlayableBySong(session, transport, { songmid, songId, vs, preferQualities = DEFAULT_ORDER, guid = randomGuid() }) {
  let vsFirst = Array.isArray(vs) ? vs[0] : vs;
  let mid = songmid;
  let file = {};
  if (!vsFirst || !mid) {
    const info = await getTrackInfo(session, transport, { ids: [songId] });
    const track = info.data && info.data.tracks && info.data.tracks[0];
    if (!track) throw new Error('SONG_NOT_FOUND: 未取到歌曲信息');
    vsFirst = vsFirst || (track.vs && track.vs[0]);
    mid = mid || track.mid;
    file = track.file || {};
  }
  if (!vsFirst) return { code: 0, quality: null, sip: [], purl: '', url: '', reason: 'NO_VS' };

  const tried = [];
  for (const qname of preferQualities) {
    const q = QUALITY_BY_NAME[qname];
    if (!q) continue;
    // 有 size 字段时按其过滤;master(无 sizeKey)直接试
    if (q.sizeKey && !(file[q.sizeKey] > 0)) { tried.push({ quality: qname, reason: 'no-size' }); continue; }
    const res = await resolvePlaybackUrl(session, transport, { songmid: mid, vs: vsFirst, quality: qname, guid });
    if (res.purl) return { ...res, quality: qname };
    tried.push({ quality: qname, reason: 'empty-purl' });
  }
  return { code: 0, quality: null, sip: [], purl: '', url: '', tried, reason: 'NO_PLAYABLE_QUALITY' };
}

module.exports = {
  resolvePlaybackUrl,
  resolvePlayableBySong,
  buildFilename,
  QUALITIES,
  DEFAULT_ORDER,
  MissingFilenameError,
};
