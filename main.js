const { app, BrowserWindow, Menu, powerSaveBlocker } = require('electron');
const path = require('path');

// Exit combo: Ctrl + Alt (Option on Mac) + Shift + Q, all held together.
const isUnlockCombo = (i) =>
  i.type === 'keyDown' && i.control && i.alt && i.shift && i.code === 'KeyQ';

// `npm run dev` passes --windowed: normal window, no lockdown, devtools allowed.
const windowed = process.argv.includes('--windowed');

let win;
let unlocked = false;

if (!app.requestSingleInstanceLock()) app.exit(0);

function quit() {
  unlocked = true;
  app.quit();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    fullscreen: !windowed,
    kiosk: !windowed,
    alwaysOnTop: !windowed,
    autoHideMenuBar: true,
    backgroundColor: '#1b3a5c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: windowed,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  if (!windowed) win.setAlwaysOnTop(true, 'screen-saver');

  // Swallow every key before the page or OS menu sees it; forward key-downs to the UI.
  win.webContents.on('before-input-event', (e, input) => {
    e.preventDefault();
    if (isUnlockCombo(input)) return quit();
    if (input.type === 'keyDown') {
      win.webContents.send('key', { key: input.key, repeat: input.isAutoRepeat });
    }
  });

  win.on('close', (e) => { if (!unlocked) e.preventDefault(); });

  if (!windowed) {
    // If something steals focus (Alt+Tab, Win key), grab it back.
    const refocus = () => {
      if (unlocked) return;
      setTimeout(() => {
        if (unlocked) return;
        if (win.isMinimized()) win.restore();
        win.setKiosk(true);
        win.show();
        win.moveTop();
        win.focus();
      }, 150);
    };
    win.on('blur', refocus);
    win.on('minimize', refocus);
    win.on('hide', refocus);
    win.on('leave-full-screen', refocus);
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('did-finish-load', () => win.webContents.setVisualZoomLevelLimits(1, 1));
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // removes Cmd+Q / Cmd+W / reload accelerators
  powerSaveBlocker.start('prevent-display-sleep');
  createWindow();
});

app.on('before-quit', (e) => { if (!unlocked) e.preventDefault(); });
app.on('session-end', () => { unlocked = true; }); // let Windows shut down / log off
app.on('window-all-closed', () => app.quit());
