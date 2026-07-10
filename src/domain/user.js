// 用户态 / VIP / 收藏服务
function getVipStatus(session, transport, { uin = session.uin } = {}) {
  return transport.callQQ(session, 'userInfo.VipQueryServer', 'SRFVipQuery_V2', {
    uin_list: [String(uin)],
  });
}

function getUserBaseInfo(session, transport, { uin = session.uin } = {}) {
  return transport.callQQ(session, 'userInfo.BaseUserInfoServer', 'get_user_baseinfo_v2', {
    vec_uin: [String(uin)],
  });
}

function getFavorList(session, transport, { userId = session.uin, favType = 1 } = {}) {
  return transport.callQQ(session, 'music.favor_system_read', 'get_favor_list', {
    userid: String(userId),
    fav_type: favType,
  });
}

module.exports = { getVipStatus, getUserBaseInfo, getFavorList };
