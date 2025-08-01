# 🎭 ChunRP - Immersive Roleplay Chat

<div align="center">

![ChunRP Logo](src/frontend/assets/splash.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-v28+-blue.svg)](https://electronjs.org/)

**A powerful, local AI roleplay chatbot with advanced memory, reranking, and multiple LLM provider support**

[✨ Features](#-features) • [🚀 Getting Started](#-getting-started) • [📖 Documentation](#-documentation) • [🛠️ Development](#️-development)

</div>

---

## 🌟 What is ChunRP?

ChunRP is an **immersive local roleplay chatbot** that brings your AI characters to life! Unlike simple chatbots, ChunRP creates deep, persistent relationships with characters that remember your conversations, evolve over time, and maintain rich emotional connections through advanced vector memory and intelligent reranking systems.

### ✨ Key Highlights

- 🧠 **Advanced Memory System** - Characters remember everything with vector-based long-term memory and intelligent retrieval
- 🎯 **Memory Reranking** - Powered by Jina, Cohere, and NVIDIA for precision memory recall
- ♻️ **Memory Recycling** - Rebuild character memories from scratch with progress tracking
- 🗄️ **SQLite Database** - Fast, reliable data storage with ACID compliance and proper relationships
- 🔄 **Smart API Key Rotation** - Multiple API keys per provider with automatic rotation and fallback
- 🤖 **9+ AI Providers** - Access a vast selection of free and premium models from providers like Gemini, OpenRouter, Chutes, NVIDIA, and more
- 🏠 **100% Local** - Your conversations stay private on your machine
- 📱 **Mobile Responsive** - Works beautifully on desktop, tablet, and mobile with optimized UI
- 🎨 **10+ Beautiful Themes** - Choose from over ten themes (Dark, Light, Cyberpunk, Ocean, etc.) with customizable bubble styles
- ⚡ **Real-time Experience** - Instant responses with streaming support and robust reasoning model handling

---

## ✨ Features

### 🔄 Smart Multiple API Key System

**🚀 ADVANCED RELIABILITY FEATURES**
- **Multiple Keys per Provider** - Add several API keys for each service to maximize uptime
- **Automatic Key Rotation** - Round-robin system cycles through keys to prevent rate limits
- **Smart Fallback** - If one key fails, instantly switches to the next available key
- **Status Tracking** - Real-time monitoring shows which keys are working, failed, or rate-limited
- **Error Recovery** - Automatically retries failed requests with different keys
- **Load Balancing** - Distributes requests across keys for optimal performance

This system ensures your conversations never get interrupted by rate limits or key failures!

### 🎭 Character Management
- **Rich Character Profiles**: Create detailed characters with personas, appearances, and scenarios. The **persona** field now serves as the complete system prompt for maximum control
- **Avatar Support**: Add custom avatars via URL or use the default avatar with fallback handling
- **Per-Character Settings**: Customize LLM settings individually for each character's unique personality
- **Character Search & Selection**: Fast character lookup in sidebar with mobile-optimized selector overlay
- **SQLite Storage**: Characters stored in a fast, reliable SQLite database with proper relationships

### 🧠 Advanced Memory System

<div align="center">

> **🚀 LATEST FEATURES**
> - **Memory Reranking** with Jina, Cohere, and NVIDIA APIs
> - **Memory Recycling** with real-time progress tracking
> - **Reasoning Model Support** with robust JSON extraction
> - **SQLite Database** for improved performance and reliability
> - **Memory Viewer** with side panel for browsing and managing memories

</div>

- **Vector Memory Storage**: Characters remember conversations using advanced embedding technology with multiple provider support
- **Intelligent Reranking**: Memories are reranked using state-of-the-art reranking models for perfect context retrieval
- **Memory Recycling**: Complete memory regeneration with progress toasts, timeout handling, and error recovery
- **Memory Viewer**: Browse, search, and manage character memories through dedicated side panel
- **Emotional Analysis**: Characters understand and remember emotional context with LLM-powered analysis
- **Smart Retrieval**: Relevant memories automatically surfaced with LLM summaries, HyDE, or averaging methods
- **Robust Processing**: Handles reasoning model thinking blocks and malformed responses gracefully
- **Progress Tracking**: Real-time memory creation progress with detailed status updates
- **Database Integration**: Chat history and memories stored in SQLite with efficient querying and relationships

### 🔄 Memory Reranking System

- **Multiple Providers**: Jina AI, Cohere, and NVIDIA reranking APIs for maximum compatibility
- **Automatic Fallback**: Seamless provider switching when one fails for uninterrupted experience
- **Configurable**: Choose your preferred reranking provider and manage API keys easily
- **Performance Optimized**: Smart query processing for optimal retrieval accuracy and speed

### 🤖 Multi-Provider LLM Support - Extensive Model Selection!

<details>
<summary><strong>🌐 Supported Providers & Models (Click to expand)</strong></summary>

| Provider | Featured Models | Reasoning Models | Multiple Keys |
|----------|-----------------|------------------|---------------|
| **🔥 Gemini** | Gemini 2.5 Pro, 2.5 Flash, **2.5 Flash Thinking** | ✅ Thinking models | ✅ |
| **🔥 Chutes** | DeepSeek R1, ArliAI QwQ 32B, Llama 4 Maverick | ✅ DeepSeek R1 family | ✅ |
| **🔥 OpenRouter** | Horizon Alpha, QWQ 32B, DeepSeek Chat v3 | ✅ Multiple reasoning models | ✅ |
| **NVIDIA** | Llama 3.3 Nemotron, Llama 4 Scout/Maverick | ✅ Qwen, DeepSeek R1 | ✅ |
| **Hugging Face** | Llama 3.3 70B, DeepSeek V3, Dolphin Mixtral | ❌ | ✅ |
| **Mistral** | Mistral Large, Magistral Medium, Open Nemo | ✅ Magistral family | ✅ |
| **Cohere** | Command A, Command R Plus, Command R7B | ❌ | ✅ |
| **Aion Labs** | Aion 1.0, Aion RP Small | ✅ | ✅ |

**🔥 Popular FREE Reasoning Models:**
- **DeepSeek R1 & R1-0528** (Chutes, OpenRouter, NVIDIA)
- **Gemini 2.5 Pro & Flash with Thinking** (Gemini)
- **QWQ 32B** (NVIDIA, OpenRouter, Chutes)
- **ArliAI QwQ 32B** (Chutes, OpenRouter)
- **Llama 4 Scout/Maverick** (NVIDIA, Chutes)

**📋 Complete Model List (as of latest build):**

**Gemini Models:**
- gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
- gemini-2.5-pro-preview-06-05, gemini-2.5-flash-preview-05-20
- gemini-2.0-flash-thinking-exp-01-21, learnlm-2.0-flash-experimental

**Chutes Models:**
- deepseek-ai/DeepSeek-R1, ArliAI/QwQ-32B-ArliAI-RpR-v1
- tngtech/DeepSeek-R1T2-Chimera, chutesai/Llama-4-Maverick-17B-128E-Instruct-FP8
- TheDrummer/Tunguska-39B-v1, Qwen/Qwen3-235B-A22B-Instruct-2507, and more

**OpenRouter Models (Free Tier):**
- openrouter/horizon-alpha, arliai/qwq-32b-arliai-rpr-v1:free
- deepseek/deepseek-chat-v3-0324:free, rekaai/reka-flash-3:free, and more

**NVIDIA Models:**
- nvidia/llama-3.3-nemotron-super-49b-v1, meta/llama-4-scout-17b-16e-instruct
- qwen/qwen3-235b-a22b, deepseek-ai/deepseek-r1, and more

**Hugging Face Models:**
- meta-llama/Llama-3.3-70B-Instruct, deepseek-ai/DeepSeek-V3-0324
- cognitivecomputations/dolphin-2.9.2-mixtral-8x22b, Sao10K/L3-8B-Stheno-v3.2

**Mistral Models:**
- mistral-large-latest, mistral-medium-latest, open-mistral-nemo
- magistral-medium-latest, magistral-small-latest

**Cohere Models (Free Tier):**
- command-a-03-2025, command-r7b-12-2024, command-r-plus-08-2024

**Aion Labs Models:**
- aion-labs/aion-1.0, aion-rp-small

</details>

### 💬 Enhanced Chat Features
- **Rich Message Support**: Full markdown support with proper rendering
- **Message Management**: Edit, delete, regenerate any message in conversation
- **Smart Regeneration**: Regenerate last AI response with one click
- **Persistent History**: All conversations stored in SQLite database with fast retrieval
- **Chat History Clear**: Clear conversation history while preserving character's first message
- **Emoji Picker**: Built-in emoji picker for expressive conversations
- **Mobile Optimized**: Auto-resizing input, keyboard-aware interface, touch-friendly controls
- **Reasoning Model Support**: Robust handling of thinking blocks and complex reasoning outputs
- **Real-time Sync**: All changes automatically saved to database with connection monitoring

### 📱 Mobile Experience

- **Responsive Design**: Fully optimized interface that works beautifully on all screen sizes
- **Character Selector Overlay**: Mobile-specific character selection with smooth animations
- **Smart Input Handling**: Auto-resizing message input with min/max height constraints
- **Keyboard Awareness**: Navigation footer automatically hides when typing for more space
- **Touch Optimized**: All buttons and interactions designed for touch screens
- **Mobile Navigation**: Dedicated mobile navigation footer with intuitive tab system
- **Performance Optimized**: Efficient rendering for smooth scrolling on mobile devices

### 🎨 Modern UI & Themes

- **🎨 10+ Themes**: Instantly change the look and feel. Supported themes include **Dark, Light, Purple, Cyberpunk, Ocean, Forest, Sunset, Rose, Minimal Light,** and **High Contrast**
- **🎈 Bubble Styles**: Multiple message bubble styles (rounded, angular) for personalization
- **✨ Smooth Animations**: Polished transitions and micro-interactions throughout the interface
- **🎯 Modern Components**: Contemporary UI elements with accessibility and usability in mind
- **🎨 Theme Persistence**: Your theme preference is remembered across sessions
- **🔧 Customizable**: Extensive theming options for personalized experience

### 🔧 Advanced Settings & Configuration

- **🔑 Smart API Key Management**: Add multiple API keys per provider with automatic rotation and status tracking
- **⚙️ Model Configuration**: Fine-tune temperature, top-p, max tokens, and context size per character
- **👤 User Profile**: Set custom user name, avatar, and persona for personalized interactions
- **📊 Memory Settings**: Configure journal frequency, retrieval count, and embedding providers
- **🔄 Reranking Configuration**: Choose reranking provider and configure fallback behavior
- **🎯 Query Enhancement**: Select from multiple query embedding methods (LLM summary, HyDE, averaging)
- **📈 Performance Tuning**: Adjust history message count and context management

### 🔌 Connection & Monitoring

- **📡 Connection Status**: Real-time connection monitoring with visual status indicators
- **🔄 Auto-Reconnection**: Automatic reconnection attempts if connection is lost
- **📱 Toast Notifications**: Informative success, error, and info messages
- **📊 Server Logs**: Real-time server-sent events for debugging and monitoring
- **⚡ Performance Metrics**: Track API response times and system health
- **🔑 API Key Status**: Live monitoring of which keys are working, failed, or rate-limited

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js** v20 or higher
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### ⚡ Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/chungus1310/ChunRP.git
   cd ChunRP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   # For web app
   npm start
   
   # For desktop app
   npm run electron
   ```

4. **Open your browser** (web mode only)
   ```
   http://localhost:3000
   ```

> **📝 Note:** If you're upgrading from an older version that used JSON files, ChunRP will automatically detect and offer to migrate your data to SQLite for better performance.

### 🔧 Configuration

1. **Set up Multiple API Keys** - Click the settings gear ⚙️ and add multiple API keys for each provider you want to use
2. **Configure Smart Rotation** - The system automatically handles key rotation and fallback
3. **Set up Memory System** - Configure reranking provider and embedding preferences  
4. **Customize Your Profile** - Set your username, avatar, and persona for personalized interactions
5. **Create Your First Character** - Click "Create Character" and fill in the details
6. **Start Chatting** - Select your character and begin your adventure!

> **🔄 Migrating from JSON?** If you have an existing ChunRP installation with JSON files, run `npm run migrate` to automatically convert your data to the new SQLite format. Your original files will be safely backed up!

---

## 📖 Documentation

### 🔑 Multiple API Key System

<details>
<summary><strong>How the Smart API Key System Works</strong></summary>

**🔄 Key Rotation Process:**
- **Round-Robin Distribution**: Keys are used in rotation to prevent any single key from being overused
- **Automatic Failover**: If a key hits rate limits or fails, the system instantly switches to the next available key
- **Status Tracking**: Each key is monitored for health (working, failed, rate-limited, untested)
- **Recovery Management**: Failed keys are automatically retried after cooldown periods
- **Load Balancing**: Requests are distributed evenly across all available keys

**💡 Benefits:**
- **Maximum Uptime**: Never get stuck waiting for rate limits to reset
- **Reliability**: If one key fails, others continue working seamlessly
- **Performance**: Distributed load prevents any single key from being overwhelmed
- **Scalability**: Add more keys anytime to increase your request capacity

**🎯 Best Practices:**
- Add 2-3 keys per provider you use frequently
- Monitor key status in the settings to identify problematic keys
- Remove or replace keys that consistently fail
- Different providers have different rate limits - plan accordingly

</details>

### 🎯 Creating Characters

<details>
<summary><strong>Character Fields Explained</strong></summary>

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| **Name** | Character's name | ✅ | "Luna the Librarian" |
| **Persona** | Core personality, background, and behavior instructions. **This field acts as the complete system prompt.** | ✅ | "A wise, ancient librarian who loves books and tea. You must always speak in a wise, calm tone..." |
| **Description** | Physical and background details | ❌ | "Tall, silver-haired elf with kind eyes" |
| **Current Scenario** | Starting situation | ❌ | "Working late in the magical library" |
| **Appearance** | Detailed looks | ❌ | "Wears flowing robes, carries a glowing staff" |
| **Avatar URL** | Character image | ❌ | `https://example.com/luna.jpg` |
| **First Message** | Opening line | ❌ | "Welcome to my library, traveler. How may I help you?" |

</details>

### ⚙️ Settings Guide

<details>
<summary><strong>LLM Provider Settings</strong></summary>

- **Provider**: Choose your preferred AI service from 9+ supported providers
- **Model**: Select the specific model to use (including reasoning models)
- **Temperature** (0.0-2.0): Controls creativity and randomness
  - `0.3`: Very focused and consistent responses
  - `0.7`: Balanced creativity and coherence
  - `1.2`: Highly creative and unpredictable
- **Top P** (0.0-1.0): Controls response diversity via nucleus sampling
- **Max Tokens**: Maximum response length limit
- **Max Context Tokens**: Conversation memory limit for the model

</details>

<details>
<summary><strong>🧠 Advanced Memory System Settings</strong></summary>

**📊 Core Memory Settings:**
- **Journal Frequency**: How often to create memory summaries (default: 10 messages)
- **Retrieval Count**: Number of memories to recall for context (default: 3)
- **History Message Count**: Recent messages to keep in context (default: 300)

**🔍 Embedding & Analysis:**
- **Embedding Provider**: Service for creating memory embeddings (NVIDIA, Gemini, Mistral, Cohere)
- **Analysis Provider**: LLM provider for memory analysis (Gemini recommended)
- **Analysis Model**: Specific model for memory processing and emotional analysis

**🎯 Query Enhancement:**
- **Query Embedding Method**: 
  - `llm-summary`: LLM summarizes recent context for better retrieval
  - `hyde`: Hypothetical Document Embeddings for enhanced matching
  - `average`: Average embeddings of recent messages
  - `plain`: Use current message as-is

**🔄 Memory Reranking:**
- **Enable Reranking**: Toggle intelligent memory reranking system
- **Reranking Provider**: Choose between Jina, Cohere, or NVIDIA
- **Automatic Fallback**: Switches providers if primary fails for reliability

**♻️ Memory Recycling:**
- **Progress Tracking**: Real-time updates during memory recreation process
- **Timeout Handling**: 6-second delays between memory creation for rate limiting
- **Error Recovery**: Continues processing even if individual chunks fail

</details>

### 🎨 Themes and Customization

Switch between **10+ themes** in settings. Each theme includes:
- Carefully crafted color palettes optimized for readability and eye comfort
- Smooth animations and transitions for polished user experience
- Modern glassmorphism effects and contemporary design elements
- Customizable message bubble styles for personalization
- Accessibility-focused design choices with proper contrast ratios

### 📱 Mobile Experience

ChunRP is fully responsive with mobile-first design:
- **Touch-optimized interface** with appropriately sized buttons and touch targets
- **Swipe gestures** for intuitive navigation
- **Mobile-friendly character selector** with smooth overlay animations
- **Keyboard-aware input handling** that adapts to mobile keyboards
- **Responsive message bubbles** that adjust to screen size
- **Auto-resizing input field** with smart height constraints
- **Navigation footer** that hides when typing for maximum screen space

---

## 🛠️ Development

### 📁 Project Structure

```
ChunRP/
├── 📁 src/
│   ├── 📁 backend/
│   │   ├── 🔧 server.js                  # Express server & API routes
│   │   ├── 🗄️ database.js               # SQLite database layer
│   │   ├── 👤 character-system.js       # Character CRUD operations (exports from SQLite)
│   │   ├── 👤 character-system-sqlite.js # SQLite-based character operations
│   │   ├── 🤖 llm-providers.js          # AI provider integrations (9+ providers)
│   │   ├── 🧠 memory-system.js          # Vector memory, embedding, and analysis
│   │   ├── 🔄 reranking-system.js       # Memory reranking with multiple APIs
│   │   ├── 📊 vectra-wrapper.js         # Vector database wrapper
│   │   ├── 🔄 migration.js              # Database migration utilities
│   │   └── 📍 app-paths.js              # Path management for different environments
│   ├── 📁 frontend/
│   │   ├── 🏠 index.html                # Main HTML structure
│   │   ├── 📁 css/
│   │   │   ├── 🎨 main.css              # Core styles with modern design
│   │   │   ├── 🌙 themes.css            # All theme definitions
│   │   │   └── 📱 mobile.css            # Mobile responsiveness
│   │   ├── 📁 js/
│   │   │   ├── ⚡ app.js                # Main application logic
│   │   │   └── 📱 mobile-ui.js          # Mobile-specific UI features
│   │   └── 📁 assets/                   # Images and icons
│   └── ⚡ electron.js                   # Desktop app entry point
├── 📁 data/
│   ├── 🗄️ chunrp.db                    # SQLite database (characters, messages, settings)
│   ├── 🧠 memory-vectra/                # Vector memory storage
│   └── 📋 data-backup/                  # Migration backup files (if migrated)
├── 🔄 migrate.js                        # Database migration runner
├── 🧹 cleanup.js                        # Post-migration cleanup
└── 📦 package.json                      # Dependencies and scripts
```

### 🔨 Available Scripts

```bash
# Development
npm run dev          # Start with auto-reload
npm start           # Production server
npm run electron    # Desktop app
npm run build       # Build desktop app
npm test           # Run tests

# Database Management
npm run migrate     # Run SQLite migration (if upgrading from JSON)
npm run cleanup     # Archive old JSON files post-migration

# Docker
docker build -t chunrp .
docker run -p 3000:3000 chunrp
```

### 🧪 API Endpoints

<details>
<summary><strong>Character Management</strong></summary>

```javascript
GET    /api/characters          # List all characters
GET    /api/characters/:name    # Get specific character
POST   /api/characters          # Create new character
PUT    /api/characters/:name    # Update character
DELETE /api/characters/:name    # Delete character
```

</details>

<details>
<summary><strong>Chat & Memory</strong></summary>

```javascript
POST   /api/chat                # Generate AI response
GET    /api/chat/:character     # Get chat history
PUT    /api/chat/:character     # Update chat history
DELETE /api/chat/:character     # Clear chat history
GET    /api/memories/:character # Retrieve character memories
POST   /api/recycle-memories    # Recycle character memories
GET    /api/progress           # Memory recycling progress (SSE)
```

</details>

<details>
<summary><strong>Configuration</strong></summary>

```javascript
GET    /api/settings            # Get user settings
PUT    /api/settings            # Update settings
GET    /api/models              # Get available models
GET    /api/logs                # Server-sent events for logs
```

</details>

### 🗄️ Database Schema

ChunRP uses SQLite for reliable, fast data storage:

<details>
<summary><strong>Database Tables</strong></summary>

**Characters Table**
```sql
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  current_scenario TEXT DEFAULT '',
  persona TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  first_message TEXT DEFAULT '',
  last_journal_index INTEGER DEFAULT 0,
  settings_override TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  modified_at INTEGER NOT NULL
);
```

**Chat Messages Table**
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);
```

**Character Relationships Table**
```sql
CREATE TABLE IF NOT EXISTS character_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'User',
  status TEXT DEFAULT 'neutral',
  sentiment REAL DEFAULT 0.0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
  UNIQUE(character_id, user_name)
);
```

**Settings Table**
```sql
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
```

</details>

### 🔌 Adding New LLM Providers

1. **Add to `llm-providers.js`**:
   ```javascript
   const llmProviderFactory = {
     myProvider: async (messages, settings) => {
       // Implementation here
       return responseText;
     }
   };
   ```

2. **Add model configurations**:
   ```javascript
   const modelConfigurations = {
     myProvider: [
       { id: "my-model-1", name: "My Model 1", free: true }
     ]
   };
   ```

3. **Update frontend settings** to include the new provider option in the dropdown.

### 🔄 Adding Reranking Providers

1. **Update `reranking-system.js`** with new provider implementation
2. **Add API key configuration** in settings modal
3. **Update fallback chain** for robust error handling
4. **Test integration** with existing memory retrieval system

---

## 🆕 Recent Updates

### 🎉 Latest Features (v3.0.0) - Major Database Migration!

- **🗄️ SQLite Database Migration**: Complete transition from JSON files to SQLite for better performance and reliability
- **🔄 Smart API Key System**: Multiple API keys per provider with automatic rotation and intelligent fallback
- **🔄 Memory Reranking System**: Intelligent memory retrieval with Jina, Cohere, and NVIDIA APIs
- **♻️ Memory Recycling**: Complete memory regeneration with progress tracking and error recovery
- **👁️ Memory Viewer**: Browse and manage character memories through dedicated side panel
- **🤖 Reasoning Model Support**: Robust handling of thinking blocks and malformed JSON responses
- **📊 Progress Tracking**: Real-time memory creation progress with detailed status updates
- **🔧 Provider Expansion**: Now supporting 9+ providers including new additions like Chutes and Aion Labs
- **⚡ Performance Improvements**: Significantly faster data operations with SQLite queries
- **🛡️ Data Integrity**: Foreign key constraints and ACID compliance prevent data corruption
- **🎨 Enhanced UI**: Improved themes (10+ options), better mobile experience, and modern design elements
- **🎯 Persona System Update**: The persona field now acts as the complete system prompt for maximum control

### 🔑 API Key Management Revolution

- **🔄 Automatic Key Rotation**: Round-robin system prevents rate limit issues
- **📊 Real-time Status Monitoring**: See which keys are working, failed, or rate-limited
- **🛡️ Intelligent Fallback**: Seamless switching when keys fail or hit limits
- **⚡ Load Balancing**: Distributed requests for optimal performance
- **🎯 Recovery Management**: Automatic retry of failed keys after cooldown periods

### 📱 Mobile UI Enhancements

- **🎯 Character Selector Overlay**: Smooth mobile-specific character selection interface
- **📝 Auto-resizing Input**: Smart message input that adapts to content with height constraints
- **⌨️ Keyboard-aware Interface**: Navigation footer automatically hides when typing
- **👆 Touch Optimizations**: All interactions optimized for touch screens
- **🔄 Responsive Navigation**: Mobile-first navigation system with intuitive tab structure
- **🎨 Mobile Themes**: Themes optimized for mobile viewing with proper contrast

### 🔧 Technical Improvements

- **🗄️ Database Architecture**: Modern SQLite database with proper schema design and indexing
- **🔗 Data Relationships**: Proper foreign key relationships between characters, messages, and relationships
- **🔒 Transaction Safety**: Atomic database operations with automatic backup and recovery
- **📈 Better Performance**: SQLite queries are significantly faster than JSON file operations
- **🚀 Migration Tools**: Automated migration system with validation and rollback capabilities
- **💾 Memory Efficiency**: No need to load entire JSON files into memory
- **🔧 Error Handling**: Graceful fallback systems for memory creation and reranking
- **🌐 API Reliability**: Automatic provider switching and timeout handling

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### 🐛 Reporting Issues

Found a bug? Please open an issue with:
- Detailed description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- System information (OS, Node.js version)
- Provider and model being used
- Any relevant error messages or screenshots

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Vectra** - Local vector database for memory storage
- **Express** - Web framework for the backend API
- **Electron** - Cross-platform desktop app framework
- **SQLite** - Reliable, efficient database engine
- **Jina AI, Cohere, NVIDIA** - Reranking API providers
- **All AI Providers** - For making this diverse ecosystem possible with free models
- **Open Source Community** - For the amazing tools and libraries

---

<div align="center">

**Made with ❤️ by Chun, for the AI roleplay community**

[⭐ Star this repo](https://github.com/chungus1310/ChunRP) | [🐛 Report Issues](https://github.com/chungus1310/ChunRP/issues) | [💬 Discussions](https://github.com/chungus1310/ChunRP/discussions)

</div>
