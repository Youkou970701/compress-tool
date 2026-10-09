# 压缩工具

拖入文件即压缩，结果存在原文件旁边（`xxx-压缩.ext`），不覆盖原文件。

- 图片：sharp（jpg/png/webp/heic）
- 视频：内置 ffmpeg，设了目标大小会按时长反推码率
- PDF：需要 Ghostscript（`brew install ghostscript`）
- PPT/Word/Excel/ZIP：解包后重压内部图片和视频，再重新打包

运行：双击 `start.command`，或 `npm start`。核心测试：`node scripts/test.mjs <文件> [light|medium|strong] [目标MB]`。
Electron 下载慢时：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js`
