#!/bin/bash
# Windows runner 上（git-bash）：choco 装好 Ghostscript 后拷进 vendor/gs
set -e
cd "$(dirname "$0")/.."
GSROOT=$(ls -d "/c/Program Files/gs/gs"* | sort | tail -1)
rm -rf vendor/gs && mkdir -p vendor/gs
cp "$GSROOT/bin/gswin64c.exe" "$GSROOT/bin/gsdll64.dll" vendor/gs/
for d in Resource iccprofiles lib; do cp -R "$GSROOT/$d" vendor/gs/$d; done
