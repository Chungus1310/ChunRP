// Utility to get correct app paths for both development and packaged environments
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if we're running in a packaged environment
function isPackaged() {
  // In packaged apps, __dirname will contain 'app.asar'
  // Also check for production environment or server deployment
  return __dirname.includes('app.asar') || 
         process.env.NODE_ENV === 'production' ||
         !process.env.npm_lifecycle_event; // Not running via npm script
}

// Get the correct data directory path
function getDataDirectory() {
  if (isPackaged()) {
    // Check if we're in an Electron environment
    if (process.resourcesPath) {
      // In packaged Electron mode, use the resources directory
      const resourcesPath = path.join(process.resourcesPath, 'data');
      
      // If data doesn't exist in resources, try userData
      if (!fs.existsSync(resourcesPath)) {
        // Fallback to userData directory - we'll handle this in initializeDataDirectory
        try {
          const { app } = require('electron');
          return path.join(app.getPath('userData'), 'data');
        } catch (e) {
          // If electron is not available, use process.env or a fallback
          const userDataPath = process.env.APPDATA || process.env.HOME || process.cwd();
          return path.join(userDataPath, 'ChunRP', 'data');
        }
      }
      
      return resourcesPath;
    } else {
      // In server/production mode without Electron
      // Use a data directory relative to the application or an environment variable
      const dataPath = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      return dataPath;
    }
  } else {
    // In development mode, use the project's data directory
    return path.join(__dirname, '../../data');
  }
}

// Get the correct database path
function getDatabasePath() {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'chunrp.db');
}

// Get memory storage path
function getMemoryStoragePath() {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'memory-vectra');
}

// Get characters directory path
function getCharactersPath() {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'characters');
}

// Get chat history directory path
function getChatHistoryPath() {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'chat-history');
}

// Get settings file path
function getSettingsPath() {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'settings.json');
}

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = getDataDirectory();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

// Copy initial data from resources to userData (for packaged apps)
async function initializeDataDirectory() {
  if (!isPackaged()) {
    return; // No need to copy in development
  }
  
  // Only try to copy if we're in an Electron environment with resourcesPath
  if (!process.resourcesPath) {
    return; // Not in Electron, skip copying
  }
  
  const userDataDir = getDataDirectory();
  const resourcesDataDir = path.join(process.resourcesPath, 'data');
  
  // Use promise-based access to avoid TOCTOU race
  try {
    await fs.promises.access(userDataDir);
    // Directory exists; nothing to do
  } catch {
    // User data dir missing – attempt copy or create
    try {
      await fs.promises.access(resourcesDataDir);
      console.log('Copying initial data from resources to user directory...');
      await fs.promises.cp(resourcesDataDir, userDataDir, { recursive: true });
      console.log('Initial data copied successfully');
    } catch (copyErr) {
      // Resources data missing; just create directory
      try {
        await fs.promises.mkdir(userDataDir, { recursive: true });
        console.log('Created empty user data directory');
      } catch (mkdirErr) {
        console.error('Failed to prepare user data directory:', mkdirErr);
      }
    }
  }
}

export {
  isPackaged,
  getDataDirectory,
  getDatabasePath,
  getMemoryStoragePath,
  getCharactersPath,
  getChatHistoryPath,
  getSettingsPath,
  ensureDataDirectory,
  initializeDataDirectory
};