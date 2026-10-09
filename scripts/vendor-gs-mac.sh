#!/bin/bash
# 把 Ghostscript 连同依赖库打进 vendor/gs（需要 brew install ghostscript dylibbundler）
set -e
cd "$(dirname "$0")/.."
GSV=$(brew --prefix ghostscript)
rm -rf vendor/gs && mkdir -p vendor/gs/libs
cp "$(readlink -f "$GSV/bin/gs")" vendor/gs/gs && chmod u+w vendor/gs/gs
dylibbundler -b -x vendor/gs/gs -d vendor/gs/libs -p @executable_path/libs -cd -of
for d in Resource iccprofiles lib; do cp -R "$(brew --prefix)/share/ghostscript/$d" vendor/gs/$d; done
