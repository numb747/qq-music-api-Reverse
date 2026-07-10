// 搜索领域服务
const SEARCH_TYPES = {
  song: 0,
  album: 2,
  mv: 4,
  lyric: 7,
  user: 8,
  // singer/songList 暂未完全实测,保留 experimental 值由调用方显式传入更稳。
};

function search(session, transport, { query, type = 'song', searchType, page = 1, pageSize = 10, remoteplace = 'yqq.yqq.yqq' }) {
  const finalType = searchType != null ? searchType : SEARCH_TYPES[type];
  if (finalType == null) throw new Error('未知或未实测的搜索类型: ' + type);
  return transport.callQQ(session, 'music.search.SearchCgiService', 'DoSearchForQQMusicDesktop', {
    remoteplace,
    searchid: String(Math.floor(Math.random() * 90000000000000000) + 10000000000000000),
    search_type: finalType,
    query,
    page_num: page,
    num_per_page: pageSize,
  });
}

function searchSongs(session, transport, opts) {
  return search(session, transport, { ...opts, type: 'song' });
}

function getHotkeys(session, transport) {
  return transport.callQQ(session, 'music.musicsearch.HotkeyService', 'GetHotkeyForQQMusicMobile', {
    searchid: String(Math.floor(Math.random() * 90000000000000000) + 10000000000000000),
    remoteplace: 'txt.yqq.top',
    from: 'yqqweb',
  });
}

module.exports = { SEARCH_TYPES, search, searchSongs, getHotkeys };
