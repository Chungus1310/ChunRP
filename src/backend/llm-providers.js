// Replace all {{user}} placeholders with the current user's name (for backend use)
function replaceUserPlaceholder(text, userName) {
  if (!text) return text;
  return text.replace(/\{\{user\}\}/gi, userName || 'User');
}

// Global state for API key rotation
const apiKeyIndices = {
  gemini: 0,
  openrouter: 0,
  huggingface: 0,
  aionlabs: 0,
  mistral: 0,
  cohere: 0,
  nvidia: 0,
  chutes: 0
};

const apiKeyStatus = {
  gemini: [],
  openrouter: [],
  aionlabs: [],
  huggingface: [],
  mistral: [],
  cohere: [],
  nvidia: [],
  chutes: []
};

// Helper function to normalize API keys (backward compatibility)
function normalizeApiKeys(apiKeys, provider) {
  const keys = apiKeys?.[provider];
  if (typeof keys === 'string') {
    return keys ? [keys] : [];
  }
  return Array.isArray(keys) ? keys : [];
}

// Helper function to get next API key with rotation
function getNextApiKey(provider, apiKeys) {
  const normalizedKeys = normalizeApiKeys(apiKeys, provider);
  if (normalizedKeys.length === 0) {
    throw new Error(`No API key(s) found for ${provider}`);
  }
  
  // Initialize status array if needed
  if (!apiKeyStatus[provider] || apiKeyStatus[provider].length !== normalizedKeys.length) {
    apiKeyStatus[provider] = new Array(normalizedKeys.length).fill('untested');
  }
  
  // Reset index if it's out of bounds
  if (apiKeyIndices[provider] >= normalizedKeys.length) {
    apiKeyIndices[provider] = 0;
  }
  
  return {
    keys: normalizedKeys,
    currentIndex: apiKeyIndices[provider],
    currentKey: normalizedKeys[apiKeyIndices[provider]]
  };
}

// Helper function to mark API key success and rotate
function markApiKeySuccess(provider, keyIndex, totalKeys) {
  if (apiKeyStatus[provider]) {
    apiKeyStatus[provider][keyIndex] = 'working';
  }
  // Rotate to next key for subsequent requests
  apiKeyIndices[provider] = (keyIndex + 1) % totalKeys;
}

// Helper function to mark API key failure
function markApiKeyFailure(provider, keyIndex, error) {
  if (apiKeyStatus[provider]) {
    const isRateLimit = error.message && (
      error.message.includes('rate') || 
      error.message.includes('quota') || 
      error.message.includes('429')
    );
    apiKeyStatus[provider][keyIndex] = isRateLimit ? 'rate-limited' : 'failed';
  }
}

// Handles connections to different LLM APIs

// Factory object to hold different provider functions
const llmProviderFactory = {
  // Gemini API handler with rotation
  gemini: async (prompt, settings) => {
    const { GoogleGenAI } = await import("@google/genai");
    
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('gemini', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 2; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('Gemini API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const ai = new GoogleGenAI({ apiKey });

        // Convert prompt format for Gemini
        const contents = prompt.map(msg => {
          return {
            role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'user'/'model'
            parts: [{ text: msg.content }]
          };
        });

        // Define models that support thinking budget
        const modelsWithThinkingBudget = [
          "gemini-2.5-pro",
          "gemini-2.5-pro-preview-06-05",
          "gemini-2.5-pro-preview-05-06",
          "gemini-2.5-flash-preview-04-17",
          "gemini-2.5-flash-preview-05-20"
        ];

        // Determine if thinking budget should be used
        const model = settings.model || "gemini-2.0-flash"; // Default model
        const useThinkingBudget = modelsWithThinkingBudget.includes(model);

        // Call Gemini API based on whether thinking budget is needed
        let response;
        if (useThinkingBudget) {
          response = await ai.models.generateContent({
            model: model,
            contents: contents,
            generationConfig: {
              temperature: settings.temperature || 0.7,
              topP: settings.topP || 0.9,
              maxOutputTokens: settings.maxTokens || 2048
            },
            thinkingConfig: {
              thinkingBudget: 24576, // Default thinking budget
            }
          });
        } else {
          response = await ai.models.generateContent({
            model: model,
            contents: contents,
            generationConfig: {
              temperature: settings.temperature || 0.7,
              topP: settings.topP || 0.9,
              maxOutputTokens: settings.maxTokens || 2048
            }
          });
        }

        // Extract text from response
        let responseText;
        if (response && response.text) {
          responseText = response.text;
        } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          responseText = response.candidates[0].content.parts[0].text;
        } else {
          console.error("Gemini API response format unexpected:", response);
          throw new Error('Gemini API response format unexpected.');
        }

        // Success: mark key as working and rotate for next request
        markApiKeySuccess('gemini', currentIndex, keyInfo.keys.length);
        return responseText;
        
      } catch (error) {
        console.error(`Gemini API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('gemini', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    const errorMessage = lastError?.details || lastError?.message || 'Unknown error';
    throw new Error(`All Gemini API keys failed. Last error: ${errorMessage}`);
  },

  // OpenRouter API handler
  // Requesty API handler
  requesty: async (messages, settings) => {
    const apiKey = settings.apiKeys?.requesty || settings.apiKey;
    if (!apiKey) {
      throw new Error('No API key found for Requesty');
    }
    try {
      const response = await fetch("https://router.requesty.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": settings.siteUrl || "http://localhost:3000",
          "X-Title": settings.siteName || "Local Roleplay Bot"
        },
        body: JSON.stringify({
          model: settings.model || "google/gemini-2.0-flash-exp",
          messages: messages,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 2048,
          top_p: settings.topP || 0.9
        })
      });

      if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch (jsonError) { errorData.message = response.statusText; }
        console.error("Requesty API error:", errorData);
        throw new Error(`Requesty API request failed: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content === 'undefined') {
        console.error("Requesty API response format unexpected:", data);
        throw new Error('Requesty API response format unexpected.');
      }
      return data.choices[0].message.content;
    } catch (error) {
      console.error("Requesty request failed:", error.message || error);
      throw new Error(`Requesty request failed: ${error.message || 'Network error or unexpected issue'}`);
    }
  },
  openrouter: async (messages, settings) => {
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('openrouter', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 2; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('OpenRouter API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": settings.siteUrl || "http://localhost:3000", // Required headers
            "X-Title": settings.siteName || "Local Roleplay Bot",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: settings.model || "deepseek/deepseek-chat-v3-0324:free", // Default model
            messages: messages,
            temperature: settings.temperature || 0.7,
            max_tokens: settings.maxTokens || 2048,
            top_p: settings.topP || 0.9
          })
        });

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json(); // Try to parse error details
          } catch (jsonError) {
            errorData.message = response.statusText; // Fallback to status text
          }
          console.error("OpenRouter API error:", errorData);
          throw new Error(`OpenRouter API request failed: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        // Check response structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content === 'undefined') {
          console.error("OpenRouter API response format unexpected:", data);
          throw new Error('OpenRouter API response format unexpected.');
        }

        // Success: mark key as working and rotate for next request
        markApiKeySuccess('openrouter', currentIndex, keyInfo.keys.length);
        return data.choices[0].message.content;
        
      } catch (error) {
        console.error(`OpenRouter API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('openrouter', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All OpenRouter API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // HuggingFace API handler with rotation
  huggingface: async (messages, settings) => {
    const { HfInference } = await import("@huggingface/inference");
    
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('huggingface', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Map HF models to specific underlying providers (needed for some models)
    const modelProviderMapping = {
      "alpindale/WizardLM-2-8x22B": "novita",
      "deepseek-ai/DeepSeek-V3-0324": "sambanova",
      "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b": "nebius",
      "HuggingFaceH4/zephyr-7b-beta": "hf-inference", // Uses HF directly
      "meta-llama/Llama-3.3-70B-Instruct": "nebius",
      "Sao10K/L3-8B-Stheno-v3.2": "novita",
      "Sao10K/L3-8B-Lunaris-v1": "novita"
    };

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 1; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('HuggingFace API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const client = new HfInference(apiKey);
        
        // Simple format for HF
        const formattedMessages = messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        const model = settings.model || "meta-llama/Llama-3.3-70B-Instruct"; // Default model
        
        // Determine the provider to use
        const provider = settings.providerOverride || 
                         modelProviderMapping[model] || 
                         "nebius"; // Fallback provider
        
        console.log(`Using provider "${provider}" for model "${model}"`);

        let output = "";
        // Use streaming API
        const stream = client.chatCompletionStream({
          model: model,
          messages: formattedMessages,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 2048,
          top_p: settings.topP || 0.9,
          provider: provider // Specify the provider
        });

        // Collect streamed chunks
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const newContent = chunk.choices[0].delta.content;
            if (newContent) {
              output += newContent;
            }
          }
        }

        if (output === "") {
          console.warn("HuggingFace stream finished without generating content.");
        }

        // Success: mark key as working and rotate for next request
        markApiKeySuccess('huggingface', currentIndex, keyInfo.keys.length);
        return output;
        
      } catch (error) {
        console.error(`HuggingFace API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('huggingface', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All HuggingFace API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // Mistral API handler with rotation
  mistral: async (messages, settings) => {
    const { Mistral } = await import('@mistralai/mistralai');
    
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('mistral', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 2; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('Mistral API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const client = new Mistral({apiKey});

        const chatResponse = await client.chat.complete({
          model: settings.model || "mistral-large-latest", // Default model
          messages: messages,
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 2048,
          topP: settings.topP || 0.9
        });

        // Check response structure
        if (!chatResponse.choices || !chatResponse.choices[0] || !chatResponse.choices[0].message || typeof chatResponse.choices[0].message.content === 'undefined') {
          console.error("Mistral API response format unexpected:", chatResponse);
          throw new Error('Mistral API response format unexpected.');
        }

        // --- MITIGATION START ---
        // Handle both string and array responses for `content`
        const content = chatResponse.choices[0].message.content;
        let responseText = '';
        
        if (Array.isArray(content)) {
          // If content is an array, filter for 'text' parts and join them.
          // This safely ignores the 'thinking' parts that cause the error.
          console.log(`Mistral API returned array content with ${content.length} parts`);
          const textParts = content.filter(part => part.type === 'text');
          const thinkingParts = content.filter(part => part.type === 'thinking');
          console.log(`Found ${textParts.length} text parts and ${thinkingParts.length} thinking parts`);
          
          responseText = textParts.map(part => part.content).join('');
        } else {
          // If content is already a string, use it directly.
          responseText = content;
        }
        // --- MITIGATION END ---

        // --- MITIGATION V2 START ---
        // After processing, check if the response is empty.
        // If so, treat it as a failure for this API key.
        if (!responseText || responseText.trim() === '') {
          throw new Error('Mistral API returned a response with no usable text content.');
        }
        // --- MITIGATION V2 END ---

        // Success: mark key as working and rotate for next request
        markApiKeySuccess('mistral', currentIndex, keyInfo.keys.length);
        // Return the processed text
        return responseText;
        
      } catch (error) {
        console.error(`Mistral API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('mistral', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All Mistral API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // Cohere API handler with rotation
  cohere: async (messages, settings) => {
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('cohere', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 1; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('Cohere API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        // Dynamic import for ESM compatibility
        const { CohereClientV2 } = await import('cohere-ai');
        const cohere = new CohereClientV2({ token: apiKey });
        const model = settings.model || 'command-a-03-2025';

        // --- Patch: Preprocess messages for Cohere v2 API ---
        // Cohere expects: role: 'user' | 'assistant' | 'system', content: string or array of {type: 'text', text: string}
        // But our chatHistory may have content as non-string (defensive)
        const cohereMessages = messages.map(msg => {
          // If content is already an array of objects, pass as-is
          if (Array.isArray(msg.content)) {
            return { role: msg.role, content: msg.content };
          }
          // If content is a string, pass as string
          if (typeof msg.content === 'string') {
            return { role: msg.role, content: msg.content };
          }
          // Defensive: fallback to string conversion
          return { role: msg.role, content: String(msg.content) };
        });

        const chatParams = {
          model,
          messages: cohereMessages,
          stream: false, // REQUIRED by Cohere v2
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 2048
        };
        const response = await cohere.chat(chatParams);
        
        // Cohere returns response.message.content as an array of objects with .text
        if (response && response.message && Array.isArray(response.message.content) && response.message.content[0]?.text) {
          // Success: mark key as working and rotate for next request
          markApiKeySuccess('cohere', currentIndex, keyInfo.keys.length);
          return response.message.content.map(c => c.text).join('\n');
        } else {
          console.error('Cohere API response format unexpected:', response);
          throw new Error('Cohere API response format unexpected.');
        }
        
      } catch (error) {
        console.error(`Cohere API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('cohere', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All Cohere API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // NVIDIA NIM API handler with rotation
  nvidia: async (messages, settings) => {
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('nvidia', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 2; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('NVIDIA API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        // Dynamic import for ESM compatibility
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey,
          baseURL: 'https://integrate.api.nvidia.com/v1',
        });
        const model = settings.model || 'writer/palmyra-creative-122b';

        // Insert extra system message for Nemotron models only
        const nemotronModels = [
          'nvidia/llama-3.1-nemotron-ultra-253b-v1',
          'nvidia/llama-3.3-nemotron-super-49b-v1',
          'nvidia/llama-3.3-nemotron-super-49b-v1.5'
        ];
        let patchedMessages = messages;
        if (nemotronModels.includes(model)) {
          patchedMessages = [
            { role: 'system', content: 'detailed thinking on' },
            ...messages
          ];
        }

        // Special handling for Qwen/Qwen3-235B-A22B: add chat_template_kwargs: {thinking: true}
        let extraParams = {};
        if ((model || '').toLowerCase() === 'qwen/qwen3-235b-a22b') {
          extraParams = { chat_template_kwargs: { thinking: true } };
        }

        // Streaming is always off for this integration
        const completion = await openai.chat.completions.create({
          model,
          messages: patchedMessages,
          temperature: settings.temperature || 0.7,
          top_p: settings.topP || 0.9,
          max_tokens: settings.maxTokens || 2048,
          stream: false,
          ...extraParams
        });
        
        // OpenAI compatible response
        if (completion && completion.choices && completion.choices[0]?.message?.content) {
          // Success: mark key as working and rotate for next request
          markApiKeySuccess('nvidia', currentIndex, keyInfo.keys.length);
          return completion.choices[0].message.content;
        } else {
          console.error('NVIDIA NIM API response format unexpected:', completion);
          throw new Error('NVIDIA NIM API response format unexpected.');
        }
        
      } catch (error) {
        console.error(`NVIDIA NIM API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('nvidia', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All NVIDIA NIM API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // Chutes API handler with rotation
  chutes: async (messages, settings) => {
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('chutes', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 2; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('Chutes API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const model = settings.model || "deepseek-ai/DeepSeek-R1-0528";
        let processedMessages = messages;

        // Special handling for TheDrummer/Tunguska-39B-v1 which requires the conversation
        // to start with a 'user' role after the optional 'system' role.
        if (model === 'TheDrummer/Tunguska-39B-v1') {
          const systemMessage = messages.find(m => m.role === 'system');
          const chatMessages = messages.filter(m => m.role !== 'system');
          const firstUserIndex = chatMessages.findIndex(m => m.role === 'user');

          if (firstUserIndex > 0) {
            console.log(`Applying special message processing for ${model}: Removing leading assistant messages.`);
            const validChat = chatMessages.slice(firstUserIndex);
            processedMessages = systemMessage ? [systemMessage, ...validChat] : validChat;
          }
        }

        const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: processedMessages,
            stream: false,
            max_tokens: settings.maxTokens || 1024,
            temperature: settings.temperature || 0.7
          })
        });

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch (jsonError) {
            errorData.message = response.statusText;
          }
          console.error("Chutes API error:", errorData);
          throw new Error(`Chutes API request failed: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        // Check response structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content === 'undefined') {
          console.error("Chutes API response format unexpected:", data);
          throw new Error('Chutes API response format unexpected.');
        }

        // Success: mark key as working and rotate for next request
        markApiKeySuccess('chutes', currentIndex, keyInfo.keys.length);
        return data.choices[0].message.content;
        
      } catch (error) {
        console.error(`Chutes API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('chutes', currentIndex, error);
        lastError = error;
        
        // Move to next key
        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }
    
    // All keys failed
    throw new Error(`All Chutes API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

  // Aion Labs API handler with rotation
  aionlabs: async (messages, settings) => {
    // Get API keys with rotation support
    const keyInfo = getNextApiKey('aionlabs', settings.apiKeys || {});
    let currentIndex = keyInfo.currentIndex;
    let attemptCount = 0;
    let lastError = null;

    // Try each key starting from current index, with 2 complete rounds
    const maxAttempts = keyInfo.keys.length * 1; // 2 rounds through all keys
    while (attemptCount < maxAttempts) {
      const apiKey = keyInfo.keys[currentIndex];
      try {
        // --- ROBUSTNESS GUARD ---
        if (typeof apiKey !== 'string' || apiKey === '') {
          throw new Error('AionLabs API key is invalid or empty.');
        }
        // --- END GUARD ---
        
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey,
          baseURL: 'https://api.aionlabs.ai/v1',
        });

        const completion = await openai.chat.completions.create({
          model: settings.model || 'aion-rp-small',
          messages: messages,
          temperature: settings.temperature || 0.7,
          top_p: settings.topP || 0.9,
          max_tokens: settings.maxTokens || 2048,
          stream: false,
        });

        if (completion && completion.choices && completion.choices[0]?.message?.content) {
          markApiKeySuccess('aionlabs', currentIndex, keyInfo.keys.length);
          return completion.choices[0].message.content;
        } else {
          console.error('AionLabs API response format unexpected:', completion);
          throw new Error('AionLabs API response format unexpected.');
        }

      } catch (error) {
        console.error(`AionLabs API key ${currentIndex + 1} failed:`, error.message);
        markApiKeyFailure('aionlabs', currentIndex, error);
        lastError = error;

        currentIndex = (currentIndex + 1) % keyInfo.keys.length;
        attemptCount++;
      }
    }

    throw new Error(`All AionLabs API keys failed. Last error: ${lastError.message || 'Unknown error'}`);
  },

};

// Utility to strip <think>...</think> tags and their content from a string
function stripThinkTags(text) {
  if (typeof text !== 'string') return text;
  // Remove all <think>...</think> blocks, including multiline
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Main function to generate a response using the selected provider
async function generateResponse(character, userMessage, userProfile, chatHistory, settings) {
  try {
    // Dynamically import memory functions and estimateTokens
    const { retrieveRelevantMemories, buildOptimizedContext, createJournalEntry, estimateTokens } = await import('./memory-system.js');    // 1. Get relevant memories
    const relevantMemories = await retrieveRelevantMemories(
      userMessage,
      character,
      settings.memory?.retrievalCount ?? 5, // How many memories to fetch
      settings // Pass settings for API keys etc.
    );

    // Log memory retrieval results
    console.log(`Retrieved ${relevantMemories.length} memories relevant to message: "${userMessage.substring(0, 30)}..."`);

    // 2. Build the initial context (system, memories)
    const initialContext = buildOptimizedContext(
      character,
      userMessage,
      userProfile,
      relevantMemories,
      settings.maxContextTokens || 8000, // Max context size
      chatHistory.length // Pass history length for context logic
    );
    
    // Calculate tokens used by initial context
    const baseContextTokens = initialContext.reduce(
      (sum, msg) => sum + estimateTokens(msg.content), 0
    );
    console.log(`Initial context uses ${baseContextTokens} tokens`);    // 3. Build Dynamic History Context
    const userMessageTokens = estimateTokens(userMessage);
    // Reserve tokens for user message + buffer (100 tokens is a safe buffer)
    const historyTokenBudget = (settings.maxContextTokens || 6000) - baseContextTokens - userMessageTokens - 100;
    
    // Select messages that fit within the budget
    const recentMessages = [];
    let historyTokensUsed = 0;
    
    // Get maximum 15 recent messages (increased from default behavior)
    const historyMessageLimit = settings.memory?.historyMessageCount || 15; // Default to 15 messages
    console.log(`Including up to ${historyMessageLimit} messages from chat history`);
    
    // Process from newest to oldest
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const message = chatHistory[i];
      const tokens = estimateTokens(message.content);
      
      // Add only if we stay within budget AND haven't reached message count limit
      if (historyTokensUsed + tokens <= historyTokenBudget && recentMessages.length < historyMessageLimit) {
        // Add to beginning to maintain chronological order
        recentMessages.unshift(message);
        historyTokensUsed += tokens;
      } else {
        // Stop if budget exceeded or we reached message count limit
        if (recentMessages.length >= historyMessageLimit) {
          console.log(`Reached max message limit (${historyMessageLimit})`);
        } else {
          console.log(`Reached token budget limit (${historyTokenBudget})`);
        }
        break;
      }
    }
    
    console.log(`Including ${recentMessages.length} messages from history using ${historyTokensUsed} tokens`);

    // 4. Combine full context
    let fullContext = [
      ...initialContext,
      ...recentMessages,
      { role: "user", content: userMessage }
    ];

    // Special handling for Cohere: merge all system messages into one
    if ((settings.provider || '').toLowerCase() === 'cohere') {
      const systemMessages = fullContext.filter(msg => msg.role === 'system');
      const nonSystemMessages = fullContext.filter(msg => msg.role !== 'system');
      if (systemMessages.length > 1) {
        // Concatenate all system contents with double newlines
        const mergedSystemContent = systemMessages.map(m => m.content).join('\n\n');
        fullContext = [
          { role: 'system', content: mergedSystemContent },
          ...nonSystemMessages
        ];
      }
    }

    // 5. Merge global and character-specific settings
    const providerSettings = {
      ...settings,
      ...character.settingsOverride // Character settings take precedence
    };

    // 6. Get the correct provider function
    const provider = llmProviderFactory[settings.provider || 'gemini']; // Default to gemini
    if (!provider) {
      console.error(`Unsupported LLM provider specified: ${settings.provider}`);
      throw new Error(`Provider ${settings.provider} not supported`);
    }
    // --- Log the final prompt with token count ---
    const totalTokens = fullContext.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    console.log(`--- Final Prompt Sent to LLM (Approx. ${totalTokens} tokens) ---`);

    // Check if memories are included in the prompt
    const hasMemories = fullContext.some(msg => 
      msg.content.includes("MEMORIES (Important things you remember)")
    );

    if (!hasMemories) {
      console.warn("WARNING: No memory context included in the final prompt!");
    }

    // Log full context for debugging
    console.log(JSON.stringify(fullContext, null, 2));
    console.log("---------------------------------");
    // --- End Log ---

    // 7. Call the provider
    let response = await provider(fullContext, providerSettings);

    // Strip <think> tags from response content
    response = stripThinkTags(response);

    // 8. Update chat history (mutates the array passed in)
    chatHistory.push({ role: "user", content: userMessage });
    chatHistory.push({ role: "assistant", content: response });


    // 9. Create journal entry based on last journal point (fixes frequency bug)
    // Check if memory creation is enabled in settings.
    const enableMemoryCreation = settings.memory?.enableMemoryCreation !== false; // Default to true
    const journalFrequency = settings.memory?.journalFrequency || 10;

    if (enableMemoryCreation) {
      const lastJournalIndex = character.lastJournalIndex || 0;
      // Only count user/assistant messages (not system)
      const effectiveMessageCount = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').length;
      const messagesSinceLastJournal = effectiveMessageCount - lastJournalIndex;
      if (messagesSinceLastJournal >= journalFrequency && messagesSinceLastJournal > 0) {
        console.log(`Attempting journal entry creation at message count: ${effectiveMessageCount}`);
        // Get the last N messages for the journal
        const messagesForJournal = chatHistory
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-journalFrequency);
        // Create journal entry and get updated relationships
        const journalResult = await createJournalEntry(messagesForJournal, character, settings);
        // Update character relationships in memory directly
        if (journalResult && journalResult.updatedRelationships) {
          character.relationships = journalResult.updatedRelationships;
          character.modifiedAt = Date.now(); // Update modified time
          character.lastJournalIndex = effectiveMessageCount; // Update the persisted index
          console.log(`Updated lastJournalIndex for ${character.name} to ${effectiveMessageCount}`);
          console.log(`Updated relationships in memory for ${character.name}`);
        }
      }
    }

    return response;
  } catch (error) {
    console.error("Error generating response:", error.message || error);
    // Throw the error to let the server handle it and send it to the user
    throw error;
  }
}

// Available models grouped by provider (for UI dropdowns etc.)
const modelConfigurations = {
  openrouter: [
    { id: "openrouter/horizon-alpha", name: "Horizon Alpha" },
    { id: "arliai/qwq-32b-arliai-rpr-v1:free", name: "QWQ 32B RPR", free: true },
    { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek Chat v3", free: true },
    { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", free: true },
    { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 (0528, Free)", free: true },
    { id: "tngtech/deepseek-r1t2-chimera:free", name: "TNG DeepSeek R1T2 Chimera (Free)", free: true },
    { id: "tencent/hunyuan-a13b-instruct:free", name: "Tencent Hunyuan A13B Instruct (Free)", free: true },
    { id: "rekaai/reka-flash-3:free", name: "Reka Flash 3", free: true },
    { id: "moonshotai/moonlight-16b-a3b-instruct:free", name: "Moonlight 16B", free: true },
    { id: "cognitivecomputations/dolphin3.0-mistral-24b:free", name: "Dolphin 3.0 Mistral 24B", free: true },
    { id: "moonshotai/kimi-k2:free", name: "Kimi K2 (Free)", free: true }
  ],
  huggingface: [
    { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct", provider: "nebius" },
    { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3", provider: "sambanova" },
    { id: "alpindale/WizardLM-2-8x22B", name: "WizardLM 2 8x22B", provider: "novita" },
    { id: "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b", name: "Dolphin 2.9.2 Mixtral 8x22B", provider: "nebius" },
    { id: "HuggingFaceH4/zephyr-7b-beta", name: "Zephyr 7B Beta", provider: "hf-inference" },
    { id: "Sao10K/L3-8B-Stheno-v3.2", name: "L3 8B Stheno v3.2", provider: "novita" },
    { id: "Sao10K/L3-8B-Lunaris-v1", name: "L3 8B Lunaris v1", provider: "novita" }
  ],
  gemini: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-pro-preview-06-05", name: "Gemini 2.5 Pro Preview 06-05" },
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro Preview" },
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash Preview 05-20" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash Lite Preview 06-17" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
    { id: "gemini-2.0-flash-thinking-exp-01-21", name: "Gemini 2.0 Flash Thinking" },
    { id: "gemini-exp-1206", name: "Gemini Exp 1206" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "learnlm-2.0-flash-experimental", name: "LearnLM 2.0 Flash Experimental" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" }
  ],
  mistral: [
    { id: "mistral-large-latest", name: "Mistral Large" },
    { id: "mistral-medium-latest", name: "Mistral Medium" },
    { id: "mistral-small-latest", name: "Mistral Small" },
    { id: "magistral-medium-latest", name: "Magistral Medium" },
    { id: "magistral-small-latest", name: "Magistral Small" },
    { id: "open-mistral-nemo", name: "Open Mistral Nemo" }
  ],
  cohere: [
    { id: "command-a-03-2025", name: "Command A 03-2025", free: true },
    { id: "command-r7b-12-2024", name: "Command R7B 12-2024", free: true },
    { id: "command-r-plus-08-2024", name: "Command R Plus 08-2024", free: true },
    { id: "command-r-08-2024", name: "Command R 08-2024", free: true },
    { id: "command-nightly", name: "Command Nightly", free: true }  ],    
  chutes: [
    { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
    { id: "deepseek-ai/DeepSeek-R1-0528", name: "DeepSeek R1 (0528)" },
    { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3 (0324)" },
    { id: "ArliAI/QwQ-32B-ArliAI-RpR-v1", name: "ArliAI QwQ 32B RPR v1" },
    { id: "tngtech/DeepSeek-TNG-R1T2-Chimera", name: "TNG DeepSeek TNG R1T2 Chimera" },
    { id: "chutesai/Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama-4 Maverick 17B 128E Instruct FP8" },
    { id: "mrfakename/mistral-Small-3.1-24B-Instruct-2503-hf", name: "Mistral Small 3.1 24B Instruct" },
    { id: "moonshotai/Kimi-K2-Instruct", name: "Kimi K2 Instruct" },
    { id: "TheDrummer/Tunguska-39B-v1", name: "Tunguska 39B v1" },
    { id: "TheDrummer/Skyfall-36B-v2", name: "Skyfall 36B v2" },
    { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", name: "Qwen3-235B-A22B Instruct 2507" },
  { id: "stepfun-ai/step3", name: "StepFun Step3" },
  { id: "Qwen/Qwen3-235B-A22B-Thinking-2507", name: "Qwen/Qwen3-235B-A22B-Thinking-2507" },
  { id: "internlm/Intern-S1", name: "InternLM S1" },
  { id: "zai-org/GLM-4.5-FP8", name: "GLM-4.5-FP8" },
  { id: "zai-org/GLM-4.5-Air", name: "GLM-4.5-Air" }
  ],
  nvidia: [
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Llama 3.3 Nemotron Super 49B" },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Llama 3.3 Nemotron Super 49B v1.5" },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "Llama 3.1 Nemotron Ultra 253B" },
    { id: "moonshotai/kimi-k2-instruct", name: "Kimi K2 Instruct" },
    { id: "meta/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B 16E Instruct" },
    { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B 128E Instruct" },
    { id: "qwen/qwq-32b", name: "QWQ 32B" },
    { id: "mistralai/mixtral-8x22b-instruct-v0.1", name: "Mixtral 8x22B Instruct v0.1" },
    { id: "deepseek-ai/deepseek-r1", name: "DeepSeek R1" },
      { id: "deepseek-ai/deepseek-r1-0528", name: "DeepSeek R1 (0528)" },
      { id: "qwen/qwen3-235b-a22b", name: "Qwen3-235B-A22B" }
    ],
    aionlabs: [
      { id: "aion-labs/aion-1.0", name: "Aion 1.0" },
      { id: "aion-rp-small", name: "Aion RP Small" }
    ]
};

export { llmProviderFactory, generateResponse, modelConfigurations, apiKeyStatus, apiKeyIndices };
