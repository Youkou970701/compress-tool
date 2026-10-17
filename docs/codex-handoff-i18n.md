# 交接：界面支持中文 / English / 日本語（2026-10-16，Claude）

目的：给国外用户用。Claude 已写好 `README.en.md`、`README.ja.md`，并在 `README.md` 顶部加了语言切换行。**这三个文件原样随本次提交，不要改**。

## 分支（重要）

**所有提交推到新分支 `i18n`，不要推 `main`**。README 和界面要在 Claude 验收后一起公开，验收通过后再合并进 `main`。
这些 README 引用的 `docs/screenshot-en.png`、`docs/screenshot-ja.png` 要由本次产出。界面没做完之前不能先发 README，否则老外下载后看到的全是中文。

## 要求

1. **三种语言**：`zh-CN`、`en`、`ja`。默认按系统语言选：`app.getLocale()` 以 `zh` 开头用中文，以 `ja` 开头用日文，其余一律英文。
2. **手动切换**：窗口右上角放一个小的语言选择（`中文 / EN / 日本語`），选择结果记住，下次启动沿用。切换后立即生效，不用重启。
3. **文案集中**：所有界面文字放进一份字典（例如 `src/i18n.js`，三种语言同一组 key），`index.html` 里不再写死中文。
4. **主进程的提示也要翻译**：`compress.js` 现在直接返回中文 `note` 和中文报错（「不支持的文件类型」「已满足目标大小，无需压缩」「已压到当前方法的极限…」「未找到内置的 Ghostscript…」等）。改成返回 `code` + 参数（例如 `{ code: 'fontHint', fontMB: 12 }`），由渲染进程按当前语言拼句子。ffmpeg、Ghostscript 原始报错的末尾片段可以保持原文，前缀要翻译。
5. **输出文件名后缀跟着语言**：`-压缩` / `-compressed` / `-圧縮`。重名时的编号规则不变。英文 README 写的就是 `name-compressed.ext`。
6. **译文用词**，和 README 保持一致：
   - 强度：轻度 / 标准 / 强力 → `Light / Standard / Strong` → `弱 / 標準 / 強`
   - 目标大小 → `Target size` → `目標サイズ`；占位「不限」→ `No limit` → `指定なし`
   - 移除内嵌字体 → `Remove embedded fonts` → `埋め込みフォントを削除`
   - 拖放区 → `Drop files here, or click to choose` → `ここにファイルをドロップ、またはクリックして選択`
   - 日文用「です・ます」体
7. **不改的东西**：`productName`（「压缩工具」）、安装包文件名、appId 都不动，改了会让老用户装出两份应用。
8. **截图**：用现有 `scripts/screenshot.js` 分别以 `en`、`ja` 出图，存成 `docs/screenshot-en.png`、`docs/screenshot-ja.png`，画面内容和现在的中文截图一致（同样的示例文件和结果）。
9. **版本**：`package.json` 升到 `0.2.0`。**不打 tag**，等 Claude 验收。

## 测试（加进现有测试脚本）

- 三种语言的 key 完全一致，没有缺漏、没有空字符串
- `en` 字典的所有值里不含任何中日文字（正则 `[\u3040-\u30ff\u4e00-\u9fff]`）
- `ja` 字典没有一条和 `zh-CN` 完全相同（防止漏翻直接复制中文）
- `compress.js` 返回的每个 `code` 都能在三种语言里找到对应文案
- 三种语言的输出文件名后缀各测一次，重名编号正常
- `index.html` 里不再出现中文（字典文件除外）

完成后提交并推送到 `i18n` 分支，告诉 Claude。不要合并进 `main`。
