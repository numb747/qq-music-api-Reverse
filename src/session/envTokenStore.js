// .env 登录态读写: 保留其它配置行,只更新 QQ_UIN / QQ_KEYST / QQ_PROXY
const fs = require('fs');

function readEnvFile(path = '.env') {
  const env = {};
  try {
    fs.readFileSync(path, 'utf8').split(/\r?\n/).forEach((l) => {
      const i = l.indexOf('=');
      if (i > 0) env[l.slice(0, i)] = l.slice(i + 1);
    });
  } catch (_) {}
  return env;
}

function writeEnvToken({ uin, qmKeyst }, path = '.env') {
  const env = readEnvFile(path);
  env.QQ_UIN = uin;
  env.QQ_KEYST = qmKeyst;
  if (!('QQ_PROXY' in env)) env.QQ_PROXY = '';
  fs.writeFileSync(path, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

module.exports = { readEnvFile, writeEnvToken };
