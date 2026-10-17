# 三语界面验证（2026-10-17）

本次仅在 `i18n` 分支交付，版本为 0.2.0，不合并 main、不打 tag。

- `node scripts/test.mjs`：17/17 通过。包括三语字典键/非空/占位一致、英文无中日文字、日文不直接复制中文、9 种核心结果 code 均有译文、系统语言映射、HTML 无硬编码中日文、三语输出后缀与重名编号、转换扩展名后的重名保护、实际图片/视频/Office 压缩与结构化错误。
- `npm run test:ui`：Electron 实际加载界面，验证系统日语默认值、即时切换、已完成结果与错误重译、标题/占位/文件夹链接、语言传入压缩核心及重启恢复偏好。使用独立临时 profile，不改用户已有偏好。
- `npx electron scripts/screenshot.js en` / `ja`：生成 `docs/screenshot-en.png`、`docs/screenshot-ja.png`，已实际查看。沿用原中文截图的四个示例文件名及数字，界面说明和结果标签按所选语言显示。
- `git diff --check`：通过。Claude 的 README.md、README.en.md、README.ja.md 用 SHA-256 对照修改前副本，内容未改。

压缩算法和 productName、appId、安装包命名模板不变。主进程返回 code/params，渲染层按当前语言显示；外部工具原始报错只作为 detail 插入已翻译的前缀。
