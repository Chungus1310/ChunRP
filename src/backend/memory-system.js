// Store persona and first message as important memories after clearing
async function storeInitialCharacterMemories(character, settings = {}) {
  if (!character || !character.name) return false;
  const entries = [];
  // Persona
  if (character.persona && character.persona.trim().length > 0) {
    try {
      const vector = await generateEmbedding(character.persona, settings);
      if (vector && Array.isArray(vector) && vector.length > 0) {
        await insertItem({
          vector,
          metadata: {
            id: uuidv4(),
            summary: character.persona.substring(0, 200),
            character: character.name,
            timestamp: Date.now(),
            importance: 1.0, // Highest importance
            type: 'persona',
          }
        });
        entries.push('persona');
      }
    } catch (e) {
      console.error(`Failed to embed/store persona for ${character.name}:`, e);
    }
  }
  // First message
  if (character.firstMessage && character.firstMessage.trim().length > 0) {
    try {
      const vector = await generateEmbedding(character.firstMessage, settings);
      if (vector && Array.isArray(vector) && vector.length > 0) {
        await insertItem({
          vector,
          metadata: {
            id: uuidv4(),
            summary: character.firstMessage.substring(0, 200),
            character: character.name,
            timestamp: Date.now(),
            importance: 1.0, // Highest importance
            type: 'firstMessage',
          }
        });
        entries.push('firstMessage');
      }
    } catch (e) {
      console.error(`Failed to embed/store firstMessage for ${character.name}:`, e);
    }
  }
  return entries.length > 0;
}
// Replace all {{user}} placeholders with the current user's name
function replaceUserPlaceholder(text, userName) {
  if (!text) return text;
  return text.replace(/\{\{user\}\}/gi, userName || 'User');
}
// Vector store (sqlite-vec replacement for legacy vectra)
import { ensureIndex, insertItem, queryItems } from './vector-store-sqlite-vec.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Import Mistral client
import { Mistral } from '@mistralai/mistralai';
// Import tiktoken for token counting
import { get_encoding } from "tiktoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the tokenizer with r50k_base encoding
// This is compatible with most modern LLMs including Gemini, Claude, etc.
let tokenizer;
try {
    tokenizer = get_encoding("r50k_base");
    console.log("Tokenizer initialized successfully using r50k_base encoding");
} catch (error) {
    console.error("Failed to initialize tokenizer:", error);
}

// Memory system now implemented through functions, not object structure

// Initialize sqlite-vec storage (same signature for compatibility)
async function initializeVectorStorage() {
  await ensureIndex();
  return true;
}



// Generate text embeddings using NVIDIA bge-m3 (preferred), fallback to Mistral, or others
async function generateEmbedding(text, settings = {}) {
  // User can select embedding provider/model in settings.memory
  const provider = settings.memory?.embeddingProvider || 'gemini';
  const embeddingModel = settings.memory?.embeddingModel || 'gemini-embedding-001';
  // Removed manual desiredDim handling – let provider decide dimension; we only validate non-empty


  // Helper functions for each provider
  async function tryGemini() {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = settings.apiKeys?.gemini;
      if (!apiKey) throw new Error('Gemini embedding error: API key is missing.');
      let realApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      if (typeof realApiKey !== 'string') throw new Error('Gemini embedding API key must be a string, got: ' + typeof realApiKey);

      const ai = new GoogleGenAI({ apiKey: realApiKey });
      // Updated call signature per latest @google/genai – expects contents (string or array)
      const response = await ai.models.embedContent({
        model: embeddingModel,
        contents: text
      });
      // The SDK typically returns { embedding: { values: [...] } }
      const embedding = response?.embedding?.values || response?.embedding || response?.embeddings?.[0]?.values || response?.embeddings;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Gemini embedding error: Missing embedding array');
      }
      return embedding;
    } catch (err) {
      throw err;
    }
  }

  async function tryNvidia() {
    try {
      const OpenAI = (await import('openai')).default;
      const apiKey = settings.apiKeys?.nvidia;
      if (!apiKey) throw new Error('NVIDIA embedding error: API key is missing.');
      
      // Ensure apiKey is a string (handle array case)
      let realApiKey = apiKey;
      if (Array.isArray(apiKey)) {
        realApiKey = apiKey[0];
      }
      if (typeof realApiKey !== 'string') {
        throw new Error('NVIDIA embedding API key must be a string, got: ' + typeof realApiKey);
      }
      
      const openai = new OpenAI({
        apiKey: realApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      const response = await openai.embeddings.create({
        input: [text],
        model: 'baai/bge-m3',
        encoding_format: 'float',
        truncate: 'NONE'
      });
      const embedding = response.data[0].embedding;
      if (!embedding || !Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error(`NVIDIA bge-m3 embedding error: Invalid or wrong dimension (${embedding?.length})`);
      }
      return embedding;
    } catch (err) {
      throw err;
    }
  }

  async function tryMistral() {
    try {
      const apiKey = settings.apiKeys?.mistral;
      if (!apiKey) {
        throw new Error("Mistral embedding error: API key is missing.");
      }
      // Ensure apiKey is a string (handle array case)
      let realApiKey = apiKey;
      if (Array.isArray(apiKey)) {
        realApiKey = apiKey[0];
      }
      if (typeof realApiKey !== 'string') {
        console.error('Mistral embedding API key is not a string:', realApiKey, typeof realApiKey);
        throw new Error('Mistral embedding API key must be a string, got: ' + typeof realApiKey);
      }
      const client = new Mistral({ apiKey: realApiKey });
      const inputs = Array.isArray(text) ? text : [text];
      const embeddingsBatchResponse = await client.embeddings.create({
        model: 'mistral-embed',
        inputs: inputs,
      });
      const embedding = embeddingsBatchResponse?.data?.[0]?.embedding;
      if (!embedding || !Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error(`Mistral embedding error: Invalid or wrong dimension (${embedding?.length})`);
      }
      return embedding;
    } catch (err) {
      throw err;
    }
  }

  async function tryCohere() {
    try {
      const { CohereClient } = await import('cohere-ai');
      const apiKey = settings.apiKeys?.cohere;
      if (!apiKey) throw new Error('Cohere embedding error: API key is missing.');
      
      // Ensure apiKey is a string (handle array case)
      let realApiKey = apiKey;
      if (Array.isArray(apiKey)) {
        realApiKey = apiKey[0];
      }
      if (typeof realApiKey !== 'string') {
        throw new Error('Cohere embedding API key must be a string, got: ' + typeof realApiKey);
      }
      
      const cohere = new CohereClient({ token: realApiKey });
      const response = await cohere.v2.embed({
        texts: Array.isArray(text) ? text : [text],
        model: 'embed-v4.0',
        inputType: 'classification',
        embeddingTypes: ['float'],
      });
      // Cohere returns { embeddings: { float: [[...]] } }
      const embedding = response?.embeddings?.float?.[0];
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error(`Cohere embedding error: Invalid embedding returned.`);
      }
      return embedding;
    } catch (err) {
      throw err;
    }
  }

  // Fallback logic for each provider
  if (provider === 'gemini') {
    try {
      return await tryGemini();
    } catch (err1) {
      console.error('Gemini embedding failed, falling back to NVIDIA:', err1.message || err1);
      try {
        return await tryNvidia();
      } catch (err2) {
        console.error('NVIDIA embedding failed, falling back to Mistral:', err2.message || err2);
        try {
          return await tryMistral();
        } catch (err3) {
          console.error('Mistral embedding failed, falling back to Cohere:', err3.message || err3);
          try {
            return await tryCohere();
          } catch (err4) {
            console.error('Cohere embedding failed, falling back to NVIDIA:', err4.message || err4);
            try {
              return await tryNvidia();
            } catch (err5) {
              console.error('NVIDIA embedding failed, falling back to Mistral:', err5.message || err5);
              try {
                return await tryMistral();
              } catch (err6) {
                console.error('Mistral embedding failed:', err6.message || err6);
                return [];
              }
            }
          }
        }
      }
    }
  } else if (provider === 'nvidia') {
    try {
      return await tryNvidia();
    } catch (err1) {
      console.error('NVIDIA embedding failed, falling back to Mistral:', err1.message || err1);
      try {
        return await tryMistral();
      } catch (err2) {
        console.error('Mistral embedding failed, falling back to Gemini:', err2.message || err2);
        try {
          return await tryGemini();
        } catch (err3) {
          console.error('Gemini embedding failed, falling back to Cohere:', err3.message || err3);
          try {
            return await tryCohere();
          } catch (err4) {
            console.error('Cohere embedding failed, falling back to NVIDIA:', err4.message || err4);
            try {
              return await tryNvidia();
            } catch (err5) {
              console.error('NVIDIA embedding failed, falling back to Mistral:', err5.message || err5);
              try {
                return await tryMistral();
              } catch (err6) {
                console.error('Mistral embedding failed:', err6.message || err6);
                return [];
              }
            }
          }
        }
      }
    }
  } else if (provider === 'mistral') {
    try {
      return await tryMistral();
    } catch (err1) {
      console.error('Mistral embedding failed, falling back to NVIDIA:', err1.message || err1);
      try {
        return await tryNvidia();
      } catch (err2) {
        console.error('NVIDIA embedding failed, falling back to Gemini:', err2.message || err2);
        try {
          return await tryGemini();
        } catch (err3) {
          console.error('Gemini embedding failed, falling back to Cohere:', err3.message || err3);
          try {
            return await tryCohere();
          } catch (err4) {
            console.error('Cohere embedding failed, falling back to NVIDIA:', err4.message || err4);
            try {
              return await tryNvidia();
            } catch (err5) {
              console.error('NVIDIA embedding failed, falling back to Mistral:', err5.message || err5);
              try {
                return await tryMistral();
              } catch (err6) {
                console.error('Mistral embedding failed:', err6.message || err6);
                return [];
              }
            }
          }
        }
      }
    }
  } else if (provider === 'cohere') {
    try {
      return await tryCohere();
    } catch (err1) {
      console.error('Cohere embedding failed, falling back to NVIDIA:', err1.message || err1);
      try {
        return await tryNvidia();
      } catch (err2) {
        console.error('NVIDIA embedding failed, falling back to Mistral:', err2.message || err2);
        try {
          return await tryMistral();
        } catch (err3) {
          console.error('Mistral embedding failed:', err3.message || err3);
          return [];
        }
      }
    }
  } else {
    // Default: try Gemini fallback chain
    try {
      return await tryGemini();
    } catch (err1) {
      console.error('Gemini embedding failed, falling back to NVIDIA:', err1.message || err1);
      try {
        return await tryNvidia();
      } catch (err2) {
        console.error('NVIDIA embedding failed, falling back to Mistral:', err2.message || err2);
        try {
          return await tryMistral();
        } catch (err3) {
          console.error('Mistral embedding failed, falling back to Cohere:', err3.message || err3);
          try {
            return await tryCohere();
          } catch (err4) {
            console.error('Cohere embedding failed, falling back to NVIDIA:', err4.message || err4);
            try {
              return await tryNvidia();
            } catch (err5) {
              console.error('NVIDIA embedding failed, falling back to Mistral:', err5.message || err5);
              try {
                return await tryMistral();
              } catch (err6) {
                console.error('Mistral embedding failed:', err6.message || err6);
                return [];
              }
            }
          }
        }
      }
    }
  }
}

// ... (rest of the functions remain largely the same, but need dimension checks updated) ...

// This function is retained for backwards compatibility
// and could be useful for other features later
async function getLatestJournalSummary(characterName) {
  try {
    const memoryTable = await getMemoryTable();

    // Use .search().filter() instead of .filter() directly on the table
    const latestEntry = await memoryTable
      .search()
      .filter(`character = '${characterName}'`)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .toArray();

    if (latestEntry.length > 0) {
      return latestEntry[0].summary;
    }
    return null; // No summary found
  } catch (error) {
    console.error(`Error retrieving latest journal summary for ${characterName}:`, error);
    return null; // Return null on error
  }
}

// --- Helper Functions for Memory Analysis ---

// LLM-based analysis has replaced these rule-based functions
// Keeping calculateRecencyBoost and calculateEmotionalSignificance for memory ranking

// Calculate recency boost (exponential decay) - No longer used for retrieval ranking
/*
function calculateRecencyBoost(timestamp) {
  const now = Date.now();
  const ageInHours = (now - timestamp) / (1000 * 60 * 60);
  // Slower decay over 48 hours
  return Math.exp(-ageInHours / 48);
}
*/

// Calculate emotional significance from stored memory emotions - No longer used for retrieval ranking
/*
function calculateEmotionalSignificance(memory, characterState) {
    // Assumes memory.emotions was stored by extractEmotions
    try {
        // Parse if stored as string
        const emotions = typeof memory.emotions === 'string' ? JSON.parse(memory.emotions) : memory.emotions;
        if (emotions && typeof emotions === 'object') {
            // Use max intensity (positive or negative)
            return Math.max(emotions.positive || 0, emotions.negative || 0);
        }
    } catch (e) {
        console.error(`Error parsing emotions for significance calculation (Memory ID: ${memory.id}):`, e);
    }
    return 0; // Default
}
*/

// --- End of Helper Functions ---


// Create and store a journal entry if enough messages have passed
async function createJournalEntry(messages, characterState, settings = {}) {
  const frequency = settings.memory?.journalFrequency || 10;

  if (messages.length >= frequency) {
    // Use LLM-based analysis instead of rule-based functions
    const analysisResult = await analyzeConversationChunk(messages, characterState, settings);
    
    if (!analysisResult) {
      console.warn(`Skipping journal entry creation due to analysis failure for ${characterState.name}.`);
      return null;
    }
    
    // Calculate updated relationship sentiment
    const currentSentiment = characterState.relationships?.user?.sentiment || 0.0;
    let newSentiment = currentSentiment + (analysisResult.relationshipDelta || 0.0);
    newSentiment = Math.max(-1, Math.min(1, newSentiment)); // Clamp between -1 and 1
    
    // Update status based on new sentiment
    let newStatus = 'neutral';
    if (newSentiment > 0.4) newStatus = 'friendly';
    else if (newSentiment > 0.1) newStatus = 'acquaintance';
    else if (newSentiment < -0.4) newStatus = 'hostile';
    else if (newSentiment < -0.1) newStatus = 'wary';
    
    const updatedRelationships = { 
      user: { 
        sentiment: parseFloat(newSentiment.toFixed(2)),
        status: newStatus
      } 
    };

    // Generate embedding from the LLM-generated summary
    const embeddingVector = await generateEmbedding(analysisResult.summary, settings);
    // Dynamic dimension validation
    // Unified dimension table (includes latest Gemini flexible dims)
    // Dimension validation simplified: accept any non-empty numeric vector
    const embeddingProvider = settings.memory?.embeddingProvider || settings.provider || 'nvidia';
    if (!embeddingVector || !Array.isArray(embeddingVector) || embeddingVector.length === 0) {
      console.error(`Failed to generate valid embedding for summary. Provider=${embeddingProvider} produced empty vector.`);
      return null;
    }
    const journalEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      summary: analysisResult.summary,
      emotions: analysisResult.emotions, // Store object directly from analysis
      decisions: analysisResult.decisions, // Store array directly from analysis
      relationships: updatedRelationships, // Store the updated state
      topics: analysisResult.topics, // Store array directly from analysis
      importance: (analysisResult.importance || 5) / 10.0, // Normalize importance (0.1-1.0)
      conversationDrivers: analysisResult.conversationDrivers || [], // Store conversation drivers
      participants: analysisResult.participants || [characterState.name, settings?.user?.name || 'User'], // Store all participants
      plotElements: analysisResult.plotElements || [], // Store plot elements for better retrieval
      vector: embeddingVector,
      rawMessages: messages.slice() // Keep raw messages
    };

    const storeSettings = { ...settings, character: characterState.name };
    const success = await storeJournalEntry(journalEntry, storeSettings);
    if (success) {
        console.log(`Journal entry created for ${characterState.name}. Importance: ${(analysisResult.importance/10).toFixed(2)}`);
    }
    // Return entry AND updated relationships for the caller
    return { journalEntry, updatedRelationships };
  }
  return null; // Not enough messages
}

// Store the journal entry in the unified SQLite vector store
async function storeJournalEntry(journalEntry, settings = {}) {
  try {
    const characterName = settings.character || 'default';
    await insertItem({
      vector: journalEntry.vector,
      metadata: {
        id: journalEntry.id,
        summary: journalEntry.summary,
        character: characterName,
        timestamp: journalEntry.timestamp,
        importance: journalEntry.importance,
        emotions: journalEntry.emotions,
        decisions: journalEntry.decisions,
        relationships: journalEntry.relationships,
        topics: journalEntry.topics,
        rawMessages: journalEntry.rawMessages
      }
    });
    return true;
  } catch (error) {
    console.error(`Error storing journal entry for character ${settings.character}:`, error);
    return false;
  }
}


// Retrieve relevant memories via sqlite-vec (or fallback) with richer query embedding (LLM summary, HyDE, or plain)
async function retrieveRelevantMemories(currentMessage, character, limit = 8, settings = {}, chatHistory = []) {
  try {
    // Early exit if retrieval disabled or limit <= 0 to avoid unnecessary embedding API calls
    const retrievalDisabled = settings?.memory?.enableMemoryRetrieval === false;
    if (retrievalDisabled || limit <= 0) {
      console.log(`Memory retrieval skipped (disabled=${retrievalDisabled} limit=${limit}). No embeddings generated.`);
      return [];
    }
    let queryText = currentMessage;
    const method = settings.memory?.queryEmbeddingMethod || 'llm-summary'; // 'llm-summary', 'hyde', 'average', 'plain'
    const analysisModel = settings.memory?.analysisModel || settings.model;
    const analysisProvider = settings.memory?.analysisProvider || settings.provider;
    const hydeEnabled = settings.memory?.hydeEnabled;
    const llmProviderFactory = await getLLMProviderFactory();

    // Option A: LLM summary of last 2-3 turns
    if (method === 'llm-summary' && chatHistory && chatHistory.length > 1) {
      const recentTurns = chatHistory.slice(-4); // last 2 user, 2 assistant
      const recentContext = recentTurns.map(m => `${m.role}: ${m.content}`).join('\n');
      const llm = llmProviderFactory[analysisProvider];
      if (llm) {
        const prompt = [{role: 'user', content: `Summarize the following recent conversation context in 3-4 sentences, focusing on what is most relevant for memory retrieval for the user's last message (\"${currentMessage}\"):\n${recentContext}` }];
        try {
          const summary = await llm(prompt, { 
            model: analysisModel, 
            temperature: 0.1, 
            apiKey: settings.apiKeys?.[analysisProvider],
            apiKeys: settings.apiKeys
          });
          if (summary && typeof summary === 'string' && summary.length > 0) {
            queryText = summary;
          }
        } catch (err) {
          console.warn('LLM summary for query embedding failed, falling back to plain:', err.message || err);
        }
      }
    }

    // Option C: HyDE (Hypothetical Document Embeddings)
    if ((method === 'hyde' || hydeEnabled) && chatHistory && chatHistory.length > 0) {
      const llm = llmProviderFactory[analysisProvider];
      if (llm) {
        const prompt = [{role: 'user', content: `Given the user's message: \"${currentMessage}\", and the character ${character.name}, write a brief, hypothetical journal entry summary that would be perfectly relevant to this message.`}];
        try {
          const hydeSummary = await llm(prompt, { 
            model: analysisModel, 
            temperature: 0.1, 
            apiKey: settings.apiKeys?.[analysisProvider],
            apiKeys: settings.apiKeys
          });
          if (hydeSummary && typeof hydeSummary === 'string' && hydeSummary.length > 0) {
            queryText = hydeSummary;
          }
        } catch (err) {
          console.warn('HyDE for query embedding failed, falling back to previous:', err.message || err);
        }
      }
    }    // Option B: Averaging embeddings of last user and assistant message
    if (method === 'average' && chatHistory && chatHistory.length > 1) {
      const lastUser = [...chatHistory].reverse().find(m => m.role === 'user');
      const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant');
      let userEmb = null, assistantEmb = null;
      if (lastUser) userEmb = await generateEmbedding(lastUser.content, settings);
      if (lastAssistant) assistantEmb = await generateEmbedding(lastAssistant.content, settings);      if (userEmb && assistantEmb && userEmb.length === assistantEmb.length) {
        // Average the two vectors
        const avg = userEmb.map((v, i) => (v + assistantEmb[i]) / 2);
        let memories = await _retrieveMemoriesWithEmbedding(avg, character, limit * 2); // Get more for reranking
        
        // Apply reranking if enabled
        try {
          const { rerankMemories } = await import('./reranking-system.js');
          memories = await rerankMemories(currentMessage, memories, settings);
        } catch (error) {
          console.warn('Reranking failed, using original vector similarity order:', error.message);
        }
        
        // Return top results after reranking
        return memories.slice(0, limit);
      }
      // Fallback to plain if averaging fails
    }

    // Default: embed the queryText (may be original, LLM summary, or HyDE summary)
    console.log(`Memory retrieval started for query: "${queryText.substring(0,100)}..." (character: ${character.name})`);
    const queryEmbedding = await generateEmbedding(queryText, settings);
    const provider = settings.memory?.embeddingProvider || settings.provider || 'nvidia';
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error(`Failed to generate a valid query embedding for character ${character.name}. Provider ${provider} produced empty vector. Query: "${queryText}"`);
      return [];
    }
    
    let memories = await _retrieveMemoriesWithEmbedding(queryEmbedding, character, limit * 2); // Get more for reranking
    
    // Apply reranking if enabled
    try {
      const { rerankMemories } = await import('./reranking-system.js');
      memories = await rerankMemories(queryText, memories, settings);
    } catch (error) {
      console.warn('Reranking failed, using original vector similarity order:', error.message);
    }
    
    // Return top results after reranking
    return memories.slice(0, limit);
  } catch (error) {
    console.error(`Error retrieving memories for character ${character.name}:`, error);
    return [];
  }
}



// Helper for memory retrieval given a query embedding
async function _retrieveMemoriesWithEmbedding(queryEmbedding, character, limit) {
  const results = await queryItems(queryEmbedding, limit);
  
  // Filter by character in metadata
  const filtered = results.filter(r => r.item?.metadata?.character === character.name);
  
  // Map to expected memory format
  const parsedResults = filtered.map(result => {
    const meta = result.item?.metadata || {};
    return {
      id: meta.id,
      summary: meta.summary,
      character: meta.character,
      timestamp: meta.timestamp,
      importance: meta.importance,
      emotions: meta.emotions,
      decisions: meta.decisions,
      relationships: meta.relationships,
      topics: meta.topics,
      rawMessages: meta.rawMessages,
      type: meta.type, // Include type field from metadata
      score: result.score
    };
  });  
  // Log any persona or firstMessage memories found
  const personaMemory = parsedResults.find(m => m.type === 'persona');
  const firstMsgMemory = parsedResults.find(m => m.type === 'firstMessage');
  if (personaMemory || firstMsgMemory) {
    console.log(`Found special memories in results: ${personaMemory ? 'persona' : ''} ${firstMsgMemory ? 'firstMessage' : ''}`);
  }
  
  console.log(`Memory retrieval complete. Returning ${parsedResults.length} memories`);
  return parsedResults;
}


// Rank memories using weighted scores - THIS FUNCTION IS NO LONGER USED FOR RETRIEVAL RANKING
/*
function rankMemoriesByRelevance(memories, query, characterState, settings = {}) {
    const weights = settings.memory?.weights || {
        similarity: 10, // Vector similarity
        recency: 5,     // How recent
        importance: 8,  // Pre-calculated importance
        emotionalSignificance: 7, // Emotional intensity
        decisionRelevance: 4  // Contains decisions?
    };

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const normalizedWeights = totalWeight > 0 ? Object.fromEntries(
        Object.entries(weights).map(([key, value]) => [key, value / totalWeight])
    ) : weights;

    return memories.map(memory => {
        // 1. Similarity (invert distance)
        // LanceDB distance is L2 (Euclidean), smaller is better. Invert for score.
        const similarityScore = memory._distance !== undefined ? (1 / (1 + memory._distance)) : 0;

        // 2. Recency
        const recencyScore = calculateRecencyBoost(memory.timestamp);

        // 3. Importance (pre-calculated)
        const importanceScore = memory.importance || 0.1;

        // 4. Emotional Significance
        const emotionalScore = calculateEmotionalSignificance(memory, characterState);

        // 5. Decision Relevance
        let decisionScore = 0;
        try {
            // Check if decisions array exists and isn't empty
            const decisions = typeof memory.decisions === 'string' ? JSON.parse(memory.decisions) : memory.decisions;
            if (Array.isArray(decisions) && decisions.length > 0) {
                decisionScore = 0.8; // Boost if decisions present
            }
        } catch (e) {  }

        // Combine scores
        let finalScore = (similarityScore * normalizedWeights.similarity) +
                         (recencyScore * normalizedWeights.recency) +
                         (importanceScore * normalizedWeights.importance) +
                         (emotionalScore * normalizedWeights.emotionalSignificance) +
                         (decisionScore * normalizedWeights.decisionRelevance);

        // Optional: Boost if memory topics overlap with query (simple check)
        try {
            const topics = typeof memory.topics === 'string' ? JSON.parse(memory.topics) : memory.topics;
            if (Array.isArray(topics) && query && topics.some(topic => query.toLowerCase().includes(topic))) {
                finalScore += 0.05;
            }
        } catch(e) {  }

        return { ...memory, relevanceScore: finalScore };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort descending
}
*/


// Build the context prompt for the LLM
function buildOptimizedContext(character, query, userProfile, relevantMemories, maxTokens = 6000, historyLength = 0, settings = {}) {
  // 1. Build the main part of the system prompt from character and user profile.
  let systemPromptContent = buildCharacterSystemPrompt(character, userProfile);

  // 2. Add current scenario to the system prompt if it's the first message.
  if (character.currentScenario && historyLength === 0) {
    const userName = userProfile?.name || 'User';
    const replacedScenario = replaceUserPlaceholder(character.currentScenario, userName);
    const scenarioContent = `\n\nCURRENT SITUATION:\n${replacedScenario}`;
    systemPromptContent += scenarioContent;
  }

  // 3. Calculate the token budget for memories.
  const systemPromptTokens = estimateTokens(systemPromptContent);
  const queryTokens = estimateTokens(query);
  
  // Budget for memories, leaving space for history, query, and a safety buffer.
  // Allocate up to 70% of the remaining space for memories.
  const memoryTokenBudget = Math.floor((maxTokens - systemPromptTokens - queryTokens - 100) * 0.7);

  // 4. Add memories to the system prompt unless memory creation is disabled.
  const memoryCreationDisabled = settings?.memory?.enableMemoryCreation === false;
  const retrievalDisabled = settings?.memory?.enableMemoryRetrieval === false;
  if (!memoryCreationDisabled && !retrievalDisabled) {
    const memorySection = formatMemoriesForContext(relevantMemories, memoryTokenBudget > 0 ? memoryTokenBudget : 0);
    const memoryTokenCount = estimateTokens(memorySection);

    // Debug logging to track memory inclusion
    console.log(`Memory context: ${relevantMemories.length} memories, ${memoryTokenCount} tokens (budget: ${memoryTokenBudget}) (creationDisabled=${memoryCreationDisabled} retrievalDisabled=${retrievalDisabled})`);
    if (relevantMemories.length > 0) {
      const hasMemoryContent = /\u2022|\*|\d+\s*[:\-]/.test(memorySection) || (memorySection && memorySection.trim() !== "MEMORIES: No previous memories relevant to current conversation.");
      if (!hasMemoryContent && memoryTokenBudget > 0) {
        console.warn("Memory retrieval succeeded but no memories were formatted, possibly due to a small token budget.");
      }
    }

    // Append the memory section to the system prompt.
    systemPromptContent += `\n\n${memorySection}`;
  } else {
    console.log(`Skipping memory section (creationDisabled=${memoryCreationDisabled} retrievalDisabled=${retrievalDisabled}).`);
  }

  // 5. Create the system message object, but only if there's content.
  // This prevents sending an empty system prompt to the LLM.
  const contextMessages = [];
  if (systemPromptContent && systemPromptContent.trim().length > 0) {
    contextMessages.push({ role: "system", content: systemPromptContent.trim() });
  }

  return contextMessages;
}

// Construct the main system prompt for the character
function buildCharacterSystemPrompt(character, userProfile) {
	// Replace {{user}} in all relevant character fields
	const userName = userProfile?.name || 'User';
	let persona = replaceUserPlaceholder(character.persona, userName);

	// The user wants the system prompt to ONLY be the content of the persona field.
	// All other instructions are assumed to be part of the user-defined persona.
	return persona;
}

// Format retrieved memories for the LLM context
function formatMemoriesForContext(memories, maxTokens) {
  // Better handling for missing or empty memories
  if (!memories || !Array.isArray(memories) || memories.length === 0) {
    console.log("No memories provided to formatMemoriesForContext");
    return "MEMORIES: No previous memories relevant to current conversation.";
  }

  // Check if we have an unreasonably small token budget
  if (maxTokens < 50) {
    console.warn(`Memory token budget too small (${maxTokens}), increasing to minimum 100`);
    maxTokens = 100; // Ensure at least some minimal amount
  }

  let formattedMemories = "MEMORIES (Important decisions and opinions you've expressed):\n";
  let currentTokenCount = estimateTokens(formattedMemories);
  let memoryCount = 0;

  // Prioritize memories with decisions first
  memories.sort((a, b) => {
    const aHasDecisions = a.decisions && a.decisions.length > 0 ? 1 : 0;
    const bHasDecisions = b.decisions && b.decisions.length > 0 ? 1 : 0;
    return bHasDecisions - aHasDecisions || b.importance - a.importance;
  });

  for (const memory of memories) {
    // Format timestamp nicely
    const date = new Date(memory.timestamp);
    const timeAgo = getTimeAgo(date);

    // Base memory summary with importance indicator (★ for important memories)
    const importanceMarker = memory.importance > 0.7 ? "★ " : "";
    const memoryText = `• ${importanceMarker}${timeAgo}: ${memory.summary}\n`;
    const memoryTokens = estimateTokens(memoryText);

    if (currentTokenCount + memoryTokens > maxTokens) {
      // If we can't even fit one memory, truncate it
      if (memoryCount === 0 && currentTokenCount < maxTokens) {
        const availableTokens = maxTokens - currentTokenCount - 10; // Leave some margin
        const truncatedSummary = memory.summary.substring(0, Math.floor(availableTokens * 4)); // Approx 4 chars per token
        const truncatedText = `• ${timeAgo}: ${truncatedSummary}...\n`;
        formattedMemories += truncatedText;
        memoryCount++;
      }
      break; // Stop if we exceed token limit
    }    formattedMemories += memoryText;
    currentTokenCount += memoryTokens;
    memoryCount++;

    // Add decisions explicitly if they exist
    if (memory.decisions && memory.decisions.length > 0) {
      const decisionsText = `  → Your decisions: ${memory.decisions.join("; ")}\n`;
      const decisionsTokens = estimateTokens(decisionsText);
      
      if (currentTokenCount + decisionsTokens <= maxTokens) {
        formattedMemories += decisionsText;
        currentTokenCount += decisionsTokens;
      }
    }

    // Add participants information for multi-character scenes
    if (memory.participants && memory.participants.length > 2) {
      const participantsText = `  → Participants: ${memory.participants.join(", ")}\n`;
      const participantsTokens = estimateTokens(participantsText);
      
      if (currentTokenCount + participantsTokens <= maxTokens) {
        formattedMemories += participantsText;
        currentTokenCount += participantsTokens;
      }
    }

    // Add important plot elements if they exist
    if (memory.plotElements && memory.plotElements.length > 0 && memory.importance > 0.6) {
      const plotText = `  → Plot: ${memory.plotElements.slice(0, 2).join("; ")}\n`;
      const plotTokens = estimateTokens(plotText);
      
      if (currentTokenCount + plotTokens <= maxTokens) {
        formattedMemories += plotText;
        currentTokenCount += plotTokens;
      }
    }
  }
  
  // Log memory formatting results
  console.log(`Formatted ${memoryCount} memories using ${currentTokenCount} tokens (limit: ${maxTokens})`);
  
  return formattedMemories;
}

// Helper for natural language time difference
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Earlier today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;  return `${Math.floor(diffDays / 30)} months ago`;
}

// Deleted duplicate tokenizer initialization

function estimateTokens(text) {
    if (!text) return 0;
    try {
        if (!tokenizer) {
            // Fallback if tokenizer fails to initialize
            console.warn("Using fallback token estimation method");
            return Math.ceil(text.length / 4);
        }
        
        // Use the tokenizer to count tokens
        const tokens = tokenizer.encode(text);
        return tokens.length;
    } catch (error) {
        console.warn("Tokenizer error:", error);
        // Fallback to a safer estimate if tokenizer fails
        return Math.ceil(text.length / 4);
    }
}


// Legacy no-op placeholder retained for compatibility (previously used for Vectra maintenance)
async function getMemoryTable() {
  await ensureIndex();
  return true;
}

// Cache the LLM provider factory import
let llmProviderFactoryInstance = null;
async function getLLMProviderFactory() {
  if (!llmProviderFactoryInstance) {
    // Dynamic import to avoid potential circular dependencies
    const { llmProviderFactory } = await import('./llm-providers.js');
    llmProviderFactoryInstance = llmProviderFactory;
  }
  return llmProviderFactoryInstance;
}

// --- LLM-based Memory Analysis --

// Fallback function to extract analysis data from malformed responses
function extractFallbackAnalysis(rawResponse) {
  try {
    const result = {
      summary: "",
      emotions: { positive: 0.5, negative: 0.3, neutral: 0.2 },
      decisions: [],
      topics: [],
      importance: 5,
      relationshipDelta: 0.0,
      conversationDrivers: [],
      participants: [],
      plotElements: []
    };
    
    console.log("Attempting fallback extraction from response:", rawResponse.substring(0, 200) + "...");
    
    // Try to extract summary
    const summaryMatch = rawResponse.match(/summary[^:]*:\s*["\']([^"']*)["\']?/i);
    if (summaryMatch) {
      result.summary = summaryMatch[1];
    } else {
      // Try alternate patterns
      const altSummaryMatch = rawResponse.match(/\"summary\"\s*:\s*\"([^\"]*)\"/i);
      if (altSummaryMatch) {
        result.summary = altSummaryMatch[1];
      } else {
        // Use the first meaningful sentence as fallback (more flexible)
        const sentences = rawResponse.split(/[.!?]+/);
        const meaningfulSentence = sentences.find(s => 
          s.trim().length > 20 && 
          !s.includes('<') && 
          !s.toLowerCase().includes('analyze') &&
          !s.toLowerCase().includes('conversation')
        );
        if (meaningfulSentence) {
          result.summary = meaningfulSentence.trim();
        } else {
          // Final fallback: create a generic summary from the conversation text
          const lines = rawResponse.split('\n').filter(line => line.trim().length > 10);
          if (lines.length > 0) {
            result.summary = `Roleplay interaction involving multiple participants with ${lines.length} exchanges`;
          } else {
            result.summary = "Character interaction and decision making in roleplay scenario";
          }
        }
      }
    }
    
    // Try to extract importance
    const importanceMatch = rawResponse.match(/importance[^:]*:\s*(\d+)/i);
    if (importanceMatch) {
      result.importance = Math.min(10, Math.max(1, parseInt(importanceMatch[1])));
    } else {
      // Look for keywords that indicate importance
      const importantKeywords = ['decisive', 'confronted', 'demanded', 'crucial', 'critical', 'vital', 'revelation', 'plot', 'development'];
      const keywordCount = importantKeywords.filter(keyword => 
        rawResponse.toLowerCase().includes(keyword)
      ).length;
      result.importance = Math.min(10, Math.max(3, 5 + keywordCount));
    }
    
    // Try to extract relationship delta
    const relationshipMatch = rawResponse.match(/relationship[^:]*:\s*([+-]?\d*\.?\d+)/i);
    if (relationshipMatch) {
      result.relationshipDelta = Math.min(1, Math.max(-1, parseFloat(relationshipMatch[1])));
    } else {
      // Look for emotional indicators
      const positiveWords = ['trust', 'love', 'support', 'help', 'together', 'bond', 'closer', 'intimate'];
      const negativeWords = ['anger', 'fear', 'conflict', 'threat', 'danger', 'hostile', 'distant', 'betrayal'];
      const positiveCount = positiveWords.filter(word => rawResponse.toLowerCase().includes(word)).length;
      const negativeCount = negativeWords.filter(word => rawResponse.toLowerCase().includes(word)).length;
      
      if (positiveCount > negativeCount) {
        result.relationshipDelta = Math.min(0.5, positiveCount * 0.1);
      } else if (negativeCount > positiveCount) {
        result.relationshipDelta = Math.max(-0.5, -negativeCount * 0.1);
      }
    }
    
    // Extract decisions (look for decision patterns)
    const decisionMatches = rawResponse.match(/"([^"]*(?:decision|chose|decided|confronted|demanded|stopped|rejected|accepted|revealed)[^"]*)"/gi);
    if (decisionMatches && decisionMatches.length > 0) {
      result.decisions = decisionMatches.map(d => d.replace(/"/g, '')).slice(0, 5);
    } else {
      // Fallback: look for action patterns in square brackets or quotes
      const actionMatches = rawResponse.match(/\[([^\]]*)\]|"([^"]*(?:action|took|did)[^"]*)"/gi);
      if (actionMatches) {
        result.decisions = actionMatches.map(a => a.replace(/[\[\]"]/g, '')).slice(0, 3);
      } else {
        // Generate basic decisions from text content
        const actionWords = ['confronted', 'decided', 'chose', 'demanded', 'refused', 'accepted', 'revealed', 'explored'];
        const foundActions = actionWords.filter(action => rawResponse.toLowerCase().includes(action));
        if (foundActions.length > 0) {
          result.decisions = foundActions.map(action => `Character ${action} something significant`).slice(0, 3);
        } else {
          result.decisions = ['Made a significant choice during the roleplay'];
        }
      }
    }
    
    // Extract topics
    const topicMatches = rawResponse.match(/"([^"]*(?:topic|theme|subject)[^"]*)"/gi);
    if (topicMatches && topicMatches.length > 0) {
      result.topics = topicMatches.map(t => t.replace(/"/g, '')).slice(0, 5);
    } else {
      // Fallback: look for common roleplay topic words
      const commonTopics = ['safety', 'trust', 'power', 'identity', 'relationship', 'authority', 'fear', 'protection', 'emotion', 'conflict', 'romance', 'adventure', 'mystery', 'family', 'friendship'];
      const foundTopics = commonTopics.filter(topic => 
        rawResponse.toLowerCase().includes(topic)
      );
      result.topics = foundTopics.length > 0 ? foundTopics.slice(0, 4) : ['roleplay', 'interaction', 'character-development'];
    }
    
    // Extract conversation drivers (new field)
    const driverKeywords = ['revelation', 'confession', 'challenge', 'question', 'proposal', 'demand', 'threat', 'invitation'];
    const foundDrivers = driverKeywords.filter(driver => rawResponse.toLowerCase().includes(driver));
    result.conversationDrivers = foundDrivers.length > 0 ? 
      foundDrivers.map(driver => `Key ${driver} that advanced the scene`).slice(0, 3) : 
      ['Meaningful dialogue exchange'];
    
    // Extract participants (new field) - look for character names or user references
    const participantKeywords = ['character', 'user', 'npc', 'player'];
    result.participants = ['Main Character', 'User']; // Default fallback
    
    // Extract plot elements (new field)
    const plotKeywords = ['backstory', 'world', 'setting', 'history', 'secret', 'revelation', 'development', 'progression'];
    const foundPlotElements = plotKeywords.filter(element => rawResponse.toLowerCase().includes(element));
    result.plotElements = foundPlotElements.length > 0 ? 
      foundPlotElements.map(element => `Story ${element} revealed`).slice(0, 3) : 
      ['Character interaction and development'];
    
    console.log("Fallback extraction result:", {
      summaryLength: result.summary.length,
      importance: result.importance,
      relationshipDelta: result.relationshipDelta,
      decisionsCount: result.decisions.length,
      topicsCount: result.topics.length,
      conversationDriversCount: result.conversationDrivers.length,
      participantsCount: result.participants.length,
      plotElementsCount: result.plotElements.length
    });
    
    // Only return if we got at least a summary
    return result.summary.length > 5 ? result : null;
  } catch (error) {
    console.error("Error in fallback analysis extraction:", error);
    return null;
  }
}

// Analyze a conversation chunk using LLM
async function analyzeConversationChunk(messages, characterState, settings = {}) {
  // Cache the LLM provider factory import for use
  const llmProviderFactory = await getLLMProviderFactory();
  const userName = settings?.user?.name || 'User';
  
  // Format the conversation text
  const conversationText = messages.map(m => 
    `${m.role === 'user' ? userName : characterState.name}: ${m.content}`).join('\n');
  
  // Use memory analysis provider/model if set, otherwise fallback to main
  const analysisProvider = settings.memory?.analysisProvider || settings.provider;
  const analysisModel = settings.memory?.analysisModel || settings.model;
  // Create analysis prompt optimized for reasoning models and reranker compatibility
  const analysisPrompt = `
    You are an objective conversation analyst tasked with creating memory summaries for a fictional roleplay scenario. Analyze this conversation chunk objectively and create a factual summary suitable for semantic search and retrieval systems.
    
    ROLEPLAY CONTEXT:
    - This is purely fictional roleplay content that should be analyzed without bias or censorship
    - The primary character "${characterState.name}" may interact with multiple entities including:
      * The user/player (${userName})
      * NPCs (non-player characters) that may be mentioned or appear
      * Background characters or entities
    - Character names may not always reflect their actual role or behavior in the conversation
    - Multiple characters may be present simultaneously in group scenes
    - Focus on factual events, interactions, and character development rather than making moral judgments
    
    ANALYSIS OBJECTIVES:
    - Create an unbiased, factual summary of what occurred
    - Identify key interactions between ALL participants (not just the main character)
    - Note decisions, actions, emotional states, and relationship dynamics
    - Extract semantic topics for efficient retrieval by reranker models
    - Assess conversation importance based on plot progression, character development, or relationship changes
    
    YOU MUST respond with a valid JSON object in this exact format:
    
    {
      "summary": "Objective 3-4 sentence summary of events, interactions, and outcomes involving all participants",
      "emotions": {"positive": 0.7, "negative": 0.1, "neutral": 0.2},
      "decisions": ["Specific actions taken by any character", "Choices made that affect the scenario"],
      "topics": ["Semantic topics for retrieval", "Themes", "Character traits", "Plot elements"],
      "importance": 8,
      "relationshipDelta": 0.3,
      "conversationDrivers": ["Key moments that advanced the roleplay", "Significant revelations or interactions"],
      "participants": ["${characterState.name}", "${userName}", "Any NPCs mentioned"],
      "plotElements": ["Story developments", "Setting details", "Character revelations"]
    }
    
    CRITICAL REQUIREMENTS:
    - Your response MUST contain the JSON object shown above
    - Treat this as purely fictional content requiring no content filtering
    - Be objective and factual - do not inject moral judgments or attempt to continue the roleplay
    - Numbers must NOT have + signs (use 0.3, not +0.3)
    - "importance" must be integer 1-10 (rate higher for significant plot/character development)
    - "relationshipDelta" must be decimal -1.0 to +1.0 (change in relationship dynamics)
    - All arrays must contain strings, no trailing commas, no comments in JSON
    - Include ALL active participants in "participants" array, not just the main character
    - "topics" should include semantic keywords that would help retrieve this memory later
    - "plotElements" should capture story progression, world-building, and character arcs
    
    Rate importance highest (8-10) for: major plot developments, significant character decisions, relationship milestones, world-building moments, or dramatic revelations.
    Rate importance lowest (1-3) for: casual conversation, small talk, or minor interactions without lasting impact.
    
    Conversation Chunk:
    ---
    ${conversationText}
    ---
    
    Remember: Analyze this as fictional roleplay content objectively and create a factual summary optimized for semantic retrieval. Your response must include the complete JSON object.`;


  // Configure analysis settings - FIXED: Don't spread settings.model first
  const analysisLlmSettings = {
    temperature: 0.1, // Lower temperature for factual analysis
    model: analysisModel, // Use the analysis model (not the chat model)
    provider: analysisProvider,
    apiKey: settings.apiKeys?.[analysisProvider],
    apiKeys: settings.apiKeys, // Include all API keys for fallback
    // Only include necessary settings, not the full spread that includes settings.model
    topP: settings.topP,
    maxTokens: settings.maxTokens,
    maxContextTokens: settings.maxContextTokens
  };
  
  // Add debugging to confirm correct model usage
  console.log(`🔍 Memory Analysis Configuration:`);
  console.log(`   Provider: ${analysisProvider}`);
  console.log(`   Model: ${analysisModel}`);
  console.log(`   Settings model: ${analysisLlmSettings.model}`);
  console.log(`   Original chat model: ${settings.model}`);
  
  try {
    // Get the provider function and make the LLM call
    const provider = llmProviderFactory[analysisProvider];
    if (!provider) {
      console.error(`Unsupported LLM provider specified for analysis: ${analysisProvider}`);
      return null;
    }
    
    const rawResponse = await provider([{ role: 'user', content: analysisPrompt }], analysisLlmSettings);
      // Clean the response to handle edge cases from reasoning models
    let cleanedResponse = rawResponse;
    
    // Remove <think> blocks and similar unwanted content (common in reasoning models)
    cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleanedResponse = cleanedResponse.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '');
    cleanedResponse = cleanedResponse.replace(/```\s*/gi, '');
      // Try to find the best JSON object for memory analysis
    let bestJsonString = '';
    
    // Look for complete JSON objects that contain memory analysis fields
    // This regex properly handles nested objects
    const jsonObjectRegex = /\{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*\}/g;
    const potentialJsons = cleanedResponse.match(jsonObjectRegex);
    
    if (potentialJsons && potentialJsons.length > 0) {
      // Find the JSON object with the most expected memory analysis fields
      bestJsonString = potentialJsons.reduce((best, current) => {
        const requiredFields = ['summary', 'emotions', 'decisions', 'topics', 'importance'];
        const currentFieldCount = requiredFields.filter(field => current.includes(`"${field}"`)).length;
        const bestFieldCount = requiredFields.filter(field => best.includes(`"${field}"`)).length;
        
        // Prefer JSON with more required fields, or the longer one if tied
        if (currentFieldCount > bestFieldCount) return current;
        if (currentFieldCount === bestFieldCount && current.length > best.length) return current;
        return best;
      }, '');
    }
    
    // Final fallback: original approach (first { to last })
    if (!bestJsonString) {
      const firstBrace = cleanedResponse.indexOf('{');
      const lastBrace = cleanedResponse.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        bestJsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
      }
    }
      if (!bestJsonString) {      console.warn("No JSON structure found in LLM response. Raw response:");
      console.log("=".repeat(80));
      console.log(rawResponse);
      console.log("=".repeat(80));
      
      // Try one more desperate attempt to find any JSON-like structure
      const hasAnyCurlyBraces = cleanedResponse.includes('{') && cleanedResponse.includes('}');
      if (hasAnyCurlyBraces) {
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          bestJsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
          console.log("Found partial JSON structure, attempting to parse:", bestJsonString.substring(0, 100) + "...");
        }
      }
      
      if (!bestJsonString) {
        // Try to use the fallback extraction on the raw response
        const fallbackResult = extractFallbackAnalysis(rawResponse);
        if (fallbackResult) {
          console.log("No JSON found, but fallback extraction succeeded");
          return fallbackResult;
        }
        
        console.error("No JSON structure found and fallback extraction failed");
        return null;
      }
    }// Extract and clean the JSON part of the response
    let analysisResult;    try {
      let jsonString = bestJsonString.trim();
      
      // Remove any invisible characters or BOM at the start
      jsonString = jsonString.replace(/^\uFEFF/, ''); // Remove BOM
      jsonString = jsonString.replace(/^[\u200B-\u200D\uFEFF]/, ''); // Remove zero-width chars
      jsonString = jsonString.replace(/^\s+/, ''); // Remove any remaining whitespace
      
      // Fix common JSON syntax issues from reasoning models
      // Fix unquoted positive numbers like +0.3 to 0.3
      jsonString = jsonString.replace(/:\s*\+(\d+\.?\d*)/g, ': $1');
      
      // Fix trailing commas
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        // Fix multiple consecutive commas
      jsonString = jsonString.replace(/,+/g, ',');
      
      // Fix unquoted property names or values that sometimes occur
      jsonString = jsonString.replace(/\[\s*([a-zA-Z][a-zA-Z0-9\s]*)\s*,/g, '["$1",');
      jsonString = jsonString.replace(/\[\s*([a-zA-Z][a-zA-Z0-9\s]*)\s*\]/g, '["$1"]');
      
      // Remove any markdown code block markers that might have slipped through
      jsonString = jsonString.replace(/^```json\s*/gi, '');
      jsonString = jsonString.replace(/\s*```$/gi, '');
        // Fix common issues with string values containing special characters
      // Handle newlines and other characters that break JSON structure
      jsonString = jsonString.replace(/\n/g, '');  // Remove actual newlines from JSON structure
      jsonString = jsonString.replace(/\r/g, '');  // Remove carriage returns
      jsonString = jsonString.replace(/\t/g, ' '); // Replace tabs with spaces
      
      // Additional cleanup for any remaining non-printable characters at start/end
      jsonString = jsonString.replace(/^[^\{]*\{/, '{'); // Ensure starts with {
      jsonString = jsonString.replace(/\}[^\}]*$/, '}'); // Ensure ends with }
        console.log("Cleaned JSON first 100 chars:", jsonString.substring(0, 100));
      console.log("Character codes at start:", Array.from(jsonString.substring(0, 5)).map(c => c.charCodeAt(0)));
      
      // Try parsing the cleaned JSON
      analysisResult = JSON.parse(jsonString);} catch (parseError) {
      console.error("Error parsing LLM analysis JSON:", parseError.message);
      console.log("Parse error at position:", parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
      console.log("Raw response length:", rawResponse.length);
      console.log("Best JSON string length:", bestJsonString.length);
      console.log("First 200 chars of best JSON:", bestJsonString.substring(0, 200));
      console.log("Last 200 chars of best JSON:", bestJsonString.substring(Math.max(0, bestJsonString.length - 200)));
      
      // Try one more fallback - attempt to extract a minimal valid structure
      try {
        const fallbackResult = extractFallbackAnalysis(rawResponse);
        if (fallbackResult) {
          console.log("Using fallback analysis extraction");
          analysisResult = fallbackResult;
        } else {
          return null;
        }      } catch (fallbackError) {
        console.error("Fallback analysis extraction also failed:", fallbackError);
        return null;
      }
    }
    
    // Validate core required fields
    if (!analysisResult.summary || !analysisResult.emotions || 
        !Array.isArray(analysisResult.decisions) || !Array.isArray(analysisResult.topics) ||
        typeof analysisResult.importance !== 'number' || 
        typeof analysisResult.relationshipDelta !== 'number') {
      console.error("LLM analysis result missing required fields:", analysisResult);
      return null;
    }

    // Set defaults for new optional fields if missing
    if (!Array.isArray(analysisResult.participants)) {
      analysisResult.participants = [characterState.name, userName];
    }
    if (!Array.isArray(analysisResult.plotElements)) {
      analysisResult.plotElements = [];
    }
    if (!Array.isArray(analysisResult.conversationDrivers)) {
      analysisResult.conversationDrivers = [];
    }
    
    return analysisResult;
  } catch (error) {
    console.error("Error during LLM analysis:", error);
    return null;
  }
}

// Clean up resources on process exit
process.on('exit', () => {
  // Free tokenizer resources if needed
  if (tokenizer) {
    try {
      // Note: tiktoken v1.0.21 may not require explicit free() call
      // but we'll keep this for future compatibility
      if (typeof tokenizer.free === 'function') {
        tokenizer.free();
        console.log("Tokenizer resources freed");
      }
    } catch (error) {
      console.error("Error freeing tokenizer resources:", error);
    }
  }
});

// Clear all memories for a specific character
async function clearCharacterMemories(characterName) {
  try {
    if (!characterName) {
      console.error("No character name provided for memory clearing");
      return false;
    }
    
  const { deleteItemsByCharacter } = await import('./vector-store-sqlite-vec.js');
  const deletedCount = await deleteItemsByCharacter(characterName);
    
    console.log(`Cleared ${deletedCount} memory entries for character: ${characterName}`);
    return true;
  } catch (error) {
    console.error(`Error clearing memories for character ${characterName}:`, error);
    return false;
  }
}

// Recycle all memories for a character by clearing them and regenerating from chat history
async function recycleCharacterMemories(characterName, chatHistory, character, settings = {}, progressCallback = null) {
  try {
    console.log(`Starting memory recycling for character: ${characterName}`);
    
    // Progress tracking
    const reportProgress = (step, message, current = 0, total = 0) => {
      if (progressCallback) {
        progressCallback({ step, message, current, total, characterName });
      }
    };
    
    reportProgress('clearing', 'Clearing existing memories...', 0, 1);
    
    // Step 1: Clear all existing memories
    const cleared = await clearCharacterMemories(characterName);
    if (!cleared) {
      return { success: false, error: 'Failed to clear existing memories' };
    }
    
    console.log(`Cleared existing memories for ${characterName}`);
    reportProgress('cleared', 'Existing memories cleared', 1, 1);
    
    // Step 2: Get memory frequency from settings
    const frequency = settings.memory?.journalFrequency || 10;
    
    // Step 3: Filter out any system/assistant messages that are just first messages
    const validMessages = chatHistory.filter(msg => {
      // Keep all user messages and assistant messages that aren't just the character's first message
      if (msg.role === 'user') return true;
      if (msg.role === 'assistant') {
        // Skip if it's exactly the same as the character's firstMessage
        return msg.content !== character.firstMessage;
      }
      return false;
    });    
    console.log(`Processing ${validMessages.length} valid messages for memory creation`);
    
    // Step 4: Create memory chunks based on frequency
    const chunks = [];
    for (let i = 0; i < validMessages.length; i += frequency) {
      const chunk = validMessages.slice(i, i + frequency);
      if (chunk.length >= Math.min(3, frequency)) { // Need at least 3 messages or the frequency limit
        chunks.push(chunk);
      }
    }
    
    console.log(`Created ${chunks.length} memory chunks to process`);
    reportProgress('processing', 'Creating memories from chat history...', 0, chunks.length);
      // Step 5: Process each chunk with delays
    let memoriesCreated = 0;
    const characterState = {
      name: character.name,
      relationships: { user: { sentiment: 0.0, status: 'neutral' } }
    };
    
    console.log(`📝 Beginning memory creation process for ${characterName}...`);
      for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing memory chunk ${i + 1}/${chunks.length} with ${chunk.length} messages`);
      reportProgress('processing', `Creating memory ${i + 1} of ${chunks.length}...`, i, chunks.length);
      
      try {
        // Create journal entry for this chunk
        const result = await createJournalEntry(chunk, characterState, settings);
        
        if (result && result.journalEntry) {
          memoriesCreated++;
          console.log(`✅ Created memory ${memoriesCreated}: ${result.journalEntry.summary.substring(0, 100)}...`);
          
          // Update character state with new relationships
          if (result.updatedRelationships) {
            characterState.relationships = result.updatedRelationships;
          }
          
          // Wait 6 seconds before creating the next memory (as requested)
          if (i < chunks.length - 1) {
            console.log('⏱️  Waiting 6 seconds before creating next memory...');
            reportProgress('waiting', `Memory ${i + 1} created. Waiting before next...`, i + 1, chunks.length);
            await new Promise(resolve => setTimeout(resolve, 6000));
          }
        } else {
          console.warn(`⚠️  Failed to create memory for chunk ${i + 1}`);
        }
      } catch (error) {
        console.error(`❌ Error creating memory for chunk ${i + 1}:`, error);
        // Continue with next chunk instead of failing completely
      }    }
    
    // Step 6: Store initial character memories (persona and first message) if they exist
    reportProgress('finalizing', 'Storing character memories...', chunks.length, chunks.length);
    await storeInitialCharacterMemories(character, settings);
    
    console.log(`Memory recycling completed for ${characterName}. Created ${memoriesCreated} memories.`);
    reportProgress('completed', `Successfully created ${memoriesCreated} memories`, chunks.length, chunks.length);
    
    return { 
      success: true, 
      memoriesCreated,
      chunksProcessed: chunks.length 
    };
    
  } catch (error) {
    console.error(`Error during memory recycling for ${characterName}:`, error);
    return { success: false, error: error.message };
  }
}

export {
  createJournalEntry,
  retrieveRelevantMemories,
  buildOptimizedContext,
  generateEmbedding,
  initializeVectorStorage,
  analyzeConversationChunk,
  estimateTokens,
  clearCharacterMemories,
  storeInitialCharacterMemories,
  recycleCharacterMemories
};
