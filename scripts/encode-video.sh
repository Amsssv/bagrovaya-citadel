#!/bin/sh
# Кадры scripts/record-video.js → ролик для карточки на Яндексе.
#
#   sh scripts/encode-video.sh <ru|en> <desktop|phone>
#
# Кадры сняты в 2×; уменьшение lanczos до 1920×1080 (ПК) или 1080×1920
# (телефон) — суперсэмплинг: края и текст глаже, чем при съёмке в 1×.
set -e
LANG_=${1:-ru}
KIND=${2:-desktop}
IN=.video/$LANG_-$KIND
if [ "$KIND" = desktop ]; then SIZE=1920:1080; NAME=horizontal; else SIZE=1080:1920; NAME=vertical; fi
OUT=art/catalog/video/$LANG_-$NAME.mp4
mkdir -p art/catalog/video
ffmpeg -v error -y -framerate 60 -i "$IN/%05d.png" \
  -vf "scale=$SIZE:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -preset veryslow -tune animation -crf 14 -profile:v high -level 4.2 \
  -r 60 -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=width,height,r_frame_rate,bit_rate -show_entries format=duration,size \
  -of compact=p=0 "$OUT"
