// QQ音乐 web 会话: 登录态、Cookie、g_tk 与 comm 公共参数

function hash33(t, seed = 5381) {
  let n = seed;
  for (let i = 0; i < t.length; i++) n += (n << 5) + t.charCodeAt(i);
  return n & 0x7fffffff;
}

function createSession({ uin = '', qmKeyst = '', host = 'u6.y.qq.com', proxy } = {}) {
  return {
    uin,
    qmKeyst,
    host,
    proxy,

    isLoggedIn() {
      return Boolean(this.uin && this.qmKeyst);
    },

    gtkForMusicApi() {
      // qmKeyst 为空时 hash33('') 自动返回 5381,兼容匿名公开接口。
      return hash33(this.qmKeyst || '');
    },

    cookieHeader() {
      if (!this.uin && !this.qmKeyst) return 'login_type=1; tmeLoginType=2';
      return `uin=${this.uin}; qm_keyst=${this.qmKeyst}; qqmusic_key=${this.qmKeyst}; login_type=1; tmeLoginType=2`;
    },

    comm() {
      const gtk = this.gtkForMusicApi();
      return {
        cv: 4747474,
        ct: 24,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 1,
        uin: this.uin,
        g_tk_new_20200303: gtk,
        g_tk: gtk,
      };
    },
  };
}

function sessionFromEnv(env = process.env) {
  return createSession({
    uin: env.QQ_UIN || '',
    qmKeyst: env.QQ_KEYST || '',
    host: env.QQ_HOST || 'u6.y.qq.com',
    proxy: env.QQ_PROXY === 'none' ? null : { host: '127.0.0.1', port: 8085 },
  });
}

module.exports = { hash33, createSession, sessionFromEnv };
