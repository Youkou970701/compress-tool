const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { compressFile, kindOf } = require('./compress');

function createWindow() {
  const win = new BrowserWindow({
    width: 760, height: 640, minWidth: 600, minHeight: 480,
    titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('supported', (_, f) => !!kindOf(f));
ipcMain.handle('compress', async (e, { id, file, level, targetMB, removeFonts }) =>
  compressFile(file, { level, targetMB, removeFonts }, (p) => e.sender.send('progress', { id, p })));
ipcMain.handle('reveal', (_, f) => shell.showItemInFolder(f));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
