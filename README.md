# qq-music-web-crypto

QQ 音乐 web 版(y.qq.com)请求加密/签名的独立 Node 实现,用于学习 JS VMP 逆向与 Web 加密分析。

`musicu.fcg`/`musics.fcg` 接口对请求体做 AES-GCM 加密、用 SHA-1 变换生成 `sign` 签名,加解密逻辑封装在 VMP(虚拟机保护)里。本项目把 VMP 引擎抽出,在 Node 中还原了完整的加密→签名→解密链路。

## 文件

| 文件 | 说明 |
|------|------|
| `qqcrypto.js` | 核心引擎,vm 沙箱加载两段 VMP,导出 `getSecuritySign` / `cgiEncrypt` / `cgiDecrypt` |
| `_sign_iife.js` | SHA-1 签名的 VMP 字节码(自包含) |
| `_enc_iife.js` | AES-GCM 加解密的 VMP 字节码(自包含) |
| `qqclient.js` | 通用客户端,`callQQ(module, method, param)` / `callBatch({...})` |
| `qqlogin.js` | 扫码登录脚本,自动换取 `QQ_UIN` / `QQ_KEYST` 并写回 `.env` |
| `docs/常用接口清单.md` | CDP 实操捕获的常用接口清单(搜索/播放/歌单/歌词/VIP 等) |

## 使用

```bash
# 1. 配置登录态:推荐扫码自动获取
QQ_PROXY=none node qqlogin.js

# 或复制示例后手动填入你自己的 QQ_UIN / QQ_KEYST
cp .env.example .env

# 2. 命令行调接口
QQ_PROXY=none node --env-file=.env qqclient.js music.search.SearchCgiService DoSearchForQQMusicDesktop "{\"query\":\"周杰伦\",\"num_per_page\":5,\"page_num\":1,\"search_type\":0,\"remoteplace\":\"yqq.yqq.yqq\"}"
```

```js
// 3. 作为模块
const { callQQ, callBatch } = require('./qqclient');
const r = await callQQ('music.search.SearchCgiService', 'DoSearchForQQMusicDesktop',
                       { query: '周杰伦', num_per_page: 10, page_num: 1, search_type: 0, remoteplace: 'yqq.yqq.yqq' });
```

登录态可由 `qqlogin.js` 扫码换取,也可从浏览器 Cookie 获取(`uin` / `qm_keyst`)后写入 `.env`。默认经本地代理 `127.0.0.1:8085` 发送;直连设 `QQ_PROXY=none`。

## 接口注意事项

- `g_tk` 对音乐 API 按 `hash33(qm_keyst)` 动态计算;匿名态自动退化为 `5381`。
- 播放接口 `music.vkey.GetEVkey/GetUrl` 的 `filename` 必须来自服务端/页面返回,不要手工拼接。
- 充值/付费走腾讯米大师(Midas)官方 H5 收银台;本项目不逆向下单参数,也不自动确认支付。
- 常用接口与实测参数见 `docs/常用接口清单.md`。

## 声明

仅用于技术学习与安全研究,请勿用于任何商业或侵犯版权用途。使用者需对自己的行为负责。
