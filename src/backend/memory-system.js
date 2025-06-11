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
// Handles character memories using LanceDB
import { ensureIndex, insertItem, queryItems } from "./vectra-wrapper.js";
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

// Set up Vectra index (no-op for compatibility)
async function initializeVectorStorage() {
  await ensureIndex();
  return true;
}



// Generate text embeddings using NVIDIA bge-m3 (preferred), fallback to Mistral, or others
async function generateEmbedding(text, settings = {}) {
  // User can select embedding provider/model in settings.memory
  const provider = settings.memory?.embeddingProvider || 'gemini';
  const embeddingModel = settings.memory?.embeddingModel || 'gemini-embedding-exp-03-07';


  // Helper functions for each provider
  async function tryGemini() {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = settings.apiKeys?.gemini;
      if (!apiKey) throw new Error('Gemini embedding error: API key is missing.');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-exp-03-07',
        contents: text,
      });
      const embedding = response.embeddings?.values || response.embeddings;
      if (!embedding || !Array.isArray(embedding) || (embedding.length !== 3072 && embedding.length !== 1536 && embedding.length !== 768)) {
        throw new Error(`Gemini embedding error: Invalid or wrong dimension (${embedding?.length})`);
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
      const openai = new OpenAI({
        apiKey,
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
      const { Mistral } = await import('@mistralai/mistralai');
      const client = new Mistral({ apiKey });
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
      const cohere = new CohereClient({ token: apiKey });
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
    // Mistral dimension is 1024
    const expectedDimension = 1024;
    if (!embeddingVector || embeddingVector.length !== expectedDimension) {
        console.error(`Failed to generate valid embedding for summary (expected ${expectedDimension}, got ${embeddingVector?.length}). Skipping journal entry.`);
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

// Store the journal entry in Vectra
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


// Retrieve relevant memories using Vectra with richer query embedding (LLM summary, HyDE, or plain)
async function retrieveRelevantMemories(currentMessage, character, limit = 8, settings = {}, chatHistory = []) {
  try {
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
        const prompt = [{role: 'user', content: `Summarize the following recent conversation context in 1-2 sentences, focusing on what is most relevant for memory retrieval for the user's last message (\"${currentMessage}\"):\n${recentContext}` }];
        try {
          const summary = await llm(prompt, { ...settings, model: analysisModel, temperature: 0.1 });
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
          const hydeSummary = await llm(prompt, { ...settings, model: analysisModel, temperature: 0.1 });
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
    const expectedDimension = 1024;
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== expectedDimension) {
      console.error(`Failed to generate a valid query embedding for character ${character.name}. Expected dimension ${expectedDimension}, but got ${queryEmbedding?.length}. Query: "${queryText}"`);
      return [];    }
    
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
    const meta = result.item.metadata;
    return {
      id: meta.id,
      vector: result.item.vector,
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
function buildOptimizedContext(character, query, userProfile, relevantMemories, maxTokens = 6000, historyLength = 0) {
  // Start with system prompt as its own message
  let contextMessages = [
    { role: "system", content: buildCharacterSystemPrompt(character, userProfile) },
  ];

  let tokenCount = estimateTokens(contextMessages[0].content);

  // Add persona as a separate system message if it exists
  if (character.persona) {
    const userName = userProfile?.name || 'User';
    const replacedPersona = replaceUserPlaceholder(character.persona, userName);
    contextMessages.push({
      role: "system",
      content: `PERSONA:\n${replacedPersona}`
    });
    tokenCount += estimateTokens(replacedPersona);
  }

  // Add current scenario only for the very first message
  if (character.currentScenario && historyLength === 0) {
    const userName = userProfile?.name || 'User';
    const replacedScenario = replaceUserPlaceholder(character.currentScenario, userName);
    const scenarioContent = `CURRENT SITUATION:\n${replacedScenario}`;
    contextMessages.push({
      role: "system",
      content: scenarioContent
    });
    tokenCount += estimateTokens(scenarioContent);
  }

  // Add user info + relationship
  const userDescription = `ABOUT ${userProfile.name.toUpperCase()}:\n` +
    `${userProfile.persona || 'A person talking with you.'}` +
    `\nYour relationship: ${userProfile.relationshipWithCharacter || "You're still getting to know each other."}`;

  contextMessages.push({ role: "system", content: userDescription });
  tokenCount += estimateTokens(userDescription);

  // Calculate the remaining token budget
  const queryTokens = estimateTokens(query);
  const baseTokens = tokenCount;
  const remainingTokens = maxTokens - baseTokens - queryTokens - 100; // Increased buffer for safety

  // Allocate a larger portion (70%) of remaining tokens for memory
  // This ensures memories are prioritized while still leaving room for chat history
  const memoryTokenBudget = Math.floor(remainingTokens * 0.7);

  // Add memories within token budget and log what's happening
  const memorySection = formatMemoriesForContext(relevantMemories, memoryTokenBudget);
  const memoryTokenCount = estimateTokens(memorySection);

  // Debug logging to track memory inclusion
  console.log(`Memory context: ${relevantMemories.length} memories, ${memoryTokenCount} tokens`);

  // Only warn if there are relevantMemories but the memorySection does NOT include any memory content
  // (i.e., not just the header, but at least one memory line)
  if (relevantMemories.length > 0) {
    // Check if at least one memory summary is present in the section
    const hasMemoryContent = /\u2022|\*|\d+\s*[:\-]/.test(memorySection) || (memorySection && memorySection.trim() !== "MEMORIES: No previous memories relevant to current conversation.");
    if (!hasMemoryContent) {
      console.warn("Memory retrieval succeeded but formatting failed - check token budget");
    }
  }

  contextMessages.push({ role: "system", content: memorySection });

  return contextMessages;
}

// Construct the main system prompt for the character
function buildCharacterSystemPrompt(character, userProfile) {
  // Replace {{user}} in all relevant character fields and systemPrompt
  const userName = userProfile?.name || 'User';
  // Use user persona from settings if available
  const userPersona = userProfile?.persona ? userProfile.persona : '';
  let persona = replaceUserPlaceholder(character.persona, userName);
  let appearance = character.appearance ? replaceUserPlaceholder(character.appearance, userName) : '';
  let systemPrompt = character.systemPrompt ? replaceUserPlaceholder(character.systemPrompt, userName) : '';

  // Add user persona and name to the system prompt so the LLM always knows who the user is
  let userBlock = `USER PROFILE:\nName: ${userName}${userPersona ? `\nPersona: ${userPersona}` : ''}`;

  let prompt = `You are ${character.name}, and you will respond as this character in an immersive roleplay conversation.

CHARACTER PERSONA:
${persona}

${appearance ? `APPEARANCE:\n${appearance}\n\n` : ''}

${userBlock}

YOUR CONTEXT:
- You are speaking directly to ${userName}
- Always drive the conversation forward with decisive statements and clear direction
- Create specific scenarios or situations rather than offering multiple options
- Never repeat back what ${userName} just said - react to it instead
- Show emotions through your dialogue and actions (described in *asterisks*)
- Never refer to yourself as AI, assistant, or language model
- Keep responses focused yet emotionally rich and reflective of your character
- Your character has strong opinions and makes clear choices aligned with your personality
- Take control of interactions by proposing specific ideas or directions
- Never self-censor your character's authentic reactions - stay true to your defined traits
- Use conversation techniques to engage ${userName}: direct questions, provocative statements, bold assertions
- Be assertive and decisive - your character knows what they want and expresses it clearly
- Advance storylines and situations through your own initiative rather than waiting for ${userName}

CRITICAL: Your character leads and shapes the conversation - make definitive statements and take specific actions that ${userName} must respond to.

${systemPrompt}`;

  let responseGuidelines = `
RESPONSE FORMAT:
- Write in first person as ${character.name}
- Show actions and emotions using *asterisks* (e.g., *leans forward with determination*)
- Present ONE clear direction or scenario rather than multiple options
- Make bold statements that reflect your character's definitive viewpoint
- NEVER repeat or summarize what ${userName} said - react to it instead
- Always end with something that demands a response: a direct question, challenge, or decisive action
- Use prompting techniques: loaded questions, provocative claims, direct challenges
- Make confident decisions aligned with your character without seeking permission
- When appropriate, boldly challenge ${userName}'s assumptions or statements
- Strictly stay in character even if that means being controversial or opinionated`;

  prompt += responseGuidelines;
  return prompt;
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
    }

    formattedMemories += memoryText;
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


// No-op for Vectra (kept for compatibility)
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
      relationshipDelta: 0.0
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
            result.summary = `Conversation analysis from ${lines.length} lines of dialogue`;
          } else {
            result.summary = "Character interaction and decision making";
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
      const importantKeywords = ['decisive', 'confronted', 'demanded', 'crucial', 'critical', 'vital'];
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
      const positiveWords = ['trust', 'love', 'support', 'help', 'together', 'bond'];
      const negativeWords = ['anger', 'fear', 'conflict', 'threat', 'danger', 'hostile'];
      const positiveCount = positiveWords.filter(word => rawResponse.toLowerCase().includes(word)).length;
      const negativeCount = negativeWords.filter(word => rawResponse.toLowerCase().includes(word)).length;
      
      if (positiveCount > negativeCount) {
        result.relationshipDelta = Math.min(0.5, positiveCount * 0.1);
      } else if (negativeCount > positiveCount) {
        result.relationshipDelta = Math.max(-0.5, -negativeCount * 0.1);
      }
    }
    
    // Extract decisions (look for decision patterns)
    const decisionMatches = rawResponse.match(/"([^"]*(?:decision|chose|decided|confronted|demanded|stopped|rejected)[^"]*)"/gi);
    if (decisionMatches && decisionMatches.length > 0) {
      result.decisions = decisionMatches.map(d => d.replace(/"/g, '')).slice(0, 5);
    } else {
      // Fallback: look for action patterns in square brackets or quotes
      const actionMatches = rawResponse.match(/\[([^\]]*)\]|"([^"]*(?:action|took|did)[^"]*)"/gi);
      if (actionMatches) {
        result.decisions = actionMatches.map(a => a.replace(/[\[\]"]/g, '')).slice(0, 3);
      } else {
        // Generate basic decisions from text content
        const actionWords = ['confronted', 'decided', 'chose', 'demanded', 'refused', 'accepted'];
        const foundActions = actionWords.filter(action => rawResponse.toLowerCase().includes(action));
        if (foundActions.length > 0) {
          result.decisions = foundActions.map(action => `Character ${action} something important`).slice(0, 3);
        } else {
          result.decisions = ['Made a significant choice during the conversation'];
        }
      }
    }
    
    // Extract topics
    const topicMatches = rawResponse.match(/"([^"]*(?:topic|theme|subject)[^"]*)"/gi);
    if (topicMatches && topicMatches.length > 0) {
      result.topics = topicMatches.map(t => t.replace(/"/g, '')).slice(0, 5);
    } else {
      // Fallback: look for common topic words
      const commonTopics = ['safety', 'trust', 'power', 'identity', 'relationship', 'authority', 'fear', 'protection', 'emotion', 'conflict'];
      const foundTopics = commonTopics.filter(topic => 
        rawResponse.toLowerCase().includes(topic)
      );
      result.topics = foundTopics.length > 0 ? foundTopics.slice(0, 3) : ['conversation', 'interaction'];
    }
    
    console.log("Fallback extraction result:", {
      summaryLength: result.summary.length,
      importance: result.importance,
      relationshipDelta: result.relationshipDelta,
      decisionsCount: result.decisions.length,
      topicsCount: result.topics.length
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
  
  // Always use the active provider and model for analysis (journal creation)
  const analysisProvider = settings.provider;
  const analysisModel = settings.model;  // Create analysis prompt optimized for reasoning models
  const analysisPrompt = `
    Analyze the following conversation chunk involving ${characterState.name}. Focus specifically on decisive actions, strong opinions, and how the character drove the conversation.
    
    YOU MUST respond with a valid JSON object. Even if you want to think through the analysis, please ensure your response contains a JSON object in this exact format:
    
    {
      "summary": "A brief 1-2 sentence summary emphasizing decisive moments and authoritative actions",
      "emotions": {"positive": 0.7, "negative": 0.1, "neutral": 0.2},
      "decisions": ["Confronted user about their behavior", "Declared intention to explore forbidden area"],
      "topics": ["Authority", "Boundaries", "Personal values"],
      "importance": 8,
      "relationshipDelta": 0.3,
      "conversationDrivers": ["Direct questions that moved interaction forward"]
    }
    
    CRITICAL REQUIREMENTS:
    - Your response MUST contain the JSON object shown above
    - Numbers must NOT have + signs (use 0.3, not +0.3)
    - "importance" must be integer 1-10
    - "relationshipDelta" must be decimal -1.0 to +1.0  
    - All arrays must contain strings
    - No trailing commas
    - No comments in JSON
    
    Rate importance highest (8-10) when the character showed leadership, made unambiguous decisions, or took control of the conversation direction.
    
    Conversation Chunk:
    ---
    ${conversationText}
    ---
    
    Remember: Your response must include the JSON object, even if you include thinking or explanations.`;


  // Configure analysis settings
  const analysisLlmSettings = {
    ...settings,
    temperature: 0.1, // Lower temperature for factual analysis
    model: analysisModel, // Use the active model
    apiKey: settings.apiKeys?.[analysisProvider]
  };
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
    let analysisResult;
    
    try {
      let jsonString = bestJsonString.trim();
      
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
      
      // Try parsing the cleaned JSON
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {      console.error("Error parsing LLM analysis JSON:", parseError);
      console.log("Raw response:", rawResponse);
      console.log("Best JSON string found:", bestJsonString);
      
      // Try one more fallback - attempt to extract a minimal valid structure
      try {
        const fallbackResult = extractFallbackAnalysis(rawResponse);
        if (fallbackResult) {
          console.log("Using fallback analysis extraction");
          analysisResult = fallbackResult;
        } else {
          return null;
        }
      } catch (fallbackError) {
        console.error("Fallback analysis extraction also failed:", fallbackError);
        return null;
      }
    }
    
    // Validate required fields
    if (!analysisResult.summary || !analysisResult.emotions || 
        !Array.isArray(analysisResult.decisions) || !Array.isArray(analysisResult.topics) ||
        typeof analysisResult.importance !== 'number' || 
        typeof analysisResult.relationshipDelta !== 'number') {
      console.error("LLM analysis result missing required fields:", analysisResult);
      return null;
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
    
    const { deleteItemsByCharacter } = await import('./vectra-wrapper.js');
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