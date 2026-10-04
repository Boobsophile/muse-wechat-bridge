/**
 * 微信 <-> Muse 胶水桥
 *
 * weixin-agent-sdk 负责微信收发，muse-client 负责跟 Muse 聊天。
 * 微信收到一句话 -> 发给我 -> 把回复扔回微信。
 *
 * 前置条件（只做一次）：
 *  1. Node.js >= 22（macOS 11+，Catalina 装不上官方 Node 22）
 *  2. npm install
 *  3. 配对：MUSE_SDK_TOKEN=你的token npm run pair
 *     token 在 Muse App -> Settings -> Devices -> Developer mode -> Add Device 获取
 *     配对要开蓝牙，手机和电脑最好在同一 Wi-Fi 下
 *
 * 运行：npm start，终端打出二维码后用微信扫码登录（建议用小号！）
 */

import { login, start, type Agent } from "weixin-agent-sdk";
import { MuseClient } from "muse-client";
import { loadCredentials, saveCredentials } from "muse-client/credentials";
import { writeFile } from "node:fs/promises";

// 视频号分享链接正则：https://weixin.qq.com/sph/xxxx
const WX_SPH_RE = /https?:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9]+/;

// 下载一条视频号视频，返回本地路径。跑在正常网络的机器上（非受限 VM）。
async function downloadWxVideo(
  shareUrl: string,
): Promise<{ path: string; title: string } | { error: string }> {
  const api = `https://api.bugpk.com/api/wxsph?url=${encodeURIComponent(shareUrl)}`;
  let j: any;
  try {
    j = await (await fetch(api)).json();
  } catch (err) {
    return { error: `解析接口请求失败：${String(err)}` };
  }
  if (j?.code !== 200 || !j?.data?.url) return { error: "解析失败，可能链接无效或接口限流" };

  const title: string =
    String(j.data.title || "wxvideo").trim().split("\n")[0].slice(0, 40) || "wxvideo";
  const safe = title.replace(/[/\\:*?"<>|]/g, "_") || "wxvideo";
  const path = `/tmp/${safe}.mp4`;

  const dl = await fetch(j.data.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40",
      Referer: "https://channels.weixin.qq.com/",
    },
  });
  if (!dl.ok || !dl.body) return { error: `视频下载失败（HTTP ${dl.status}）` };
  await writeFile(path, Buffer.from(await dl.arrayBuffer()));
  return { path, title };
}

// Muse 回复判停：收到第一个字之前最多等 60 秒（它在思考），
// 之后连续 8 秒没新字就当说完了。注意 subscribe() 不是按轮次结束的流，
// 不会自己关，必须手动 close()，否则订阅会越积越多。
const FIRST_DELTA_MS = 60000;
const IDLE_MS = 8000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 凭证目录：默认走系统默认位置；跑在手机/Termux 上时，
// 把 Mac 上配对好的凭证目录拷过来，用 MUSE_CREDENTIALS_DIR 指向它。
// Mac 默认：~/Library/Application Support/MuseGadgetPair/
const credentialsDir = process.env.MUSE_CREDENTIALS_DIR?.trim() || undefined;

const client = await MuseClient.connect({
  credentials: await loadCredentials(credentialsDir),
  onCredentials: (creds) => saveCredentials(creds, credentialsDir),
});

// 串行处理微信消息：同一时间只跟 Muse 聊一句，避免多个订阅打架
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function askMuse(text: string): Promise<string> {
  const events = await client.subscribe();
  let reply = "";
  let gotAny = false;
  let lastActivity = Date.now();

  const pump = (async () => {
    try {
      for await (const event of events) {
        const e = event as { event?: string; payload?: { text?: string } };
        if (e.event === "delta.text_append") {
          reply += String(e.payload?.text ?? "");
          gotAny = true;
          lastActivity = Date.now();
        }
      }
    } catch {
      // close() 会中断迭代，属正常
    }
  })();
  pump.catch(() => {});

  try {
    await client.sendMessage(text);
  } catch (err) {
    events.close();
    return `（发给 Muse 失败了：${String(err)}）`;
  }
  lastActivity = Date.now();

  // 等：有字之后静默 IDLE_MS 判说完；一直没字等 FIRST_DELTA_MS 就放弃
  for (;;) {
    await sleep(300);
    const quietFor = Date.now() - lastActivity;
    if (gotAny && quietFor >= IDLE_MS) break;
    if (!gotAny && quietFor >= FIRST_DELTA_MS) break;
  }
  events.close();
  await pump.catch(() => {});

  return reply.trim() || "（Muse 没回话，可能断连了，重启桥试试）";
}

const agent: Agent = {
  async chat(req) {
    return enqueue(async () => {
      const text = req.text?.trim() ?? "";

      // 视频号链接：直接下载并把视频文件发回微信（跟 X 上那哥们一样）
      const link = text.match(WX_SPH_RE)?.[0];
      if (link) {
        const r = await downloadWxVideo(link);
        if ("error" in r) return { text: `视频号下载失败：${r.error}` };
        return {
          text: `《${r.title}》下载完成`,
          media: { type: "video", url: r.path },
        };
      }

      // 文字消息：直接转给我
      if (text) {
        return { text: await askMuse(text) };
      }
      // 语音/图片/视频/文件：muse-client 只支持文字，先礼貌拒绝
      // 想支持语音的话，这里可以把 req.media.filePath（WAV）扔给 STT 转文字再发
      const kind =
        req.media?.type === "audio"
          ? "语音"
          : req.media?.type === "image"
            ? "图片"
            : req.media?.type === "video"
              ? "视频"
              : "文件";
      return { text: `收到一条${kind}，但我这版桥只会传文字，麻烦发文字哈` };
    });
  },
};

await login(); // 终端打出二维码，微信扫码登录
console.log("微信登录成功，开始收消息…");
const bot = start(agent);
await bot.wait();
