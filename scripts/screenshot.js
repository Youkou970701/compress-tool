// 用 Electron 离屏渲染界面生成 README 截图（数字取自真实压缩测试，文件名为示意）：npx electron scripts/screenshot.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 560, show: false, webPreferences: { contextIsolation: false, preload: path.join(__dirname, 'mock-preload.js') } });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await win.webContents.executeJavaScript(`
    const demo = [
      ['宣传视频.mp4', '157.7 MB → 28.1 MB（省 82%）'],
      ['作品集.zip', '22.0 MB → 13.9 MB（省 37%）'],
      ['分镜头脚本.docx', '4.0 MB → 2.1 MB（省 48%）'],
      ['投放方案.pdf', '7.3 MB → 1.9 MB（省 74%）'],
    ];
    const list = document.getElementById('list');
    for (const [n, s] of demo) {
      const el = document.createElement('div'); el.className = 'row';
      el.innerHTML = '<div class="name"></div><div class="st ok"></div>';
      el.firstChild.textContent = n; el.querySelector('.st').textContent = s + ' ';
      const a = document.createElement('a'); a.textContent = '在访达中显示'; el.querySelector('.st').appendChild(a);
      list.appendChild(el);
    }
    document.getElementById('target').value = 50;
    document.querySelectorAll('#level button').forEach(b => b.classList.toggle('on', b.dataset.v === 'medium'));
  `);
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'screenshot.png'), img.toPNG());
  app.quit();
});
