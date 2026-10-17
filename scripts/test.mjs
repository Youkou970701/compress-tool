import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { compressFile, kindOf, MESSAGE_CODES } = require('../src/compress.js');
const [file, level, target] = process.argv.slice(2);
if (file) {
  const r = await compressFile(file, { level, targetMB: +target || 0 }, (p) => process.stderr.write(`\r${(p * 100).toFixed(0)}%`));
  console.log('\n', r, r.after && (r.before / r.after).toFixed(2) + 'x');
  process.exitCode = r.ok ? 0 : 1;
} else {
  const sharp = require('sharp');
  const JSZip = require('jszip');
  const { messages, resolveLanguage, translate } = require('../src/i18n.js');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-i18n-'));
  let passed = 0;
  const test = async (name, fn) => { await fn(); passed++; console.log(`✓ ${name}`); };
  const validResult = (result) => {
    assert.equal('note' in result, false);
    if (result.code) {
      assert.ok(MESSAGE_CODES.includes(result.code));
      for (const language of Object.keys(messages)) assert.ok(translate(language, result.code, result.params));
    }
    return result;
  };
  try {
    await test('language dictionaries have identical nonempty keys', () => {
      const expected = Object.keys(messages['zh-CN']).sort();
      assert.deepEqual(Object.keys(messages).sort(), ['en', 'ja', 'zh-CN']);
      for (const dictionary of Object.values(messages)) {
        assert.deepEqual(Object.keys(dictionary).sort(), expected);
        for (const value of Object.values(dictionary)) assert.ok(typeof value === 'string' && value.trim());
      }
      for (const value of Object.values(messages.en)) assert.doesNotMatch(value, /[\u3040-\u30ff\u4e00-\u9fff]/u);
      for (const key of expected) {
        assert.notEqual(messages.ja[key], messages['zh-CN'][key], key);
        const parameters = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        for (const language of ['en', 'ja']) assert.deepEqual(parameters(messages[language][key]), parameters(messages['zh-CN'][key]), key);
      }
    });
    await test('every core message code has all three translations', () => {
      assert.equal(new Set(MESSAGE_CODES).size, MESSAGE_CODES.length);
      for (const code of MESSAGE_CODES) {
        for (const language of Object.keys(messages)) assert.ok(messages[language][code]?.trim(), `${language}:${code}`);
      }
      const source = fs.readFileSync(path.join(root, 'src/compress.js'), 'utf8');
      for (const match of source.matchAll(/(?:code:\s*|res\.code\s*=\s*|failure\()'([^']+)'/g)) assert.ok(MESSAGE_CODES.includes(match[1]), match[1]);
    });
    await test('system locale selection and placeholder substitution', () => {
      for (const [locale, language] of [['zh-TW', 'zh-CN'], ['ZH-cn', 'zh-CN'], ['ja-JP', 'ja'], ['en-US', 'en'], ['fr-FR', 'en'], ['ko-KR', 'en'], ['', 'en']]) assert.equal(resolveLanguage(locale), language);
      for (const language of Object.keys(messages)) {
        assert.ok(translate(language, 'targetUnmetFonts', { fontMB: 17 }).includes('17'));
        assert.ok(translate(language, 'compressionFailed', { detail: 'RAW_DETAIL' }).includes('RAW_DETAIL'));
      }
    });
    await test('HTML contains no hardcoded Chinese or Japanese copy', () => {
      assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/index.html'), 'utf8'), /[\u3040-\u30ff\u4e00-\u9fff]/u);
    });
    const image = path.join(temp, 'portrait.jpg');
    await sharp(randomBytes(640 * 480 * 3), { raw: { width: 640, height: 480, channels: 3 } }).jpeg({ quality: 100 }).toFile(image);
    const original = fs.readFileSync(image);
    for (const [language, suffix] of [['zh-CN', '压缩'], ['en', 'compressed'], ['ja', '圧縮']]) {
      await test(`${language}: localized filename, collision numbering and source preservation`, async () => {
        const first = validResult(await compressFile(image, { language }));
        assert.equal(first.ok, true); assert.ok(first.after < first.before);
        assert.equal(path.basename(first.output), `portrait-${suffix}.jpg`);
        const contents = fs.readFileSync(first.output);
        const second = validResult(await compressFile(image, { language }));
        assert.equal(path.basename(second.output), `portrait-${suffix}2.jpg`);
        assert.deepEqual(fs.readFileSync(first.output), contents);
        assert.deepEqual(fs.readFileSync(image), original);
      });
    }
    await test('extension-changing image output reserves the final JPEG name', async () => {
      // The encoder reads magic bytes: a lossless synthetic PNG with a HEIC input name
      // exercises the HEIC-to-JPEG output path without a platform-dependent HEIC decoder.
      const input = path.join(temp, 'converted.heic');
      await sharp(randomBytes(320 * 240 * 3), { raw: { width: 320, height: 240, channels: 3 } }).png().toFile(input);
      const reserved = path.join(temp, 'converted-compressed.jpg'); fs.writeFileSync(reserved, 'keep original output');
      const result = validResult(await compressFile(input, { language: 'en' }));
      assert.equal(result.ok, true); assert.equal(path.basename(result.output), 'converted-compressed2.jpg');
      assert.equal(fs.readFileSync(reserved, 'utf8'), 'keep original output');
    });
    await test('MOV-to-MP4 output also numbers final-extension collisions', async () => {
      const input = path.join(temp, 'clip.mov');
      execFileSync(require('ffmpeg-static'), ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=10:duration=0.5', '-c:v', 'png', input]);
      const reserved = path.join(temp, 'clip-圧縮.mp4'); fs.writeFileSync(reserved, 'keep existing mp4');
      const result = validResult(await compressFile(input, { language: 'ja' }));
      assert.equal(result.ok, true); assert.equal(path.basename(result.output), 'clip-圧縮2.mp4');
      assert.equal(fs.readFileSync(reserved, 'utf8'), 'keep existing mp4');
    });
    await test('default language retains Chinese suffix', async () => {
      assert.equal(path.basename((await compressFile(image)).output), 'portrait-压缩3.jpg');
    });
    await test('target already satisfied returns code and no output', async () => {
      const result = validResult(await compressFile(image, { targetMB: 1000, language: 'en' }));
      assert.equal(result.code, 'targetSatisfied'); assert.equal(result.before, result.after); assert.equal(result.output, undefined);
    });
    await test('unreachable target returns localized limit code', async () => {
      const result = validResult(await compressFile(image, { targetMB: 0.000001 }));
      assert.equal(result.code, 'targetUnmet'); assert.ok(result.after > 1);
    });
    await test('unsupported and unreadable inputs return structured errors', async () => {
      const unknown = path.join(temp, 'input.txt'); fs.writeFileSync(unknown, 'test');
      assert.equal(validResult(await compressFile(unknown)).code, 'unsupportedType');
      assert.equal(validResult(await compressFile(path.join(temp, 'missing.jpg'))).code, 'compressionFailed');
      const broken = path.join(temp, 'broken.jpg'); fs.writeFileSync(broken, 'not an image');
      const result = validResult(await compressFile(broken));
      assert.equal(result.ok, false); assert.equal(result.code, 'compressionFailed'); assert.ok(result.params.detail);
    });
    await test('already minimal archive produces no duplicate output', async () => {
      const archive = path.join(temp, 'empty.zip');
      fs.writeFileSync(archive, await new JSZip().generateAsync({ type: 'nodebuffer' }));
      const result = validResult(await compressFile(archive));
      assert.equal(result.code, 'noSmallerOutput'); assert.equal(result.output, undefined);
    });
    await test('embedded font hint carries numeric fontMB and explicit removal remains optional', async () => {
      const zip = new JSZip(); zip.file('ppt/fonts/font.fntdata', randomBytes(2100000));
      zip.file('ppt/media/image.jpg', original); zip.file('ppt/presentation.xml', '<p:presentation><p:embeddedFontLst>font</p:embeddedFontLst></p:presentation>');
      const archive = path.join(temp, 'slides.pptx');
      fs.writeFileSync(archive, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
      const result = validResult(await compressFile(archive, { targetMB: 0.000001, language: 'en' }));
      assert.equal(result.code, 'targetUnmetFonts'); assert.equal(result.params.fontMB, 2);
      assert.ok((await JSZip.loadAsync(fs.readFileSync(result.output))).file('ppt/fonts/font.fntdata'));
      const stripped = validResult(await compressFile(archive, { removeFonts: true }));
      assert.equal((await JSZip.loadAsync(fs.readFileSync(stripped.output))).file('ppt/fonts/font.fntdata'), null);
    });
    await test('external ffmpeg and Ghostscript failures have translated prefixes and raw detail', async () => {
      const source = fs.readFileSync(path.join(root, 'src/compress.js'), 'utf8');
      const load = (gsPresent) => {
        const module = { exports: {} };
        const fakeFs = { ...fs, existsSync: (p) => /(?:^|[/\\])gs(?:win64c\.exe)?$/.test(p) ? gsPresent : fs.existsSync(p) };
        const fakeChild = {
          execFile: (_exe, args, options, callback) => {
            const cb = typeof options === 'function' ? options : callback;
            queueMicrotask(() => cb(new Error('RAW_TOOL_DETAIL'), '', args.includes('-sDEVICE=pdfwrite') ? 'RAW_GS_DETAIL' : ''));
          },
          spawn: () => {
            const handlers = {}; const child = { stderr: { on: (event, cb) => { if (event === 'data') queueMicrotask(() => cb('RAW_FFMPEG_DETAIL')); } }, stdout: { on() {} }, on: (event, cb) => { handlers[event] = cb; return child; } };
            queueMicrotask(() => queueMicrotask(() => handlers.close(1))); return child;
          },
        };
        vm.runInNewContext(source, { require: (name) => name === 'fs' ? fakeFs : name === 'child_process' ? fakeChild : require(name), module, exports: module.exports, __dirname: path.join(root, 'src'), process, Buffer, console });
        return module.exports;
      };
      const badVideo = path.join(temp, 'broken.mp4'); fs.writeFileSync(badVideo, 'broken');
      const videoResult = validResult(await load(true).compressFile(badVideo));
      assert.equal(videoResult.code, 'ffmpegFailed'); assert.equal(videoResult.params.detail, 'RAW_FFMPEG_DETAIL');
      const badPdf = path.join(temp, 'broken.pdf'); fs.writeFileSync(badPdf, 'broken');
      const pdfResult = validResult(await load(true).compressFile(badPdf));
      assert.equal(pdfResult.code, 'ghostscriptFailed'); assert.equal(pdfResult.params.detail, 'RAW_GS_DETAIL');
      assert.equal(validResult(await load(false).compressFile(badPdf)).code, 'ghostscriptMissing');
    });
    await test('supported extension classification is unchanged', () => {
      for (const [name, kind] of [['A.JPEG', 'image'], ['a.heic', 'image'], ['a.mp4', 'video'], ['a.pdf', 'pdf'], ['a.pptx', 'zip'], ['a.zip', 'zip'], ['a.txt', null]]) assert.equal(kindOf(name), kind);
    });
    console.log(`\n${passed}/${passed} tests passed`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
