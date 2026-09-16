const { app, BrowserWindow, shell } = require('electron');
const origin = process.env.NATIVOS_POS_TEST_URL || 'http://127.0.0.1:4311';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Invalid local POS URL');
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1440, height: 1000, minWidth: 390, minHeight: 640, show: !process.env.NATIVOS_POS_TEST_URL, backgroundColor: '#f4f7f5', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) { event.preventDefault(); if (url === 'http://127.0.0.1:4310/') void shell.openExternal(url); } });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.loadURL(origin).catch(() => {});
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });
});
app.on('window-all-closed', () => app.quit());
