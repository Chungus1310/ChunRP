// (Moved below app definition)
// Main Express server setup
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// console.log("__dirname:", __dirname);
// console.log("Frontend path:", path.join(__dirname, '../frontend'));

// Create global progress tracking store
const progressStore = new Map();

// Character stuff
import { 
  loadAllCharacters, 
  loadCharacter, 
  createCharacter,
  updateCharacter,
  deleteCharacter,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadSettings,
  saveSettings
} from './character-system.js';

// LLM stuff
import { generateResponse, modelConfigurations, apiKeyStatus, apiKeyIndices } from './llm-providers.js';

// Memory stuff
import { 
  retrieveRelevantMemories, 
  initializeVectorStorage 
} from './memory-system.js';

// Database initialization
import { initializeDatabase, closeDatabase } from './database.js';
import { initializeDataDirectory } from './app-paths.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve static files for frontend (css, js, assets)
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


// --- SSE LOG BROADCAST SETUP ---
let sseClients = [];

function broadcastLog(message) {
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// Patch console.log to also broadcast to SSE
const origConsoleLog = console.log;
console.log = function (...args) {
  origConsoleLog.apply(console, args);
  try {
    broadcastLog(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  } catch (e) {}
};

// Register SSE endpoint *after* app is defined
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Health check endpoint for connection monitoring
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
// --- SSE LOG BROADCAST SETUP ---


// Load settings from database
function loadSettingsFromDB() {
  try {
    const settings = loadSettings();
    if (!settings) {
      // Default settings if none exist
      const defaultSettings = {
        provider: 'gemini',
        model: 'gemini-2.5-pro-preview-03-25',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        maxContextTokens: 6000,
        // API keys per provider
        apiKeys: {
          gemini: '',
          openrouter: '',
          huggingface: '',
          mistral: ''
        },
        memory: {
          journalFrequency: 10,
          retrievalCount: 5,
          historyMessageCount: 15,
          embeddingProvider: 'nvidia',
          embeddingModel: 'baai/bge-m3',
          queryEmbeddingMethod: 'llm-summary',
          analysisProvider: 'gemini',
          analysisModel: 'gemini-2.0-flash',
          hydeEnabled: false,
          weights: {
            recency: 5,
            emotionalSignificance: 7,
            decisionRelevance: 6
          }
        },
        user: {
          name: 'User',
          persona: 'A friendly user chatting with the character.'
        },
        theme: 'dark',
        bubbleStyle: 'rounded'
      };
      saveSettings(defaultSettings);
      return defaultSettings;
    }
    
    return settings;
  } catch (error) {
    console.error("Error loading settings:", error);
    return {}; // Return empty object on error
  }
}

// Save settings to database
function saveSettingsToDB(settings) {
  try {
    return saveSettings(settings);
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

// --- API Endpoints ---

// Get all characters
app.get('/api/characters', (req, res) => {
  try {
    // Load all characters and update cache while doing so
    const characters = loadAllCharacters();
    
    // Update character cache with loaded characters
    characters.forEach(character => {
      if (character && character.name) {
        characterCache.set(character.name, character);
      }
    });
    
    res.json(characters);
  } catch (error) {
    console.error("Error in GET /api/characters:", error);
    res.status(500).json({ error: 'Failed to load characters.' });
  }
});

// Get a single character
app.get('/api/characters/:name', (req, res) => {
  try {
    // Check cache first
    const character = loadCharacterWithCache(req.params.name);
    
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }
    
    res.json(character);
  } catch (error) {
    console.error(`Error in GET /api/characters/${req.params.name}:`, error);
    res.status(500).json({ error: 'Failed to load character.' });
  }
});

// Create a new character
app.post('/api/characters', (req, res) => {
  try {
    // Basic check
    if (!req.body || !req.body.name || !req.body.persona) {
      return res.status(400).json({ error: 'Character name and persona are required.' });
    }
    
    // Create the character
    const character = createCharacter(req.body);
    
    // Check if creation failed
    if (!character) {
       return res.status(500).json({ error: 'Failed to create character due to a server error.' });
    }
    
    // Add to cache
    characterCache.set(character.name, character);
    
    res.status(201).json(character);
  } catch (error) {
    console.error("Error in POST /api/characters:", error);
    // Check for specific validation errors
    if (error.message.includes('validation failed')) { 
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create character.' });
  }
});

// Update a character
app.put('/api/characters/:name', (req, res) => {
  try {
     // Basic check
    if (!req.body) {
      return res.status(400).json({ error: 'Invalid update data provided.' });
    }
    
    // Check if in cache first
    const cachedCharacter = characterCache.get(req.params.name);
    let updatedCharacter;
      if (cachedCharacter) {
      // Update cached character
      updatedCharacter = {
        ...cachedCharacter,
        ...req.body,
        modifiedAt: Date.now()
      };
      // Save to database immediately
      const dbUpdatedCharacter = updateCharacter(req.params.name, req.body);
      if (!dbUpdatedCharacter) {
        return res.status(500).json({ error: 'Failed to save character to database.' });
      }
      // Use the result from database to ensure consistency
      updatedCharacter = dbUpdatedCharacter;
      
      // If name is changing, handle cache properly
      if (req.body.name && req.body.name !== req.params.name) {
        characterCache.delete(req.params.name);
        characterCache.set(req.body.name, updatedCharacter);
      } else {
        characterCache.set(req.params.name, updatedCharacter);
      }
      res.json(updatedCharacter);
    } else {
      // Not in cache, use original update function
      updatedCharacter = updateCharacter(req.params.name, req.body);
      if (!updatedCharacter) {
        // Check if the character existed to give a better error
        const originalCharacter = loadCharacter(req.params.name); 
        if (!originalCharacter) {
            return res.status(404).json({ error: "Character not found" });
        } else {
            return res.status(500).json({ error: 'Failed to update character due to a server error.' });
        }
      }
      // Add to cache
      characterCache.set(updatedCharacter.name, updatedCharacter);
      res.json(updatedCharacter);
    }
  } catch (error) {
    console.error(`Error in PUT /api/characters/${req.params.name}:`, error);
     // Check for specific validation errors
    if (error.message.includes('validation failed')) { 
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update character.' });
  }
});

// Delete a character
app.delete('/api/characters/:name', (req, res) => {
  try {
    // Remove from cache first if present
    characterCache.delete(req.params.name);
    dirtyCharacters.delete(req.params.name);
    
    const success = deleteCharacter(req.params.name);
    
    if (!success) {
       // Could be not found or deletion failed
       return res.status(404).json({ error: "Character not found or could not be deleted." });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(`Error in DELETE /api/characters/${req.params.name}:`, error);
    res.status(500).json({ error: 'Failed to delete character.' });
  }
});

// Generate chat response
app.post('/api/chat', async (req, res) => {
  try {
    const { characterName, message, messageId, settings } = req.body;

    // Basic check
    if (!characterName || !message) {
        return res.status(400).json({ error: 'Character name and message are required.' });
    }
    
    // Load character from cache
    const character = loadCharacterWithCache(characterName);
    if (!character) {
      console.warn(`Chat request for non-existent character: ${characterName}`);
      return res.status(404).json({ error: "Character not found" });
    }
    
    // Load history
    const chatHistory = loadChatHistory(characterName); 
    
    // Load settings
    const globalSettings = loadSettingsFromDB(); 
    const mergedSettings = {
      ...globalSettings,
      ...(settings || {}) // Make sure settings is at least {}
    };
    
    // Get user profile
    const userProfile = mergedSettings.user || { name: 'User' };
      // Generate response - this may update character.relationships in memory
    const responseContent = await generateResponse(
      character,
      message,
      userProfile,
      chatHistory, // Pass history (generateResponse modifies it)
      mergedSettings
    );

    // --- ROBUSTNESS GUARD ---
    if (typeof responseContent !== 'string') {
      console.error(`generateResponse returned a non-string value: ${typeof responseContent}`);
      throw new Error('The model returned an invalid response format.');
    }
    // --- END GUARD ---

    // If character was modified, mark as dirty and schedule save
    if (character.modifiedAt > (characterCache.get(characterName)?.modifiedAt || 0)) {
      // Update cache with potentially modified character
      characterCache.set(characterName, { ...character }); // Store a copy to avoid mutation issues
      dirtyCharacters.add(characterName);
      scheduleSaveCache();
      console.log(`Character ${characterName} marked for deferred save`);
    }

    // Save updated history immediately
    saveChatHistory(characterName, chatHistory); 
    
    res.json({ response: responseContent });
  } catch (error) {
    // Send the actual error message to the user
    console.error("Error in POST /api/chat:", error.message || error);
    
    // Check if it's a provider-specific error (has detailed message)
    if (error.message && (
      error.message.includes('API key') || 
      error.message.includes('API request failed') || 
      error.message.includes('response format unexpected') ||
      error.message.includes('Network error') ||
      error.message.includes('Provider') ||
      error.message.includes('not supported')
    )) {
      // Send the specific error message to the user
      return res.status(500).json({ error: error.message });
    }
    
    // For unknown errors, send a generic message
    res.status(500).json({ error: "Failed to generate chat response due to an unexpected server error." });
  }
});

// Get chat history
app.get('/api/chat/:characterName', (req, res) => {
  try {
    const chatHistory = loadChatHistory(req.params.characterName);
    res.json(chatHistory);
  } catch (error) {
    console.error(`Error in GET /api/chat/${req.params.characterName}:`, error);
    res.status(500).json({ error: 'Failed to retrieve chat history.' });
  }
});

// Save chat history (e.g., if edited by user)
app.put('/api/chat/:characterName', (req, res) => {
  try {
    const characterName = req.params.characterName;
    const chatHistory = req.body;

    if (!Array.isArray(chatHistory)) {
      return res.status(400).json({ error: 'Invalid chat history format. Expected an array.' });
    }

    // Optional: Check if character exists
    const character = loadCharacter(characterName);
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

    const success = saveChatHistory(characterName, chatHistory);

    if (success) {
      res.json({ success: true });
    } else {
      // saveChatHistory logs the specific error
      res.status(500).json({ error: 'Failed to save chat history.' });
    }
  } catch (error) {
    console.error(`Error in PUT /api/chat/${req.params.characterName}:`, error);
    res.status(500).json({ error: 'Failed to save chat history due to a server error.' });
  }
});

// Clear chat history
app.delete('/api/chat/:characterName', (req, res) => {
  try {
    const characterName = req.params.characterName;
    // Optional: Check if character exists first
    const character = loadCharacter(characterName);
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }
    
    // Get current chat history to log the preserved message
    const beforeClear = loadChatHistory(characterName);
    console.log(`Clearing chat for ${characterName}, preserving first message: ${beforeClear.length > 0 ? 'Yes' : 'No first message'}`);
    
    // Clear chat history (preserving first message)
    clearChatHistory(characterName); 
    
    // Log the result after clearing
    const afterClear = loadChatHistory(characterName);
    console.log(`After clearing, chat history length: ${afterClear.length}`);
    
    res.json({ success: true });
  } catch (error) {
     // Unlikely if clear/save handle errors, but good practice
    console.error(`Error in DELETE /api/chat/${req.params.characterName}:`, error);
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// Retrieve memories for a character from vector database
app.get('/api/memories/:characterName', async (req, res) => {
  try {
    const charName = req.params.characterName;
    const filter = req.query.filter ? req.query.filter.toLowerCase() : 'all';
    // Ensure vector storage is initialized
    await initializeVectorStorage();
    // Load character data and chat history
    const character = loadCharacterWithCache ? loadCharacterWithCache(charName) : loadCharacter(charName);
    const chatHistory = loadChatHistory(charName);    // Load settings
    const settings = loadSettingsFromDB();
    const retrievalCount = settings.memory?.retrievalCount ?? 5;
    // Determine last user message for query
    const lastUser = [...chatHistory].reverse().find(m => m.role === 'user');
    const currentMessage = lastUser ? lastUser.content : '';
    // Fetch relevant memories
    let memories = await retrieveRelevantMemories(currentMessage, character, retrievalCount, settings, chatHistory);

    // Apply backend filtering for importance/recency if requested
    if (filter === 'important') {
      memories = (memories || []).filter(m => m.importance > 0.7);
    } else if (filter === 'recent') {
      memories = (memories || [])
        .slice() // copy
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3); // most recent 3
    }
    res.json(memories || []);
  } catch (err) {
    console.error(`Error in GET /api/memories/${req.params.characterName}:`, err);
    res.status(500).json({ error: 'Failed to retrieve memories.' });
  }
});

// Recycle memories for a character
app.post('/api/memories/:characterName/recycle', async (req, res) => {
  try {
    const characterName = req.params.characterName;
    
    // Check if character exists
    const character = loadCharacter(characterName);
    if (!character) {
      return res.status(404).json({ error: 'Character not found.' });
    }
    
    // Load chat history
    const chatHistory = loadChatHistory(characterName);
    if (!chatHistory || chatHistory.length === 0) {
      return res.status(400).json({ error: 'No chat history available for memory recycling.' });
    }
      // Load settings
    const settings = loadSettingsFromDB();
      // Import memory functions
    const { recycleCharacterMemories } = await import('./memory-system.js');
    
    // Create progress callback
    const progressCallback = (progress) => {
      progressStore.set(characterName, progress);
    };
    
    // Start the recycling process
    const result = await recycleCharacterMemories(characterName, chatHistory, character, settings, progressCallback);
    
    // Clear progress after completion
    progressStore.delete(characterName);
    
    if (result.success) {
      res.json({ 
        success: true, 
        memoriesCreated: result.memoriesCreated,
        message: `Successfully recycled memories. Created ${result.memoriesCreated} new memories.`
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to recycle memories.' });
    }
  } catch (error) {
    console.error(`Error in POST /api/memories/${req.params.characterName}/recycle:`, error);
    res.status(500).json({ error: 'Failed to recycle memories due to server error.' });  }
});

// Get recycling progress for a character
app.get('/api/memories/:characterName/progress', (req, res) => {
  try {
    const characterName = req.params.characterName;
    const progress = progressStore.get(characterName);
    
    if (progress) {
      res.json(progress);
    } else {
      res.json({ step: 'idle', message: 'No active recycling process', current: 0, total: 0 });
    }
  } catch (error) {
    console.error(`Error in GET /api/memories/${req.params.characterName}/progress:`, error);
    res.status(500).json({ error: 'Failed to get recycling progress.' });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = loadSettingsFromDB();
    // loadSettingsFromDB returns {} on error, which is probably fine
    res.json(settings);
  } catch (error) {
    // Unlikely if loadSettingsFromDB handles its own errors
    console.error("Error in GET /api/settings:", error);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

// Update settings
app.put('/api/settings', (req, res) => {
  try {
    // Add validation if needed
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid settings data provided.' });
    }
    const settings = req.body;
    saveSettingsToDB(settings); // saveSettingsToDB handles database errors
    res.json(settings); // Return saved settings
  } catch (error) {
    // Unlikely if saveSettingsToDB handles errors
    console.error("Error in PUT /api/settings:", error);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// Get API key statuses
app.get('/api/key-status', (req, res) => {
  try {
    // Return current API key statuses for all providers
    const statusResponse = {
      statuses: apiKeyStatus,
      indices: apiKeyIndices
    };
    res.json(statusResponse);
  } catch (error) {
    console.error("Error in GET /api/key-status:", error);
    res.status(500).json({ error: 'Failed to retrieve API key statuses.' });
  }
});

// Get model configurations
app.get('/api/models', (req, res) => {
  try {
    // Just return the imported constant
    res.json(modelConfigurations);
  } catch (error) {
    // Very unlikely
    console.error("Error in GET /api/models:", error);
    res.status(500).json({ error: 'Failed to retrieve model configurations.' });
  }
});

// Serve the main HTML file for any other routes (like SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Simple request logger middleware
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Initialize database before starting server
async function startServer() {
  console.log('Initializing data directories...');
  await initializeDataDirectory();
  
  console.log('Initializing database...');
  const dbInit = initializeDatabase();
  if (!dbInit) {
    console.error('Failed to initialize database. Exiting...');
    process.exit(1);
  }
  
  console.log('Initializing vector storage...');
  await initializeVectorStorage();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Database: SQLite (data/chunrp.db)');
    console.log('Vector storage: Vectra (data/memory-vectra/)');
  });
  
  return server;
}

// Start the server
const server = await startServer();

// Graceful shutdown function
function gracefulShutdown(signal) {
  console.log(`Server received ${signal} signal, shutting down gracefully...`);
  
  // Clear any pending timers
  if (saveCacheTimeoutId) {
    clearTimeout(saveCacheTimeoutId);
    saveCacheTimeoutId = null;
  }
  
  // Close all SSE connections
  console.log(`Closing ${sseClients.length} SSE connections...`);
  sseClients.forEach(client => {
    try {
      client.end();
    } catch (error) {
      // Ignore errors when closing connections
    }
  });
  sseClients.length = 0; // Clear the array
  
  // Save any dirty characters
  if (dirtyCharacters.size > 0) {
    console.log(`Saving ${dirtyCharacters.size} characters before shutdown...`);
    saveCache();
  }
  
  // Close server with timeout
  const shutdownTimeout = setTimeout(() => {
    console.log('Forced shutdown due to timeout');
    process.exit(1);
  }, 5000); // 5 second timeout
  
  server.close(() => {
    clearTimeout(shutdownTimeout);
    console.log('Closing database connection...');
    closeDatabase();
    console.log('Server closed gracefully');
    process.exit(0);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default server;

// Character cache to reduce disk I/O
const characterCache = new Map();
const dirtyCharacters = new Set(); // Track characters that need saving
let saveCacheTimeoutId = null;

// Load a character with caching
function loadCharacterWithCache(characterName) {
  // Check cache first
  if (characterCache.has(characterName)) {
    return characterCache.get(characterName);
  }
  
  // Cache miss - load from disk
  const character = loadCharacter(characterName);
  if (character) {
    characterCache.set(characterName, character);
  }
  return character;
}

// Schedule deferred save for dirty characters
function scheduleSaveCache(delayMs = 30000) { // Default 30 seconds
  // Clear existing timeout if any
  if (saveCacheTimeoutId) {
    clearTimeout(saveCacheTimeoutId);
  }
  
  // Set new timeout
  saveCacheTimeoutId = setTimeout(() => {
    saveCache();
    saveCacheTimeoutId = null; // Clear the reference after execution
  }, delayMs);
}

// Save all dirty characters
function saveCache() {
  if (dirtyCharacters.size === 0) {
    return; // Nothing to save
  }
  
  console.log(`Saving ${dirtyCharacters.size} modified characters to disk...`);
    dirtyCharacters.forEach(characterName => {
    const character = characterCache.get(characterName);
    if (character) {
      try {
        updateCharacter(characterName, character);
        console.log(`Saved ${characterName} to database`);
      } catch (error) {
        console.error(`Failed to save ${characterName} to database:`, error);
      }
    }
  });
  
  // Clear dirty set after saving
  dirtyCharacters.clear();
  
  // Clear the timeout reference if this was called directly
  if (saveCacheTimeoutId) {
    clearTimeout(saveCacheTimeoutId);
    saveCacheTimeoutId = null;
  }
}

