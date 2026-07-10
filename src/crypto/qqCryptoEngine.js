// CryptoEngine 适配层: 当前复用 Node 版 VMP 加密/签名/解密实现
const { getSecuritySign, cgiEncrypt, cgiDecrypt } = require('../../qqcrypto');

function createQQCryptoEngine() {
  return {
    sign(plain) {
      return getSecuritySign(plain);
    },

    encrypt(plain) {
      return cgiEncrypt(plain);
    },

    decrypt(buffer) {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      return cgiDecrypt(ab);
    },
  };
}

module.exports = { createQQCryptoEngine };
