// SQLite database layer for ChunRP
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, '../../data/chunrp.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
let db;

function initializeDatabase() {
  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    createTables();
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

function createTables() {
  // Settings table - stores app configuration as JSON
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Characters table - normalized character data
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      current_scenario TEXT DEFAULT '',
      persona TEXT DEFAULT '',
      appearance TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      first_message TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      settings_override TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      modified_at INTEGER NOT NULL
    )
  `);

  // Character relationships table
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      user_name TEXT NOT NULL DEFAULT 'User',
      status TEXT DEFAULT 'neutral',
      sentiment REAL DEFAULT 0.0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
      UNIQUE(character_id, user_name)
    )
  `);

  // Chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_character_timestamp 
    ON chat_messages(character_id, timestamp);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_character_relationships_character 
    ON character_relationships(character_id);
  `);
}

function getDatabase() {
  if (!db) {
    initializeDatabase();
  }
  return db;
}

// Close database connection
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Export database functions
export {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
