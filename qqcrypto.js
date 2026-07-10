// QQ音乐 web 加密引擎 - 独立 Node 版
// 抽取自 vendor.chunk.js 的两段 VMP IIFE (sign=SHA-1变换, ae/se=AES-GCM)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadInto(iifeFile) {
  // 假的 DOM 元素(VMP 内部会 document.createElement('a') 等)
  const fakeEl = new Proxy({}, {
    get(t, k) { return k in t ? t[k] : ''; },
    set(t, k, v) { t[k] = v; return true; },
  });
  const fakeDoc = {
    createElement: () => fakeEl,
    documentElement: fakeEl, body: fakeEl,
    getElementsByTagName: () => [fakeEl], addEventListener() {},
  };
  const sandbox = {
    TextEncoder, TextDecoder,
    Uint8Array, Uint32Array, Int8Array, Int32Array, ArrayBuffer, DataView, Float64Array,
    Array, Math, String, Number,
    JSON, Date, parseInt, isNaN, Symbol, Object, Promise, RegExp, Error,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    console, crypto: globalThis.crypto,
    document: fakeDoc,
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0', platform: 'Win32' },
    location: { href: 'https://y.qq.com/', protocol: 'https:', host: 'y.qq.com' },
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, iifeFile), 'utf8');
  // VMP 把函数挂到调用时的 this 上; sloppy 模式下顶层普通调用 this=globalThis(=context).
  // ne/oe/e 是目标对象参数, 也指向 globalThis; re 是 typeof 辅助函数(VMP case25).
  const prelude = 'var e=globalThis, ne=globalThis, oe=globalThis, self=globalThis, window=globalThis;'
    + 'var re=function(e){return e&&"undefined"!=typeof Symbol&&e.constructor===Symbol?"symbol":typeof e};\n';
  vm.runInContext(prelude + code, sandbox, { filename: iifeFile });
  return sandbox; // 挂载结果反映在 sandbox 上
}

const t1 = loadInto('_sign_iife.js');
const t2 = loadInto('_enc_iife.js');

const getSecuritySign = t1._getSecuritySign;
const cgiEncrypt = t2.__cgiEncrypt;
const cgiDecrypt = t2.__cgiDecrypt;

if (process.env.QQCRYPTO_DEBUG === '1' || require.main === module) {
  console.log('getSecuritySign:', typeof getSecuritySign);
  console.log('__cgiEncrypt   :', typeof cgiEncrypt);
  console.log('__cgiDecrypt   :', typeof cgiDecrypt);
}

module.exports = { getSecuritySign, cgiEncrypt, cgiDecrypt };

// 自测: 直接运行时做往返
if (require.main === module) {
  (async () => {
    const plain = JSON.stringify({ comm: { ct: 24 }, test: { module: 'x', method: 'y', param: {} } });
    console.log('\n--- 往返测试 ---');
    console.log('明文:', plain);
    try {
      const sign = getSecuritySign(plain);
      console.log('sign:', sign);
    } catch (e) { console.log('sign 出错:', e.message); }
    try {
      const enc = await cgiEncrypt(plain);
      console.log('加密(base64)长度:', enc.length, '前40:', enc.slice(0, 40));
      // ae 输出 base64 字符串; se 期望 ArrayBuffer(浏览器里 se(xhr.response))
      const buf = Buffer.from(enc, 'base64');
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const dec = cgiDecrypt(ab);
      console.log('解密回:', typeof dec === 'string' ? dec.slice(0, 120) : dec);
      console.log('往返一致:', dec === plain);
    } catch (e) { console.log('加解密出错:', e.message, '\n', e.stack); }
  })();
}
