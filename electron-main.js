const { app, BrowserWindow, ipcMain } = require('electron');
const loudness = require('loudness');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('set-system-volume', async (event, volume) => {
  try {
    await loudness.setVolume(volume);
    event.reply('volume-set', 'success');
  } catch (error) {
    event.reply('volume-set', 'error: ' + error.message);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});