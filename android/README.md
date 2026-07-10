# QQ音乐客户端 Android MVP (Demo)

一个最小 Android 前端,通过**本地协议网关**调用仓库根目录的 QQ音乐 web 协议内核,验证「搜索 → 选歌 → 播放地址解析 → VIP 官方入口」闭环。

> 仅用于技术学习与安全研究。播放不破解、不绕过权限;充值只跳官方米大师 H5。

## 架构

```
Compose UI (feature/search, player, vip)
        │
   MusicRepository (data/)
        │  HTTP JSON
GatewayApi (core/network) ──▶ 本地协议网关 src/server/protocolServer.js
                                      │
                            协议内核 src/*(sign/encrypt/session/domain)
                                      │
                                QQ音乐 web musics.fcg
```

Android 侧**不含**任何加密/签名逻辑,全部委托给本地网关。等 MVP 稳定后再评估把 CryptoEngine 迁到 WebView/QuickJS/原生。

## 技术栈

- Kotlin + Jetpack Compose (Material3)
- AndroidX Media3 / ExoPlayer(播放 `sip + purl`)
- OkHttp + kotlinx.serialization
- Chrome Custom Tabs(打开官方 VIP/Midas 页面)

## 运行前置

1. 在仓库根目录启动协议网关:

   ```bash
   QQ_PROXY=none node --env-file=.env src/server/protocolServer.js
   # 默认 127.0.0.1:5178
   ```

2. 配置网关地址(`app/build.gradle.kts` 的 `GATEWAY_BASE_URL`):
   - Android 模拟器访问宿主机:`http://10.0.2.2:5178`(默认)
   - 真机:改成宿主机局域网 IP,如 `http://192.168.x.x:5178`

3. 用 Android Studio 打开 `android/` 目录构建运行(首次会自动下载 Gradle wrapper;若无 wrapper,用本机 Gradle 8.7+ 或 Android Studio 生成)。

## 已实现(MVP 骨架)

- 搜索页:调用 `/api/search/songs` 展示歌曲列表。
- 播放:点歌 → `/api/song/playable`(网关取 `vs` 拼 filename、按音质降级)→ Media3 播放 `sip + purl`。
- VIP 入口:Custom Tabs 打开官方 `vipportal`。

## 待接续

- 歌词页 `/api/lyric`(Repository 已就绪)、歌单页 `/api/playlist/detail`。
- 播放队列、通知栏控制、后台服务(MediaSessionService)。
- 登录态管理(扫码/导入)与安全存储。

## 说明

- filename = 音质前缀 + `song.vs[0]` + 扩展名(实证规则,见根目录 `docs/常用接口清单.md`)。客户端不自行猜测,由网关 `/api/song/playable` 统一处理。
- 明文 HTTP 仅为本地开发放开(见 `res/xml/network_security_config.xml`)。
