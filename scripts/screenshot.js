// Capture the same example files/results in each interface language.
// npx electron scripts/screenshot.js en|ja|zh-CN
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('node:os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'compress-i18n-'));
app.setPath('userData',profile);
process.on('exit',()=>fs.rmSync(profile,{recursive:true,force:true}));
const language = process.argv[2] || 'zh-CN';
if (!['zh-CN', 'en', 'ja'].includes(language)) throw new Error('Unsupported screenshot language');
process.env.COMPRESS_SCREENSHOT_LANG = language;
const demoNames = {
  'zh-CN': ['宣传视频.mp4', '作品集.zip', '分镜头脚本.docx', '投放方案.pdf'],
  en: ['promo-video.mp4', 'portfolio.zip', 'storyboard.docx', 'proposal.pdf'],
  ja: ['プロモーション動画.mp4', 'ポートフォリオ.zip', '絵コンテ.docx', '企画書.pdf'],
};
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ width: 760, height: 560, show: false, webPreferences: { contextIsolation: false, preload: path.join(__dirname, 'mock-preload.js') } });
    await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
    await win.webContents.executeJavaScript(`window.i18nReady`);
    await win.webContents.executeJavaScript(`
      setLanguage(${JSON.stringify(language)});
      const names = ${JSON.stringify(demoNames[language])};
      const demo = [
        [names[0], 157.7e6, 28.1e6, 82],
        [names[1], 22e6, 13.9e6, 37],
        [names[2], 4e6, 2.1e6, 48],
        [names[3], 7.3e6, 1.9e6, 74],
      ];
      const list = document.getElementById('list');
      for (const [name, before, after, percent] of demo) {
        const el = document.createElement('div'); el.className = 'row';
        el.innerHTML = '<div class="name"></div><div class="st ok"></div>';
        el.firstChild.textContent = name;
        el.querySelector('.st').textContent = t('savings', {before:fmt(before),after:fmt(after),percent});
        const a = document.createElement('a'); a.textContent = t('reveal'); el.querySelector('.st').appendChild(a);
        list.appendChild(el);
      }
      document.getElementById('target').value = 50;
      document.querySelectorAll('#level button').forEach(b => b.classList.toggle('on', b.dataset.v === 'medium'));
    `);
    await new Promise(resolve=>setTimeout(resolve,400));
    const image = await win.webContents.capturePage();
    const file = language === 'zh-CN' ? 'screenshot.png' : `screenshot-${language}.png`;
    fs.writeFileSync(path.join(__dirname, '..', 'docs', file), image.toPNG());
    console.log('Saved ' + file);
  } catch(error) { console.error(error); process.exitCode=1; }
  app.exit(process.exitCode || 0);
});
