// 压缩核心：纯 Node，无 Electron 依赖，可脱离界面直接测试。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const sharp = require('sharp');
const JSZip = require('jszip');

const FFMPEG = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
// 优先用打包进 app 的 Ghostscript（同事机器上不用装任何东西），开发时回退到 vendor/ 或系统安装
const GS_BIN = process.platform === 'win32' ? 'gswin64c.exe' : 'gs';
const GS_DIR = [process.resourcesPath && path.join(process.resourcesPath, 'gs'), path.join(__dirname, '..', 'vendor', 'gs')]
  .find((d) => d && fs.existsSync(path.join(d, GS_BIN)));
const GS = GS_DIR ? path.join(GS_DIR, GS_BIN) : ['/opt/homebrew/bin/gs', '/usr/local/bin/gs'].find((p) => fs.existsSync(p)) || null;
const GS_ARGS = GS_DIR ? [`-I${GS_DIR}/lib`, `-I${GS_DIR}/Resource/Init`, `-sGenericResourceDir=${GS_DIR}/Resource/`, `-sICCProfilesDir=${GS_DIR}/iccprofiles/`] : [];

const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff']);
const VID = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.avi', '.webm']);
const ZIPLIKE = new Set(['.zip', '.pptx', '.docx', '.xlsx', '.ppsx', '.potx']);

// 与访达/资源管理器一致：1 MB = 1000×1000 字节，避免「填 50 实际 52」
const MB = 1000 * 1000;

function kindOf(file) {
  const e = path.extname(file).toLowerCase();
  if (IMG.has(e)) return 'image';
  if (VID.has(e)) return 'video';
  if (e === '.pdf') return 'pdf';
  if (ZIPLIKE.has(e)) return 'zip';
  return null;
}

// 档位：质量 / 最长边 / 视频 CRF / PDF 预设
const LEVELS = {
  light: { q: 85, max: 3840, crf: 24, pdf: '/printer' },
  medium: { q: 72, max: 2560, crf: 28, pdf: '/ebook' },
  strong: { q: 55, max: 1600, crf: 33, pdf: '/screen' },
};
// 设了目标大小时，从轻到重逐档尝试
const LADDER = [
  { q: 85, max: 3840, crf: 24, pdf: '/printer', h: 2160 },
  { q: 75, max: 2560, crf: 28, pdf: '/ebook', h: 1440 },
  { q: 62, max: 1920, crf: 31, pdf: '/ebook', h: 1080 },
  { q: 50, max: 1600, crf: 34, pdf: '/screen', h: 720 },
  { q: 38, max: 1280, crf: 37, pdf: '/screen', h: 540 },
];

const tmp = (ext) => path.join(os.tmpdir(), `ct-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
const size = (f) => fs.statSync(f).size;

// ---------- 图片 ----------
async function encodeImage(input, out, ext, { q, max }) {
  let img = sharp(input, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  if (Math.max(meta.width || 0, meta.height || 0) > max) {
    img = img.resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true });
  }
  if (ext === '.png') img = img.png({ palette: true, quality: q, compressionLevel: 9, effort: 8 });
  else if (ext === '.webp') img = img.webp({ quality: q });
  else if (ext === '.heic') img = img.jpeg({ quality: q, mozjpeg: true });
  else if (ext === '.tif' || ext === '.tiff') img = img.tiff({ quality: q, compression: 'jpeg' });
  else img = img.jpeg({ quality: q, mozjpeg: true });
  await img.toFile(out);
}

async function compressImage(input, out, { level, targetBytes }) {
  const ext = path.extname(input).toLowerCase();
  const outExt = ext === '.heic' ? '.jpg' : ext;
  if (ext === '.heic') out = out.replace(/\.heic$/i, '.jpg');
  const steps = targetBytes ? LADDER : [LEVELS[level]];
  for (const s of steps) {
    await encodeImage(input, out, outExt, s);
    if (!targetBytes || size(out) <= targetBytes) break;
  }
  return out;
}

// ---------- 视频 ----------
function probeDuration(file) {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-i', file], (err, so, se) => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(se || '');
      resolve(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0);
    });
  });
}

function runFfmpeg(args, duration, onProgress) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', ...args]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.stdout.on('data', (d) => {
      const m = /out_time_us=(\d+)/.exec(String(d));
      if (m && duration) onProgress?.(Math.min(0.99, +m[1] / 1e6 / duration));
    });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg 失败: ' + err.slice(-300)))));
  });
}

async function compressVideo(input, out, { level, targetBytes }, onProgress) {
  const dur = await probeDuration(input);
  out = out.replace(/\.[^.]+$/, '.mp4');
  const base = ['-i', input, '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart'];
  if (targetBytes && dur) {
    // 按目标体积反推总码率（预留 4% 容器开销），音频固定 96k，分辨率随码率下降
    const total = (targetBytes * 0.96 * 8) / dur;
    const audio = 96000;
    const vb = Math.max(150000, total - audio);
    const h = vb > 4e6 ? 1080 : vb > 2e6 ? 900 : vb > 1e6 ? 720 : vb > 5e5 ? 540 : 360;
    await runFfmpeg([...base, '-vf', `scale=-2:'min(${h},ih)'`, '-b:v', String(Math.round(vb)),
      '-maxrate', String(Math.round(vb * 1.4)), '-bufsize', String(Math.round(vb * 2)), '-b:a', String(audio), out],
      dur, onProgress);
  } else {
    const l = LEVELS[level];
    await runFfmpeg([...base, '-crf', String(l.crf), '-vf', `scale=-2:'min(${level === 'strong' ? 720 : level === 'medium' ? 1080 : 2160},ih)'`,
      '-b:a', '128k', out], dur, onProgress);
  }
  return out;
}

// ---------- PDF ----------
function runGs(input, out, preset) {
  return new Promise((resolve, reject) => {
    execFile(GS, ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', `-dPDFSETTINGS=${preset}`, '-dNOPAUSE', '-dQUIET', '-dBATCH',
      '-dDetectDuplicateImages=true', '-dCompressFonts=true', ...GS_ARGS, `-sOutputFile=${out}`, input],
      { maxBuffer: 1 << 26 }, (e, so, se) => (e ? reject(new Error('Ghostscript 失败: ' + (se || e.message))) : resolve()));
  });
}

async function compressPdf(input, out, { level, targetBytes }) {
  if (!GS) throw new Error('未找到内置的 Ghostscript，请重新安装本应用');
  const presets = targetBytes ? ['/printer', '/ebook', '/screen'] : [LEVELS[level].pdf];
  for (const p of presets) {
    await runGs(input, out, p);
    if (!targetBytes || size(out) <= targetBytes) break;
  }
  return out;
}

// ---------- ZIP / Office ----------
async function recompressMedia(buf, name, step, onProgress) {
  const ext = path.extname(name).toLowerCase();
  const kind = kindOf(name);
  if (kind === 'image' && ext !== '.heic') {
    const i = tmp(ext), o = tmp(ext);
    fs.writeFileSync(i, buf);
    try {
      await encodeImage(i, o, ext, step);
      const nb = fs.readFileSync(o);
      return nb.length < buf.length ? nb : buf;
    } catch { return buf; } finally { fs.rmSync(i, { force: true }); fs.rmSync(o, { force: true }); }
  }
  if (kind === 'video') {
    const i = tmp(ext), o = tmp('.mp4');
    fs.writeFileSync(i, buf);
    try {
      const dur = await probeDuration(i);
      await runFfmpeg(['-i', i, '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-crf', String(step.crf),
        '-vf', `scale=-2:'min(${step.h},ih)'`, '-c:a', 'aac', '-b:a', '96k', o], dur);
      const nb = fs.readFileSync(o);
      // 压后扩展名必须和原文件一致，否则 Office 里的引用会断：只压同容器的 mp4/mov/m4v
      return nb.length < buf.length && ['.mp4', '.m4v'].includes(ext) ? nb : buf;
    } catch { return buf; } finally { fs.rmSync(i, { force: true }); fs.rmSync(o, { force: true }); }
  }
  return buf;
}

// 内嵌字体：pptx 的 ppt/fonts/*.fntdata、docx 的 word/fonts/*.odttf。体积可达几十 MB，
// 但移除后对方电脑缺字体时会换成默认字体，所以只在用户明确勾选时才删。
const FONT_RE = /^(ppt|word)\/fonts\//;
const fontBytes = (zip) => Object.keys(zip.files).filter((n) => FONT_RE.test(n))
  .reduce((a, n) => a + (zip.files[n]._data?.compressedSize || 0), 0);

async function stripEmbeddedFonts(zip) {
  for (const n of Object.keys(zip.files)) if (FONT_RE.test(n)) zip.remove(n);
  const edit = async (name, fn) => { const f = zip.file(name); if (f) zip.file(name, fn(await f.async('string'))); };
  // pptx：去掉 <p:embeddedFontLst> 及 presentation.xml.rels 里指向字体的关系
  await edit('ppt/presentation.xml', (x) => x.replace(/<p:embeddedFontLst>[\s\S]*?<\/p:embeddedFontLst>/g, ''));
  await edit('ppt/_rels/presentation.xml.rels', (x) => x.replace(/<Relationship\b[^>]*\/relationships\/font"[^>]*\/>/g, '').replace(/<Relationship\b[^>]*Target="fonts\/[^"]*"[^>]*\/>/g, ''));
  // docx：去掉 fontTable 里的 embed* 引用，并删掉它的关系文件
  await edit('word/fontTable.xml', (x) => x.replace(/<w:embed(Regular|Bold|Italic|BoldItalic)\b[^>]*\/>/g, ''));
  zip.remove('word/_rels/fontTable.xml.rels');
}

async function compressZip(input, out, { level, targetBytes, removeFonts, info }, onProgress) {
  const src = await JSZip.loadAsync(fs.readFileSync(input));
  if (removeFonts) await stripEmbeddedFonts(src);
  else if (info) info.fontBytes = fontBytes(src);
  const names = Object.keys(src.files).filter((n) => !src.files[n].dir);
  const steps = targetBytes ? LADDER : [{ ...LEVELS[level], h: { light: 2160, medium: 1080, strong: 720 }[level] }];
  const cache = new Map();
  for (let si = 0; si < steps.length; si++) {
    const dst = new JSZip();
    // 保持原始顺序（[Content_Types].xml / mimetype 等需要靠前）
    let done = 0;
    for (const n of names) {
      let data = await src.files[n].async('nodebuffer');
      data = await recompressMedia(data, n, steps[si], onProgress);
      dst.file(n, data, { date: src.files[n].date, compression: 'DEFLATE', compressionOptions: { level: 9 } });
      onProgress?.((si + done++ / names.length) / steps.length);
    }
    const buf = await dst.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    fs.writeFileSync(out, buf);
    if (!targetBytes || buf.length <= targetBytes) break;
  }
  return out;
}

// ---------- 入口 ----------
function outputPath(input) {
  const { dir, name, ext } = path.parse(input);
  let p = path.join(dir, `${name}-压缩${ext}`), i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${name}-压缩${i++}${ext}`);
  return p;
}

/**
 * opts: { level: 'light'|'medium'|'strong', targetMB?: number }
 * 返回 { ok, input, output?, before, after?, note? }；压不小则不产生输出文件。
 */
async function compressFile(input, opts = {}, onProgress) {
  const level = opts.level || 'medium';
  const targetBytes = opts.targetMB > 0 ? Math.floor(opts.targetMB * MB) : 0;
  const kind = kindOf(input);
  const before = size(input);
  if (!kind) return { ok: false, input, before, note: '不支持的文件类型' };
  if (targetBytes && before <= targetBytes) return { ok: true, input, before, after: before, note: '已满足目标大小，无需压缩' };

  const out = outputPath(input);
  const info = {};
  const tmpOut = tmp(path.extname(out) || '.bin');
  let produced;
  try {
    const o = { level, targetBytes, removeFonts: !!opts.removeFonts, info };
    if (kind === 'image') produced = await compressImage(input, tmpOut, o);
    else if (kind === 'video') produced = await compressVideo(input, tmpOut, o, onProgress);
    else if (kind === 'pdf') produced = await compressPdf(input, tmpOut, o);
    else produced = await compressZip(input, tmpOut, o, onProgress);
    const after = size(produced);
    if (after >= before) return { ok: true, input, before, after: before, note: '已经很小了，压缩后反而更大，未生成新文件' };
    const final = path.join(path.dirname(out), path.basename(out, path.extname(out)) + path.extname(produced));
    fs.copyFileSync(produced, final);
    const res = { ok: true, input, output: final, before, after };
    if (targetBytes && after > targetBytes) {
      res.note = '已压到当前方法的极限，仍未达到目标大小';
      if (info.fontBytes > 2 * MB) res.note += `。文件里内嵌字体占约 ${(info.fontBytes / MB).toFixed(0)} MB，勾选「移除内嵌字体」可继续压（对方电脑没有该字体时会换成默认字体）`;
    }
    return res;
  } catch (e) {
    return { ok: false, input, before, note: e.message };
  } finally {
    fs.rmSync(tmpOut, { force: true });
    if (produced && produced !== tmpOut) fs.rmSync(produced, { force: true });
  }
}

module.exports = { compressFile, kindOf };
