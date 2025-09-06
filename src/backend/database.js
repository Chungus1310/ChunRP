// SQLite database layer for ChunRP
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabasePath, ensureDataDirectory } from './app-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path - use the utility function
const DB_PATH = getDatabasePath();

// Ensure data directory exists
const dataDir = ensureDataDirectory();

// Initialize database connection
let db;

// The latest version of your database schema
const LATEST_SCHEMA_VERSION = 1;

function initializeDatabase() {
  try {    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Run schema creation and migration
  // Enforce foreign key constraints explicitly (Better-sqlite3 requires pragma)
  db.pragma('foreign_keys = ON');
  migrateSchema();

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

function migrateSchema() {
  // Get the current schema version from the database
  const versionPragma = db.prepare('PRAGMA user_version').get();
  let currentVersion = versionPragma.user_version;

  console.log(`Current database schema version: ${currentVersion}`);

  if (currentVersion < LATEST_SCHEMA_VERSION) {
    console.log(`Database schema is outdated. Migrating from v${currentVersion} to v${LATEST_SCHEMA_VERSION}...`);
    
    // --- Migration from v0 to v1 ---
    if (currentVersion < 1) {
      console.log('Applying migration v1: Adding last_journal_index to characters table...');
      try {
        // Create tables first (for new installations)
        createTablesV1(); 
        
        // Add the new column if the table already exists but the column doesn't
        // This handles existing databases. We wrap it in a transaction.
        const transaction = db.transaction(() => {
          try {
            db.exec('ALTER TABLE characters ADD COLUMN last_journal_index INTEGER DEFAULT 0');
            console.log('  -> Successfully added last_journal_index column.');
          } catch (error) {
            if (error.message.includes('duplicate column name')) {
              console.log('  -> Column last_journal_index already exists. Skipping.');
            } else {
              throw error; // Re-throw other errors
            }
          }
        });
        transaction();

      } catch (error) {
        console.error('  -> FAILED to apply migration v1:', error);
        // Stop migration if a step fails
        return;
      }
    }

    // --- Add future migrations here in `if (currentVersion < 2)` blocks ---

    // Update the database version to the latest
    db.prepare(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`).run();
    console.log(`Database schema migrated successfully to v${LATEST_SCHEMA_VERSION}.`);
  } else {
    // If this is a fresh install, the tables might not exist yet.
    // The createTablesV1 function uses IF NOT EXISTS, so it's safe to run.
    createTablesV1();
    console.log('Database schema is up to date.');
  }
}

// Renamed from createTables to reflect its version
function createTablesV1() {
  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Characters table - with the new column
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
      last_journal_index INTEGER DEFAULT 0,
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

  // Indexes
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
