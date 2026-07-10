// QQ音乐 web 原始 HTTPS 发送器: 支持直连或 Burp CONNECT 代理
const http = require('http');
const tls = require('tls');

function sendEncryptedPost(session, path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      Cookie: session.cookieHeader(),
      'Content-Type': 'text/plain',
      Origin: 'https://y.qq.com',
      Referer: 'https://y.qq.com/',
      Accept: 'application/octet-stream',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0',
    };

    const onSock = (s) => {
      const h = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
      s.write(`POST ${path} HTTP/1.1\r\nHost: ${session.host}\r\n${h}\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n`);
      s.write(body);
      const chunks = [];
      s.on('data', (d) => chunks.push(d));
      s.on('end', () => {
        const raw = Buffer.concat(chunks);
        const i = raw.indexOf('\r\n\r\n');
        if (i < 0) return reject(new Error('HTTP响应缺少头体分隔'));
        resolve(raw.slice(i + 4));
      });
      s.on('error', reject);
    };

    if (session.proxy) {
      const c = http.request({ host: session.proxy.host, port: session.proxy.port, method: 'CONNECT', path: `${session.host}:443` });
      c.on('connect', (_r, socket) => onSock(tls.connect({ socket, servername: session.host, rejectUnauthorized: false })));
      c.on('error', reject);
      c.end();
    } else {
      onSock(tls.connect({ host: session.host, port: 443, servername: session.host, rejectUnauthorized: false }));
    }
  });
}

module.exports = { sendEncryptedPost };
