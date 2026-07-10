// QQ音乐 web 扫码登录流程: QR -> ptqrlogin -> check_sig -> OAuth code -> qm_keyst
const http = require('http');
const tls = require('tls');
const { URL } = require('url');
const { createCookieJar } = require('../session/cookieJar');
const { hash33 } = require('../session/qqSession');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const APPID = '716027609';
const DAID = '383';
const PT_3RD_AID = '100497308';
const U1 = 'https://graph.qq.com/oauth2.0/login_jump';
const REDIRECT_URI = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qrToken = (qrsig) => hash33(qrsig, 0);

function defaultProxyFromEnv(env = process.env) {
  return env.QQ_PROXY === 'none' ? null : { host: '127.0.0.1', port: 8085 };
}

function createRequester({ proxy = defaultProxyFromEnv(), jar = createCookieJar() } = {}) {
  function request(method, urlStr, { body = null, headers = {} } = {}) {
    const u = new URL(urlStr);
    return new Promise((resolve, reject) => {
      const base = {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'identity',
        Cookie: jar.header(),
        ...headers,
      };
      if (body != null) base['Content-Length'] = Buffer.byteLength(body);
      const path = u.pathname + u.search;
      const onSock = (sock) => {
        const hdr = `${method} ${path} HTTP/1.1\r\nHost: ${u.hostname}\r\n` +
          Object.entries(base).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
          `\r\nConnection: close\r\n\r\n`;
        sock.write(hdr);
        if (body != null) sock.write(body);
        const chunks = [];
        sock.on('data', (d) => chunks.push(d));
        sock.on('end', () => {
          const raw = Buffer.concat(chunks);
          const sep = raw.indexOf('\r\n\r\n');
          if (sep < 0) return reject(new Error('HTTP响应缺少头体分隔'));
          const head = raw.slice(0, sep).toString('latin1');
          const bodyBuf = raw.slice(sep + 4);
          const lines = head.split('\r\n');
          const status = parseInt(lines[0].split(' ')[1], 10);
          const headers = {};
          for (let i = 1; i < lines.length; i++) {
            const c = lines[i].indexOf(':');
            if (c < 0) continue;
            const k = lines[i].slice(0, c).toLowerCase().trim();
            const v = lines[i].slice(c + 1).trim();
            if (k === 'set-cookie') (headers[k] = headers[k] || []).push(v);
            else headers[k] = v;
          }
          jar.setCookiesFrom(headers);
          resolve({ status, headers, body: bodyBuf, location: headers.location });
        });
        sock.on('error', reject);
      };
      if (proxy) {
        const c = http.request({ host: proxy.host, port: proxy.port, method: 'CONNECT', path: `${u.hostname}:443` });
        c.on('connect', (_r, socket) => onSock(tls.connect({ socket, servername: u.hostname, rejectUnauthorized: false })));
        c.on('error', reject);
        c.end();
      } else {
        onSock(tls.connect({ host: u.hostname, port: 443, servername: u.hostname, rejectUnauthorized: false }));
      }
    });
  }

  async function follow(urlStr, max = 5) {
    let cur = urlStr;
    for (let i = 0; i < max; i++) {
      const r = await request('GET', cur, { headers: { Accept: 'text/html', Referer: 'https://xui.ptlogin2.qq.com/' } });
      if (r.status >= 300 && r.status < 400 && r.location) {
        cur = r.location.startsWith('http') ? r.location : new URL(r.location, cur).href;
        continue;
      }
      return r;
    }
    throw new Error('重定向次数过多');
  }

  return { request, follow, jar };
}

function unescapePtUrl(s) {
  if (!s) return s;
  return s.replace(/\\\//g, '/').replace(/\\x26/g, '&').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
}

async function step1Xlogin(ctx) {
  const url = `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${APPID}&daid=${DAID}` +
    `&style=33&hide_title_bar=1&hide_border=1&target=self` +
    `&s_url=${encodeURIComponent(U1)}&pt_3rd_aid=${PT_3RD_AID}&theme=2`;
  await ctx.request('GET', url, { headers: { Accept: 'text/html', Referer: 'https://graph.qq.com/' } });
  const loginSig = ctx.jar.get('pt_login_sig');
  if (!loginSig) throw new Error('未拿到 pt_login_sig, 无法继续');
  return loginSig;
}

async function step2Qrshow(ctx) {
  const t = Math.random();
  const url = `https://xui.ptlogin2.qq.com/ssl/ptqrshow?appid=${APPID}&e=2&l=M&s=3&d=72&v=4` +
    `&t=${t}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}&u1=${encodeURIComponent(U1)}`;
  const r = await ctx.request('GET', url, { headers: { Referer: 'https://xui.ptlogin2.qq.com/', Accept: 'image/*,*/*;q=0.8' } });
  const qrsig = ctx.jar.get('qrsig');
  if (!qrsig || r.body.length < 100) throw new Error('二维码获取失败');
  return { png: r.body, qrsig, ptqrtoken: qrToken(qrsig) };
}

async function step3Poll(ctx, loginSig, ptqrtoken, { onStatus } = {}) {
  const valid = 110;
  const started = Date.now();
  onStatus && onStatus({ type: 'waiting-scan', left: valid });
  for (let i = 0; i < 60; i++) {
    const left = valid - Math.floor((Date.now() - started) / 1000);
    const action = `0-0-${Date.now()}`;
    const url = `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?u1=${encodeURIComponent(U1)}` +
      `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
      `&action=${action}&js_ver=26030415&js_type=1&login_sig=${loginSig}` +
      `&pt_uistyle=40&aid=${APPID}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}&`;
    const r = await ctx.request('GET', url, { headers: { Referer: 'https://xui.ptlogin2.qq.com/' } });
    const text = r.body.toString('utf8');
    const m = text.match(/ptuiCB\((.*)\)/);
    const args = m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')) : [];
    const code = args[0];
    if (code === '0') {
      onStatus && onStatus({ type: 'success', nick: args[5] || '' });
      return unescapePtUrl(args[2]);
    }
    if (code === '65' || left <= 0) {
      onStatus && onStatus({ type: 'expired' });
      return null;
    }
    if (code === '67') onStatus && onStatus({ type: 'confirmed-waiting', left: Math.max(0, left) });
    else if (code === '66') onStatus && onStatus({ type: 'waiting-scan', left: Math.max(0, left) });
    await sleep(3000);
  }
  throw new Error('轮询超时');
}

async function step4CheckSig(ctx, checkSigUrl) {
  const r = await ctx.follow(checkSigUrl);
  if (!ctx.jar.get('p_skey')) throw new Error('未拿到 p_skey, check_sig 失败 (最终 status=' + r.status + ')');
  return { pSkey: ctx.jar.get('p_skey'), pUin: ctx.jar.get('p_uin') };
}

async function step5Authorize(ctx, pSkey) {
  const gtk = hash33(pSkey);
  const ui = (ctx.jar.get('ui') || '').toUpperCase() || '';
  const body = `response_type=code&client_id=${PT_3RD_AID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=get_user_info%2Cget_app_friends&state=state&switch=&from_ptlogin=1` +
    `&src=1&update_auth=1&openapi=1010_1030&g_tk=${gtk}&auth_time=${Date.now()}&ui=${ui}`;
  const r = await ctx.request('POST', 'https://graph.qq.com/oauth2.0/authorize', {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://graph.qq.com', Referer: 'https://graph.qq.com/', Accept: 'text/html' },
  });
  const loc = r.location || '';
  const m = loc.match(/[?&]code=([^&]+)/);
  if (!m) throw new Error('未拿到 OAuth code, Location=' + loc);
  return decodeURIComponent(m[1]);
}

async function step6Qqlogin(ctx, code) {
  const key = ctx.jar.get('qqmusic_key') || ctx.jar.get('p_skey') || ctx.jar.get('skey') || '';
  const bodyObj = {
    comm: { g_tk: hash33(key), platform: 'yqq', ct: 24, cv: 0 },
    req: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } },
  };
  const r = await ctx.request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
    body: JSON.stringify(bodyObj),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://y.qq.com', Referer: 'https://y.qq.com/', Accept: '*/*' },
  });
  const json = JSON.parse(r.body.toString('utf8'));
  const data = json.req && json.req.data;
  if (!data || !data.musickey) throw new Error('QQLogin 失败: ' + r.body.toString('utf8').slice(0, 200));
  return { uin: String(data.musicid), qmKeyst: data.musickey, expiresIn: data.keyExpiresIn };
}

async function runQrLogin({ proxy = defaultProxyFromEnv(), onQrPng, onStatus, maxRefresh = 5 } = {}) {
  const ctx = createRequester({ proxy });
  const loginSig = await step1Xlogin(ctx);
  let checkSigUrl = null;
  for (let attempt = 0; attempt < maxRefresh && !checkSigUrl; attempt++) {
    const qr = await step2Qrshow(ctx);
    onQrPng && onQrPng(qr.png, { attempt, qrsig: qr.qrsig, ptqrtoken: qr.ptqrtoken });
    checkSigUrl = await step3Poll(ctx, loginSig, qr.ptqrtoken, { onStatus });
  }
  if (!checkSigUrl) throw new Error('多次刷新仍未扫码, 退出');
  const { pSkey } = await step4CheckSig(ctx, checkSigUrl);
  const code = await step5Authorize(ctx, pSkey);
  return step6Qqlogin(ctx, code);
}

module.exports = {
  runQrLogin,
  createRequester,
  qrToken,
  unescapePtUrl,
};
