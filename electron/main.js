import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { fork } from 'child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow=null, serverProcess=null;
const DEFAULT_PORT=3000;
function getConfigPath(){return path.join(app.getPath('userData'),'cbopka-config.json');}
function loadConfig(){try{const p=getConfigPath(); if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));}catch{} return {};}
function saveConfig(c){try{fs.writeFileSync(getConfigPath(), JSON.stringify(c,null,2));}catch{}}
function getServerEntry(){if(app.isPackaged){const r=path.join(process.resourcesPath,'server','index.js'); if(fs.existsSync(r)) return r; return path.join(__dirname,'../server/index.js');} return path.join(__dirname,'../server/index.js');}
function getClientDist(){if(app.isPackaged){const r=path.join(process.resourcesPath,'client-dist'); if(fs.existsSync(r)) return r; return path.join(__dirname,'../client/dist');} return path.join(__dirname,'../client/dist');}
function startLocalServer(){
  const cfg=loadConfig();
  if(cfg.serverUrl && !cfg.serverUrl.includes('localhost') && !cfg.serverUrl.includes('127.0.0.1')) return Promise.resolve();
  const serverEntry=getServerEntry(); const clientDist=getClientDist();
  return new Promise((resolve,reject)=>{
    const env={...process.env, PORT:String(DEFAULT_PORT), CLIENT_DIST_PATH:clientDist, NODE_ENV:'production'};
    try{serverProcess=fork(serverEntry,[],{env, stdio:'pipe', cwd:path.dirname(serverEntry)});}catch(e){reject(e); return;}
    let started=false;
    const timeout=setTimeout(()=>{if(!started){started=true; resolve();}},4000);
    if(serverProcess.stdout) serverProcess.stdout.on('data',d=>{const msg=d.toString(); console.log('[server]',msg.trim()); if(msg.includes('Server running')&&!started){started=true; clearTimeout(timeout); resolve();}});
    if(serverProcess.stderr) serverProcess.stderr.on('data',d=>console.error('[server err]',d.toString().trim()));
    serverProcess.on('error',err=>{if(!started){clearTimeout(timeout); reject(err);}});
    serverProcess.on('exit',code=>{if(!started&&code!==0){clearTimeout(timeout); reject(new Error('Server exited '+code));}});
    setTimeout(()=>{if(!started){started=true; clearTimeout(timeout); resolve();}},2500);
  });
}
function createWindow(){
  const cfg=loadConfig();
  let targetUrl=`http://localhost:${DEFAULT_PORT}`;
  if(cfg.serverUrl) targetUrl=cfg.serverUrl;
  mainWindow=new BrowserWindow({width:1280,height:800,minWidth:900,minHeight:600,backgroundColor:'#0f0f12',title:'Cbopka',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false},autoHideMenuBar:true});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url); return {action:'deny'};});
  mainWindow.loadURL(targetUrl).catch(err=>{const indexPath=path.join(getClientDist(),'index.html'); if(fs.existsSync(indexPath)) mainWindow.loadFile(indexPath); else dialog.showErrorBox('Ошибка',`Не удалось загрузить ${targetUrl}\n${err.message}`);});
  mainWindow.webContents.on('did-finish-load',()=>{if(cfg.serverUrl) mainWindow.webContents.executeJavaScript(`window.CBOPKA_SERVER_URL='${cfg.serverUrl}'; localStorage.setItem('cb_server_url','${cfg.serverUrl}');`).catch(()=>{});});
}
app.whenReady().then(async()=>{
  ipcMain.handle('get-server-url',()=>{const cfg=loadConfig(); return cfg.serverUrl||'';});
  ipcMain.handle('set-server-url',(e,url)=>{const cfg=loadConfig(); if(url) cfg.serverUrl=url; else delete cfg.serverUrl; saveConfig(cfg); return cfg.serverUrl||'';});
  ipcMain.handle('get-version',()=>app.getVersion());
  try{await startLocalServer();}catch(e){console.error('Failed local server',e); const cfg=loadConfig(); if(!cfg.serverUrl) dialog.showErrorBox('Сервер не запустился',`Локальный сервер не запустился: ${e.message}`);}
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
app.on('before-quit',()=>{if(serverProcess) try{serverProcess.kill();}catch{}});
