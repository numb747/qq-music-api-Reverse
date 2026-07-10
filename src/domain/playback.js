// 播放地址解析: filename 必须来自服务端/页面返回,禁止手工拼接
class MissingServerFilenameError extends Error {
  constructor() {
    super('MISSING_SERVER_FILENAME: GetEVkey 需要服务端返回的真实 filename,不能手工拼接');
    this.code = 'MISSING_SERVER_FILENAME';
  }
}

function randomGuid() {
  return String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

async function resolvePlaybackUrl(session, transport, { songmid, songtype = 0, filename, guid = randomGuid() }) {
  if (!filename) throw new MissingServerFilenameError();
  const r = await transport.callQQ(session, 'music.vkey.GetEVkey', 'GetUrl', {
    guid,
    songmid: [songmid],
    songtype: [songtype],
    uin: session.uin,
    loginflag: session.isLoggedIn() ? 1 : 0,
    platform: '20',
    xcdn: 1,
    filename: [filename],
  });
  const data = r.data || {};
  const info = data.midurlinfo && data.midurlinfo[0];
  const purl = info && info.purl;
  return {
    code: r.code,
    sip: data.sip || [],
    purl: purl || '',
    url: purl && data.sip && data.sip.length ? data.sip[0] + purl : '',
    raw: r,
  };
}

module.exports = { resolvePlaybackUrl, MissingServerFilenameError };
