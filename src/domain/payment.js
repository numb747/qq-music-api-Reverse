// 付费入口: 只返回官方 QQ音乐/Midas H5 入口,不逆向/代理下单
const VIP_PORTAL_URL = 'https://y.qq.com/portal/vipportal/index.html';

function getOfficialVipEntry() {
  return {
    type: 'official-h5',
    provider: 'midas',
    url: VIP_PORTAL_URL,
    note: '充值/付费走腾讯米大师官方收银台; 本项目不逆向下单参数,也不自动确认支付。',
  };
}

function getChargeAccount(session, transport) {
  return transport.callQQ(session, 'music.paycenterapi.LoginStateVerificationApi', 'GetChargeAccount', {
    appid: 'mlive',
  });
}

module.exports = { VIP_PORTAL_URL, getOfficialVipEntry, getChargeAccount };
