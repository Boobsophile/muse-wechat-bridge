#!/bin/bash
# 视频号一键下载：./wxdl.sh "https://weixin.qq.com/sph/xxxx"
# 原理：调公开解析接口拿直链 -> curl 下载。需 curl + python3。
# 在 Termux 里：pkg install curl python
set -e
URL="$1"
[ -z "$URL" ] && { echo "用法：$0 <视频号分享链接>"; exit 1; }

ENC_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$URL")
JSON=$(curl -sk --max-time 35 "https://api.bugpk.com/api/wxsph?url=${ENC_URL}")

CODE=$(echo "$JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('code'))")
[ "$CODE" != "200" ] && { echo "解析失败：$JSON" | head -c 500; exit 1; }

TITLE=$(echo "$JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)['data']
t = (d.get('title') or 'wxvideo').strip().split(chr(10))[0][:40]
print(t)")
VURL=$(echo "$JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['url'])")
QUALITY=$(echo "$JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('quality',''))")

SAFE=$(echo "$TITLE" | tr '/\\:*?"<>|' '_' | sed 's/^[#. ]*//' | xargs)
OUT="${SAFE:-wxvideo}.mp4"
echo "标题：$TITLE（$QUALITY）"
echo "下载中…"
curl -L --max-time 600 -o "$OUT" "$VURL" \
  -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40" \
  -H "Referer: https://channels.weixin.qq.com/" \
  --retry 2 -w "完成：%{size_download} 字节，存为 $OUT\n"

# 自动拷一份到系统下载文件夹（Termux 下）
DL_DIR="/storage/emulated/0/Download"
if [ -d "$DL_DIR" ] && [ -w "$DL_DIR" ]; then
  cp -f "$OUT" "$DL_DIR/" && echo "已拷到下载文件夹：$DL_DIR/$OUT"
fi
