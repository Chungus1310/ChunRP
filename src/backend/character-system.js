// Replace all {{user}} placeholders with the current user's name (for backend use)
function replaceUserPlaceholder(text, userName) {
  if (!text) return text;
  return text.replace(/\{\{user\}\}/gi, userName || 'User');
}
// Manages character data (CRUD) and chat history
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url'; // For URL validation

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default structure for a character
const characterSchema = {
  name: "", 
  description: "", 
  currentScenario: "", 
  persona: "", 
  appearance: "", 
  avatarUrl: "", 
  firstMessage: "", 
  systemPrompt: "", 
  settingsOverride: {}, // LLM settings specific to this char
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  // Relationship data updated by memory system
  relationships: {
    user: {
      status: 'neutral',
      sentiment: 0.0
    }
  }
};

// Get the directory where character JSON files are stored
function getCharacterDirectory() {
  const dirPath = path.join(__dirname, '../../data/characters');
  
  // Create if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return dirPath;
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

// Create a new character object and save it
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

  const character = {
    ...characterSchema, // Start with defaults
    ...characterData,   // Override with provided data
    createdAt: Date.now(),
    modifiedAt: Date.now()
  };

  // Save and check for errors
  if (!saveCharacter(character)) {
      return null;
  }
  return character;
}

// Save character data to a JSON file
function saveCharacter(character) {
  try {
    const filePath = path.join(getCharacterDirectory(), `${character.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
    return true; // Success
  } catch (error) {
    console.error(`Error saving character ${character.name}:`, error);
    return false; // Failure
  }
}

// Load a character from its JSON file
function loadCharacter(characterName) {
  try {
    const filePath = path.join(getCharacterDirectory(), `${characterName}.json`);
    if (!fs.existsSync(filePath)) {
      return null; // Not found
    }
    
    // Try parsing the file content
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (parseError) {
        console.error(`Error parsing character file ${characterName}.json:`, parseError);
        return null; // Parse error
    }
  } catch (error) {
    // Error accessing file path etc.
    console.error(`Error accessing character file for ${characterName}:`, error);
    return null;
  }
}

// Load all character files from the directory
function loadAllCharacters() {
  const characterDir = getCharacterDirectory(); 
  let files;
  try {
    files = fs.readdirSync(characterDir).filter(file => file.endsWith('.json'));
  } catch (error) {
      console.error("Error reading character directory:", error);
      return []; // Return empty if directory read fails
  }
    
  return files.map(file => {
    try {
        const filePath = path.join(characterDir, file);
        // Try reading and parsing each file
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (readParseError) {
            console.error(`Error reading or parsing character file ${file}:`, readParseError);
            return null; // Skip files that fail
        }
    } catch (pathError) {
        console.error(`Error generating path for character file ${file}:`, pathError);
        return null;
    }
  }).filter(character => character !== null); // Filter out any nulls from errors
}

// Delete a character's JSON file
function deleteCharacter(characterName) {
  try {
    const filePath = path.join(getCharacterDirectory(), `${characterName}.json`);
    
    if (fs.existsSync(filePath)) {
        // Try deleting the file
        try {
            fs.unlinkSync(filePath);
            return true; // Success
        } catch (unlinkError) {
            console.error(`Error deleting character file ${characterName}.json:`, unlinkError);
            return false; // Deletion failed
        }
    } else {
        console.warn(`Attempted to delete non-existent character: ${characterName}`);
        return false; // Not found
    }
  } catch (error) {
    // Error accessing file path etc.
    console.error(`Error accessing character file for deletion ${characterName}:`, error);
    return false;
  }
}

// Update a character's data and save
function updateCharacter(characterName, updateData) {
  const character = loadCharacter(characterName); 

  if (!character) {
    return null; // Not found
  }

  // Special handling if the name is being changed
  if (updateData.name && updateData.name !== characterName) {
    // Optional: Check if the new name is already taken
    const existingNewName = loadCharacter(updateData.name);
    if (existingNewName) {
        console.error(`Error updating: Character with name ${updateData.name} already exists.`);
        return null; // Don't overwrite
    }

    // Prepare the updated data *before* deleting the old file
    const updatedCharacterData = {
        ...character,
        ...updateData,
        modifiedAt: Date.now()
    };

    // Try saving with the new name first
    if (!saveCharacter(updatedCharacterData)) {
        console.error(`Error saving character with new name ${updateData.name}. Update aborted.`);
        // Don't delete the old file if the new save failed
        return null;
    }

    // If new save succeeded, delete the old file
    try {
        deleteCharacter(characterName); 
    } catch (deleteError) {
        // Log if deletion fails, but the update mostly worked
        console.warn(`Character ${characterName} updated to ${updateData.name}, but failed to delete the old file:`, deleteError);
    }
    return updatedCharacterData; // Return the data with the new name

  } else {
    // No name change, just update and save
    const updatedCharacter = {
      ...character,
      ...updateData,
      modifiedAt: Date.now()
    };

    // Save and check for errors
    if (!saveCharacter(updatedCharacter)) {
        return null;
    }
    return updatedCharacter;
  }
}

// Get the directory where chat history JSON files are stored
function getChatHistoryDirectory() {
  const dirPath = path.join(__dirname, '../../data/chat-history');
  
  // Create if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return dirPath;
}

// Load chat history for a character from its JSON file
function loadChatHistory(characterName) {
  try {
    const filePath = path.join(getChatHistoryDirectory(), `${characterName}.json`);
    
    if (!fs.existsSync(filePath)) {
      return []; // Return empty if no history file
    }
    
    // Try parsing the file content
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (parseError) {
        console.error(`Error parsing chat history file ${characterName}.json:`, parseError);
        return []; // Return empty on parse error
    }
  } catch (error) {
    // Error accessing file path etc.
    console.error(`Error accessing chat history file for ${characterName}:`, error);
    return []; // Return empty on other errors
  }
}

// Save chat history for a character to its JSON file
function saveChatHistory(characterName, chatHistory) {
  try {
    const filePath = path.join(getChatHistoryDirectory(), `${characterName}.json`);
    
    // No longer limiting chat history size
    // Store full history now, can implement pagination later if needed
    
    // Try writing the file
    try {
        fs.writeFileSync(filePath, JSON.stringify(chatHistory, null, 2));
        return true; // Success
    } catch (writeError) {
        console.error(`Error writing chat history file ${characterName}.json:`, writeError);
        return false; // Write failed
    }
  } catch (error) {
      // Error preparing path etc.
      console.error(`Error preparing to save chat history for ${characterName}:`, error);
      return false;
  }
}

// Clear chat history by saving an empty array and clearing memories
async function clearChatHistory(characterName) {
  try {
    // Always reload the character from disk to get the latest firstMessage
    const character = loadCharacter(characterName);
    let preservedHistory = [];
    if (character && character.firstMessage && character.firstMessage.trim().length > 0) {
      preservedHistory = [{ role: 'assistant', content: character.firstMessage }];
    }
    // Save the chat history with only the latest first message (or empty if none exists)
    const chatHistoryCleared = saveChatHistory(characterName, preservedHistory);
    // Clear memories from Vectra
    const { clearCharacterMemories } = await import('./memory-system.js');
    const memoriesCleared = await clearCharacterMemories(characterName);
    console.log(`Chat history cleared (preserving latest first message) for character: ${characterName}.`);
    return chatHistoryCleared && memoriesCleared;
  } catch (error) {
    console.error(`Error clearing chat history and memories for character ${characterName}:`, error);
    return false;
  }
}

// Export all functions
export {
  createCharacter,
  saveCharacter,
  loadCharacter,
  loadAllCharacters,
  deleteCharacter,
  updateCharacter,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory
};
