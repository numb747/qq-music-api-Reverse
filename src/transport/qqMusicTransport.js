// QQ音乐 web 通用传输层: comm -> sign -> encrypt -> musics.fcg -> decrypt -> JSON
const { createQQCryptoEngine } = require('../crypto/qqCryptoEngine');
const { sendEncryptedPost } = require('./rawHttpClient');

function createTransport({ cryptoEngine = createQQCryptoEngine(), httpClient = { sendEncryptedPost } } = {}) {
  return {
    async callBatch(session, reqs) {
      const bodyObj = { comm: session.comm() };
      Object.assign(bodyObj, reqs);
      const plain = JSON.stringify(bodyObj);
      const sign = cryptoEngine.sign(plain);
      const enc = await cryptoEngine.encrypt(plain);
      const buf = await httpClient.sendEncryptedPost(session, `/cgi-bin/musics.fcg?_=${Date.now()}&encoding=ag-1&sign=${sign}`, enc);
      const out = cryptoEngine.decrypt(buf);
      if (typeof out !== 'string' || out[0] !== '{') throw new Error('解密失败, 前40: ' + String(out).slice(0, 40));
      return JSON.parse(out);
    },

    async callQQ(session, module, method, param = {}) {
      const r = await this.callBatch(session, { req_1: { module, method, param } });
      if (r.code !== 0) throw new Error('顶层错误 code=' + r.code);
      return r.req_1;
    },
  };
}

module.exports = { createTransport };
