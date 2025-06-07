// Electron main process for the immersive roleplay chatbot
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Store for persistent settings
const store = new Store();

// Import server module
import server from './backend/server.js';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Create the main application window
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'frontend/assets/icon.png'),
    title: 'Immersive Roleplay Chatbot',
    backgroundColor: '#1e1e1e', // Dark background to prevent white flashing on startup
    show: false // Don't show until ready
  });

  // Load the app from the Express server
  mainWindow.loadURL('http://localhost:3000');

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready event
app.whenReady().then(() => {
  createWindow();

  // MacOS-specific behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On MacOS, applications keep running unless explicitly quit with Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC messages from the renderer process
ipcMain.handle('get-app-path', () => app.getPath('userData'));

// Export the mainWindow for potential use in other modules
export { mainWindow };
