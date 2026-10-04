#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget 小部件脚本：放到 ~/.shortcuts/ 下，桌面点一下 -> 粘链接 -> 自动下载到系统 Download
# 配合：F-Droid 安装 Termux:Widget + Termux:API；Termux 里 pkg install termux-api
cd ~/muse-wechat-bridge || exit 1
git pull -q 2>/dev/null

URL=""
if command -v termux-dialog >/dev/null 2>&1; then
  URL=$(termux-dialog text -t "粘贴视频号链接" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)
fi
if [ -z "$URL" ]; then
  read -p "粘贴视频号链接: " URL
fi
[ -z "$URL" ] && exit 0

./wxdl.sh "$URL"
command -v termux-toast >/dev/null 2>&1 && termux-toast "下载完成，去 Download 文件夹看"
