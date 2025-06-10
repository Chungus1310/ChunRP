// Replace all {{user}} placeholders with the current user's name (for backend use)
function replaceUserPlaceholder(text, userName) {
  if (!text) return text;
  return text.replace(/\{\{user\}\}/gi, userName || 'User');
}
// Handles connections to different LLM APIs

// Factory object to hold different provider functions
const llmProviderFactory = {
  // Gemini API handler
  gemini: async (prompt, settings) => {
    const { GoogleGenAI } = await import("@google/genai");
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.gemini || settings.apiKey;

    if (!apiKey) {
      throw new Error('No API key found for Gemini');
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
      // Convert prompt format for Gemini
      const contents = prompt.map(msg => {
        return {
          role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'user'/'model'
          parts: [{ text: msg.content }]
        };
      });

      // Define models that support thinking budget
      const modelsWithThinkingBudget = [
        "gemini-2.5-pro-preview-05-06",
        "gemini-2.5-flash-preview-04-17"
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
      if (response && response.text) {
        return response.text;
      } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return response.candidates[0].content.parts[0].text;
      } else {
        console.error("Gemini API response format unexpected:", response);
        throw new Error('Gemini API response format unexpected.');
      }
    } catch (error) {
      console.error("Gemini API error:", error.message || error);
      const errorMessage = error.details || error.message || 'Unknown error';
      throw new Error(`Gemini API request failed: ${errorMessage}`);
    }
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
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.openrouter || settings.apiKey;

    if (!apiKey) {
      throw new Error('No API key found for OpenRouter');
    }

    try {
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
        return data.choices[0].message.content;
    } catch (error) {
        console.error("OpenRouter request failed:", error.message || error);
        // Standardize error message if needed
        if (!error.message.startsWith('OpenRouter API')) {
             throw new Error(`OpenRouter request failed: ${error.message || 'Network error or unexpected issue'}`);
        }
        throw error; // Re-throw
    }
  },

  // HuggingFace API handler
  huggingface: async (messages, settings) => {
    const { HfInference } = await import("@huggingface/inference");
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.huggingface || settings.apiKey;

    if (!apiKey) {
      throw new Error('No API key found for HuggingFace');
    }

    const client = new HfInference(apiKey);
    
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

    try {
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

      return output;
    } catch (error) {
      console.error("HuggingFace API error:", error.message || error);
      throw new Error(`HuggingFace API request failed: ${error.message || 'Unknown error'}`);
    }
  },

  // Mistral API handler
  mistral: async (messages, settings) => {
    const { Mistral } = await import('@mistralai/mistralai');
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.mistral || settings.apiKey;

    if (!apiKey) {
      throw new Error('No API key found for Mistral');
    }

    const client = new Mistral({apiKey});

    try {
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
      return chatResponse.choices[0].message.content;
    } catch (error) {
      console.error("Mistral API error:", error.message || error);
      throw new Error(`Mistral API request failed: ${error.message || 'Unknown error'}`);
    }
  },

  // Cohere API handler
  cohere: async (messages, settings) => {
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.cohere || settings.apiKey;
    if (!apiKey) {
      throw new Error('No API key found for Cohere');
    }
    try {
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
        return response.message.content.map(c => c.text).join('\n');
      } else {
        console.error('Cohere API response format unexpected:', response);
        throw new Error('Cohere API response format unexpected.');
      }
    } catch (error) {
      console.error('Cohere API error:', error.message || error);
      throw new Error(`Cohere API request failed: ${error.message || 'Unknown error'}`);
    }
  },

  // NVIDIA NIM API handler
  nvidia: async (messages, settings) => {
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.nvidia || settings.apiKey;
    if (!apiKey) {
      throw new Error('No API key found for NVIDIA NIM');
    }
    try {
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
        'nvidia/llama-3.3-nemotron-super-49b-v1'
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
        return completion.choices[0].message.content;
      } else {
        console.error('NVIDIA NIM API response format unexpected:', completion);
        throw new Error('NVIDIA NIM API response format unexpected.');
      }
    } catch (error) {
      console.error('NVIDIA NIM API error:', error.message || error);
      throw new Error(`NVIDIA NIM API request failed: ${error.message || 'Unknown error'}`);
    }
  },

  // Chutes API handler
  chutes: async (messages, settings) => {
    // Use specific key or fallback
    const apiKey = settings.apiKeys?.chutes || settings.apiKey;
    if (!apiKey) {
      throw new Error('No API key found for Chutes');
    }

    try {
      const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: settings.model || "deepseek-ai/DeepSeek-R1-0528", // Default model
          messages: messages,
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
      return data.choices[0].message.content;
    } catch (error) {
      console.error("Chutes request failed:", error.message || error);
      throw new Error(`Chutes request failed: ${error.message || 'Network error or unexpected issue'}`);
    }
  },
};

// Main function to generate a response using the selected provider
async function generateResponse(character, userMessage, userProfile, chatHistory, settings) {
  try {
    // Dynamically import memory functions and estimateTokens
    const { retrieveRelevantMemories, buildOptimizedContext, createJournalEntry, estimateTokens } = await import('./memory-system.js');    // 1. Get relevant memories
    const relevantMemories = await retrieveRelevantMemories(
      userMessage,
      character,
      settings.memory?.retrievalCount || 5, // How many memories to fetch
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
      settings.maxContextTokens || 5000, // Max context size
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
    const response = await provider(fullContext, providerSettings);

    // 8. Update chat history (mutates the array passed in)
    chatHistory.push({ role: "user", content: userMessage });
    chatHistory.push({ role: "assistant", content: response });


    // 9. Create journal entry based on last journal point (fixes frequency bug)
    const journalFrequency = settings.memory?.journalFrequency || 10;
    if (!character._lastJournalMessageIndex) character._lastJournalMessageIndex = 0;
    // Only count user/assistant messages (not system)
    const effectiveMessageCount = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').length;
    const messagesSinceLastJournal = effectiveMessageCount - character._lastJournalMessageIndex;
    if (messagesSinceLastJournal >= journalFrequency) {
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
        character._lastJournalMessageIndex = effectiveMessageCount;
        console.log(`Updated relationships in memory for ${character.name}`);
      }
    }

    return response;
  } catch (error) {
    console.error("Error generating response:", error.message || error);
    // Return a user-friendly error message
    return "I'm having trouble responding right now. Please try again.";
  }
}

// Available models grouped by provider (for UI dropdowns etc.)
const modelConfigurations = {
  requesty: [
    { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp", free: true },
    { id: "google/gemini-2.0-flash-thinking-exp-01-21", name: "Gemini 2.0 Flash Thinking Exp 01-21", free: true },
    { id: "google/gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro Exp 02-05", free: true },
    { id: "google/gemini-2.5-pro-exp-03-25", name: "Gemini 2.5 Pro Exp 03-25", free: true },
    { id: "google/gemma-3-27b-it", name: "Gemma 3 27B IT", free: true },
    { id: "novita/sao10k/l3-8b-lunaris", name: "L3-8B Lunaris (Paid)", free: false }
  ],  openrouter: [
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Exp (Free)", free: true },
    { id: "microsoft/mai-ds-r1:free", name: "MAI-DS R1 (Free)", free: true },
    { id: "arliai/qwq-32b-arliai-rpr-v1:free", name: "QWQ 32B RPR", free: true },
    { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek Chat v3", free: true },
    { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", free: true },
    { id: "deepseek/deepseek-r1-zero:free", name: "DeepSeek R1 Zero (Free)", free: true },
    { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 (0528, Free)", free: true },
    { id: "rekaai/reka-flash-3:free", name: "Reka Flash 3", free: true },
    { id: "moonshotai/moonlight-16b-a3b-instruct:free", name: "Moonlight 16B", free: true },
    { id: "cognitivecomputations/dolphin3.0-mistral-24b:free", name: "Dolphin 3.0 Mistral 24B", free: true },
    { id: "tngtech/deepseek-r1t-chimera:free", name: "DeepSeek R1T Chimera (Free)", free: true }
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
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro Preview" },
    { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash Preview 04-17" },
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash Preview 05-20" },
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
    { id: "mistral-small-latest", name: "Mistral Small" },
    { id: "open-mistral-nemo", name: "Open Mistral Nemo" }
  ],
  cohere: [
    { id: "command-a-03-2025", name: "Command R+ 03-2025", free: true },
    { id: "command-r7b-12-2024", name: "Command R7B 12-2024", free: true },
    { id: "command-r-plus-08-2024", name: "Command R Plus 08-2024", free: true },
    { id: "command-r-08-2024", name: "Command R 08-2024", free: true },
    { id: "command-nightly", name: "Command Nightly", free: true }  ],    
  chutes: [
    { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
    { id: "deepseek-ai/DeepSeek-R1-0528", name: "DeepSeek R1 (0528)" },
    { id: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", name: "DeepSeek R1 Qwen3 8B" },
    { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3 (0324)" },
    { id: "ArliAI/QwQ-32B-ArliAI-RpR-v1", name: "ArliAI QwQ 32B RPR v1" },
    { id: "microsoft/MAI-DS-R1-FP8", name: "Microsoft MAI-DS R1 FP8" },
    { id: "tngtech/DeepSeek-R1T-Chimera", name: "TNG DeepSeek R1T Chimera" },
    { id: "Qwen/Qwen3-235B-A22B", name: "Qwen3-235B-A22B" }
  ],
  nvidia: [
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Llama 3.3 Nemotron Super 49B" },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "Llama 3.1 Nemotron Ultra 253B" },
    { id: "meta/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B 16E Instruct" },
    { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B 128E Instruct" },
    { id: "writer/palmyra-creative-122b", name: "Palmyra Creative 122B" },
    { id: "qwen/qwq-32b", name: "QWQ 32B" },
    { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
    { id: "01-ai/yi-large", name: "Yi Large" },
    { id: "mistralai/mixtral-8x22b-instruct-v0.1", name: "Mixtral 8x22B Instruct v0.1" },
    { id: "deepseek-ai/deepseek-r1", name: "DeepSeek R1" },
    { id: "qwen/qwen3-235b-a22b", name: "Qwen3-235B-A22B" }
  ]
};

export { llmProviderFactory, generateResponse, modelConfigurations };