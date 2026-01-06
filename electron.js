const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;
let server;

function startServer() {
  // Set environment variable to indicate we're running in Electron
  process.env.ELECTRON = 'true';

  // Require and start the server directly
  // This works because Electron includes Node.js
  require('./src/server.js');

  console.log('Express server started in Electron');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'build', 'icon.ico')
  });

  // Wait for server to start, then load the UI
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 2000);

  // Remove default menu
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
