// 简易 cookie jar: 跨步骤累积 Cookie,空值不覆盖已有非空值
function createCookieJar() {
  const jar = {};

  function setCookiesFrom(headers) {
    const sc = headers['set-cookie'];
    if (!sc) return;
    for (const line of sc) {
      const kv = line.split(';')[0];
      const i = kv.indexOf('=');
      if (i < 0) continue;
      const k = kv.slice(0, i).trim();
      const v = kv.slice(i + 1).trim();
      if (!k) continue;
      // 同名 cookie 跨域下发时,不让空值覆盖已有非空值(p_skey 隔离机制会下发空 p_skey)
      if (v === '' && jar[k]) continue;
      jar[k] = v;
    }
  }

  function header() {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  function get(name) {
    return jar[name];
  }

  function set(name, value) {
    if (value === '' && jar[name]) return;
    jar[name] = value;
  }

  function entries() {
    return { ...jar };
  }

  return { setCookiesFrom, header, get, set, entries };
}

module.exports = { createCookieJar };
