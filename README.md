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

## 使用

```bash
# 1. 配置登录态
cp .env.example .env    # 填入你自己的 QQ_UIN / QQ_KEYST

# 2. 命令行调接口
node --env-file=.env qqclient.js music.search.SearchCgiService DoSearchForQQMusicDesktop "{\"query\":\"周杰伦\",\"num_per_page\":5,\"page_num\":1,\"search_type\":0,\"grp\":1}"
```

```js
// 3. 作为模块
const { callQQ, callBatch } = require('./qqclient');
const r = await callQQ('music.search.SearchCgiService', 'DoSearchForQQMusicDesktop',
                       { query: '周杰伦', num_per_page: 10, page_num: 1, search_type: 0, grp: 1 });
```

登录态从浏览器 Cookie 获取(`uin` / `qm_keyst`),写入 `.env`。默认经本地代理 `127.0.0.1:8085` 发送;直连设 `QQ_PROXY=none`。

## 声明

仅用于技术学习与安全研究,请勿用于任何商业或侵犯版权用途。使用者需对自己的行为负责。
