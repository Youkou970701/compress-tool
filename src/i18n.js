(function (root) {
  const messages = {
    'zh-CN': {
      appTitle: '压缩工具', languageName: '中文', languageLabel: '界面语言',
      drop: '把文件拖到这里，或点击选择', types: '图片 · 视频 · PDF · PPT / Word / Excel · ZIP，可多选',
      strength: '强度', light: '轻度', medium: '标准', strong: '强力', target: '目标大小', noLimit: '不限',
      removeFonts: '移除内嵌字体', fontHelp: 'PPT/Word 里嵌入的字体可能有几十 MB。移除后，对方电脑没有该字体时会显示成默认字体',
      targetHelp: '填了目标大小，会自动从轻到重逐档尝试', processing: '处理中…', failed: '失败',
      savings: '{before} → {after}（省 {percent}%）', reveal: '在文件夹中显示',
      unexpectedError: '操作失败：{detail}',
      unsupportedType: '不支持的文件类型', targetSatisfied: '已满足目标大小，无需压缩',
      noSmallerOutput: '已经很小了，压缩后反而更大，未生成新文件',
      targetUnmet: '已压到当前方法的极限，仍未达到目标大小',
      targetUnmetFonts: '已压到当前方法的极限，仍未达到目标大小。文件里内嵌字体占约 {fontMB} MB，勾选「移除内嵌字体」可继续压（对方电脑没有该字体时会换成默认字体）',
      ffmpegFailed: 'ffmpeg 失败：{detail}', ghostscriptFailed: 'Ghostscript 失败：{detail}',
      ghostscriptMissing: '未找到内置的 Ghostscript，请重新安装本应用', compressionFailed: '压缩失败：{detail}'
    },
    en: {
      appTitle: 'Compression Tool', languageName: 'EN', languageLabel: 'Interface language',
      drop: 'Drop files here, or click to choose', types: 'Images · Videos · PDF · PPT / Word / Excel · ZIP; multiple files supported',
      strength: 'Strength', light: 'Light', medium: 'Standard', strong: 'Strong', target: 'Target size', noLimit: 'No limit',
      removeFonts: 'Remove embedded fonts', fontHelp: 'Embedded fonts in PPT/Word can take tens of MB. Removing them may substitute default fonts on computers without the originals.',
      targetHelp: 'With a target size, compression automatically tries light to strong settings.', processing: 'Processing…', failed: 'Failed',
      savings: '{before} → {after} ({percent}% saved)', reveal: 'Show in folder',
      unexpectedError: 'Operation failed: {detail}',
      unsupportedType: 'Unsupported file type', targetSatisfied: 'Already within the target size; no compression needed.',
      noSmallerOutput: 'Already small; compression would make it larger. No new file was created.',
      targetUnmet: 'The current method reached its limit, but the target size was not met.',
      targetUnmetFonts: 'The current method reached its limit, but the target size was not met. Embedded fonts take about {fontMB} MB. Try Remove embedded fonts; computers without those fonts will use default fonts instead.',
      ffmpegFailed: 'ffmpeg failed: {detail}', ghostscriptFailed: 'Ghostscript failed: {detail}',
      ghostscriptMissing: 'Bundled Ghostscript was not found. Please reinstall this app.', compressionFailed: 'Compression failed: {detail}'
    },
    ja: {
      appTitle: '圧縮ツール', languageName: '日本語', languageLabel: '表示言語',
      drop: 'ここにファイルをドロップ、またはクリックして選択', types: '画像 · 動画 · PDF · PPT / Word / Excel · ZIP（複数選択できます）',
      strength: '圧縮レベル', light: '弱', medium: '標準', strong: '強', target: '目標サイズ', noLimit: '指定なし',
      removeFonts: '埋め込みフォントを削除', fontHelp: 'PPT/Word の埋め込みフォントは数十 MB になる場合があります。削除すると、同じフォントがないパソコンでは既定のフォントに置き換わります。',
      targetHelp: '目標サイズを指定すると、弱い設定から強い設定へ順番に試します。', processing: '処理中です…', failed: '失敗しました',
      savings: '{before} → {after}（{percent}% 削減）', reveal: 'フォルダーで表示',
      unexpectedError: '操作に失敗しました：{detail}',
      unsupportedType: 'このファイル形式には対応していません。', targetSatisfied: 'すでに目標サイズ以下です。圧縮は必要ありません。',
      noSmallerOutput: 'すでに小さいファイルです。圧縮すると大きくなるため、新しいファイルは作成しませんでした。',
      targetUnmet: '現在の方法ではこれ以上圧縮できません。目標サイズには達していません。',
      targetUnmetFonts: '現在の方法ではこれ以上圧縮できません。目標サイズには達していません。埋め込みフォントが約 {fontMB} MB あります。「埋め込みフォントを削除」をお試しください。同じフォントがないパソコンでは既定のフォントに置き換わります。',
      ffmpegFailed: 'ffmpeg の処理に失敗しました：{detail}', ghostscriptFailed: 'Ghostscript の処理に失敗しました：{detail}',
      ghostscriptMissing: '内蔵の Ghostscript が見つかりません。アプリを再インストールしてください。', compressionFailed: '圧縮に失敗しました：{detail}'
    }
  };
  function resolveLanguage(locale) {
    const value = String(locale || '').toLowerCase();
    return value.startsWith('zh') ? 'zh-CN' : value.startsWith('ja') ? 'ja' : 'en';
  }
  function translate(language, key, params = {}) {
    const template = messages[language]?.[key];
    if (template === undefined) throw new Error('Unknown translation key: ' + key);
    return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
  }
  const api = { messages, resolveLanguage, translate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
