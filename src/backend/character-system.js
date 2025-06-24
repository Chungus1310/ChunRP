// SQLite-based character system - migrated from JSON
// This file now uses SQLite database instead of JSON files
export {
  createCharacter,
  loadCharacter,
  loadAllCharacters,
  deleteCharacter,
  updateCharacter,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadSettings,
  saveSettings
} from './character-system-sqlite.js';
