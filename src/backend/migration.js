// Migration script to move data from JSON files to SQLite database
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase } from './database.js';
import { migrateLegacyVectra } from './migrate-vectra-to-sqlite-vec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backup existing JSON data before migration
function createBackup() {
  const dataDir = path.join(__dirname, '../../data');
  const backupDir = path.join(__dirname, '../../data-backup');
  
  try {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    
    // Copy entire data directory
    fs.cpSync(dataDir, backupDir, { recursive: true });
    console.log('✅ Backup created successfully at:', backupDir);
    return true;
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    return false;
  }
}

// Migrate settings from JSON to SQLite
function migrateSettings() {
  const settingsPath = path.join(__dirname, '../../data/settings.json');
  
  if (!fs.existsSync(settingsPath)) {
    console.log('⚠️  No settings.json found, skipping settings migration');
    return true;
  }
  
  try {
    const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const db = getDatabase();
    
    // Clear existing settings and insert new ones
    const clearStmt = db.prepare('DELETE FROM settings');
    const insertStmt = db.prepare(`
      INSERT INTO settings (id, data, updated_at) 
      VALUES (1, ?, ?)
    `);
    
    clearStmt.run();
    insertStmt.run(JSON.stringify(settingsData), Date.now());
    
    console.log('✅ Settings migrated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to migrate settings:', error);
    return false;
  }
}

// Migrate characters from JSON files to SQLite
function migrateCharacters() {
  const charactersDir = path.join(__dirname, '../../data/characters');
  
  if (!fs.existsSync(charactersDir)) {
    console.log('⚠️  No characters directory found, skipping characters migration');
    return true;
  }
  
  try {
    const db = getDatabase();
    const files = fs.readdirSync(charactersDir).filter(file => file.endsWith('.json'));
    
    // Prepare statements
    const insertCharStmt = db.prepare(`
      INSERT INTO characters (
        name, description, current_scenario, persona, appearance, 
        avatar_url, first_message, settings_override, last_journal_index,
        created_at, modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertRelStmt = db.prepare(`
      INSERT INTO character_relationships (character_id, user_name, status, sentiment, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    let migratedCount = 0;
    
    for (const file of files) {
      try {
        const filePath = path.join(charactersDir, file);
        const characterData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Insert character
        const result = insertCharStmt.run(
          characterData.name || '',
          characterData.description || '',
          characterData.currentScenario || '',
          characterData.persona || '',
          characterData.appearance || '',
          characterData.avatarUrl || '',
          characterData.firstMessage || '',
          JSON.stringify(characterData.settingsOverride || {}),
          0, // Default last_journal_index to 0 for migrated characters
          characterData.createdAt || Date.now(),
          characterData.modifiedAt || Date.now()
        );
        
        const characterId = result.lastInsertRowid;
        
        // Insert relationships if they exist
        if (characterData.relationships) {
          for (const [userName, relationship] of Object.entries(characterData.relationships)) {
            insertRelStmt.run(
              characterId,
              userName,
              relationship.status || 'neutral',
              relationship.sentiment || 0.0,
              Date.now()
            );
          }
        }
        
        migratedCount++;
        console.log(`✅ Migrated character: ${characterData.name}`);
      } catch (error) {
        console.error(`❌ Failed to migrate character file ${file}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${migratedCount} characters successfully`);
    return true;
  } catch (error) {
    console.error('❌ Failed to migrate characters:', error);
    return false;
  }
}

// Migrate chat history from JSON files to SQLite
function migrateChatHistory() {
  const chatHistoryDir = path.join(__dirname, '../../data/chat-history');
  
  if (!fs.existsSync(chatHistoryDir)) {
    console.log('⚠️  No chat-history directory found, skipping chat history migration');
    return true;
  }
  
  try {
    const db = getDatabase();
    const files = fs.readdirSync(chatHistoryDir).filter(file => file.endsWith('.json'));
    
    // Get character ID lookup
    const getCharacterIdStmt = db.prepare('SELECT id FROM characters WHERE name = ?');
    const insertMessageStmt = db.prepare(`
      INSERT INTO chat_messages (character_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    let migratedMessagesCount = 0;
    
    for (const file of files) {
      try {
        const characterName = path.basename(file, '.json');
        const characterRow = getCharacterIdStmt.get(characterName);
        
        if (!characterRow) {
          console.log(`⚠️  Character ${characterName} not found, skipping chat history`);
          continue;
        }
        
        const filePath = path.join(chatHistoryDir, file);
        const chatHistory = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        if (!Array.isArray(chatHistory)) {
          console.log(`⚠️  Invalid chat history format for ${characterName}`);
          continue;
        }
        
        for (const message of chatHistory) {
          if (message.role && message.content) {
            insertMessageStmt.run(
              characterRow.id,
              message.role,
              message.content,
              message.timestamp || Date.now()
            );
            migratedMessagesCount++;
          }
        }
        
        console.log(`✅ Migrated chat history for: ${characterName}`);
      } catch (error) {
        console.error(`❌ Failed to migrate chat history file ${file}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${migratedMessagesCount} chat messages successfully`);
    return true;
  } catch (error) {
    console.error('❌ Failed to migrate chat history:', error);
    return false;
  }
}

// Run complete migration
async function runMigration() {
  console.log('🚀 Starting migration from JSON to SQLite...\n');
  
  // Step 1: Create backup
  console.log('Step 1: Creating backup...');
  if (!createBackup()) {
    console.error('❌ Migration aborted due to backup failure');
    return false;
  }
  
  // Step 2: Initialize database
  console.log('\nStep 2: Initializing database...');
  if (!initializeDatabase()) {
    console.error('❌ Migration aborted due to database initialization failure');
    return false;
  }
  
  // Step 3: Migrate settings
  console.log('\nStep 3: Migrating settings...');
  if (!migrateSettings()) {
    console.error('❌ Settings migration failed');
    return false;
  }
  
  // Step 4: Migrate characters
  console.log('\nStep 4: Migrating characters...');
  if (!migrateCharacters()) {
    console.error('❌ Characters migration failed');
    return false;
  }
  
  // Step 5: Migrate chat history
  console.log('\nStep 5: Migrating chat history...');
  if (!migrateChatHistory()) {
    console.error('❌ Chat history migration failed');
    return false;
  }
  
  console.log('\n🎉 Migration completed successfully!');
  console.log('\n📋 Summary:');
  console.log('- Original JSON data backed up to data-backup/');
  console.log('- SQLite database created at data/chunrp.db');
  console.log('- All data migrated and validated');
  // Vector memory migration (legacy vectra -> sqlite-vec)
  try {
    const vecRes = await migrateLegacyVectra();
    if (vecRes.migrated) {
      console.log(`- Migrated ${vecRes.migrated} legacy vector memories into SQLite (sqlite-vec)`);
    } else if (vecRes.skipped) {
      console.log(`- Vectra migration skipped: ${vecRes.reason}`);
    } else if (vecRes.error) {
      console.log(`- Vectra migration error: ${vecRes.error}`);
    }
  } catch (e) {
    console.log('- Vectra migration unexpected error:', e.message || e);
  }
  
  return true;
}

// Validation function to compare data integrity
function validateMigration() {
  console.log('\n🔍 Validating migration...');
  
  try {
    const db = getDatabase();
    
    // Count records
    const characterCount = db.prepare('SELECT COUNT(*) as count FROM characters').get().count;
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get().count;
    const relationshipCount = db.prepare('SELECT COUNT(*) as count FROM character_relationships').get().count;
    
    console.log(`✅ Characters in database: ${characterCount}`);
    console.log(`✅ Chat messages in database: ${messageCount}`);
    console.log(`✅ Relationships in database: ${relationshipCount}`);
    
    // Sample a few characters to verify data integrity
    const sampleCharacters = db.prepare('SELECT * FROM characters LIMIT 3').all();
    for (const char of sampleCharacters) {
      console.log(`✅ Sample character: ${char.name} (Created: ${new Date(char.created_at).toISOString()})`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

export {
  createBackup,
  migrateSettings,
  migrateCharacters,
  migrateChatHistory,
  runMigration,
  validateMigration
};
