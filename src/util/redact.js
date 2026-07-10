// 敏感信息脱敏工具: 用于日志/验证输出,避免泄露登录态与播放凭证
const SECRET_KEYS = /qm_keyst|qqmusic_key|keyst|vkey|purl|p_skey|skey|cookie|authst|psrf/i;

function maskString(s) {
  if (typeof s !== 'string' || s.length <= 8) return '***';
  return s.slice(0, 3) + '***' + s.slice(-2);
}

function maskUin(uin) {
  const s = String(uin || '');
  if (s.length <= 4) return '***';
  return s.slice(0, 3) + '***' + s.slice(-3);
}

// 深拷贝并脱敏敏感字段(按 key 名匹配)
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.test(k)) out[k] = typeof v === 'string' ? maskString(v) : '***';
      else out[k] = redact(v);
    }
    return out;
  }
  return value;
}

module.exports = { redact, maskString, maskUin, SECRET_KEYS };
