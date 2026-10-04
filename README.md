# 微信 <-> Muse 桥

wong2 那套「微信里用 Muse」的复刻：`weixin-agent-sdk` 管微信收发，`muse-client`（非官方 Muse SDK）管跟 Muse 聊天。

## 跑起来

```bash
npm install

# 1. 配对（只做一次，需 macOS + 蓝牙 + Xcode Command Line Tools）
MUSE_SDK_TOKEN=你的token npm run pair
#    token 获取：手机 Muse App -> Settings -> Devices -> Developer mode -> Add Device

# 2. 启动，微信扫码登录
npm start
```

然后给这个微信号发消息，就会收到 Muse 的回复。

## 微信里直接下视频号视频

桥里已内置：往微信里丢一条视频号分享链接（`weixin.qq.com/sph/…`），
桥会自动解析并下载，把 mp4 文件发回微信——跟 X 上 @404jsh 晒的那个机器人一模一样。

注意：下载这步要跑在**正常网络**的机器上（Mac/手机/服务器都行），
我这台受限 VM 下不了腾讯 CDN，所以别指望在我这跑。

## 注意事项

- **Node.js >= 22**：官方 Node 22 要求 macOS 11+，Catalina（10.15）装不上。
  Early 2015 的 Air 可以升到 Monterey（12），升完就能跑；或者找台新点的电脑/服务器跑。
- **微信建议用小号登录**：登录后，所有发给这个号的私聊都会被 Muse 回复，大号会被消息淹没。
- **配对时的网络**：手机要能访问 `hatch-api.meta.ai` 拿设备凭证，配对卡住先查网络/代理。
- **两个库都是非官方/逆向**：Meta 改协议、微信风控，都可能说挂就挂，别当生产环境用。
- muse-client 目前只支持**文字**聊天，不支持语音、附件、历史记录；微信语音消息会收到一条"只会传文字"的提示。
  真想做语音：在 `bridge.ts` 的 `req.media?.type === "audio"` 分支里，
  `req.media.filePath` 已经是转好的 WAV，扔给任意 STT 转文字再发就行。
- Muse 侧默认走**主会话**：所有微信好友的消息都会进同一个 Muse 对话串。
  想隔离的话可以用 muse-client 的 `sessionId` 给每个微信用户开 side chat（`subscribe` 和 `sendMessage` 都传同一个 `sessionId`）。

## 跑在手机上（Pixel / Android Termux）

配对必须在 macOS 上做一次（蓝牙配对是 macOS 专属），之后：

1. 把 Mac 上 `~/Library/Application Support/MuseGadgetPair/` 整个目录拷到手机
   （adb push、微信文件传输助手，任意方式都行）
2. 手机装 Termux，`pkg install nodejs`，`node --version` 确认 >= 22
3. 把本项目拷进 Termux，`npm install`
4. `MUSE_CREDENTIALS_DIR=/data/data/com.termux/files/home/凭证目录 npm start`
   终端打出二维码后截图 → 微信扫一扫 → 从相册选这张截图（建议用小号登录）
5. 保活：跑 `termux-wake-lock` 拿 wakelock，不然息屏后进程会被系统杀掉

这是玩玩级别的方案：长期挂着会耗电，Termux 的 Node 如果低于 22 也跑不了。
