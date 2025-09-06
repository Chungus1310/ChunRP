// SQLite-based character system to replace JSON file operations
import { getDatabase } from './database.js';

// Default structure for a character (for compatibility)
const characterSchema = {
  name: "", 
  description: "", 
  currentScenario: "", 
  persona: "", 
  appearance: "", 
  avatarUrl: "", 
  firstMessage: "", 
  settingsOverride: {}, 
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  relationships: {
    user: {
      status: 'neutral',
      sentiment: 0.0
    }
  },
  lastJournalIndex: 0
};

// Helper function to convert database row to character object
function dbRowToCharacter(row, relationships = []) {
  if (!row) return null;
  let settingsOverride = {};
  try {
    settingsOverride = JSON.parse(row.settings_override || '{}');
  } catch (e) {
    console.warn(`Invalid settings_override JSON for character ${row.name}:`, e);
  }
  const character = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    currentScenario: row.current_scenario || '',
    persona: row.persona || '',
    appearance: row.appearance || '',
    avatarUrl: row.avatar_url || '',
    firstMessage: row.first_message || '',
    settingsOverride,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    relationships: {},
    lastJournalIndex: row.last_journal_index || 0
  };
  
  // Add relationships
  for (const rel of relationships) {
    character.relationships[rel.user_name] = {
      status: rel.status,
      sentiment: rel.sentiment
    };
  }
  
  return character;
}

// Simple URL validation helper
function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Create a new character and save to database
function createCharacter(characterData) {
  // Basic checks
  if (!characterData || !characterData.name || !characterData.persona) {
    console.error("Validation Error: Character name and persona are required.");
    return null;
  }

  // Validate avatar URL if provided
  if (characterData.avatarUrl && !isValidURL(characterData.avatarUrl)) {
    console.error("Validation Error: Invalid avatar URL format provided.");
    return null;
  }

  try {
    const db = getDatabase();
    const now = Date.now();
    
    // Insert character
    const insertStmt = db.prepare(`
      INSERT INTO characters (
        name, description, current_scenario, persona, appearance,
        avatar_url, first_message, settings_override, last_journal_index,
        created_at, modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertStmt.run(
      characterData.name,
      characterData.description || '',
      characterData.currentScenario || '',
      characterData.persona,
      characterData.appearance || '',
      characterData.avatarUrl || '',
      characterData.firstMessage || '',
      JSON.stringify(characterData.settingsOverride || {}),
      0, // last_journal_index
      now,
      now
    );
    
    const characterId = result.lastInsertRowid;
    
    // Insert default relationship
    const insertRelStmt = db.prepare(`
      INSERT INTO character_relationships (character_id, user_name, status, sentiment, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertRelStmt.run(characterId, 'user', 'neutral', 0.0, now);
    
    // Return the created character
    return loadCharacter(characterData.name);
  } catch (error) {
    console.error(`Error creating character ${characterData.name}:`, error);
    return null;
  }
}

// Load a character from database by name
function loadCharacter(characterName) {
  try {
    const db = getDatabase();
    
    // Get character data
    const charStmt = db.prepare('SELECT * FROM characters WHERE name = ?');
    const charRow = charStmt.get(characterName);
    
    if (!charRow) {
      return null; // Not found
    }
    
    // Get relationships
    const relStmt = db.prepare('SELECT * FROM character_relationships WHERE character_id = ?');
    const relationships = relStmt.all(charRow.id);
    
    return dbRowToCharacter(charRow, relationships);
  } catch (error) {
    console.error(`Error loading character ${characterName}:`, error);
    return null;
  }
}

// Load all characters from database
function loadAllCharacters() {
  try {
    const db = getDatabase();
    
    // Get all characters
    const charStmt = db.prepare('SELECT * FROM characters ORDER BY name');
    const charRows = charStmt.all();
    
    // Get all relationships
    const relStmt = db.prepare('SELECT * FROM character_relationships');
    const allRelationships = relStmt.all();
    
    // Group relationships by character_id
    const relationshipsByCharId = {};
    for (const rel of allRelationships) {
      if (!relationshipsByCharId[rel.character_id]) {
        relationshipsByCharId[rel.character_id] = [];
      }
      relationshipsByCharId[rel.character_id].push(rel);
    }
    
    // Convert to character objects
    return charRows.map(row => 
      dbRowToCharacter(row, relationshipsByCharId[row.id] || [])
    ).filter(char => char !== null);
  } catch (error) {
    console.error("Error loading all characters:", error);
    return [];
  }
}

// Delete a character from database
function deleteCharacter(characterName) {
  try {
    const db = getDatabase();
    
    // Find character ID
    const findStmt = db.prepare('SELECT id FROM characters WHERE name = ?');
    const charRow = findStmt.get(characterName);
    
    if (!charRow) {
      console.warn(`Attempted to delete non-existent character: ${characterName}`);
      return false;
    }
    
    // Delete character (cascade will handle relationships and messages)
    const deleteStmt = db.prepare('DELETE FROM characters WHERE id = ?');
    const result = deleteStmt.run(charRow.id);
    
    return result.changes > 0;
  } catch (error) {
    console.error(`Error deleting character ${characterName}:`, error);
    return false;
  }
}

// Update a character's data
function updateCharacter(characterName, updateData) {
  try {
    const db = getDatabase();
    
    // Find character
    const findStmt = db.prepare('SELECT * FROM characters WHERE name = ?');
    const existingChar = findStmt.get(characterName);
    
    if (!existingChar) {
      console.error(`Character ${characterName} not found`);
      return null;
    }
    
    // Special handling if the name is being changed
    if (updateData.name && updateData.name !== characterName) {
      // Check if new name already exists
      const checkStmt = db.prepare('SELECT id FROM characters WHERE name = ?');
      const existingNewName = checkStmt.get(updateData.name);
      
      if (existingNewName) {
        console.error(`Error updating: Character with name ${updateData.name} already exists.`);
        return null;
      }
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    const fieldMap = {
      name: 'name',
      description: 'description',
      currentScenario: 'current_scenario',
      persona: 'persona',
      appearance: 'appearance',
      avatarUrl: 'avatar_url',
      firstMessage: 'first_message',
      settingsOverride: 'settings_override',
      lastJournalIndex: 'last_journal_index'
    };
    
    for (const [jsField, dbField] of Object.entries(fieldMap)) {
      if (updateData.hasOwnProperty(jsField)) {
        updateFields.push(`${dbField} = ?`);
        if (jsField === 'settingsOverride') {
          updateValues.push(JSON.stringify(updateData[jsField]));
        } else if (jsField === 'lastJournalIndex') {
          updateValues.push(updateData[jsField] || 0);
        } else {
          updateValues.push(updateData[jsField]);
        }
      }
    }
    
    if (updateFields.length === 0) {
      console.log('No fields to update');
      return loadCharacter(characterName);
    }
    
    // Add modified_at
    updateFields.push('modified_at = ?');
    updateValues.push(Date.now());
    updateValues.push(existingChar.id);
    
    // Execute update
    const updateQuery = `UPDATE characters SET ${updateFields.join(', ')} WHERE id = ?`;
    const updateStmt = db.prepare(updateQuery);
    updateStmt.run(...updateValues);
    
    // Update relationships if provided
    if (updateData.relationships) {
      const deleteRelStmt = db.prepare('DELETE FROM character_relationships WHERE character_id = ?');
      const insertRelStmt = db.prepare(`
        INSERT INTO character_relationships (character_id, user_name, status, sentiment, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      deleteRelStmt.run(existingChar.id);
      
      for (const [userName, relationship] of Object.entries(updateData.relationships)) {
        insertRelStmt.run(
          existingChar.id,
          userName,
          relationship.status || 'neutral',
          relationship.sentiment || 0.0,
          Date.now()
        );
      }
    }
    
    // Return updated character
    const finalName = updateData.name || characterName;
    return loadCharacter(finalName);
  } catch (error) {
    console.error(`Error updating character ${characterName}:`, error);
    return null;
  }
}

// Load chat history for a character
function loadChatHistory(characterName) {
  try {
    const db = getDatabase();
    
    // Get character ID
    const charStmt = db.prepare('SELECT id FROM characters WHERE name = ?');
    const charRow = charStmt.get(characterName);
    
    if (!charRow) {
      console.error(`Character ${characterName} not found`);
      return [];
    }
    
    // Get chat messages
    const messagesStmt = db.prepare(`
      SELECT role, content, timestamp 
      FROM chat_messages 
      WHERE character_id = ? 
      ORDER BY timestamp ASC
    `);
    
    return messagesStmt.all(charRow.id);
  } catch (error) {
    console.error(`Error loading chat history for ${characterName}:`, error);
    return [];
  }
}

// Save chat history for a character
function saveChatHistory(characterName, chatHistory) {
  try {
    const db = getDatabase();
    
    // Get character ID
    const charStmt = db.prepare('SELECT id FROM characters WHERE name = ?');
    const charRow = charStmt.get(characterName);
    
    if (!charRow) {
      console.error(`Character ${characterName} not found`);
      return false;
    }
    
    // Clear existing messages and insert new ones
    const deleteStmt = db.prepare('DELETE FROM chat_messages WHERE character_id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO chat_messages (character_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    const transaction = db.transaction(() => {
      try {
        deleteStmt.run(charRow.id);
        for (const message of chatHistory) {
          if (message && message.role && typeof message.content === 'string') {
            const contentToSave = message.content;
            if (contentToSave.trim().length > 0) {
              const characterId = charRow.id;
              const role = String(message.role);
              const content = contentToSave;
              const timestamp = (typeof message.timestamp === 'number' && !isNaN(message.timestamp)) ? message.timestamp : Date.now();
              insertStmt.run(characterId, role, content, timestamp);
            }
          }
        }
      } catch (err) {
        console.error(`Transaction failed for ${characterName}:`, err);
        throw err; // Trigger rollback
      }
    });
    
    transaction();
    return true;
  } catch (error) {
    console.error(`Error saving chat history for ${characterName}:`, error);
    return false;
  }
}

// Clear chat history by preserving only the first message
async function clearChatHistory(characterName) {
  try {
    const db = getDatabase();
    
    // Get character data
    const character = loadCharacter(characterName);
    if (!character) {
      console.error(`Character ${characterName} not found`);
      return false;
    }
    
    // Prepare preserved history
    let preservedHistory = [];
    if (character.firstMessage && character.firstMessage.trim().length > 0) {
      preservedHistory = [{ role: 'assistant', content: character.firstMessage }];
    }
    
    // Save the preserved history
    const chatHistoryCleared = saveChatHistory(characterName, preservedHistory);
    
  // Clear memories from unified vector store
    const { clearCharacterMemories } = await import('./memory-system.js');
    const memoriesCleared = await clearCharacterMemories(characterName);
    
    console.log(`Chat history cleared (preserving latest first message) for character: ${characterName}.`);
    return chatHistoryCleared && memoriesCleared;
  } catch (error) {
    console.error(`Error clearing chat history and memories for character ${characterName}:`, error);
    return false;
  }
}

// Settings management
function loadSettings() {
  try {
    const db = getDatabase();
    const stmt = db.prepare('SELECT data FROM settings WHERE id = 1');
    const row = stmt.get();
    
    if (!row) {
      return null;
    }
    
    return JSON.parse(row.data);
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

function saveSettings(settings) {
  try {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (id, data, updated_at)
      VALUES (1, ?, ?)
    `);
    
    stmt.run(JSON.stringify(settings), Date.now());
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// Export all functions
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
};
