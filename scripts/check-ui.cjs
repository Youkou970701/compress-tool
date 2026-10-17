const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'compress-i18n-'));
app.setPath('userData',profile);
process.on('exit',()=>fs.rmSync(profile,{recursive:true,force:true}));
process.env.COMPRESS_SCREENSHOT_LANG='ja';
app.whenReady().then(async()=>{
  const win = new BrowserWindow({show:false,width:760,height:560,webPreferences:{contextIsolation:false,preload:path.join(__dirname,'mock-preload.js')}});
  const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message)});
  try{
    await win.loadFile(path.join(__dirname,'../src/index.html'));
    await win.webContents.executeJavaScript('window.i18nReady');
    await win.webContents.executeJavaScript(`(async()=>{
      function check(ok,message){if(!ok)throw new Error(message)}
      check(document.documentElement.lang==='ja','System locale selects Japanese');
      localStorage.removeItem('compressLang');
      check(document.title===t('appTitle'),'Translated title');
      let requested;
      api.compress=async options=>{requested=options;return {ok:true,before:2000000,after:1000000,output:'/tmp/demo-compressed.png',code:'targetSatisfied',params:{}}};
      add(['/tmp/demo.png']);
      while(busy)await new Promise(r=>setTimeout(r,10));
      check(requested.language==='ja','Core receives current language');
      setLanguage('en',true);
      check(document.querySelector('.note').textContent===t('targetSatisfied'),'Existing result translated immediately');
      check(document.querySelector('.st a').textContent===t('reveal'),'Reveal link translated');
      check(document.getElementById('target').placeholder==='No limit','Placeholder translated');
      check(localStorage.getItem('compressLang')==='en','Language persisted');
      check(document.querySelector('.name').textContent==='demo.png','File names preserved');
      api.compress=async()=>({ok:false,code:'unexpectedError',params:{detail:'raw detail'}});
      add(['/tmp/failure.png']);while(busy)await new Promise(r=>setTimeout(r,10));
      setLanguage('ja');
      check(rows[2].st.textContent===t('failed'),'Failure status translated');
      check(rows[2].el.querySelector('.note').textContent===t('unexpectedError',{detail:'raw detail'}),'Raw error with localized prefix');
    })()`);
    const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    win.reload();
    await reloaded;
    await win.webContents.executeJavaScript('window.i18nReady');
    const saved=await win.webContents.executeJavaScript('document.documentElement.lang');
    if(saved!=='en')throw new Error('Saved language not restored');
    if(errors.length)throw new Error(errors.join('\n'));
    await win.webContents.executeJavaScript("localStorage.removeItem('compressLang')");
    console.log('✓ Electron language switch, result/error retranslation, persistence and locale checks');
  }catch(error){console.error(error);process.exitCode=1}
  app.exit(process.exitCode || 0);
});
