/**
 * 一次性配对：把这台电脑注册成 Muse 的 gadget 设备。
 *
 * 用法：MUSE_SDK_TOKEN=你的token npm run pair
 *
 * 流程（跟官方 gadget 配对一样）：
 *  1. 在这里粘贴 SDK token，回车，允许蓝牙访问
 *  2. 手机 Muse App -> Settings -> Devices -> Developer mode -> Add Device
 *  3. 选中终端打印出来的 MuseGadgetXXXXXX，确认
 *  4. 等待 Paired successfully
 *
 * 配对要在 macOS 上做（需要蓝牙 + Xcode Command Line Tools）。
 * 凭证默认存到 ~/Library/Application Support/MuseGadgetPair/，
 * 配对一次就行，以后 npm start 直接用。
 */

import { pairMacOS } from "muse-client/pairing";

const sdkToken = process.env.MUSE_SDK_TOKEN?.trim();
if (!sdkToken) {
  console.error("请先设置 MUSE_SDK_TOKEN 环境变量再配对");
  process.exit(1);
}

await pairMacOS({ sdkToken, onProgress: console.log });
console.log("配对成功！以后直接 npm start 就行。");
