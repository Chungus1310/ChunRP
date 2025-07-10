// Memory reranking system with multiple provider fallbacks
import fetch from 'node-fetch';
import { CohereClient } from 'cohere-ai';
import https from 'https';

// Initialize Cohere client
let cohereClient = null;

function initializeCohere(apiKey) {
  if (apiKey && !cohereClient) {
    cohereClient = new CohereClient({
      token: apiKey
    });
  }
}

// Rerank memories using Jina API
async function rerankWithJina(query, memories, settings = {}) {
  const apiKey = settings.apiKeys?.jina || 'jina_52e5dc70ec8d4ceba5b05b86e474c32bWHXw1kGKJQhCQv51G9dYByIQcftF';
  
  // Ensure apiKey is a string (handle array case)
  let realApiKey = apiKey;
  if (Array.isArray(apiKey)) {
    realApiKey = apiKey[0];
  }
  if (typeof realApiKey !== 'string') {
    throw new Error('Jina API key must be a string, got: ' + typeof realApiKey);
  }
  
  if (!realApiKey) {
    throw new Error('Jina API key not provided');
  }

  // Prepare documents for reranking
  const documents = memories.map(memory => ({
    text: memory.summary
  }));

  const requestData = {
    model: "jina-reranker-m0",
    query: query,
    documents: documents,
    return_documents: false,
    top_n: Math.min(memories.length, 20) // Limit to avoid API limits
  };

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.jina.ai',
      path: '/v1/rerank',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${realApiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.results) {
            // Map results back to original memories with rerank scores
            const rerankedMemories = response.results.map(result => ({
              ...memories[result.index],
              rerankScore: result.relevance_score || result.score
            }));
            
            resolve(rerankedMemories);
          } else {
            throw new Error(response.detail || 'Invalid response format');
          }
        } catch (error) {
          reject(new Error(`Jina reranking failed: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Jina API request failed: ${error.message}`));
    });

    req.write(JSON.stringify(requestData));
    req.end();
  });
}

// Rerank memories using Cohere API
async function rerankWithCohere(query, memories, settings = {}) {
  const apiKey = settings.apiKeys?.cohere;
  
  // Ensure apiKey is a string (handle array case)
  let realApiKey = apiKey;
  if (Array.isArray(apiKey)) {
    realApiKey = apiKey[0];
  }
  if (typeof realApiKey !== 'string') {
    throw new Error('Cohere reranking API key must be a string, got: ' + typeof realApiKey);
  }
  
  if (!realApiKey) {
    throw new Error('Cohere API key not provided');
  }

  initializeCohere(realApiKey);

  if (!cohereClient) {
    throw new Error('Failed to initialize Cohere client');
  }

  // Prepare documents for reranking
  const documents = memories.map(memory => memory.summary);

  try {
    const rerank = await cohereClient.v2.rerank({
      documents: documents,
      query: query,
      topN: Math.min(memories.length, 20),
      model: 'rerank-v3.5',
    });

    // Map results back to original memories with rerank scores
    const rerankedMemories = rerank.results.map(result => ({
      ...memories[result.index],
      rerankScore: result.relevanceScore
    }));

    return rerankedMemories;
  } catch (error) {
    throw new Error(`Cohere reranking failed: ${error.message}`);
  }
}

// Rerank memories using NVIDIA API
async function rerankWithNvidia(query, memories, settings = {}) {
  const apiKey = settings.apiKeys?.nvidia;
  
  // Ensure apiKey is a string (handle array case)
  let realApiKey = apiKey;
  if (Array.isArray(apiKey)) {
    realApiKey = apiKey[0];
  }
  if (typeof realApiKey !== 'string') {
    throw new Error('NVIDIA reranking API key must be a string, got: ' + typeof realApiKey);
  }
  
  if (!realApiKey) {
    throw new Error('NVIDIA API key not provided');
  }

  const invokeUrl = "https://ai.api.nvidia.com/v1/retrieval/nvidia/reranking";

  // Prepare passages for reranking
  const passages = memories.map(memory => ({
    text: memory.summary
  }));

  const payload = {
    model: "nv-rerank-qa-mistral-4b:1",
    query: {
      text: query
    },
    passages: passages
  };

  const headers = {
    "Authorization": `Bearer ${realApiKey}`,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(invokeUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API returned ${response.status}: ${response.statusText}`);
    }

    const responseBody = await response.json();
    
    if (responseBody.rankings) {
      // Map results back to original memories with rerank scores
      const rerankedMemories = responseBody.rankings.map(ranking => ({
        ...memories[ranking.index],
        rerankScore: ranking.logit || ranking.score
      }));
      
      return rerankedMemories;
    } else {
      throw new Error('Invalid response format from NVIDIA API');
    }
  } catch (error) {
    throw new Error(`NVIDIA reranking failed: ${error.message}`);
  }
}

// Main reranking function with fallback logic
async function rerankMemories(query, memories, settings = {}) {
  if (!memories || memories.length === 0) {
    return memories;
  }

  // Get reranking settings
  const rerankingProvider = settings.memory?.rerankingProvider || 'jina';
  const enableReranking = settings.memory?.enableReranking !== false; // Default to true
  
  if (!enableReranking) {
    console.log('Reranking disabled, returning original order');
    return memories;
  }

  const providers = ['jina', 'cohere', 'nvidia'];
  let startIndex = providers.indexOf(rerankingProvider);
  if (startIndex === -1) startIndex = 0;

  // Reorder providers to start with preferred one
  const orderedProviders = [
    ...providers.slice(startIndex),
    ...providers.slice(0, startIndex)
  ];

  console.log(`Attempting reranking with providers in order: ${orderedProviders.join(', ')}`);

  for (const provider of orderedProviders) {
    try {
      console.log(`Trying reranking with ${provider}...`);
      let rerankedMemories;

      switch (provider) {
        case 'jina':
          rerankedMemories = await rerankWithJina(query, memories, settings);
          break;
        case 'cohere':
          rerankedMemories = await rerankWithCohere(query, memories, settings);
          break;
        case 'nvidia':
          rerankedMemories = await rerankWithNvidia(query, memories, settings);
          break;
        default:
          continue;
      }

      // Sort by rerank score (higher is better)
      rerankedMemories.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));
      
      console.log(`Successfully reranked ${rerankedMemories.length} memories using ${provider}`);
      return rerankedMemories;

    } catch (error) {
      console.warn(`Reranking with ${provider} failed: ${error.message}`);
      continue;
    }
  }
  // If all providers fail, show error and return original order
  console.error('❌ All reranking providers failed, returning original order');
  
  // You might want to emit an event or set a flag here to show a toast on the frontend
  // For now, we'll just log the error
  return memories;
}

export {
  rerankMemories,
  rerankWithJina,
  rerankWithCohere,
  rerankWithNvidia
};
