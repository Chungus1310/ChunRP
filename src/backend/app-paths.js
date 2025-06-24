// Utility to get correct app paths for both development and packaged environments
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if we're running in a packaged environment
function isPackaged() {
  // In packaged apps, __dirname will contain 'app.asar'
  return __dirname.includes('app.asar') || process.env.NODE_ENV === 'production';
}

// Get the correct data directory path
function getDataDirectory() {
  if (isPackaged()) {
    // In packaged mode, use the resources directory
    // app.asar is in resources/, so we go up to resources/ then to data/
    const resourcesPath = path.join(process.resourcesPath, 'data');
    
    // If data doesn't exist in resources, try userData
    if (!fs.existsSync(resourcesPath)) {
      // Fallback to userData directory - we'll handle this in initializeDataDirectory
      // For now, create in a temp location and move later
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
  
  const userDataDir = getDataDirectory();
  const resourcesDataDir = path.join(process.resourcesPath, 'data');
  
  // If userData data directory doesn't exist and resources data does
  if (!fs.existsSync(userDataDir) && fs.existsSync(resourcesDataDir)) {
    console.log('Copying initial data from resources to user directory...');
    try {
      fs.cpSync(resourcesDataDir, userDataDir, { recursive: true });
      console.log('Initial data copied successfully');
    } catch (error) {
      console.error('Failed to copy initial data:', error);
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
