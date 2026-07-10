// 歌曲元数据/音质可用性
function getTrackInfo(session, transport, { ids, types }) {
  const finalTypes = types || ids.map(() => 0);
  return transport.callQQ(session, 'music.trackInfo.UniformRuleCtrl', 'CgiGetTrackInfo', {
    types: finalTypes,
    ids,
  });
}

function availableQualities(file = {}) {
  return Object.entries(file)
    .filter(([k, v]) => /^size_/.test(k) && Number(v) > 0)
    .map(([k, v]) => ({ key: k.replace(/^size_/, ''), bytes: v }));
}

module.exports = { getTrackInfo, availableQualities };
