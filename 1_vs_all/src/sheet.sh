#!/bin/bash
# sheet.sh <A|B|C> — 검수 프레임 캡처 + 3x4 시트
S=$1; rm -f check/${S}_f*.png
F=$(ls ${S}_*.html | grep -v _end | head -1); node render.js $F check/${S}.png 0,40,75,120,150,195,240,258,275,330,350,390 2>&1 | grep -vE "^\s+at |^wrote" 
cd check && ls ${S}_f*.png | sed "s/^/file '/;s/$/'/" > ${S}_list.txt && ffmpeg -y -loglevel error -f concat -safe 0 -i ${S}_list.txt -vf "scale=640:-1,tile=3x4" -frames:v 1 ${S}_sheet.png && echo "sheet ${S} ok"
