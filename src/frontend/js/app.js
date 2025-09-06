// --- MOBILE VIEWPORT HEIGHT FIX ---
// Mobile Viewport Height Fix for older browsers that don't support dvh
function setAppHeight() {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
}
window.addEventListener('resize', setAppHeight);
setAppHeight(); // Initial call

// --- CONNECTION MONITORING & TOAST SYSTEM ---
let connectionStatus = {
  isConnected: true,
  lastHeartbeat: Date.now(),
  retryCount: 0,
  maxRetries: 5
};

// Device detection utility
function isMobile() {
  return window.innerWidth <= 768;
}

// Toast notification system
function displayToast(message, type = 'info', duration = 4000) {
  const notificationArea = document.getElementById('notification-area');
  if (!notificationArea) return;

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    </div>
  `;

  notificationArea.appendChild(toast);

  // Show toast
  setTimeout(() => toast.classList.add('show'), 100);

  // Auto-hide after duration
  setTimeout(() => hideToast(toast), duration);

  // Close button functionality
  toast.querySelector('.toast-close').addEventListener('click', () => hideToast(toast));
}

function hideToast(toast) {
  if (!toast) return;
  toast.classList.remove('show');
  setTimeout(() => {
    // Check if toast is still in the DOM before removing
    if (toast.parentElement) toast.parentElement.removeChild(toast);
  }, 300);
}

// Connection monitoring
function updateConnectionStatus(isConnected) {
  connectionStatus.isConnected = isConnected;
  connectionStatus.lastHeartbeat = Date.now();

  // Update all connection status indicators (both sidebar badge and floating dot)
  const allIndicators = document.querySelectorAll('.conn-status-badge, .conn-status-float');
  allIndicators.forEach(statusIndicator => {
    statusIndicator.classList.toggle('connected', isConnected);
    statusIndicator.classList.toggle('disconnected', !isConnected);
    statusIndicator.title = isConnected ? 'Connected' : 'Disconnected';
    
    // Update different child element types
    const badge = statusIndicator.querySelector('.status-indicator');
    const dot = statusIndicator.querySelector('.status-dot');
    if (badge) badge.style.backgroundColor = isConnected ? '#4caf50' : '#f44336';
    if (dot) dot.style.backgroundColor = isConnected ? '#4caf50' : '#f44336';
  });
}

// Heartbeat check
async function performHeartbeat() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      if (!connectionStatus.isConnected) {
        displayToast('Connection restored', 'success', 2000);
      }
      updateConnectionStatus(true);
      connectionStatus.retryCount = 0;
    } else {
      throw new Error('Server returned error status');
    }
  } catch (error) {
    updateConnectionStatus(false);
    if (connectionStatus.retryCount === 0) {
      displayToast('Connection lost - attempting to reconnect...', 'warning', 3000);
    }
    connectionStatus.retryCount++;
  }
}

// Start heartbeat monitoring
function startConnectionMonitoring() {
  // Initial heartbeat
  performHeartbeat();

  // More frequent heartbeat for mobile devices
  const heartbeatInterval = isMobile() ? 5000 : 10000;
  heartbeatIntervalId = setInterval(performHeartbeat, heartbeatInterval);

  // Enhanced network change detection
  window.addEventListener('online', async () => {
    displayToast('Connection restored', 'success', 2000);
    updateConnectionStatus(true);
  });

  window.addEventListener('offline', () => {
    displayToast('Connection lost', 'warning', 5000);
    updateConnectionStatus(false);
  });

  // Page visibility change (mobile app switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // User returned to page, just perform heartbeat
      setTimeout(performHeartbeat, 500);
    }
  });
}

// Request with timeout and retry logic
async function makeRequest(url, options = {}, timeout = 30000, retries = 2) {
  // Mobile-optimized timeouts and retries
  const mobileTimeout = isMobile() ? Math.max(timeout, 60000) : timeout;
  const mobileRetries = isMobile() ? Math.max(retries, 3) : retries;

  for (let attempt = 0; attempt <= mobileRetries; attempt++) {
    try {
      const controller = new AbortController();

      // Store the controller globally so it can be cancelled
      if (url.includes('/api/chat') && options.method === 'POST') {
        state.currentAbortController = controller;
      }

      const timeoutId = setTimeout(() => controller.abort(), mobileTimeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.response = response; // Attach response for error handling
        throw error;
      }

      // Update connection status on successful request
      if (!connectionStatus.isConnected) {
        updateConnectionStatus(true);
      }

      // Clear the abort controller on success
      if (state.currentAbortController === controller) {
        state.currentAbortController = null;
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`Request timeout (attempt ${attempt + 1}/${mobileRetries + 1}):`, url);
      } else {
        console.warn(`Request failed (attempt ${attempt + 1}/${mobileRetries + 1}):`, error.message);
      }

      // Clear the abort controller on error
      if (state.currentAbortController) {
        state.currentAbortController = null;
      }

      if (attempt === mobileRetries) {
        updateConnectionStatus(false);
        throw error;
      }

      // Exponential backoff with mobile-friendly delays
      const delay = Math.min(Math.pow(2, attempt) * 2000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// --- SSE LOG LISTENER ---
let logSource = null; // Store reference for cleanup
let heartbeatIntervalId = null; // Store heartbeat interval reference

function setupLogListener() {
  try {
    // Close existing connection if any
    if (logSource) {
      logSource.close();
    }
    
    logSource = new EventSource('/api/logs');
    logSource.onmessage = (event) => {
      if (event.data) {
        // Print backend logs to frontend console
        console.log('%c[Backend]', 'color: #0af; font-weight: bold;', event.data);
      }
    };
    logSource.onerror = (err) => {
      console.warn('SSE log connection error:', err);
    };
  } catch (e) {
    console.warn('Failed to set up backend log listener:', e);
  }
}

// Cleanup function for when page is unloaded
function cleanup() {
  if (logSource) {
    logSource.close();
    logSource = null;
  }
  
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanup);
// Note: 'unload' event is deprecated, using 'beforeunload' for cleanup

// Handle window resize to sync mobile chat class
window.addEventListener('resize', () => {
  // Sync mobile-chat-active class based on screen size and active character
  if (state.activeCharacter) {
    if (isMobile()) {
      document.body.classList.add('mobile-chat-active');
    } else {
      document.body.classList.remove('mobile-chat-active');
    }
  }
});

// Main application JavaScript for Immersive Roleplay Chat
// Implements the frontend functionality as described in PLAN.md

// API endpoints
const API = {
  CHARACTERS: '/api/characters',
  CHAT: '/api/chat',
  SETTINGS: '/api/settings',
  MODELS: '/api/models',
  MEMORIES: '/api/memories'
};

// Dynamic Theme Manager ------------------------------------------------------
// Scans loaded CSS (themes.css) for [data-theme="..."] selectors and builds a
// runtime registry. Eliminates need to hard-code themes in JS.
const ThemeManager = (() => {
  let _registry = {}; // themeId -> { name, description }
  let _initialized = false;
  const LEGACY_THEME_ALIASES = {
    // Stored historical values -> new canonical IDs from CSS
    'dark': 'modern-dark',
    'light': 'modern-light'
  };

  function _prettyName(id) {
    return id
      .replace(/^[a-z]/, c => c.toUpperCase())
      .replace(/[-_]+/g, ' ')
      .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
  }

  function _scanThemesFromStyleSheets() {
    const found = new Set();
    // Attempt to read all same-origin stylesheets
    for (const sheet of Array.from(document.styleSheets)) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText) continue;
        const matches = rule.selectorText.match(/\[data-theme="([^"]+)"\]/g);
        if (matches) {
          for (const m of matches) {
            const idMatch = m.match(/\[data-theme="([^"]+)"\]/);
            if (idMatch) found.add(idMatch[1]);
          }
        }
      }
    }
    return Array.from(found);
  }

  function _rebuildRegistry() {
    const discovered = _scanThemesFromStyleSheets();
    // If nothing found, provide a minimal fallback so UI still works
    if (discovered.length === 0) {
      discovered.push('modern-dark', 'modern-light');
    }
    const next = {};
    for (const id of discovered) {
      next[id] = {
        id,
        name: _prettyName(id),
        description: `Auto-detected theme: ${_prettyName(id)}`,
        dataTheme: id // Canonical attribute value
      };
    }
    _registry = next;
    _initialized = true;
    document.dispatchEvent(new CustomEvent('themes:updated', { detail: { themes: getAllThemes() } }));
  }

  function init() {
    if (_initialized) return;
    _rebuildRegistry();
  }

  function refresh() { _rebuildRegistry(); }
  function getAllThemes() { init(); return Object.keys(_registry); }
  function getThemeInfo(id) { init(); return _registry[id]; }
  function isValidTheme(id) { init(); return !!_registry[id]; }
  function getDefaultTheme() { init(); return _registry['modern-dark'] ? 'modern-dark' : Object.keys(_registry)[0]; }
  function normalize(id) {
    if (!id) return getDefaultTheme();
    if (LEGACY_THEME_ALIASES[id]) id = LEGACY_THEME_ALIASES[id];
    return isValidTheme(id) ? id : getDefaultTheme();
  }

  // Initialize immediately after definition so early calls work with a registry
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { getAllThemes, getThemeInfo, isValidTheme, getDefaultTheme, refresh, normalize };
})();

// Application state
const state = {
  characters: [],
  activeCharacter: null,
  chatHistory: [],
  settings: null,
  modelConfigurations: null,
  isGenerating: false,
  currentAbortController: null,
  // Simple message ID counter for tracking
  lastMessageId: 0
};

// DOM Elements - update the existing dom object to include new elements
const dom = {
  characterList: document.getElementById('character-list'),
  characterModal: document.getElementById('character-modal'),
  settingsModal: document.getElementById('settings-modal'),
  chatContainer: document.getElementById('chat-container'),
  welcomeScreen: document.getElementById('welcome-screen'),
  chatMessages: document.getElementById('chat-messages'),
  characterName: document.getElementById('character-name'),
  characterAvatar: document.getElementById('character-avatar'),
  messageInput: document.getElementById('message-input'),
  sendMessageBtn: document.getElementById('send-message-btn'),
  createCharacterBtn: document.getElementById('create-character-btn'),
  editCharacterBtn: document.getElementById('edit-character-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  sceneBreakBtn: document.getElementById('scene-break-btn'),
  settingsBtn: document.getElementById('settings-btn'),  // Add new elements
  chatToolsToggle: document.getElementById('chat-tools-toggle'), // New toggle for dropdown
  chatToolsMenu: document.getElementById('chat-tools-menu'),   // New dropdown menu
  emojiBtn: document.getElementById('emoji-btn'),
  regenBtn: document.getElementById('regen-btn'),
  memoryViewBtn: document.getElementById('memory-view-btn'),
  recycleMemoryBtn: document.getElementById('recycle-memory-btn'),
  memoryPanel: document.getElementById('memory-panel'),
  sidebar: document.querySelector('.sidebar'),
  // Import/Export chat buttons (to be added in HTML)
  exportChatBtn: document.getElementById('export-chat-btn'),
  desktopSidebarToggle: document.getElementById('desktop-sidebar-toggle'),
  importChatBtn: document.getElementById('import-chat-btn'),
  importChatInput: document.getElementById('import-chat-input')
};
// --- Import/Export Chat Functions ---
function exportChatHistory() {
  if (!state.activeCharacter || !Array.isArray(state.chatHistory)) {
    showErrorMessage('No chat history to export.');
    return;
  }
  const dataStr = JSON.stringify(state.chatHistory, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.activeCharacter.name}-chat.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importChatHistoryFromFile(file) {
  if (!state.activeCharacter) {
    showErrorMessage('No character selected.');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid chat history format.');
      // Send to backend to replace chat history
      const response = await fetch(`${API.CHAT}/${state.activeCharacter.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imported)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showErrorMessage(data.error || 'Failed to import chat history.');
        return;
      }
      // Reload chat history from backend
      await loadChatHistory(state.activeCharacter.name);
      renderChatHistory();
      scrollToBottom();
      showSuccessMessage('Chat history imported successfully.');
    } catch (err) {
      showErrorMessage('Invalid or corrupt chat history file.');
    }
  };
  reader.readAsText(file);
}

// Initialize the application - update with emoji picker initialization
async function initApp() {
  try {
    // Start connection monitoring
    startConnectionMonitoring();

    // Load settings
    await loadSettings();

    // Apply theme from settings
    applyTheme(state.settings.theme || ThemeManager.getDefaultTheme());
    applyBubbleStyle(state.settings.bubbleStyle || 'rounded');

    // Load model configurations

    // Start listening for backend logs
    setupLogListener();
    await loadModelConfigurations();

    // Load characters
    await loadCharacters();

    // Set up event listeners
    setupEventListeners();

    // Initialize emoji picker
    initEmojiPicker();

    // Keyboard-safe input on mobile (VisualViewport)
    initViewportGuards();

    // Mobile message actions: long-press & kebab
    initMobileMessageActions();

    // Setup import/export chat event listeners
    if (dom.exportChatBtn) {
      dom.exportChatBtn.addEventListener('click', exportChatHistory);
    }
    if (dom.importChatBtn && dom.importChatInput) {
      dom.importChatBtn.addEventListener('click', () => dom.importChatInput.click());
      dom.importChatInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importChatHistoryFromFile(file);
        e.target.value = '';
      });
    }

    // Add connection status indicator to the UI
    addConnectionStatusIndicator();

    // Restore sidebar state from localStorage on desktop
    if (!isMobile() && localStorage.getItem('sidebarCollapsed') === 'true') {
      const container = document.querySelector('.app-container');
      if (container) container.classList.add('sidebar-collapsed');
    }

    // Mark application initialized for startup reveal animation (safe: just adds class)
    requestAnimationFrame(() => document.body.classList.add('app-initialized'));

    // Initialize rotating tips (non-intrusive)
    initWelcomeTips();

  } catch (error) {
    console.error('Error initializing app:', error);
    displayToast('Failed to initialize application. Please check the console for details.', 'error', 8000);
  }
}

// VisualViewport guards: keep footer/input visible under keyboards
function initViewportGuards() {
  try {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const applyInset = () => {
      const kbInset = (vv && (window.innerHeight - vv.height) > 0) ? (window.innerHeight - vv.height) : 0;
      root.style.setProperty('--kb-inset', kbInset + 'px');
    };
    applyInset();
    if (vv) {
      vv.addEventListener('resize', applyInset);
      vv.addEventListener('scroll', applyInset);
    } else {
      window.addEventListener('resize', applyInset);
      window.addEventListener('orientationchange', applyInset);
    }
  } catch (e) { /* noop */ }
}

// Enhance mobile actions: long-press shows inline actions; kebab button toggles
function initMobileMessageActions() {
  const container = dom.chatMessages;
  if (!container) return;
  let pressTimer = null;
  container.addEventListener('touchstart', (e) => {
    const msg = e.target.closest('.message');
    if (!msg) return;
    pressTimer = setTimeout(() => {
      msg.classList.add('message--actions-visible');
    }, 400);
  }, { passive: true });
  container.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
  });
  container.addEventListener('click', (e) => {
    const kebab = e.target.closest('.message-kebab');
    if (!kebab) return;
    const msg = kebab.closest('.message');
    if (msg) msg.classList.toggle('message--actions-visible');
  });
}

// Lightweight rotating tips for landing page
function initWelcomeTips() {
  const tipEl = document.getElementById('welcome-rotating-tip');
  if (!tipEl) return; // If markup not present, silently exit
  const tips = [
    'Tip: Hover or long-press messages to edit.',
    'Tip: Change themes in Settings > Appearance.',
    'Tip: Memories adapt as you roleplay.',
    'Tip: Enable Streaming in Settings for live tokens.',
    'Tip: Use the ⋯ menu for tools & actions.'
  ];
  let idx = 0;
  const swap = () => {
    tipEl.style.opacity = 0;
    setTimeout(() => {
      tipEl.textContent = tips[idx % tips.length];
      tipEl.style.opacity = 1;
      idx++;
    }, 250);
  };
  swap();
  setInterval(swap, 5000);
}

// Add connection status indicator to UI
function addConnectionStatusIndicator() {
  // Check if floating indicator already exists
  if (document.querySelector('.conn-status-float')) return;

  const indicator = document.createElement('div');
  indicator.className = 'conn-status-float connected';
  indicator.title = 'Connected';
  indicator.innerHTML = '<div class="status-dot"></div>';

  // Add to header or appropriate location
  const header = document.querySelector('.chat-header') || document.body;
  header.appendChild(indicator);
}

// Load settings from the server
async function loadSettings() {
  try {
    const response = await makeRequest(API.SETTINGS, {}, 10000, 1);
    state.settings = await response.json();
    // Normalize legacy / invalid theme ids to an available one
    if (state.settings && state.settings.theme) {
      state.settings.theme = ThemeManager.normalize(state.settings.theme);
    }
    return state.settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    // Use default settings if server request fails
    state.settings = {
      provider: 'gemini',
      model: 'gemini-2.5-pro-preview-03-25',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      maxContextTokens: 6000,
      apiKeys: { gemini: '', openrouter: '', huggingface: '', mistral: '', glm: '' },
      memory: {
        journalFrequency: 10,
        retrievalCount: 5,
        historyMessageCount: 15,
        enableMemoryRetrieval: true,
        embeddingProvider: 'nvidia',
        embeddingModel: 'baai/bge-m3',
        queryEmbeddingMethod: 'llm-summary',
        analysisProvider: 'gemini',
        analysisModel: 'gemini-2.0-flash',
        hydeEnabled: false,
        weights: { recency: 5, emotionalSignificance: 7, decisionRelevance: 6 }
      },
      user: { name: 'User', persona: 'A friendly user chatting with the character.' },
      theme: ThemeManager.getDefaultTheme(),
      bubbleStyle: 'rounded'
    };
    return state.settings;
  }
}

// Save settings to the server
async function saveSettings(settings) {
  try {
    const response = await makeRequest(API.SETTINGS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }, 15000, 2);

    state.settings = await response.json();

    // Apply theme and bubble style
    applyTheme(state.settings.theme);
    applyBubbleStyle(state.settings.bubbleStyle);

    return state.settings;
  } catch (error) {
    console.error('Error saving settings:', error);
    displayToast('Failed to save settings.', 'error');
    throw error;
  }
}

// Load model configurations
async function loadModelConfigurations() {
  try {
    const response = await fetch(API.MODELS);
    state.modelConfigurations = await response.json();
    return state.modelConfigurations;
  } catch (error) {
    console.error('Error loading model configurations:', error);
    // Use default/fallback configurations
    state.modelConfigurations = {
      gemini: [
        { id: "gemini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro Preview" }
      ]
    };
    return state.modelConfigurations;
  }
}

// Load all characters
async function loadCharacters() {
  try {
    const response = await makeRequest(API.CHARACTERS, {}, 10000, 1);
    state.characters = await response.json();
    renderCharacterList();
    return state.characters;
  } catch (error) {
    console.error('Error loading characters:', error);
    displayToast('Failed to load characters.', 'error');
    return [];
  }
}

// Render the character list in the sidebar
function renderCharacterList() {
  dom.characterList.innerHTML = '';

  if (state.characters.length === 0) {
    dom.characterList.innerHTML = '<div class="empty-list">No characters found. Create a new one!</div>';
    return;
  }

  state.characters.forEach(character => {
    const card = document.createElement('div');
    card.className = `character-card ${state.activeCharacter?.name === character.name ? 'active' : ''}`;
    card.dataset.characterName = character.name;

    // Add delete button (with icon)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn icon-btn delete-character-btn';
    deleteBtn.title = 'Delete Character';
    deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Character',
        message: `Delete character '${character.name}'? This cannot be undone.`,
        confirmText: 'Delete',
        confirmVariant: 'danger'
      });
      if (!confirmed) return;
      try {
        const res = await fetch(`/api/characters/${encodeURIComponent(character.name)}`, { method: 'DELETE' });
        if (res.ok) {
          state.characters = state.characters.filter(c => c.name !== character.name);
          if (state.activeCharacter?.name === character.name) {
            state.activeCharacter = null;
            document.body.classList.remove('mobile-chat-active');
            dom.chatContainer.classList.add('hidden');
            dom.welcomeScreen.classList.remove('hidden');
          }
          renderCharacterList();
          showSuccessMessage(`Character '${character.name}' deleted.`);
        } else {
          const data = await res.json().catch(() => ({}));
          showErrorMessage(data.error || 'Failed to delete character.');
        }
      } catch (err) {
        showErrorMessage('Failed to delete character.');
      }
    });

    card.innerHTML = `
      <img src="${character.avatarUrl || 'assets/default-avatar.svg'}" alt="${character.name}">
      <div class="character-info">
        <div class="character-name">${character.name}</div>
      </div>
    `;
    card.appendChild(deleteBtn);

    // Add error handler for avatar images
    const img = card.querySelector('img');
    img.onerror = () => {
      img.src = 'assets/default-avatar.svg';
    };

    card.addEventListener('click', () => selectCharacter(character.name));
    dom.characterList.appendChild(card);
  });
}

// Select a character and load their chat history
async function selectCharacter(characterName) {
  try {
    // Find the character in state
    const character = state.characters.find(c => c.name === characterName);
    if (!character) return;

    state.activeCharacter = character;

    // Update UI
    dom.characterName.textContent = character.name;
    // Set the character avatar in the header
    dom.characterAvatar.src = character.avatarUrl || 'assets/default-avatar.svg';
    // Add error handler for the header avatar
    dom.characterAvatar.onerror = () => {
      dom.characterAvatar.src = 'assets/default-avatar.svg';
    };
 

    // Highlight the selected character in the list
    const characterCards = document.querySelectorAll('.character-card');
    characterCards.forEach(card => {
      card.classList.toggle('active', card.dataset.characterName === characterName);
    });

    dom.welcomeScreen.classList.add('hidden');
    dom.chatContainer.classList.remove('hidden');

    if (isMobile()) {
      document.body.classList.add('mobile-chat-active');
      dom.sidebar.classList.remove('expanded');
    }

    // Load chat history
    await loadChatHistory(characterName);


    if (state.chatHistory.length === 0) {
      console.log("Chat history empty, not adding first message.");
    } else {
      console.log("Chat history loaded:", state.chatHistory); // Added log
    }

    // Render whatever is now in state.chatHistory
    renderChatHistory();
    scrollToBottom();

    // Add this log:
    console.log("selectCharacter end: chatContainer classes:", dom.chatContainer.className);
    console.log("selectCharacter end: chatMessages computed height:", window.getComputedStyle(dom.chatMessages).height);

  } catch (error) {
    console.error('Error selecting character:', error);
    displayToast('Failed to load character data.', 'error');
  }
}

// Load chat history for the selected character
async function loadChatHistory(characterName) {
  try {
    const response = await makeRequest(`${API.CHAT}/${characterName}`, {}, 10000, 1);

    // Check if the request was successful and response is valid
    if (!response.ok) {
      console.warn(`Failed to load chat history for ${characterName}, status: ${response.status}. Assuming empty history.`);
      state.chatHistory = []; // Ensure state is empty array
      return [];
    }

    const history = await response.json();

    // Ensure the loaded history is actually an array
    if (!Array.isArray(history)) {
      console.error(`Loaded chat history for ${characterName} is not an array:`, history);
      state.chatHistory = []; // Ensure state is empty array
      return [];
    }

    state.chatHistory = history;
    return state.chatHistory;

  } catch (error) {
    console.error('Error loading or parsing chat history:', error);
    state.chatHistory = []; // Ensure state is empty array on any error
    return [];
  }
}

// Save chat history for the active character
async function saveChatHistory() {
  if (!state.activeCharacter) return;

  try {
    await makeRequest(`${API.CHAT}/${state.activeCharacter.name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.chatHistory)
    }, 15000, 2);
  } catch (error) {
    console.error('Error saving chat history:', error);
    displayToast('Failed to save chat history.', 'warning');
  }
}

// Reusable animated confirmation dialog (Promise-based)
function showConfirm({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Yes', cancelText = 'Cancel', confirmVariant = 'primary' } = {}) {
  return new Promise(resolve => {
    const dialog = document.getElementById('confirm-dialog');
    if (!dialog) { // Fallback gracefully
      const native = window.confirm(message);
      resolve(native); return;
    }
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    // Set content
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.classList.remove('danger');
      if (confirmVariant === 'danger') {
        okBtn.style.background = 'linear-gradient(135deg, var(--error-color), #ff6b6b)';
        okBtn.style.borderColor = 'var(--error-color)';
      } else {
        okBtn.style.background = '';
        okBtn.style.borderColor = '';
      }
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    // Show dialog
    dialog.classList.remove('hidden');
    // Focus management
    let previousActive = document.activeElement;
    setTimeout(() => okBtn?.focus(), 10);

    const cleanup = (result) => {
      dialog.classList.add('hidden');
      // Restore focus
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      // Remove listeners to avoid leaks
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement === okBtn) {
          cleanup(true);
        } else if (document.activeElement === cancelBtn) {
          cleanup(false);
        } else {
          // Default to confirm if focus is elsewhere (current behavior fallback)
          cleanup(true);
        }
      }
    };

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
  });
}

// Clear chat history for the active character
async function clearChatHistory() {
  if (!state.activeCharacter) return;

  try {
    // Call the backend API to clear chat history (which now preserves the first message)
    const response = await makeRequest(`${API.CHAT}/${state.activeCharacter.name}`, {
      method: 'DELETE'
    }, 10000, 1);

    if (!response.ok) {
      throw new Error('Failed to clear chat history');
    }

    // Load the chat history again to get the preserved first message
    await loadChatHistory(state.activeCharacter.name);

    // Show success message
    showSuccessMessage('Chat history cleared');

    // No need to manually set state.chatHistory as loadChatHistory handles it

    renderChatHistory();
    scrollToBottom();
  } catch (error) {
    console.error('Error clearing chat history:', error);
    showErrorMessage('Failed to clear chat history.');
  }
}

// Render chat history in the chat container
function renderChatHistory() {
  dom.chatMessages.innerHTML = '';

  if (!state.chatHistory || state.chatHistory.length === 0) {
    console.log("renderChatHistory: No history to render.");
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < state.chatHistory.length; i++) {
    const message = state.chatHistory[i];
    const messageElement = createMessageElement(message, i);
    if (messageElement instanceof Node) {
      fragment.appendChild(messageElement);
    } else {
      console.error(`renderChatHistory: Failed to create valid element for message ${i}`, message);
    }
  }
  dom.chatMessages.appendChild(fragment);

  // Animate in only the newly rendered messages
  const messageElements = dom.chatMessages.querySelectorAll('.message');
  messageElements.forEach(el => {
    requestAnimationFrame(() => {
      el.classList.add('animate-in');
    });
  });

  scrollToBottom();
}

// Removed legacy performance/show-more logic

// --- Add New Handler Functions ---

// Handle Multi-Delete Button Click
async function handleMultiDelete(startIndex) {
  if (!state.activeCharacter) return;

  const messagesToDeleteCount = state.chatHistory.length - startIndex;
  
  // Show confirmation dialog
  const confirmMessage = messagesToDeleteCount === 1 
    ? 'Are you sure you want to delete this message?'
    : `Are you sure you want to delete ${messagesToDeleteCount} messages from this point onward?`;
  
  if (!confirm(confirmMessage)) {
    return; // User cancelled
  }

  try {
    // Remove messages from state
    state.chatHistory.splice(startIndex);

    // Re-render chat
    renderChatHistory();

    // Save updated history to backend
    await saveChatHistory();
    showSuccessMessage(`Deleted ${messagesToDeleteCount} message(s).`); // Updated message
  } catch (error) {
    console.error('Error during multi-delete:', error);
    showErrorMessage('Failed to delete messages.');
    // Consider reloading history from backend if save failed partially
    await loadChatHistory(state.activeCharacter.name);
    renderChatHistory();
  }
}

// Handle Edit Button Click
function handleEditMessage(index) {
  const messageElement = dom.chatMessages.querySelector(`.message[data-message-index="${index}"]`);
  if (!messageElement) return;

  const bubbleDiv = messageElement.querySelector('.message-bubble');
  const originalContent = bubbleDiv.dataset.originalContent || (state.chatHistory[index] && state.chatHistory[index].content) || '';

  // Prevent editing if already in edit mode
  if (bubbleDiv.querySelector('textarea.edit-textarea')) {
    return;
  }

  // Create textarea for editing
  const editTextArea = document.createElement('textarea');
  editTextArea.className = 'edit-textarea';
  editTextArea.value = originalContent;
  editTextArea.rows = Math.max(3, (originalContent.match(/\n/g) || []).length + 1); // Adjust rows based on content

  // Create save/cancel buttons
  const editActionsDiv = document.createElement('div');
  editActionsDiv.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn primary btn-sm';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    const newContent = editTextArea.value.trim();
    if (newContent && newContent !== originalContent) {
      try {
        // Update state FIRST
        state.chatHistory[index].content = newContent;
        // Optionally add/update a timestamp for the edit
        state.chatHistory[index].editedTimestamp = Date.now();

        // Re-render from state
        reRenderSingleMessage(index);

        // Save to backend
        await saveChatHistory();
        showSuccessMessage('Message updated.');
      } catch (error) {
        console.error('Error saving edited message:', error);
        showErrorMessage('Failed to save edit.');
        // Revert state and re-render on error
        state.chatHistory[index].content = originalContent;
        delete state.chatHistory[index].editedTimestamp;
        reRenderSingleMessage(index);
      }
    } else {
      // Content is unchanged, just cancel the edit by re-rendering the original state
      reRenderSingleMessage(index);
    }
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    // Restore original content in the state
    state.chatHistory[index].content = originalContent;
    // Re-render the message bubble from the updated state.
    reRenderSingleMessage(index);
  };

  editActionsDiv.appendChild(saveBtn);
  editActionsDiv.appendChild(cancelBtn);

  // Replace bubble content with textarea and actions
  bubbleDiv.innerHTML = '';
  bubbleDiv.appendChild(editTextArea);
  bubbleDiv.appendChild(editActionsDiv);
  editTextArea.focus(); // Focus the textarea
}

// Re-render a single message in place (used after edit cancel/save)
function reRenderSingleMessage(index) {
  const nodeToReplace = dom.chatMessages.querySelector(`.message[data-message-index="${index}"]`);
  if (!nodeToReplace) {
    console.error(`reRenderSingleMessage: Could not find message node with index ${index} to replace.`);
    return;
  }

  const messageData = state.chatHistory[index];
  if (!messageData) {
    console.error(`reRenderSingleMessage: No chat history data found for index ${index}.`);
    // As a fallback, just remove the broken node to prevent UI blockage
    nodeToReplace.remove();
    return;
  }

  const replacementNode = createMessageElement(messageData, index);

  if (replacementNode instanceof Node) {
    nodeToReplace.replaceWith(replacementNode);
    // Animate the new node in to provide visual feedback
    requestAnimationFrame(() => {
      replacementNode.classList.add('animate-in');
    });
  } else {
    console.error(`reRenderSingleMessage: createMessageElement failed to return a valid DOM node for index ${index}.`, messageData);
    // Fallback: Instead of disappearing, revert the node's content without a full re-render.
    const bubble = nodeToReplace.querySelector('.message-bubble');
    if (bubble) {
      const contentWithoutThoughts = messageData.content.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
      const sanitizedContent = DOMPurify.sanitize(marked.parse(contentWithoutThoughts));
      bubble.innerHTML = sanitizedContent;
    }
  }
}

// --- End New Handler Functions ---

// Replace all {{user}} placeholders with the current user's name
function replaceUserPlaceholder(text) {
  if (!text) return text;
  const userName = state.settings?.user?.name || 'User';
  return text.replace(/\{\{user\}\}/gi, userName);
}

// Create a message element
function createMessageElement(message, index) {
  // Handle special message types like scene breaks
  if (message.type === 'scene-break') {
    const breakDiv = document.createElement('div');
    breakDiv.className = 'scene-break-divider';
    // You can add text here if you want, e.g., breakDiv.textContent = '...';
    const hr = document.createElement('hr');
    breakDiv.appendChild(hr);
    return breakDiv;
  }

  const messageDiv = document.createElement('div');
  let extraClass = '';
  if (message.pending) extraClass += ' pending';
  if (message.failed) extraClass += ' failed';
  messageDiv.className = `message ${message.role}${extraClass}`;
  messageDiv.dataset.messageIndex = index;

  // Avatar
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'avatar';
  const avatarImg = document.createElement('img');
  if (message.role === 'user') {
    avatarImg.src = state.settings.user?.avatarUrl || 'assets/default-avatar.svg';
    avatarImg.alt = state.settings.user?.name || 'User';
  } else {
    avatarImg.src = state.activeCharacter?.avatarUrl || 'assets/default-avatar.svg';
    avatarImg.alt = state.activeCharacter?.name || 'Character';
  }
  avatarImg.onerror = () => { avatarImg.src = 'assets/default-avatar.svg'; };
  avatarDiv.appendChild(avatarImg);

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';

  // --- NEW: Handle rendering for failed messages ---
  if (message.failed) {
    // For failed messages, the content is the error message. Render it safely.
    bubbleDiv.innerHTML = `<div class="message-error-content"><i class="ri-error-warning-line"></i><span>${message.content}</span></div>`;
  } else {
    // Original rendering logic for successful messages
    marked.setOptions({ breaks: true, gfm: true, sanitize: false });
    let safeContent = typeof message.content === 'string' ? message.content : '';
    
    // --- NEW: Handle displaying AI thoughts ---
    let filteredContent = safeContent; // Start with full content
    if (message.role === 'assistant') {
      const thoughtRegex = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
      const thoughts = [...safeContent.matchAll(thoughtRegex)].map(match => match[1].trim());

      if (thoughts.length > 0) {
        const thoughtContainer = document.createElement('div');
        thoughtContainer.className = 'message-thought-container';

        const thoughtBtn = document.createElement('button');
        thoughtBtn.className = 'thought-btn';
        thoughtBtn.innerHTML = '<i class="ri-psychotherapy-line"></i>';
        thoughtBtn.title = 'View character thoughts';

        const thoughtContentDiv = document.createElement('div');
        thoughtContentDiv.className = 'thought-content';
        // Sanitize thought content since it's internal AI content
        thoughtContentDiv.innerHTML = DOMPurify.sanitize(thoughts.join('<hr>'));

        thoughtContainer.appendChild(thoughtBtn);
        thoughtContainer.appendChild(thoughtContentDiv);
        messageDiv.appendChild(thoughtContainer);
      }
      // Remove thoughts from the content that will be displayed in the bubble
      filteredContent = safeContent.replace(thoughtRegex, '').trim();
    }

    const replacedContent = replaceUserPlaceholder(filteredContent);
    bubbleDiv.dataset.originalContent = safeContent;
    // Sanitize content before rendering with marked
    const sanitizedContent = DOMPurify.sanitize(marked.parse(replacedContent));
    bubbleDiv.innerHTML = sanitizedContent;
  }

  if (message.pending) {
    const pendingDiv = document.createElement('div');
    pendingDiv.className = 'message-pending';
    pendingDiv.innerHTML = '<span style="color:gray"><i class="ri-time-line"></i> Sending...</span>';
    bubbleDiv.appendChild(pendingDiv);
  }

  // Time
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
  timeDiv.textContent = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Actions (only show for non-failed messages)
  if (!message.failed) {
    const messageActionsDiv = document.createElement('div');
    messageActionsDiv.className = 'message-inline-actions';
    // Edit
    const editBtn = document.createElement('button');
    editBtn.className = 'btn icon-btn message-action-btn edit-btn';
    editBtn.innerHTML = '<i class="ri-pencil-line"></i>';
    editBtn.title = 'Edit Message';
    editBtn.addEventListener('click', () => handleEditMessage(index));
    messageActionsDiv.appendChild(editBtn);
    // Multi-Delete
    if (message.role === 'user') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn icon-btn message-action-btn delete-from-here-btn';
      deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
      deleteBtn.title = 'Delete From Here';
      deleteBtn.addEventListener('click', () => handleMultiDelete(index));
      messageActionsDiv.appendChild(deleteBtn);
    }

    messageDiv.appendChild(messageActionsDiv);
    // Small overflow button for mobile to toggle actions
    const kebab = document.createElement('button');
    kebab.className = 'message-kebab';
    kebab.type = 'button';
    kebab.setAttribute('aria-label', 'Message options');
    kebab.innerHTML = '<i class="ri-more-2-fill"></i>';
    messageDiv.appendChild(kebab);
  }

  contentDiv.appendChild(bubbleDiv);
  contentDiv.appendChild(timeDiv);
  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  return messageDiv;
}

// Send a message to the character
async function sendMessage() {
  const message = dom.messageInput.value.trim();

  if (!message || !state.activeCharacter || state.isGenerating) {
    return;
  }

  // Generate unique message ID
  const messageId = ++state.lastMessageId;

  try {
    // Add user message to chat history
    state.chatHistory.push({ role: 'user', content: message, id: messageId });
    renderChatHistory();

    // Clear input and show generating
    dom.messageInput.value = '';
    state.isGenerating = true;
    addGeneratingIndicator();

    // Notify user about potential wait time for complex processing
    displayToast('Starting response generation. Complex responses may take up to 5 minutes.', 'info', 6000);

    // Send message with longer timeout for mobile and include message ID
    const response = await makeRequest(API.CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: state.activeCharacter.name,
        message,
        messageId, // Include message ID for server-side caching
        settings: state.settings
      })
    }, 600000, 1); // 10 minute timeout, 1 retry (2 total attempts)

    const data = await response.json();

    // Remove generating indicator
    removeGeneratingIndicator();

    // Validate response
    if (!data.response || typeof data.response !== 'string') {
      throw new Error('Invalid response from server');
    }

    // Check for duplicate before adding (in case recovery system already added it)
    const lastMessage = state.chatHistory[state.chatHistory.length - 1];
    const isDuplicate = lastMessage &&
      lastMessage.role === 'assistant' &&
      lastMessage.content === data.response;

    if (!isDuplicate) {
      // Add assistant response to chat history
      state.chatHistory.push({ role: 'assistant', content: data.response });
      renderChatHistory();
    }

    // Save chat history
    await saveChatHistory();

  } catch (error) {
    console.error('Error sending message:', error);
    removeGeneratingIndicator();

    // --- NEW LOGIC FOR IN-CHAT ERROR DISPLAY ---
    // 1. Determine the error message
    let errorMessage = 'Failed to generate response. Please check the server logs.';
    if (error.response) {
      try {
        const errorData = await error.response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        errorMessage = `Request failed with status: ${error.response.status}. Please try again.`;
      }
    } else if (error.name === 'AbortError') {
      // Don't show an error if the user cancelled it
      if (state.currentAbortController) { // Abort was from timeout, not user
        errorMessage = 'Request timed out. The server might be busy or the request is too complex.';
      } else { // User cancelled
        // Remove the user message that was optimistically added
        if (state.chatHistory.length > 0 && state.chatHistory[state.chatHistory.length - 1].role === 'user') {
          state.chatHistory.pop();
          renderChatHistory();
        }
        return; // Exit without showing an error
      }
    } else if (!connectionStatus.isConnected) {
      errorMessage = 'No connection to server. Your message will be sent when connection is restored.';
    }

    // 2. Add a "failed" assistant message to the chat history for UI display
    state.chatHistory.push({
      role: 'assistant',
      content: errorMessage,
      failed: true // Custom flag for the renderer
    });

    // 3. Re-render the chat to show the user's message and the error response
    renderChatHistory();
    scrollToBottom();

    // 4. IMPORTANT: Do NOT save this failed state to the permanent chat history.
    // The user can then choose to edit their message, try again, or continue.
  } finally {
    state.isGenerating = false;
    state.currentAbortController = null;
  }
}

// Add loading indicator while generating a response
function addGeneratingIndicator() {
  const indicatorDiv = document.createElement('div');
  indicatorDiv.className = 'message assistant generating';
  indicatorDiv.innerHTML = `
    <div class="message-bubble">
      <div class="loading"></div> 
      <div class="generating-text">
        <span class="generating-main">Generating response...</span>
        <span class="generating-detail">Processing memories, context, and model inference</span>
        <span class="generating-time">This may take up to 5 minutes for complex responses</span>
      </div>
      <button class="cancel-generation-btn" title="Cancel generation">
        <i class="ri-close-line"></i>
      </button>
    </div>
  `;

  dom.chatMessages.appendChild(indicatorDiv);
  scrollToBottom();

  // Add cancel button functionality
  const cancelBtn = indicatorDiv.querySelector('.cancel-generation-btn');
  cancelBtn.addEventListener('click', () => {
    if (state.currentAbortController) {
      state.currentAbortController.abort();
      displayToast('Response generation cancelled', 'info', 3000);
    }
  });

  // Add a progress timer to show elapsed time
  const startTime = Date.now();
  const timeSpan = indicatorDiv.querySelector('.generating-time');

  const timeInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    if (minutes > 0) {
      timeSpan.textContent = `Processing for ${minutes}m ${seconds}s...`;
    } else {
      timeSpan.textContent = `Processing for ${seconds}s...`;
    }

    // If it's been over 2 minutes, show encouraging message
    if (elapsed > 120) {
      timeSpan.textContent += ' (Complex response in progress, please wait)';
    }
  }, 1000);

  // Store the interval so we can clear it when removing the indicator
  indicatorDiv.dataset.timeInterval = timeInterval;
}

// Remove the generating indicator
function removeGeneratingIndicator() {
  const indicator = document.querySelector('.message.generating');
  if (indicator) {
    // Clear the timer interval if it exists
    const timeInterval = indicator.dataset.timeInterval;
    if (timeInterval) {
      clearInterval(parseInt(timeInterval));
    }
    indicator.remove();
  }
}

// Scroll to bottom of chat (mobile-safe: scroll the messages container explicitly)
function scrollToBottom({ smooth = true } = {}) {
  try {
    const container = dom.chatMessages;
    if (!container) return;

    // Prefer to scroll the scrollable chat container directly so the page/body doesn't move
    // (avoids hiding the top header/tools on mobile browsers).
    const target = Math.max(0, container.scrollHeight - container.clientHeight);
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      container.scrollTop = target;
    }
  } catch (err) {
    // Fallback to scrollIntoView on last message if anything goes wrong
    const lastMessage = dom.chatMessages && dom.chatMessages.lastElementChild;
    if (lastMessage && lastMessage.scrollIntoView) {
      try { lastMessage.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' }); } catch (e) { /* ignore */ }
    }
  }
}

// Show the character creation/editing modal
function showCharacterModal(character = null) {
  const isEditing = !!character;

  // Generate the modal HTML
  dom.characterModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${isEditing ? 'Edit Character' : 'Create New Character'}</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="character-form">
          <div class="form-group">
            <label for="char-name">Name</label>
            <input type="text" id="char-name" required value="${character?.name || ''}">
          </div>
          
          <div class="form-group">
            <label for="char-avatar-url">Avatar URL (optional)</label>
            <div class="avatar-input-group">
              <input type="text" id="char-avatar-url" value="${character?.avatarUrl || ''}" placeholder="Enter image URL">
              <div class="avatar-preview">
                <img id="avatar-preview-img" src="${character?.avatarUrl || 'assets/default-avatar.svg'}" alt="Avatar preview">
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="char-appearance">Appearance</label>
            <textarea id="char-appearance" rows="3">${character?.appearance || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label for="char-persona">Persona</label>
            <textarea id="char-persona" required rows="5">${character?.persona || ''}</textarea>
            <small>Personality, traits, background, mannerisms, speaking style, etc.</small>
          </div>
          
          <div class="form-group">
            <label for="char-scenario">Current Scenario</label>
            <textarea id="char-scenario" rows="3">${character?.currentScenario || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label for="char-first-msg">First Message</label>
            <textarea id="char-first-msg" rows="3">${character?.firstMessage || ''}</textarea>
          </div>
          
          <div class="form-tabs">
            <button type="button" class="tab-btn active" data-tab="basic">Basic</button>
            <button type="button" class="tab-btn" data-tab="advanced">Advanced</button>
            <button type="button" class="tab-btn" data-tab="memory">Memory</button>
          </div>
          
          <div id="basic-tab" class="tab-content active">
            <!-- Basic settings already shown above -->
          </div>
          
          <div id="advanced-tab" class="tab-content">
            
            <div class="form-group">
              <label>Model Settings Override</label>
              <div class="model-override-controls">
                <div class="param-group">
                  <label for="char-temperature">Temperature</label>
                  <input type="range" id="char-temperature" min="0" max="2" step="0.1" value="${character?.settingsOverride?.temperature || state.settings?.temperature || 0.7}">
                  <span id="char-temperature-value">${character?.settingsOverride?.temperature || state.settings?.temperature || 0.7}</span>
                </div>
                <div class="param-group">
                  <label for="char-top-p">Top-P</label>
                  <input type="range" id="char-top-p" min="0" max="1" step="0.05" value="${character?.settingsOverride?.topP || state.settings?.topP || 0.9}">
                  <span id="char-top-p-value">${character?.settingsOverride?.topP || state.settings?.topP || 0.9}</span>
                </div>
              </div>
            </div>
          </div>
            <div id="memory-tab" class="tab-content">
            <div class="form-group">
              <h3>Memory Importance Factors</h3>
              <div class="slider-group">
                <label for="emotional-weight-char">Emotional weight</label>
                <input id="emotional-weight-char" type="range" min="0" max="10" value="${character?.memorySettings?.emotionalWeight || 5}">
              </div>
              <div class="slider-group">
                <label for="decision-weight-char">Decision weight</label>
                <input id="decision-weight-char" type="range" min="0" max="10" value="${character?.memorySettings?.decisionWeight || 5}">
              </div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" id="cancel-btn">Cancel</button>
        <button type="button" class="btn primary" id="save-character-btn">Save Character</button>
      </div>
    </div>
  `;

  // Show the modal
  dom.characterModal.classList.add('visible');

  // Set up avatar preview handler
  const avatarUrlInput = dom.characterModal.querySelector('#char-avatar-url');
  const avatarPreviewImg = dom.characterModal.querySelector('#avatar-preview-img');

  avatarUrlInput.addEventListener('input', () => {
    const url = avatarUrlInput.value.trim();
    avatarPreviewImg.src = url || 'assets/default-avatar.svg';
    avatarPreviewImg.onerror = () => {
      avatarPreviewImg.src = 'assets/default-avatar.svg';
    };
  });

  // Attach event listeners
  attachCharacterModalEvents(isEditing);
}



// Default system prompt for new characters


// Attach event listeners to character modal elements
function attachCharacterModalEvents(isEditing) {
  // Close button
  const closeBtn = dom.characterModal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => dom.characterModal.classList.remove('visible'));

  // Cancel button
  const cancelBtn = dom.characterModal.querySelector('#cancel-btn');
  cancelBtn.addEventListener('click', () => dom.characterModal.classList.remove('visible'));

  // Tab buttons
  const tabBtns = dom.characterModal.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tabId = btn.dataset.tab;
      const tabContents = dom.characterModal.querySelectorAll('.tab-content');
      tabContents.forEach(tab => {
        tab.classList.toggle('active', tab.id === `${tabId}-tab`);
      });
    });
  });

  // Range input value display
  const rangeInputs = dom.characterModal.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(input => {
    const valueDisplay = dom.characterModal.querySelector(`#${input.id}-value`);
    if (valueDisplay) {
      input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
      });
    }
  });

  // Save button
  const saveBtn = dom.characterModal.querySelector('#save-character-btn');
  saveBtn.addEventListener('click', () => saveCharacter(isEditing));
}

// Save character from form
async function saveCharacter(isEditing) {
  // Get form values
  const form = dom.characterModal.querySelector('#character-form');
  const name = dom.characterModal.querySelector('#char-name').value.trim();
  const avatarUrl = dom.characterModal.querySelector('#char-avatar-url').value.trim();
  const appearance = dom.characterModal.querySelector('#char-appearance').value.trim();
  const persona = dom.characterModal.querySelector('#char-persona').value.trim();
  const currentScenario = dom.characterModal.querySelector('#char-scenario').value.trim();
  const firstMessage = dom.characterModal.querySelector('#char-first-msg').value.trim();
  const temperature = parseFloat(dom.characterModal.querySelector('#char-temperature').value);
  const topP = parseFloat(dom.characterModal.querySelector('#char-top-p').value);

  // Validation
  if (!name || !persona) {
    showErrorMessage('Name and Persona are required.');
    return;
  }

  // Create character object
  const character = {
    name,
    avatarUrl,
    appearance,
    persona,
    currentScenario,
    firstMessage,
    settingsOverride: {
      temperature,
      topP
    },
    createdAt: isEditing ? state.activeCharacter.createdAt : Date.now(),
    modifiedAt: Date.now()
  };

  try {
    // Create or update character
    const method = isEditing ? 'PUT' : 'POST';
    const endpoint = isEditing ? `${API.CHARACTERS}/${state.activeCharacter.name}` : API.CHARACTERS;

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(character)
    });

    const savedCharacter = await response.json();

    // Update state and UI
    if (isEditing) {
      // Replace the character in the state
      const index = state.characters.findIndex(c => c.name === state.activeCharacter.name);
      if (index !== -1) {
        state.characters[index] = savedCharacter;
      }
      state.activeCharacter = savedCharacter;
    } else {
      // Add new character to state
      state.characters.push(savedCharacter);
      state.activeCharacter = savedCharacter;
    }

    // Close modal and update UI
    dom.characterModal.classList.remove('visible');
    renderCharacterList();

    // Select the character if it's new
    if (!isEditing) {
      selectCharacter(savedCharacter.name);
    } else {
      // Update character name in header
      dom.characterName.textContent = savedCharacter.name;
    }
  } catch (error) {
    console.error('Error saving character:', error);
    showErrorMessage('Failed to save character.');
  }
}

// Function to populate model options based on selected provider
function populateModelOptions(selectedProvider) {
  const modelSelect = document.getElementById('model-selection');
  if (!modelSelect) return;

  const provider = selectedProvider || document.getElementById('llm-provider').value;

  // Clear existing options
  modelSelect.innerHTML = '';

  if (!state.modelConfigurations) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Loading models...';
    modelSelect.appendChild(option);
    return;
  }
  const models = state.modelConfigurations[provider] || [];
  if (models.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `No models for ${provider}`;
    modelSelect.appendChild(option);
    return;
  }

  // Add options to select
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id; // Use 'id' from backend configuration
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });

  // Select current model if it exists in the list, otherwise select first model
  const currentModel = state.settings.model;
  const modelExists = Array.from(modelSelect.options).some(option => option.value === currentModel);

  if (modelExists) {
    modelSelect.value = currentModel;
  } else if (modelSelect.options.length > 0) {
    modelSelect.selectedIndex = 0;
  }
}

// Show the settings modal
function showSettingsModal() {
  // Generate the modal HTML

  const currentProvider = state.settings.provider || 'gemini';
  const apiKeys = state.settings.apiKeys || {};

  dom.settingsModal.innerHTML = `
    <div class="modal-content settings-modal">
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="settings-tabs">
          <button type="button" class="tab-btn active" data-tab="models">Models</button>
          <button type="button" class="tab-btn" data-tab="user">User Profile</button>
          <button type="button" class="tab-btn" data-tab="appearance">Appearance</button>
          <button type="button" class="tab-btn" data-tab="memory">Memory System</button>
        </div>
        
        <div id="models-tab" class="tab-content active">
          <div class="form-group">
            <label for="llm-provider">LLM Provider</label>
            <select id="llm-provider">
              <option value="gemini" ${state.settings.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="openrouter" ${state.settings.provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
              <option value="huggingface" ${state.settings.provider === 'huggingface' ? 'selected' : ''}>HuggingFace</option>
              <option value="mistral" ${state.settings.provider === 'mistral' ? 'selected' : ''}>Mistral</option>
              <!-- Requesty removed -->
              <option value="cohere" ${state.settings.provider === 'cohere' ? 'selected' : ''}>Cohere</option>
              <option value="aionlabs" ${state.settings.provider === 'aionlabs' ? 'selected' : ''}>Aion Labs</option>
              <option value="nvidia" ${state.settings.provider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM</option>
              <option value="chutes" ${state.settings.provider === 'chutes' ? 'selected' : ''}>Chutes</option>
              <option value="glm" ${state.settings.provider === 'glm' ? 'selected' : ''}>GLM (BigModel.cn)</option>
            </select>
          </div>
          
          <!-- Dynamic model selection based on provider -->
          <div class="form-group" id="model-selection-container">
            <label for="model-selection">Model</label>
            <select id="model-selection">
              <!-- Will be populated based on provider selection -->
            </select>
          </div>

          <!-- Embedding Model/Provider Selection -->
          <div class="form-group">
            <label for="embedding-provider">Embedding Provider</label>
            <select id="embedding-provider">
              <option value="gemini" ${state.settings.memory?.embeddingProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="nvidia" ${state.settings.memory?.embeddingProvider === 'nvidia' ? 'selected' : ''}>NVIDIA (bge-m3)</option>
              <option value="mistral" ${state.settings.memory?.embeddingProvider === 'mistral' ? 'selected' : ''}>Mistral</option>
              <option value="cohere" ${state.settings.memory?.embeddingProvider === 'cohere' ? 'selected' : ''}>Cohere</option>
            </select>
          </div>
          <div class="form-group">
            <label for="embedding-model">Embedding Model</label>
            <select id="embedding-model"></select>
            <small>Only compatible models for the selected provider are shown</small>
          </div>

          <!-- Query Embedding Method -->
          <div class="form-group">
            <label for="query-embedding-method">Query Embedding Method</label>
            <select id="query-embedding-method">
              <option value="llm-summary" ${!state.settings.memory?.queryEmbeddingMethod || state.settings.memory?.queryEmbeddingMethod === 'llm-summary' ? 'selected' : ''}>LLM Summary (Recommended)</option>
              <option value="hyde" ${state.settings.memory?.queryEmbeddingMethod === 'hyde' ? 'selected' : ''}>HyDE (Hypothetical Document)</option>
              <option value="average" ${state.settings.memory?.queryEmbeddingMethod === 'average' ? 'selected' : ''}>Average (User+Assistant)</option>
              <option value="plain" ${state.settings.memory?.queryEmbeddingMethod === 'plain' ? 'selected' : ''}>Plain (User Message Only)</option>
            </select>
            <small>How to generate the query vector for memory search</small>
          </div>

          <!-- Analysis Model/Provider Selection -->
          <div class="form-group">
            <label for="analysis-provider">Memory Analysis Provider</label>
            <select id="analysis-provider">
              <option value="gemini" ${state.settings.memory?.analysisProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="openrouter" ${state.settings.memory?.analysisProvider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
              <option value="huggingface" ${state.settings.memory?.analysisProvider === 'huggingface' ? 'selected' : ''}>HuggingFace</option>
              <option value="mistral" ${state.settings.memory?.analysisProvider === 'mistral' ? 'selected' : ''}>Mistral</option>
              <!-- Requesty removed -->
              <option value="cohere" ${state.settings.memory?.analysisProvider === 'cohere' ? 'selected' : ''}>Cohere</option>
              <option value="nvidia" ${state.settings.memory?.analysisProvider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM</option>
              <option value="glm" ${state.settings.memory?.analysisProvider === 'glm' ? 'selected' : ''}>GLM (BigModel.cn)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="analysis-model">Memory Analysis Model</label>
            <select id="analysis-model"></select>
            <small>Model used for memory chunk analysis (same list as chat model, but saved separately)</small>
          </div>
          
          <div class="form-group">
            <label id="api-keys-label">API Keys for ${currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)}</label>
            <div class="api-keys-container" id="api-keys-container">
              <div class="api-key-list" id="api-key-list">
                ${populateApiKeyList(currentProvider)}
              </div>
              <button type="button" class="btn secondary add-api-key-btn">+ Add API Key</button>
            </div>
          </div>
          
          <!-- LLM Parameters -->
          <div class="form-group">
            <label>Parameters</label>
            
            <div class="param-group">
              <label for="temperature">Temperature</label>
              <input type="range" id="temperature" min="0" max="2" step="0.1" value="${state.settings.temperature || 0.7}">
              <span id="temperature-value">${state.settings.temperature || 0.7}</span>
            </div>
            
            <div class="param-group">
              <label for="top-p">Top-P</label>
              <input type="range" id="top-p" min="0" max="1" step="0.05" value="${state.settings.topP || 0.9}">
              <span id="top-p-value">${state.settings.topP || 0.9}</span>
            </div>
            
            <div class="param-group">
              <label for="max-tokens">Max Output Tokens</label>
              <input type="number" id="max-tokens" min="10" max="8192" value="${state.settings.maxTokens || 2048}">
            </div>
            <div class="param-group">
              <label for="max-context-tokens">Max Context Tokens</label>
              <input type="number" id="max-context-tokens" min="1000" max="32000" value="${state.settings.maxContextTokens || 6000}">
              <small>Total token budget for prompt context (history, memories, etc)</small>
            </div>
          </div>
        </div>
        
        <div id="user-tab" class="tab-content">
          <div class="form-group">
            <label for="user-name">Your Name</label>
            <input type="text" id="user-name" value="${state.settings.user?.name || ''}">
          </div>
          
          <div class="form-group">
            <label for="user-avatar-url">Your Avatar URL (optional)</label>
            <div class="avatar-input-group">
              <input type="text" id="user-avatar-url" value="${state.settings.user?.avatarUrl || ''}" placeholder="Enter image URL">
              <div class="avatar-preview">
                <img id="user-avatar-preview" src="${state.settings.user?.avatarUrl || 'assets/default-avatar.svg'}" alt="User avatar preview">
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="user-persona">Your Persona</label>
            <textarea id="user-persona" rows="5">${state.settings.user?.persona || ''}</textarea>
            <small>Information about yourself that characters should know</small>
          </div>
        </div>
          <div id="appearance-tab" class="tab-content">
          <div class="form-group">
            <label for="theme-select">Theme</label>
            <select id="theme-select" class="theme-select">
              ${(function(){
                const themes = ThemeManager.getAllThemes();
                const current = state.settings.theme;
                // If current theme not in list (e.g., newly added CSS not yet scanned) include it
                if (current && !themes.includes(current)) themes.unshift(current);
                return themes.map(id => {
                  const meta = ThemeManager.getThemeInfo(id) || { name: id, description: 'Custom theme' };
                  const sel = ThemeManager.normalize(current) === id ? 'selected' : '';
                  return `<option value="${id}" ${sel} title="${meta.description}">${meta.name}</option>`;
                }).join('');
              })()}
            </select>
            <small>Choose a theme that matches your style and preferences</small>
          </div>
          
          <div class="form-group">
            <label>Chat Bubble Style</label>
            <div class="bubble-options">
              <button class="bubble-btn ${state.settings.bubbleStyle === 'rounded' ? 'active' : ''}" data-style="rounded">Rounded</button>
              <button class="bubble-btn ${state.settings.bubbleStyle === 'angular' ? 'active' : ''}" data-style="angular">Angular</button>
            </div>
            <small>Choose how message bubbles should look</small>
          </div>
        </div>
        
        <div id="memory-tab" class="tab-content">
          <div class="form-group">
            <label>
              <input type="checkbox" id="enable-memory-creation" ${state.settings.memory?.enableMemoryCreation !== false ? 'checked' : ''}>
              Enable Memory Creation
            </label>
            <small>Automatically create journal entries from conversations.</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="enable-memory-retrieval" ${state.settings.memory?.enableMemoryRetrieval === false ? '' : 'checked'}>
              Enable Memory Retrieval
            </label>
            <small>Retrieve and inject stored memories into prompts.</small>
          </div>
          <div class="form-group">
            <label for="journal-frequency">Journal Frequency</label>
            <input type="number" id="journal-frequency" min="5" max="50" value="${state.settings.memory?.journalFrequency || 10}">
            <small>Number of messages between creating journal entries</small>
          </div>
            <div class="form-group">
            <label for="memory-count">Memory Retrieval Count</label>
            <input type="number" id="memory-count" min="0" max="20" value="${state.settings.memory?.retrievalCount ?? 5}">
            <small>Number of memories to retrieve for context</small>
          </div>
          
          <div class="form-group">
            <label for="history-message-count">Chat History Messages</label>
            <input type="number" id="history-message-count" min="5" max="600" value="${state.settings.memory?.historyMessageCount || 15}">
            <small>Number of past messages to include in each prompt</small>
          </div>
            <div class="memory-weights">
            <h3>Memory Importance Weights</h3>
            <div class="param-group">
              <label for="recency-weight">Recency</label>
              <input type="range" min="0" max="10" value="${state.settings.memory?.weights?.recency || 5}" id="recency-weight">
              <span>${state.settings.memory?.weights?.recency || 5}</span>
            </div>
            <div class="param-group">
              <label for="emotional-weight">Emotional Significance</label>
              <input type="range" min="0" max="10" value="${state.settings.memory?.weights?.emotionalSignificance || 7}" id="emotional-weight">
              <span>${state.settings.memory?.weights?.emotionalSignificance || 7}</span>
            </div>
            <div class="param-group">
              <label for="decision-weight">Decision Relevance</label>
              <input type="range" min="0" max="10" value="${state.settings.memory?.weights?.decisionRelevance || 6}" id="decision-weight">
              <span>${state.settings.memory?.weights?.decisionRelevance || 6}</span>
            </div>
          </div>
          
          <div class="memory-reranking">
            <h3>Memory Reranking</h3>
            <div class="form-group">
              <label>
                <input type="checkbox" id="enable-reranking" ${state.settings.memory?.enableReranking !== false ? 'checked' : ''}>
                Enable Memory Reranking
              </label>
              <small>Use AI reranking to improve memory relevance</small>
            </div>
            
            <div class="form-group">
              <label for="reranking-provider">Reranking Provider</label>
              <select id="reranking-provider">
                <option value="jina" ${(state.settings.memory?.rerankingProvider || 'jina') === 'jina' ? 'selected' : ''}>Jina AI</option>
                <option value="cohere" ${state.settings.memory?.rerankingProvider === 'cohere' ? 'selected' : ''}>Cohere</option>
                <option value="nvidia" ${state.settings.memory?.rerankingProvider === 'nvidia' ? 'selected' : ''}>NVIDIA</option>
              </select>
              <small>Primary reranking provider (with automatic fallback)</small>
            </div>
            
            <div class="form-group">
              <label for="jina-api-key">Jina API Key</label>
              <input type="password" id="jina-api-key" value="${state.settings.apiKeys?.jina || ''}" placeholder="Enter your Jina API key">
              <small>Get your free API key from <a href="https://jina.ai/" target="_blank">jina.ai</a></small>
            </div>
          </div>
          <div class="turso-sync">
            <h3>Remote Sync (Turso)</h3>
            <div class="form-group">
              <label>
                <input type="checkbox" id="turso-enabled" ${state.settings.turso?.enabled ? 'checked' : ''}>
                Enable Turso Remote Sync
              </label>
              <small>Synchronize local SQLite database (including memories) with a remote Turso/libSQL deployment.</small>
            </div>
            <div id="turso-config" style="${state.settings.turso?.enabled ? '' : 'display:none;'}">
              <div class="form-group">
                <label for="turso-url">Turso Sync URL</label>
                <input type="text" id="turso-url" value="${state.settings.turso?.url || ''}" placeholder="libsql://YOUR-DB.turso.io">
                <small>Your Turso/libSQL database URL (starts with libsql://)</small>
              </div>
              <div class="form-group">
                <label for="turso-token">Turso Auth Token</label>
                <div style="display:flex; gap:8px; align-items:center;">
                  <input type="password" id="turso-token" value="${state.settings.turso?.authToken || ''}" placeholder="Access token" style="flex:1;">
                  <button type="button" class="btn secondary" id="turso-token-visibility">Show</button>
                </div>
                <small>Personal auth token with access to the database.</small>
              </div>
              <div class="form-group">
                <label for="turso-sync-interval">Sync Interval (ms)</label>
                <input type="number" id="turso-sync-interval" min="5000" step="1000" value="${state.settings.turso?.syncInterval || 30000}">
                <small>How often to pull remote changes (minimum 5000ms). Higher values reduce network usage.</small>
              </div>
              <div class="form-group">
                <small>Data flows: Local writes happen instantly; background sync periodically merges remote changes. Disable if offline.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" id="cancel-settings-btn">Cancel</button>
        <button type="button" class="btn primary" id="save-settings-btn">Save Settings</button>
      </div>
    </div>
  `;

  // Show the modal
  dom.settingsModal.classList.add('visible');

  // Attach event listeners
  attachSettingsModalEvents();

  // Fetch and update API key statuses
  updateApiKeyStatuses();
}

// Function to fetch and update API key statuses
async function updateApiKeyStatuses() {
  try {
    const response = await fetch('/api/key-status');
    if (response.ok) {
      const data = await response.json();

      // Store key statuses in state for later use
      if (!state.settings.apiKeyStatuses) {
        state.settings.apiKeyStatuses = {};
      }
      state.settings.apiKeyStatuses = data.statuses;

      // Update visual indicators if settings modal is open
      const modal = document.querySelector('.settings-modal');
      if (modal && modal.style.display !== 'none') {
        updateKeyStatusIndicators(data.statuses);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch API key statuses:', error);
  }
}

// Function to update key status indicators in the UI
function updateKeyStatusIndicators(statuses) {
  const currentProvider = document.getElementById('llm-provider')?.value;
  if (!currentProvider || !statuses[currentProvider]) return;

  const keyItems = document.querySelectorAll('.api-key-item');
  const providerStatuses = statuses[currentProvider];

  keyItems.forEach((item, index) => {
    const statusIndicator = item.querySelector('.api-key-status');
    if (statusIndicator && index < providerStatuses.length) {
      const status = providerStatuses[index];
      statusIndicator.className = `api-key-status ${status}`;
      statusIndicator.title = `Status: ${status}`;
    }
  });
}

// Helper functions for multiple API key management
function normalizeApiKeys(apiKeys, provider) {
  // Convert single string to array for backward compatibility
  const keys = apiKeys[provider];
  if (typeof keys === 'string') {
    return keys ? [keys] : [];
  }
  return Array.isArray(keys) ? keys : [];
}

function generateApiKeyInput(index, value, provider, status = 'untested') {
  const showText = value ? 'Show' : 'Show';
  const isFirst = index === 0;

  return `
    <div class="api-key-item" data-index="${index}">
      <span class="api-key-status ${status}" title="Status: ${status}"></span>
      <input type="password" class="api-key-input-field" 
             id="api-key-${provider}-${index}"
             name="api-key-${provider}-${index}"
             value="${value || ''}" 
             placeholder="Enter API key ${index + 1}"
             data-index="${index}">
      <button type="button" class="btn secondary show-hide-btn" data-index="${index}">Show</button>
      ${!isFirst ? `<button type="button" class="btn remove-api-key-btn" data-index="${index}">Remove</button>` : ''}
    </div>
  `;
}

function populateApiKeyList(provider) {
  const apiKeys = state.settings.apiKeys || {};
  const normalizedKeys = normalizeApiKeys(apiKeys, provider);
  const keyStatuses = state.settings.apiKeyStatuses?.[provider] || [];

  // Ensure at least one empty input
  if (normalizedKeys.length === 0) {
    normalizedKeys.push('');
  }

  let html = '';
  normalizedKeys.forEach((key, index) => {
    const status = keyStatuses[index] || 'untested';
    html += generateApiKeyInput(index, key, provider, status);
  });

  return html;
}

function collectApiKeyInputs(provider) {
  const inputs = document.querySelectorAll('.api-key-input-field');
  const keys = [];

  inputs.forEach(input => {
    const value = input.value.trim();
    if (value) {
      keys.push(value);
    }
  });

  return keys;
}

function addApiKeyInput(provider) {
  const container = document.getElementById('api-key-list');
  const currentInputs = container.querySelectorAll('.api-key-item');
  const newIndex = currentInputs.length;

  const newInputHtml = generateApiKeyInput(newIndex, '', provider, 'untested');
  container.insertAdjacentHTML('beforeend', newInputHtml);

  // Set up event listeners for the new input
  setupApiKeyEventListeners(provider);
}

function removeApiKeyInput(index, provider) {
  const container = document.getElementById('api-key-list');
  const items = container.querySelectorAll('.api-key-item');

  if (items.length > 1 && index > 0) { // Don't remove the first item
    items[index].remove();

    // Reindex remaining items
    const remainingItems = container.querySelectorAll('.api-key-item');
    remainingItems.forEach((item, newIndex) => {
      item.setAttribute('data-index', newIndex);
      const input = item.querySelector('.api-key-input-field');
      const showBtn = item.querySelector('.show-hide-btn');
      const removeBtn = item.querySelector('.remove-api-key-btn');

      input.setAttribute('data-index', newIndex);
      showBtn.setAttribute('data-index', newIndex);
      if (removeBtn) {
        removeBtn.setAttribute('data-index', newIndex);
      }
    });
  }
}

function setupApiKeyEventListeners(provider) {
  // Add API key button
  const addBtn = document.querySelector('.add-api-key-btn');
  if (addBtn) {
    addBtn.removeEventListener('click', addBtn._clickHandler); // Remove old listener
    addBtn._clickHandler = () => addApiKeyInput(provider);
    addBtn.addEventListener('click', addBtn._clickHandler);
  }

  // Remove buttons
  document.querySelectorAll('.remove-api-key-btn').forEach(btn => {
    btn.removeEventListener('click', btn._clickHandler);
    btn._clickHandler = () => {
      const index = parseInt(btn.getAttribute('data-index'));
      removeApiKeyInput(index, provider);
    };
    btn.addEventListener('click', btn._clickHandler);
  });

  // Show/hide buttons
  document.querySelectorAll('.show-hide-btn').forEach(btn => {
    btn.removeEventListener('click', btn._clickHandler);
    btn._clickHandler = () => {
      const index = parseInt(btn.getAttribute('data-index'));
      const input = document.querySelector(`.api-key-input-field[data-index="${index}"]`);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
      }
    };
    btn.addEventListener('click', btn._clickHandler);
  });
}

// Attach event listeners to settings modal elements
function attachSettingsModalEvents() {
  // Populate embedding model dropdown based on embedding provider
  function populateEmbeddingModelOptions() {
    const embeddingProvider = dom.settingsModal.querySelector('#embedding-provider').value;
    const embeddingModelSelect = dom.settingsModal.querySelector('#embedding-model');
    embeddingModelSelect.innerHTML = '';
    // Only show compatible models for embeddings
    let models = [];
    if (state.modelConfigurations && state.modelConfigurations[embeddingProvider]) {
      if (embeddingProvider === 'gemini') {
        // Only show Gemini embedding model(s)
        models = state.modelConfigurations[embeddingProvider].filter(m =>
          /gemini-embedding/i.test(m.id)
        );
        // Fallback if not present
        if (models.length === 0) {
          models = [{ id: 'gemini-embedding-001', name: 'Gemini Embedding (Default)' }];
        }
      } else if (embeddingProvider === 'nvidia') {
        // Only allow NVIDIA's bge-m3
        models = state.modelConfigurations[embeddingProvider].filter(m =>
          /bge-m3|baai\/bge-m3/i.test(m.id)
        );
        if (!models.some(m => m.id === 'baai/bge-m3')) {
          models.unshift({ id: 'baai/bge-m3', name: 'bge-m3 (NVIDIA, default)' });
        }
        if (models.length === 0) {
          models = [{ id: 'baai/bge-m3', name: 'bge-m3 (NVIDIA, default)' }];
        }
      } else if (embeddingProvider === 'mistral') {
        // Only allow Mistral embedding models (if any, e.g., mistral-embed)
        models = state.modelConfigurations[embeddingProvider].filter(m =>
          /embed|mistral-embed/i.test(m.id)
        );
        if (models.length === 0) {
          models = [{ id: 'mistral-embed', name: 'Mistral Embed (Default)' }];
        }
      } else if (embeddingProvider === 'cohere') {
        // Only allow Cohere embedding models
        // If modelConfigurations has Cohere embedding models, filter for embed-v*; otherwise, fallback to embed-v4.0
        models = (state.modelConfigurations[embeddingProvider] || []).filter(m =>
          /embed-v/i.test(m.id)
        );
        if (!models.some(m => m.id === 'embed-v4.0')) {
          models.unshift({ id: 'embed-v4.0', name: 'Cohere Embed v4.0 (Default)' });
        }
        if (models.length === 0) {
          models = [{ id: 'embed-v4.0', name: 'Cohere Embed v4.0 (Default)' }];
        }
      }
    }
    // Fallback if no models
    if (models.length === 0) {
      models = [{ id: 'baai/bge-m3', name: 'bge-m3 (NVIDIA, default)' }];
    }
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      embeddingModelSelect.appendChild(option);
    });
    // Set current value
    const current = state.settings.memory?.embeddingModel || models[0].id;
    if ([...embeddingModelSelect.options].some(o => o.value === current)) {
      embeddingModelSelect.value = current;
    } else {
      embeddingModelSelect.selectedIndex = 0;
    }
  }

  // Populate analysis model dropdown based on analysis provider
  function populateAnalysisModelOptions() {
    const analysisProvider = dom.settingsModal.querySelector('#analysis-provider').value;
    const analysisModelSelect = dom.settingsModal.querySelector('#analysis-model');
    analysisModelSelect.innerHTML = '';
    let models = [];
    if (state.modelConfigurations && state.modelConfigurations[analysisProvider]) {
      models = state.modelConfigurations[analysisProvider];
    }
    // Fallback if no models
    if (models.length === 0) {
      models = [{ id: state.settings.model, name: state.settings.model }];
    }
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      analysisModelSelect.appendChild(option);
    });
    // Set current value
    const current = state.settings.memory?.analysisModel || state.settings.model;
    if ([...analysisModelSelect.options].some(o => o.value === current)) {
      analysisModelSelect.value = current;
    } else {
      analysisModelSelect.selectedIndex = 0;
    }
  }

  // Initial population
  populateEmbeddingModelOptions();
  populateAnalysisModelOptions();

  // Turso toggle + token visibility
  const tursoEnabledEl = dom.settingsModal.querySelector('#turso-enabled');
  const tursoConfigEl = dom.settingsModal.querySelector('#turso-config');
  if (tursoEnabledEl && tursoConfigEl) {
    tursoEnabledEl.addEventListener('change', () => {
      tursoConfigEl.style.display = tursoEnabledEl.checked ? '' : 'none';
    });
  }
  const tursoTokenVisibilityBtn = dom.settingsModal.querySelector('#turso-token-visibility');
  if (tursoTokenVisibilityBtn) {
    tursoTokenVisibilityBtn.addEventListener('click', () => {
      const input = dom.settingsModal.querySelector('#turso-token');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        tursoTokenVisibilityBtn.textContent = 'Hide';
      } else {
        input.type = 'password';
        tursoTokenVisibilityBtn.textContent = 'Show';
      }
    });
  }

  // Change handlers
  dom.settingsModal.querySelector('#embedding-provider').addEventListener('change', populateEmbeddingModelOptions);
  dom.settingsModal.querySelector('#analysis-provider').addEventListener('change', populateAnalysisModelOptions);
  // Close button
  const closeBtn = dom.settingsModal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => dom.settingsModal.classList.remove('visible'));

  // Cancel button
  const cancelBtn = dom.settingsModal.querySelector('#cancel-settings-btn');
  cancelBtn.addEventListener('click', () => dom.settingsModal.classList.remove('visible'));

  // User avatar preview handler
  const userAvatarUrlInput = dom.settingsModal.querySelector('#user-avatar-url');
  const userAvatarPreview = dom.settingsModal.querySelector('#user-avatar-preview');

  if (userAvatarUrlInput && userAvatarPreview) {
    userAvatarUrlInput.addEventListener('input', () => {
      const url = userAvatarUrlInput.value.trim();
      userAvatarPreview.src = url || 'assets/default-avatar.svg';
      userAvatarPreview.onerror = () => {
        userAvatarPreview.src = 'assets/default-avatar.svg';
      };
    });
  }

  // Tab buttons
  const tabBtns = dom.settingsModal.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tabId = btn.dataset.tab;
      const tabContents = dom.settingsModal.querySelectorAll('.tab-content');
      tabContents.forEach(tab => {
        tab.classList.toggle('active', tab.id === `${tabId}-tab`);
      });
    });
  });

  // Provider change event - updated for multiple API keys
  const providerSelect = dom.settingsModal.querySelector('#llm-provider');
  providerSelect.addEventListener('change', () => {
    const selectedProvider = providerSelect.value;
    const apiKeyList = dom.settingsModal.querySelector('#api-key-list');
    const apiKeyLabel = dom.settingsModal.querySelector('#api-keys-label');

    // Update the label
    if (apiKeyLabel) {
      apiKeyLabel.textContent = `API Keys for ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}`;
    }

    // Update the API key list for the new provider
    apiKeyList.innerHTML = populateApiKeyList(selectedProvider);

    // Set up event listeners for the new API key inputs
    setupApiKeyEventListeners(selectedProvider);

    // Update the model selection based on the new provider
    populateModelOptions(selectedProvider);
  });

  // Call populateModelOptions after the modal is created with current provider
  populateModelOptions();

  // Set up initial API key event listeners
  setupApiKeyEventListeners(providerSelect.value);

  // Range input value display
  const rangeInputs = dom.settingsModal.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(input => {
    const valueDisplay = input.nextElementSibling;
    if (valueDisplay) {
      input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
      });
    }
  });
  // Theme selection dropdown
  const themeSelect = dom.settingsModal.querySelector('#theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const selectedTheme = themeSelect.value;
      applyTheme(selectedTheme);
    });
  }

  // Bubble style selection
  const bubbleBtns = dom.settingsModal.querySelectorAll('.bubble-btn');
  bubbleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      bubbleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Save button
  const saveBtn = dom.settingsModal.querySelector('#save-settings-btn');
  saveBtn.addEventListener('click', saveSettingsFromForm);
  // Prevent native select overflow on small screens by using an overlay picker
  enableMobileSelectOverlay(dom.settingsModal);
}

// Save settings from form
async function saveSettingsFromForm() {
  try {
    // Get form values with null checks
    const providerEl = document.getElementById('llm-provider');
    const modelEl = document.getElementById('model-selection');
    const temperatureEl = document.getElementById('temperature');
    const topPEl = document.getElementById('top-p');
    const maxTokensEl = document.getElementById('max-tokens');
    const maxContextTokensEl = document.getElementById('max-context-tokens');
    const userNameEl = document.getElementById('user-name');
    const userAvatarUrlEl = document.getElementById('user-avatar-url');
    const userPersonaEl = document.getElementById('user-persona');

    if (!providerEl || !modelEl) {
      showErrorMessage('Settings form elements are missing. Please refresh the page.');
      return;
    }

    const provider = providerEl.value;
    const model = modelEl.value;
    const currentProviderApiKeys = collectApiKeyInputs(provider); // Collect multiple API keys for current provider
    const temperature = temperatureEl ? parseFloat(temperatureEl.value) : 0.7;
    const topP = topPEl ? parseFloat(topPEl.value) : 0.9;
    const maxTokens = maxTokensEl ? parseInt(maxTokensEl.value) : 2048;
    const maxContextTokens = maxContextTokensEl ? parseInt(maxContextTokensEl.value) : 6000;
    const userName = userNameEl ? userNameEl.value.trim() : 'User';
    const userAvatarUrl = userAvatarUrlEl ? userAvatarUrlEl.value.trim() : '';
    const userPersona = userPersonaEl ? userPersonaEl.value.trim() : '';

    // Memory settings with null checks
    const journalFrequencyEl = document.getElementById('journal-frequency');
    const memoryCountEl = document.getElementById('memory-count');
    const historyMessageCountEl = document.getElementById('history-message-count');
    const recencyWeightEl = document.getElementById('recency-weight');
    const emotionalWeightEl = document.getElementById('emotional-weight');
    const decisionWeightEl = document.getElementById('decision-weight');
    const journalFrequency = journalFrequencyEl ? parseInt(journalFrequencyEl.value) : 10;
    const memoryCount = memoryCountEl ? parseInt(memoryCountEl.value) : 5;
    const historyMessageCount = historyMessageCountEl ? parseInt(historyMessageCountEl.value) : 300;
    const recencyWeight = recencyWeightEl ? parseInt(recencyWeightEl.value) : 1;
    const emotionalWeight = emotionalWeightEl ? parseInt(emotionalWeightEl.value) : 10;
    const decisionWeight = decisionWeightEl ? parseInt(decisionWeightEl.value) : 8;

    // Reranking settings with null checks
    const enableRerankingEl = document.getElementById('enable-reranking');
    const rerankingProviderEl = document.getElementById('reranking-provider');
    const jinaApiKeyEl = document.getElementById('jina-api-key');

    const enableReranking = enableRerankingEl ? enableRerankingEl.checked : false;
    const rerankingProvider = rerankingProviderEl ? rerankingProviderEl.value : 'cohere';
    const jinaApiKey = jinaApiKeyEl ? jinaApiKeyEl.value.trim() : '';

    // New memory creation setting
    const enableMemoryCreationEl = document.getElementById('enable-memory-creation');
    const enableMemoryCreation = enableMemoryCreationEl ? enableMemoryCreationEl.checked : true;
  const enableMemoryRetrievalEl = document.getElementById('enable-memory-retrieval');
  const enableMemoryRetrieval = enableMemoryRetrievalEl ? enableMemoryRetrievalEl.checked : true;

    // Streaming setting
    const streamEl = document.getElementById('enable-streaming');
    const stream = streamEl ? streamEl.checked : false;

    // Embedding/analysis settings with null checks
    const embeddingProviderEl = document.getElementById('embedding-provider');
    const embeddingModelEl = document.getElementById('embedding-model');
    const queryEmbeddingMethodEl = document.getElementById('query-embedding-method');
    const analysisProviderEl = document.getElementById('analysis-provider');
    const analysisModelEl = document.getElementById('analysis-model');

    const embeddingProvider = embeddingProviderEl ? embeddingProviderEl.value : 'nvidia';
    const embeddingModel = embeddingModelEl ? embeddingModelEl.value.trim() : 'baai/bge-m3';
  // embeddingOutputDim removed – model decides dimension
    const queryEmbeddingMethod = queryEmbeddingMethodEl ? queryEmbeddingMethodEl.value : 'llm-summary';
    const analysisProvider = analysisProviderEl ? analysisProviderEl.value : 'gemini';
    const analysisModel = analysisModelEl ? analysisModelEl.value.trim() : 'gemini-2.0-flash';// Get selected theme from dropdown
    const themeSelect = document.getElementById('theme-select');
    const theme = themeSelect ? themeSelect.value : 'dark';

    // Get selected bubble style - with null check
    const selectedBubbleBtn = document.querySelector('.bubble-btn.active');
    const bubbleStyle = selectedBubbleBtn ? selectedBubbleBtn.dataset.style : 'rounded';

    // Turso remote sync settings
    const tursoEnabledEl = document.getElementById('turso-enabled');
    const tursoUrlEl = document.getElementById('turso-url');
    const tursoTokenEl = document.getElementById('turso-token');
    const tursoSyncIntervalEl = document.getElementById('turso-sync-interval');
    const turso = {
      enabled: !!(tursoEnabledEl && tursoEnabledEl.checked),
      url: tursoUrlEl ? tursoUrlEl.value.trim() : '',
      authToken: tursoTokenEl ? tursoTokenEl.value.trim() : '',
      syncInterval: Math.max(5000, parseInt(tursoSyncIntervalEl ? tursoSyncIntervalEl.value : '30000') || 30000)
    };

    // Create settings object, preserving existing API keys
    const allApiKeys = state.settings.apiKeys || {};
    // Update the current provider's API keys (now as array)
    allApiKeys[provider] = currentProviderApiKeys;

    // Update Jina API key if provided (keep as single key for backward compatibility)
    if (jinaApiKey) {
      allApiKeys.jina = jinaApiKey;
    }

    const settings = {
      ...state.settings,
      provider,
      model,
      apiKeys: allApiKeys, // Store all API keys
      temperature,
      topP,
      maxTokens,
      maxContextTokens,
      user: {
        name: userName,
        avatarUrl: userAvatarUrl,
        persona: userPersona
      },
      theme,
      bubbleStyle, memory: {
        ...state.settings.memory,
        enableMemoryCreation,
  enableMemoryRetrieval,
        journalFrequency,
        retrievalCount: memoryCount,
        historyMessageCount,
        embeddingProvider,
    embeddingModel,
        queryEmbeddingMethod,
        analysisProvider,
        analysisModel,
        enableReranking,
        rerankingProvider,
        weights: {
          recency: recencyWeight,
          emotionalSignificance: emotionalWeight,
          decisionRelevance: decisionWeight
        }
      },
      stream,
      turso
    };
    // Save settings as before
    await saveSettings(settings);
    dom.settingsModal.classList.remove('visible');
    showSuccessMessage('Settings saved successfully.');
  } catch (error) {
    console.error('Error saving settings:', error);
    showErrorMessage('Failed to save settings.');
  }
}

// Apply selected theme (data-theme) + legacy class for back-compat
function applyTheme(theme) {
  const normalized = ThemeManager.normalize(theme);
  const info = ThemeManager.getThemeInfo(normalized);

  // Remove legacy theme-* classes then add current one for backwards CSS
  document.body.classList.forEach(cls => { if (cls.startsWith('theme-')) document.body.classList.remove(cls); });
  document.body.classList.add(`theme-${normalized}`);

  // Apply data-theme attribute (fallback to normalized id if metadata missing)
  document.documentElement.setAttribute('data-theme', info?.dataTheme || normalized);

  if (theme !== normalized) {
    console.warn(`Theme '${theme}' was normalized to '${normalized}'.`);
  }
}

// Apply selected bubble style
function applyBubbleStyle(style) {
  // Remove existing bubble style classes before adding the new one
  document.body.classList.remove('bubble-rounded', 'bubble-angular');
  document.body.classList.add(`bubble-${style || 'rounded'}`);
}

// Set up event listeners
function setupEventListeners() {
  // Create character button
  dom.createCharacterBtn.addEventListener('click', () => showCharacterModal());

  // Edit character button
  dom.editCharacterBtn.addEventListener('click', () => {
    if (state.activeCharacter) {
      showCharacterModal(state.activeCharacter);
    }
  });

  // Clear chat button
  dom.clearChatBtn.addEventListener('click', async () => {
    if (!state.activeCharacter) return;
    const confirmed = await showConfirm({
      title: 'Clear Chat History',
      message: `Clear all messages for '${state.activeCharacter.name}'? The first system/intro message may be preserved depending on backend logic.`,
      confirmText: 'Clear Chat'
    });
    if (confirmed) clearChatHistory();
  });

  // Scene break button
  dom.sceneBreakBtn.addEventListener('click', insertSceneBreak);

  // Settings button
  dom.settingsBtn.addEventListener('click', showSettingsModal);

  // Send message button
  dom.sendMessageBtn.addEventListener('click', sendMessage);

  // Send message on Enter (but not with Shift+Enter)
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  dom.messageInput.addEventListener('input', () => {
    dom.messageInput.style.height = 'auto'; // Reset height
    dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`; // Set to scroll height
  });

  // Add listener for welcome screen create button if it exists
  const welcomeCreateBtn = document.getElementById('welcome-create-btn');
  if (welcomeCreateBtn) {
    welcomeCreateBtn.addEventListener('click', () => showCharacterModal());
  }

  // Chat tools dropdown toggle
  if (dom.chatToolsToggle) {
    dom.chatToolsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.chatToolsMenu.classList.toggle('visible');
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dom.chatToolsMenu && dom.chatToolsMenu.classList.contains('visible') && !dom.chatToolsMenu.contains(e.target) && e.target !== dom.chatToolsToggle) {
      dom.chatToolsMenu.classList.remove('visible');
    }
  });

  // Emoji button
  dom.emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click handler
    toggleEmojiPicker();
  });

  // Regenerate button
  dom.regenBtn.addEventListener('click', regenerateResponse);
  // Memory view button
  dom.memoryViewBtn.addEventListener('click', loadAndDisplayMemories);

  // Recycle memory button
  dom.recycleMemoryBtn.addEventListener('click', recycleMemories);

  // Close memory panel when clicking outside
  document.addEventListener('click', (e) => {
    if (dom.memoryPanel.classList.contains('visible') &&
      !dom.memoryPanel.contains(e.target) &&
      e.target !== dom.memoryViewBtn) {
      dom.memoryPanel.classList.remove('visible');
    }
  });

  // Mobile back button from chat to character list
  const mobileBackBtn = document.getElementById('mobile-back-btn');
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
      document.body.classList.remove('mobile-chat-active');
      state.activeCharacter = null; // Allow re-selection
      renderCharacterList();
    });
  }

  // Desktop sidebar toggle (always bind; CSS/markup controls visibility)
  if (dom.desktopSidebarToggle) {
    dom.desktopSidebarToggle.addEventListener('click', () => {
      const container = document.querySelector('.app-container');
      container.classList.toggle('sidebar-collapsed');
      const isCollapsed = container.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed);
      // Reflect state for assistive tech
      dom.desktopSidebarToggle.setAttribute('aria-pressed', isCollapsed ? 'true' : 'false');
    });
  }
}

// Show error message (now using toast system)
function showErrorMessage(message) {
  displayToast(message, 'error');
}

// Show success message (now using toast system)
function showSuccessMessage(message) {
  displayToast(message, 'success');
}

// Insert a scene break into the chat
function insertSceneBreak() {
  if (!state.activeCharacter) return;

  state.chatHistory.push({ role: 'system', type: 'scene-break', timestamp: Date.now() });
  renderChatHistory();
  saveChatHistory();
}

// Display notification message (deprecated, use displayToast instead)
function displayNotification(message, type = 'info') { // type can be 'info', 'success', 'error'
  // For backward compatibility, redirect to toast system
  displayToast(message, type);
}

// Initialize emoji picker
function initEmojiPicker() {
  // Create container for emoji picker if it doesn't exist
  let emojiPickerContainer = document.querySelector('.emoji-picker-container');
  if (!emojiPickerContainer) {
    emojiPickerContainer = document.createElement('div');
    emojiPickerContainer.className = 'emoji-picker-container';
    emojiPickerContainer.innerHTML = '<emoji-picker></emoji-picker>';
    document.body.appendChild(emojiPickerContainer);

    // Add event listener for emoji selection
    const picker = emojiPickerContainer.querySelector('emoji-picker');
    picker.addEventListener('emoji-click', event => {
      const emoji = event.detail.unicode;
      insertEmojiAtCursor(emoji);
      toggleEmojiPicker(); // Hide picker after selection
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
      if (emojiPickerContainer.classList.contains('visible') &&
        e.target.id !== 'emoji-btn' &&
        !emojiPickerContainer.contains(e.target)) {
        emojiPickerContainer.classList.remove('visible');
      }
    });
  }
}

// Toggle emoji picker visibility
function toggleEmojiPicker() {
  const emojiPickerContainer = document.querySelector('.emoji-picker-container');
  if (emojiPickerContainer) {
    emojiPickerContainer.classList.toggle('visible');
  }
}

// Helper function to insert emoji at cursor position
function insertEmojiAtCursor(emoji) {
  const textarea = dom.messageInput;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const text = textarea.value;

  // Insert emoji at cursor position
  textarea.value = text.substring(0, startPos) + emoji + text.substring(endPos);

  // Move cursor to position after inserted emoji
  textarea.selectionStart = textarea.selectionEnd = startPos + emoji.length;
  textarea.focus(); // Maintain focus on textarea
}

// Regenerate the last AI response
async function regenerateResponse() {
  // Cannot regenerate if there's no character selected or if already generating
  if (!state.activeCharacter || state.isGenerating) {
    return;
  }

  // Need at least one message to regenerate
  if (!state.chatHistory || state.chatHistory.length < 1) {
    showErrorMessage('No messages to regenerate.');
    return;
  }

  try {
    // Find the last assistant message
    let lastAssistantIndex = -1;
    for (let i = state.chatHistory.length - 1; i >= 0; i--) {
      if (state.chatHistory[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      showErrorMessage('No assistant response to regenerate.');
      return;
    }

    // Find the last user message before this assistant message
    let lastUserMessage = null;
    let lastUserIndex = -1;
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (state.chatHistory[i].role === 'user') {
        lastUserMessage = state.chatHistory[i].content;
        lastUserIndex = i;
        break;
      }
    }

    if (!lastUserMessage) {
      showErrorMessage('No user message found to regenerate from.');
      return;
    }

    // Extract and remove the last user + assistant messages for a clean regeneration
    const userMessageContent = lastUserMessage;
    state.chatHistory.splice(lastUserIndex, lastAssistantIndex - lastUserIndex + 1);
    renderChatHistory();
    // Persist updated history
    await saveChatHistory();

    // Show generating indicator
    state.isGenerating = true;
    addGeneratingIndicator();

    // Send request to regenerate with timeout and retry logic
    const response = await makeRequest(API.CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: state.activeCharacter.name,
        message: userMessageContent,
        settings: state.settings
      })
    }, 300000, 1); // 5 minute timeout, 1 retry only (total max 10 minutes)

    const data = await response.json();

    // Validate response
    if (!data.response || typeof data.response !== 'string') {
      throw new Error('Invalid response from server');
    }

    // Remove generating indicator
    removeGeneratingIndicator();
    // Re-add the user message and new assistant response
    state.chatHistory.push({ role: 'user', content: userMessageContent });
    state.chatHistory.push({ role: 'assistant', content: data.response });
    renderChatHistory();
    // Save regenerated exchange
    await saveChatHistory();
  } catch (error) {
    console.error('Error regenerating response:', error);
    removeGeneratingIndicator();

    // Check if it was cancelled by user
    if (error.name === 'AbortError' && !state.currentAbortController) {
      displayToast('Response regeneration cancelled', 'info', 3000);
      return; // Don't show error message for user cancellation
    }

    // Show appropriate error message
    let errorMessage = 'Failed to regenerate response.';
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out after 5 minutes. Please try again.';
    } else if (!connectionStatus.isConnected) {
      errorMessage = 'No connection to server. Please check your internet connection.';
    }

    displayToast(errorMessage, 'error', 5000);
  } finally {
    state.isGenerating = false;
    state.currentAbortController = null;
  }
}

// Recycle memories for the active character
async function recycleMemories() {
  if (!state.activeCharacter || state.isGenerating) {
    return;
  }

  // Check if there's enough chat history
  if (!state.chatHistory || state.chatHistory.length < 3) {
    showErrorMessage('Not enough chat history to recycle memories. Need at least 3 messages.');
    return;
  }

  // Show confirmation dialog
  const confirmed = confirm(
    `This will clear all existing memories for ${state.activeCharacter.name} and recreate them from your chat history. This process may take several minutes. Continue?`
  );

  if (!confirmed) {
    return;
  }

  try {
    // Show progress toast
    displayNotification('🔄 Starting memory recycling process...', 'info');

    // Disable the button during processing
    dom.recycleMemoryBtn.disabled = true;
    dom.recycleMemoryBtn.innerHTML = '<i class="ri-loader-line rotating"></i>';

    // Start polling for progress
    const progressInterval = setInterval(async () => {
      try {
        const progressResponse = await fetch(`${API.MEMORIES}/${state.activeCharacter.name}/progress`);
        const progress = await progressResponse.json();

        if (progress && progress.step !== 'idle') {
          let message = '';
          switch (progress.step) {
            case 'clearing':
              message = '🗑️ Clearing existing memories...';
              break;
            case 'cleared':
              message = '✅ Existing memories cleared';
              break;
            case 'processing':
              message = `🧠 ${progress.message || 'Processing memories'} (${progress.current}/${progress.total})`;
              break;
            case 'waiting':
              message = `⏱️ ${progress.message || 'Waiting between memory creation'}`;
              break;
            case 'finalizing':
              message = '🔧 Finalizing memory storage...';
              break;
            case 'completed':
              message = '✅ Memory recycling completed!';
              clearInterval(progressInterval);
              break;
          }

          if (message) {
            displayNotification(message, 'info');
          }
        }
      } catch (progressError) {
        console.warn('Error fetching progress:', progressError);
      }
    }, 2000); // Poll every 2 seconds

    const response = await fetch(`${API.MEMORIES}/${state.activeCharacter.name}/recycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    // Clear the progress polling
    clearInterval(progressInterval);

    const data = await response.json();

    if (data.success) {
      displayNotification(
        `✅ Memory recycling completed! Created ${data.memoriesCreated} new memories.`,
        'success'
      );

      // Reload memories if memory panel is open
      if (dom.memoryPanel.classList.contains('visible')) {
        await loadAndDisplayMemories();
      }
    } else {
      showErrorMessage(data.error || 'Failed to recycle memories.');
    }

  } catch (error) {
    console.error('Error recycling memories:', error);
    showErrorMessage('Failed to recycle memories. Please try again.');
  } finally {
    // Re-enable the button
    dom.recycleMemoryBtn.disabled = false;
    dom.recycleMemoryBtn.innerHTML = '<i class="ri-recycle-line"></i>';
  }
}

// Load and display memories in the side panel
async function loadAndDisplayMemories() {
  if (!state.activeCharacter) {
    showErrorMessage('No character selected.');
    return;
  }

  const memoryPanel = dom.memoryPanel;
  const memoryTimeline = document.getElementById('memory-timeline');
  memoryPanel.classList.add('visible');
  memoryTimeline.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading memories...</p></div>';


  // Helper to fetch and render memories with optional filter
  async function fetchAndRenderMemories(filter = 'all') {
    memoryTimeline.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading memories...</p></div>';
    let url = `/api/memories/${encodeURIComponent(state.activeCharacter.name)}`;
    if (filter !== 'all') url += `?filter=${encodeURIComponent(filter)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch memories: ${response.status}`);
    }
    const memories = await response.json();
    if (!Array.isArray(memories) || memories.length === 0) {
      memoryTimeline.innerHTML = '<div class="empty-list">No memories found yet. Continue chatting to create memories!</div>';
      return;
    }
    memoryTimeline.innerHTML = '';
    memories.forEach(memory => {
      const memoryCard = document.createElement('div');
      memoryCard.className = 'memory-card';
      const date = new Date(memory.timestamp);
      const formattedDate = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      let importanceClass = 'importance-medium';
      if (memory.importance > 0.7) importanceClass = 'importance-high';
      else if (memory.importance < 0.4) importanceClass = 'importance-low';
      memoryCard.innerHTML = `
        <div class="memory-timestamp">${formattedDate}</div>
        <div class="memory-summary">${memory.summary}</div>
        ${memory.topics ? `<div class="memory-details">Topics: ${memory.topics.join(', ')}</div>` : ''}
        <span class="memory-importance ${importanceClass}">Importance: ${Math.round(memory.importance * 100)}%</span>
      `;
      memoryTimeline.appendChild(memoryCard);
    });
  }

  try {
    await fetchAndRenderMemories('all');

    const filterButtons = memoryPanel.querySelectorAll('.memory-filters button');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.textContent.toLowerCase().includes('important')
          ? 'important'
          : btn.textContent.toLowerCase().includes('recent')
            ? 'recent'
            : 'all';
        await fetchAndRenderMemories(filter);
      });
    });

    const closeBtn = memoryPanel.querySelector('.close-panel-btn');
    if (closeBtn) {
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      const newCloseBtn = memoryPanel.querySelector('.close-panel-btn');
      newCloseBtn.addEventListener('click', () => {
        memoryPanel.classList.remove('visible');
      });
    } else {
      console.error('Could not find memory panel close button.');
    }
  } catch (error) {
    console.error('Error loading memories:', error);
    memoryTimeline.innerHTML = '<div class="error-message">Failed to load memories. Please try again.</div>';
  }
}

// Helper function to generate mock memories from chat history
function generateMemoriesFromChat(chatHistory) {
  const memories = [];

  if (!chatHistory || chatHistory.length < 3) {
    return memories;
  }

  // Group messages into conversations (chunks of 3-5 messages)
  for (let i = 0; i < chatHistory.length; i += 4) {
    // Get a chunk of messages
    const chunk = chatHistory.slice(i, i + 4);
    if (chunk.length < 2) continue; // Skip if too small

    // Create a summary from the messages
    const summary = summarizeChunk(chunk);

    // Generate mock topics based on content
    const topics = extractTopics(chunk);

    // Generate a mock importance score
    const importance = 0.3 + Math.random() * 0.7;

    memories.push({
      id: `memory-${i}`,
      timestamp: Date.now() - ((chatHistory.length - i) * 60000), // Simulate older timestamps
      summary,
      importance,
      topics
    });
  }

  return memories;
}

// Helper to summarize a chunk of messages
function summarizeChunk(messages) {
  if (!messages || messages.length === 0) return "Empty conversation";

  // Find an assistant message to use as summary
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const text = msg.content;
      // Return first sentence or limited characters
      if (text.includes('.')) {
        return text.split('.')[0] + '.';
      } else {
        return text.substring(0, 80) + (text.length > 80 ? '...' : '');
      }
    }
  }

  // Fallback if no assistant message
  return "Conversation between you and " + state.activeCharacter.name;
}

// Helper to extract topics from messages
function extractTopics(messages) {
  const topics = [];
  const topicMap = {
    personal: ['i', 'me', 'my', 'mine', 'feel', 'think', 'believe'],
    question: ['?', 'what', 'how', 'when', 'why', 'where', 'who'],
    emotion: ['happy', 'sad', 'angry', 'love', 'hate', 'feel', 'emotion'],
    greeting: ['hello', 'hi', 'hey', 'greetings', 'morning', 'afternoon'],
    farewell: ['goodbye', 'bye', 'see you', 'later', 'night']
  };

  // Concatenate all message content
  const content = messages.map(m => m.content.toLowerCase()).join(' ');

  // Check for each topic
  Object.entries(topicMap).forEach(([topic, keywords]) => {
    if (keywords.some(word => content.includes(word))) {
      topics.push(topic);
    }
  });

  // Return up to 3 topics, or default if none found
  return topics.length > 0 ? topics.slice(0, 3) : ['conversation'];
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Removed obsolete mobile UI functions (toggleMobileMenu, handleMobileTabChange)

// Function to safely expose state to other scripts
function getAppState() {
  return {
    characters: state.characters || [],
    activeCharacter: state.activeCharacter,
    chatHistory: state.chatHistory || []
  };
}

// Expose the function to window for access from other scripts
window.getAppState = getAppState;
// Global namespace to avoid polluting window directly with many functions
window.ChunRP = {
  getAppState,
  selectCharacter,
  showCharacterModal,
  showSettingsModal
};

// --- STREAMING SUPPORT PATCH BEGIN ---
// We patch showSettingsModal by monkey-patching after its definition to inject the checkbox if not present.
(function(){
  const originalShowSettingsModal = showSettingsModal;
  showSettingsModal = function patchedShowSettingsModal(){
    originalShowSettingsModal();
    try {
      const paramsContainer = document.querySelector('.settings-modal #models-tab .form-group label[for="max-context-tokens"]').closest('.form-group').parentElement; // param grouping div
      if (paramsContainer && !document.getElementById('enable-streaming')) {
        const streamingDiv = document.createElement('div');
        streamingDiv.className = 'param-group';
        streamingDiv.innerHTML = `
          <label style="display:flex; gap:6px; align-items:center;">
            <input type="checkbox" id="enable-streaming" ${state.settings.stream ? 'checked' : ''} /> Enable Streaming Responses
          </label>
          <small>Progressively render model output (may increase token billing)</small>
        `;
        paramsContainer.appendChild(streamingDiv);
      }
    } catch(e) { console.warn('Streaming toggle injection failed:', e); }
  };
})();

// Patch saveSettingsFromForm to include stream flag if not already patched
(function(){
  const originalSave = saveSettingsFromForm;
  saveSettingsFromForm = async function patchedSaveSettingsFromForm(){
    const checkbox = document.getElementById('enable-streaming');
    const previousStream = state.settings.stream;
    await originalSave();
    if (checkbox) {
      state.settings.stream = checkbox.checked;
    } else if (typeof previousStream !== 'undefined') {
      state.settings.stream = previousStream; // retain
    }
  };
})();

// Helper to update only the last assistant message DOM during streaming
function updateLastAssistantMessageDOMStreaming(){
  const container = dom.chatMessages;
  const assistantMessages = container.querySelectorAll('.message.assistant');
  const target = assistantMessages[assistantMessages.length - 1];
  if (!target) return;
  const bubble = target.querySelector('.message-bubble');
  if (!bubble) return;
  const message = state.chatHistory[state.chatHistory.length - 1];
  if (!message) return;
  if (message.failed) {
    bubble.innerHTML = `<div class="message-error-content"><i class="ri-error-warning-line"></i><span>${message.content}</span></div>`;
    return;
  }
  const full = typeof message.content === 'string' ? message.content : String(message.content || '');
  const thinkRegex = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let thoughts = [];
  let visible;
  if (message.pending) {
    // While streaming, keep reasoning inline instead of separating.
    // Replace <think> blocks with inline span styling.
    function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    visible = full.replace(thinkRegex, (_, inner) => `<span class=\"inline-think\">${esc(inner.trim())}</span>`);
  } else {
    // After completion: extract and remove from visible.
    let m;
    while ((m = thinkRegex.exec(full)) !== null) {
      const seg = m[1].trim();
      if (seg) thoughts.push(seg);
    }
    visible = full.replace(thinkRegex, '').trim();
  }
  try { marked.setOptions({ breaks:true, gfm:true, sanitize:false }); } catch {}
  // Sanitize content before rendering with marked
  const sanitizedContent = DOMPurify.sanitize(marked.parse(visible || ''));
  bubble.innerHTML = sanitizedContent;
  bubble.dataset.originalContent = full;
  // Only create thought container after stream completion (pending removed)
  if (!message.pending) {
    let thoughtContainer = target.querySelector('.message-thought-container');
    if (thoughts.length > 0) {
      if (!thoughtContainer) {
        thoughtContainer = document.createElement('div');
        thoughtContainer.className = 'message-thought-container';
        const btn = document.createElement('button');
        btn.className = 'thought-btn';
        btn.innerHTML = '<i class=\"ri-psychotherapy-line\"></i>';
        btn.title = 'View character thoughts';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'thought-content';
        thoughtContainer.appendChild(btn);
        thoughtContainer.appendChild(contentDiv);
        target.appendChild(thoughtContainer);
      }
      const contentDiv = thoughtContainer.querySelector('.thought-content');
      if (contentDiv) contentDiv.innerHTML = thoughts.join('<hr>');
    }
  }
  if (message.pending && !bubble.querySelector('.message-pending')) {
    const pendingDiv = document.createElement('div');
    pendingDiv.className = 'message-pending';
    pendingDiv.innerHTML = '<span style="color:gray"><i class="ri-time-line"></i> Streaming...</span>';
    bubble.appendChild(pendingDiv);
  }
  scrollToBottom();
}

async function streamAssistantResponse(userMessage, messageId){
  try {
    // Insert placeholder assistant message
    state.chatHistory.push({ role: 'assistant', content: '', pending: true });
    renderChatHistory();
    scrollToBottom();
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: state.activeCharacter.name, message: userMessage, messageId, settings: state.settings })
    });
    if (!response.ok || !response.body) {
      throw new Error('Streaming request failed');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let evt; try { evt = JSON.parse(line); } catch { continue; }
        const last = state.chatHistory[state.chatHistory.length - 1];
        if (!last || last.role !== 'assistant') continue;
        if (evt.type === 'token') {
          last.content += evt.token;
          updateLastAssistantMessageDOMStreaming();
        } else if (evt.type === 'done') {
          last.content = evt.response || last.content;
          delete last.pending;
          removeGeneratingIndicator();
          updateLastAssistantMessageDOMStreaming();
          await saveChatHistory();
        } else if (evt.type === 'error') {
          last.failed = true;
          last.content = evt.error;
          delete last.pending;
          removeGeneratingIndicator();
          updateLastAssistantMessageDOMStreaming();
        }
      }
    }
    // Safety cleanup if still pending
    const last = state.chatHistory[state.chatHistory.length - 1];
    if (last && last.pending) {
      delete last.pending;
      removeGeneratingIndicator();
      updateLastAssistantMessageDOMStreaming();
    }
  } catch (e) {
    console.error('Streaming error:', e);
    removeGeneratingIndicator();
    state.chatHistory.push({ role: 'assistant', content: 'Streaming failed: ' + (e.message || e), failed: true });
    renderChatHistory();
  }
}

// Patch sendMessage to branch on streaming flag
(function(){
  const originalSendMessage = sendMessage;
  sendMessage = async function patchedSendMessage(){
    // We replicate early extraction logic from original function by peeking into its code is complex; rely on existing implementation
    // But we intercept after user message added: detect generating indicator present and state.isGenerating true.
    // So we let original function run if streaming disabled.
    if (!state.settings?.stream) return originalSendMessage();
    // Custom streamlined version for streaming to avoid duplicate request
    const message = dom.messageInput.value.trim();
    if (!message || !state.activeCharacter || state.isGenerating) return;
    const messageId = ++state.lastMessageId;
    state.chatHistory.push({ role: 'user', content: message, id: messageId });
    renderChatHistory();
    dom.messageInput.value='';
    state.isGenerating = true;
    addGeneratingIndicator();
    try {
      await streamAssistantResponse(message, messageId);
    } finally {
      state.isGenerating = false;
      state.currentAbortController = null;
    }
  };
})();
// --- STREAMING SUPPORT PATCH END ---

// --- Mobile Select Overlay (narrow viewports only) ---
// Global singleton to prevent duplicate overlays and listeners
if (!window.__SelectOverlay__) {
  window.__SelectOverlay__ = { 
    overlayEl: null, 
    escHandler: null, 
    inited: false,
    closeOverlay: function() {
      if (this.overlayEl) this.overlayEl.classList.remove('visible');
    }
  };
}

function enableMobileSelectOverlay(scope) {
  try {
    if (!scope) return;
    const activates = () => window.innerWidth <= 768; // Only intercept on narrow screens
    const selects = scope.querySelectorAll('select');
    if (!selects.length) return;
    
    const S = window.__SelectOverlay__;
    
    function ensureOverlay() {
      if (!S.inited) {
        S.overlayEl = document.createElement('div');
        S.overlayEl.className = 'select-overlay';
        S.overlayEl.innerHTML = `
          <div class="select-sheet" role="dialog" aria-modal="true" aria-labelledby="select-overlay-title">
            <header>
              <h3 id="select-overlay-title">Choose an option</h3>
              <button type="button" class="btn icon-btn" data-close aria-label="Close"><i class="ri-close-line"></i></button>
            </header>
            <div class="select-options" role="listbox"></div>
          </div>`;
        document.body.appendChild(S.overlayEl);
        
        S.overlayEl.addEventListener('click', (e) => {
          if (e.target === S.overlayEl || e.target?.dataset?.close !== undefined) S.closeOverlay();
        });
        
        S.escHandler = (e) => { if (e.key === 'Escape') S.closeOverlay(); };
        document.addEventListener('keydown', S.escHandler);
        S.inited = true;
      }
      return S.overlayEl;
    }
    
    function openOverlayForSelect(sel) {
      const ov = ensureOverlay();
      const list = ov.querySelector('.select-options');
      list.innerHTML = '';
      Array.from(sel.options).forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'select-option';
        btn.setAttribute('role','option');
        if (opt.selected) btn.setAttribute('aria-selected','true');
        btn.textContent = opt.textContent;
        btn.addEventListener('click', () => {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          S.closeOverlay();
          setTimeout(() => sel.focus(), 0);
        });
        list.appendChild(btn);
      });
      ov.classList.add('visible');
    }
    
    selects.forEach(sel => {
      sel.addEventListener('mousedown', (e) => {
        if (!activates()) return;
        e.preventDefault();
        openOverlayForSelect(sel);
      });
      sel.addEventListener('keydown', (e) => {
        if (!activates()) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOverlayForSelect(sel);
        }
      });
    });
  } catch (e) { /* silent safeguard */ }
}
