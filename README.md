# 🎭 ChunRP - Immersive Roleplay Chat

<div align="center">

![ChunRP Logo](src/frontend/assets/splash.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-v28+-blue.svg)](https://electronjs.org/)

**A powerful, local-first AI roleplay chatbot with advanced memory, sqlite-vec vector storage, and extensive LLM provider support**

[✨ Features](#-features) • [🚀 Getting Started](#-getting-started) • [📖 Documentation](#-documentation) • [🛠️ Development](#️-development)

</div>

---

## 🌟 What is ChunRP?

ChunRP is a **local-first roleplay chatbot** that brings AI characters to life with persistent memory. Built on SQLite with sqlite-vec vector storage, it provides enterprise-grade reliability with optional cloud sync capabilities through Turso/libSQL integration.

### ✨ Key Highlights

- 🗄️ **SQLite + sqlite-vec Storage** - Enterprise-grade local database with vector similarity search and optional Turso cloud sync
- 🧠 **Advanced Memory System** - Persistent character memories with LLM-powered analysis and semantic retrieval
- 🎯 **Memory Reranking** - Precision memory recall using Jina, Cohere, and NVIDIA reranking APIs
- ♻️ **Memory Recycling** - Rebuild character memories from chat history with real-time progress tracking
- 🤖 **10+ AI Providers** - Support for latest models including DeepSeek R1, Gemini 2.5, QWQ 32B, reasoning models, and more
- 🔄 **API Key Rotation** - Automatic failover and rotation across multiple API keys per provider
- 🏠 **100% Local-First** - Your data stays on your machine with optional cloud sync
- 📱 **Mobile Responsive** - Beautiful desktop and mobile experience with native-like UI
- 🎨 **Modern Design** - Dark/Light themes with glassmorphism effects and customizable styling
- ⚡ **Real-time Experience** - Streaming support with robust reasoning model handling and thinking display

---

## ✨ Features

### 🎭 Character Management
- **Rich Character Profiles**: Create detailed characters with personas, appearances, scenarios, and custom system prompts
- **Avatar Support**: Add custom avatars via URL or use the default avatar
- **Character Import/Export**: Share characters or backup your creations
- **Settings Override**: Customize LLM settings per character for unique personalities
- **SQLite Storage**: Characters stored in robust SQLite database with schema versioning

### 🗄️ Database & Storage

<div align="center">

> **🚀 MODERN ARCHITECTURE**
> - **SQLite + better-sqlite3** for reliable local storage with WAL mode
> - **sqlite-vec extension** for high-performance vector similarity search
> - **Automatic fallback** to brute-force cosine similarity if sqlite-vec unavailable
> - **Optional Turso/libSQL sync** for cloud backup and multi-device access

</div>

- **Local-First Design**: All data stored locally in SQLite database (`data/chunrp.db`)
- **Vector Storage**: Unified sqlite-vec implementation with embedding dimension auto-detection
- **Schema Migration**: Automatic database schema versioning and migration system
- **Cloud Sync (Optional)**: Turso/libSQL integration for remote backup and synchronization
- **Data Inspection**: Built-in database dump utility (`dump-db.js`) for debugging and inspection

### 🧠 Advanced Memory System

<div align="center">

> **🚀 INTELLIGENT MEMORY**
> - **LLM-Powered Analysis** with conversation chunk processing and emotional understanding
> - **Memory Recycling** with real-time progress tracking and timeout handling
> - **Multi-Provider Embedding** support (NVIDIA, Gemini, Mistral, Cohere) with automatic fallback
> - **Semantic Retrieval** with query enhancement via LLM summary, HyDE, or embedding averaging

</div>

- **Vector Memory Storage**: Characters remember conversations using advanced embedding technology with automatic dimension detection
- **Intelligent Reranking**: Memories are reranked using state-of-the-art reranking models for perfect context retrieval
- **Memory Recycling**: Complete memory regeneration from chat history with progress toasts and proper rate limiting
- **LLM Analysis**: Advanced conversation analysis using configurable analysis providers and models
- **Smart Retrieval**: Multiple query enhancement methods (LLM summary, HyDE, embedding averaging) for optimal memory recall
- **Robust Processing**: Handles reasoning model thinking blocks, malformed JSON responses, and provider failures gracefully
- **Progress Tracking**: Real-time memory creation progress with detailed status updates and error recovery

### 🔄 Memory Reranking System

- **Multiple Providers**: Jina AI, Cohere, and NVIDIA reranking APIs with automatic failover
- **Configurable Selection**: Choose your preferred reranking provider and API key in settings
- **Performance Optimized**: Smart query processing for optimal retrieval accuracy with semantic compatibility
- **Fallback Chain**: Seamless provider switching when primary reranker fails

### 🤖 Multi-Provider LLM Support

<details>
<summary><strong>🌐 Supported Providers & Latest Models (Click to expand)</strong></summary>

| Provider | Featured Models | Free Tier | Reasoning Models | Key Rotation |
|----------|-----------------|-----------|------------------|--------------|
| **🔥 Chutes** | DeepSeek R1, R1-0528, ArliAI QwQ 32B, TNG Chimera, Hermes-4 | ✅ | ✅ DeepSeek R1, Hermes-4 | ✅ |
| **🔥 Gemini** | Gemini 2.5 Pro, 2.0 Flash, **2.0 Flash Thinking** | ✅ | ✅ Thinking models | ✅ |
| **🔥 OpenRouter** | DeepSeek R1, QWQ 32B RPR, Horizon Alpha, Gemini 2.0 Flash | ✅ | ✅ Multiple reasoning models | ✅ |
| **NVIDIA** | Llama 4 Scout/Maverick, QWQ 32B, Nemotron family, DeepSeek R1/V3.1 | ✅ | ✅ QWQ 32B, DeepSeek family | ✅ |
| **Hugging Face** | Llama 3.3 70B, DeepSeek V3, Dolphin Mixtral family | ✅ | ❌ | ✅ |
| **Cohere** | Command A 03-2025, Command R7B, **Command A Reasoning** | ✅ | ✅ Command A Reasoning | ✅ |
| **Mistral** | Mistral Large, Magistral Medium/Small, Open Nemo | ✅ | ✅ Magistral family | ✅ |
| **GLM (BigModel.cn)** | GLM-4.5 Flash, GLM-Z1 Flash, GLM-4.5 | ✅ | ✅ GLM with thinking mode | ✅ |
| **AionLabs** | Aion 1.0, Aion RP Small | ✅ | ✅ | ✅ |

**🔥 Popular Reasoning Models:**
- DeepSeek R1 & R1-0528 (Chutes, OpenRouter, NVIDIA)
- Gemini 2.0 Flash Thinking (Gemini)
- QWQ 32B (NVIDIA, OpenRouter)
- ArliAI QwQ 32B RPR (Chutes, OpenRouter)
- Command A Reasoning (Cohere)
- Hermes-4 70B/405B (Chutes)
- GLM with thinking mode (GLM/BigModel.cn)

**🔧 Key Features:**
- **API Key Rotation**: Automatic rotation and failover across multiple keys per provider
- **Reasoning Support**: Native handling of thinking blocks and reasoning content
- **Provider Fallbacks**: Intelligent fallback chains for maximum reliability
- **Model-Specific Handling**: Custom configurations for different model architectures

</details>

### 💬 Enhanced Chat Features
- **Markdown Support**: Rich text formatting in messages with proper rendering
- **Message Actions**: Edit, delete, regenerate any message with intuitive controls
- **Persistent History**: SQLite-based conversation history per character with import/export
- **Emoji Picker**: Express yourself with emojis using modern picker component
- **Mobile Optimized**: Touch-friendly interface with swipe gestures and responsive design
- **Reasoning Model Support**: Native display of thinking blocks and complex reasoning outputs
- **Streaming Support**: Real-time response generation with loading indicators
- **Scene Breaks**: Create narrative breaks and new conversation contexts

### 🚿 Streaming Responses

Enable real-time token streaming in Settings → Models → Parameters by toggling "Enable Streaming Responses". When enabled:

- Backend sets `stream: true` for supported providers (OpenRouter, HuggingFace, Cohere, NVIDIA, Chutes, AionLabs, GLM where applicable) without altering other request structure.
- A dedicated endpoint `/api/chat/stream` returns newline-delimited JSON events: `{type:"token", token}` for incremental chunks, `{type:"done", response}` when complete, `{type:"error", error}` on failure.
- Frontend progressively updates the last assistant message while preserving the full final content (including `<think>` reasoning blocks in stored history).
- Reasoning / thinking blocks wrapped in `<think>` are hidden in the live incremental bubble but still stored so the existing thought viewer still works after final render.

If you encounter provider instability or want the legacy behavior, simply disable the toggle to fall back to classic single-response mode.

### 🎨 Modern UI & Experience

- **🌙 Dark Theme**: Sleek dark interface with glassmorphism effects and modern gradients
- **☀️ Light Theme**: Clean, bright interface perfect for daytime use with accessibility focus
- **📱 Mobile-First Design**: Native-like mobile experience with bottom navigation and touch optimization
- **✨ Smooth Animations**: Polished transitions, micro-interactions, and loading states
- **🎯 Modern Components**: Contemporary UI elements with proper ARIA labels and keyboard navigation
- **🔧 Customizable**: Extensive theme customization and UI preferences
- **📊 Memory Visualization**: Interactive memory timeline and importance indicators
- **🔍 Advanced Search**: Character search with real-time filtering and sorting

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
   # For web app (development)
   npm run dev
   
   # For web app (production)
   npm start
   
   # For desktop app
   npm run electron
   ```

4. **Open your browser** (web mode only)
   ```
   http://localhost:3000
   ```

### 🔧 Configuration

1. **Set up API Keys** - Click the settings gear ⚙️ and add your API keys for your preferred providers
2. **Configure Memory System** - Set up embedding providers, reranking preferences, and memory settings
3. **Optional: Turso Sync** - Configure cloud synchronization for multi-device access
4. **Create Your First Character** - Click "Create Character" and fill in the details
5. **Start Chatting** - Select your character and begin your adventure!

---

## 📖 Documentation

### 🎯 Creating Characters

<details>
<summary><strong>Character Fields Explained</strong></summary>

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| **Name** | Character's name | ✅ | "Luna the Librarian" |
| **Persona** | Core personality traits | ✅ | "A wise, ancient librarian who loves books and tea" |
| **Description** | Physical and background details | ❌ | "Tall, silver-haired elf with kind eyes" |
| **Current Scenario** | Starting situation | ❌ | "Working late in the magical library" |
| **Appearance** | Detailed looks | ❌ | "Wears flowing robes, carries a glowing staff" |
| **Avatar URL** | Character image | ❌ | `https://example.com/luna.jpg` |
| **First Message** | Opening line | ❌ | "Welcome to my library, traveler. How may I help you?" |
| **System Prompt** | Advanced behavior instructions | ❌ | "Always speak in a wise, calm tone..." |

</details>

### ⚙️ Settings Guide

<details>
<summary><strong>LLM Provider Settings</strong></summary>

- **Provider**: Choose your preferred AI service
- **Model**: Select the specific model to use
- **Temperature** (0.0-2.0): Controls creativity
  - `0.3`: Very focused and consistent
  - `0.7`: Balanced creativity
  - `1.2`: Highly creative and unpredictable
- **Top P** (0.0-1.0): Controls response diversity
- **Max Tokens**: Maximum response length
- **Max Context Tokens**: Conversation memory limit

</details>

<details>
<summary><strong>🧠 Advanced Memory System Settings</strong></summary>

**📊 Core Memory Settings:**
- **Journal Frequency**: How often to create memory summaries (default: 10 messages)
- **Retrieval Count**: Number of memories to recall (default: 5)
- **History Message Count**: Recent messages to keep in context (default: 15)
- **Enable Memory Creation**: Toggle memory journal creation
- **Enable Memory Retrieval**: Toggle memory recall during conversations

**🔍 Embedding & Analysis:**
- **Embedding Provider**: Service for creating memory embeddings (NVIDIA, Gemini, Mistral, Cohere)
- **Analysis Provider**: LLM provider for memory analysis (configurable per character)
- **Analysis Model**: Specific model for memory processing and journal creation

**🎯 Query Enhancement:**
- **Query Embedding Method**: 
  - `llm-summary`: LLM summarizes recent context for better retrieval
  - `hyde`: Hypothetical Document Embeddings for enhanced matching
  - `average`: Average embeddings of recent messages
  - `plain`: Use current message as-is

**🔄 Memory Reranking:**
- **Enable Reranking**: Toggle intelligent memory reranking
- **Reranking Provider**: Choose between Jina, Cohere, or NVIDIA
- **Automatic Fallback**: Switches providers if primary fails

**♻️ Memory Recycling:**
- **Progress Tracking**: Real-time updates during memory recreation
- **Rate Limiting**: 6-second delays between memory creation for API compliance
- **Error Recovery**: Continues processing even if individual chunks fail
- **Batch Processing**: Handles large chat histories efficiently

**🗄️ Database & Storage:**
- **SQLite Vector Storage**: High-performance similarity search with sqlite-vec
- **Automatic Fallback**: Brute-force cosine similarity if sqlite-vec unavailable
- **Turso Sync**: Optional cloud synchronization for multi-device access

</details>

### 🎨 Themes and Customization

Switch between **Dark** and **Light** themes in settings. Each theme includes:
- Carefully crafted color palettes optimized for readability and eye comfort
- Smooth animations and transitions with hardware acceleration
- Modern glassmorphism effects and gradient overlays
- Accessibility-focused design with proper contrast ratios
- Mobile-optimized touch targets and gestures
- Customizable UI density and component spacing

### 📱 Mobile Experience

ChunRP is fully responsive with native-like mobile experience:
- **Touch-Optimized Interface**: Large touch targets and swipe gestures
- **Bottom Navigation**: Easy thumb navigation with tab-based interface
- **Mobile Character Selector**: Optimized character browsing and creation
- **Responsive Layout**: Adaptive layout that works perfectly on all screen sizes
- **Gesture Support**: Swipe to navigate, pull to refresh, and more
- **Progressive Web App**: Can be installed as a native app on mobile devices

---

## 🛠️ Development

### 📁 Project Structure

```
ChunRP/
├── 📁 src/
│   ├── 📁 backend/
│   │   ├── 🔧 server.js                    # Express server & API routes with SSE logging
│   │   ├── �️ database.js                  # SQLite initialization & schema migration
│   │   ├── �👤 character-system-sqlite.js   # Character CRUD operations (SQLite-based)
│   │   ├── 🤖 llm-providers.js             # AI provider integrations (10+ providers)
│   │   ├── 🧠 memory-system.js             # Vector memory system with recycling
│   │   ├── 🔄 reranking-system.js          # Memory reranking with multiple APIs
│   │   ├── �️ vector-store-sqlite-vec.js   # Unified sqlite-vec vector storage
│   │   ├── 🔄 turso-sync.js                # Optional Turso/libSQL cloud sync
│   │   ├── 📍 app-paths.js                 # Cross-platform data directory handling
│   │   └── 🔧 migration.js                 # Database migration utilities
│   ├── 📁 frontend/
│   │   ├── 🏠 index.html                   # Main HTML structure with modern layout
│   │   ├── 📁 css/
│   │   │   ├── 🎨 main.css                 # Core styles with modern design system
│   │   │   ├── 🌙 themes.css               # Dark/Light theme definitions
│   │   │   └── 📱 mobile.css               # Mobile responsiveness & PWA support
│   │   ├── 📁 js/
│   │   │   ├── ⚡ app.js                   # Main application logic & API integration
│   │   │   └── 📱 mobile-ui.js             # Mobile-specific features & navigation
│   │   └── 📁 assets/                      # Images, icons, and static assets
│   └── ⚡ electron.js                      # Desktop app entry point
├── 📁 data/
│   └── �️ chunrp.db                       # SQLite database (auto-created)
├── � migrate.js                           # Migration runner script
├── 🔍 dump-db.js                           # Database inspection utility
├── 🧹 cleanup.js                           # Database cleanup utility
├── 📦 package.json                         # Dependencies and scripts
├── 🏗️ electron-builder.json                # Electron build configuration
└── 📋 PLAN.md                              # Architectural documentation
```

### 🔨 Available Scripts

```bash
# Development
npm run dev              # Start with auto-reload (nodemon)
npm start               # Production server
npm run electron        # Desktop app

# Database & Migration
npm run migrate         # Run database migration from legacy JSON format
node dump-db.js         # Inspect database schema and sample data
node cleanup.js         # Database cleanup utilities

# Building
npm run build           # Build desktop app installer for Windows
npm test               # Run test suite

# Docker (optional)
docker build -t chunrp .
docker run -p 3000:3000 chunrp
```

### 🔌 API Endpoints

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
POST   /api/chat                        # Generate AI response
GET    /api/chat/:character             # Get chat history
PUT    /api/chat/:character             # Update chat history
DELETE /api/chat/:character             # Clear chat history
GET    /api/memories/:character         # Retrieve character memories
POST   /api/memories/:character/recycle # Recycle character memories
GET    /api/memories/:character/progress # Memory recycling progress (real-time)
```

</details>

<details>
<summary><strong>Configuration & Monitoring</strong></summary>

```javascript
GET    /api/settings            # Get user settings
PUT    /api/settings            # Update settings
GET    /api/models              # Get available models by provider
GET    /api/key-status          # Get API key rotation status
GET    /api/logs                # Server-sent events for logs
GET    /api/health              # Health check with system info
GET    /api/turso-sync-status   # Cloud sync status
```

</details>

### 🔌 Adding New LLM Providers

1. **Add to `llm-providers.js`**:
   ```javascript
   const llmProviderFactory = {
     myProvider: async (messages, settings) => {
       // Implement API integration with key rotation support
       const keyInfo = getNextApiKey('myProvider', settings.apiKeys || {});
       // ... implementation with automatic failover
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

3. **Update frontend settings** to include the new provider option in the UI.

### 🔄 Adding Reranking Providers

1. **Create provider in `reranking-system.js`**:
   ```javascript
   async function rerankWithMyProvider(query, memories, apiKey) {
     // Implement reranking API integration
     return rerankedMemories;
   }
   ```

2. **Add to reranking provider list** and update fallback chain for robust error handling.

3. **Update settings UI** to include the new reranking provider option.

### 🗄️ Database Schema Extensions

The SQLite schema supports automatic migration. To add new features:

1. **Update schema version** in `database.js` and add migration logic:
   ```javascript
   if (currentVersion < 2) {
     db.exec('ALTER TABLE characters ADD COLUMN new_field TEXT');
   }
   ```

2. **Update character system** to handle new fields in CRUD operations.

3. **Test migrations** using `npm run migrate` and verify with `node dump-db.js`.

---

## 🆕 Recent Updates

### 🎉 Latest Features (v2.0+)

- **�️ SQLite Migration**: Complete migration from Vectra to sqlite-vec with robust SQLite storage
- **�🔄 Memory Reranking System**: Intelligent memory retrieval with Jina, Cohere, and NVIDIA APIs
- **♻️ Memory Recycling**: Complete memory regeneration with real-time progress tracking and rate limiting
- **🤖 Expanded Provider Support**: Added GLM, enhanced Chutes, AionLabs, and more reasoning models
- **🔧 API Key Rotation**: Automatic rotation and failover across multiple API keys per provider
- **📱 Mobile Overhaul**: Complete mobile experience redesign with native-like interface
- **�️ Database Schema**: Proper SQLite schema with versioning, foreign keys, and migration system
- **☁️ Turso Integration**: Optional cloud synchronization for multi-device access
- **🔍 Database Tools**: Built-in database inspection and migration utilities

### 🔧 Technical Improvements

- **Vector Storage**: High-performance sqlite-vec with automatic fallback to brute-force cosine similarity
- **Memory Analysis**: Advanced LLM-powered conversation analysis with robust JSON extraction
- **Provider Reliability**: Comprehensive error handling and automatic provider switching
- **Real-time Updates**: Server-sent events for live progress tracking and system monitoring
- **Schema Versioning**: Automatic database migration system with backward compatibility
- **Performance**: Optimized memory retrieval and context building algorithms
- **Mobile PWA**: Progressive Web App capabilities with offline support planning

### � Bug Fixes & Stability

- **Memory Creation**: Fixed journal frequency calculations and duplicate memory prevention
- **Provider Handling**: Robust error handling for API failures and malformed responses
- **Database Integrity**: Proper foreign key constraints and transaction management
- **Mobile UI**: Fixed touch interactions and responsive layout issues
- **Memory Retrieval**: Improved context assembly and token budget management

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### 🧪 Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/ChunRP.git
cd ChunRP

# Install dependencies
npm install

# Start development server
npm run dev

# Run database inspection
node dump-db.js

# Run tests
npm test
```

### � Contribution Guidelines

- Follow existing code style and conventions
- Add proper error handling and logging
- Update documentation for new features
- Test with multiple LLM providers and edge cases
- Ensure mobile responsiveness for UI changes
- Add database migration logic for schema changes

### �🐛 Reporting Issues

Found a bug? Please open an issue with:
- Detailed description and steps to reproduce
- Expected vs actual behavior
- System information (OS, Node.js version)
- Provider and model being used
- Database state (you can use `node dump-db.js` for inspection)
- Console logs and error messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **sqlite-vec** - High-performance vector similarity search for SQLite
- **better-sqlite3** - Fast, reliable SQLite3 bindings for Node.js
- **Express** - Web framework for the backend API
- **Electron** - Cross-platform desktop app framework
- **Jina AI, Cohere, NVIDIA** - Reranking API providers for intelligent memory retrieval
- **Google, OpenAI, Mistral, HuggingFace** - LLM API providers enabling diverse model support
- **Turso/libSQL** - Cloud-edge database for optional synchronization
- **All AI Providers** - For making this diverse ecosystem possible with competitive pricing
- **Open Source Community** - For the amazing tools, libraries, and inspiration

### 🎯 Special Thanks

- The **sqlite-vec** project for enabling local vector search at scale
- **Turso** for providing excellent SQLite-compatible cloud database services
- The **reasoning model** community for advancing AI capabilities
- **Mobile-first design** principles that guided our responsive UI development
- **Local-first software** movement for inspiring data ownership and privacy focus

---

<div align="center">

**Made with ❤️ by Chun, for the AI roleplay community**

[⭐ Star this repo](https://github.com/chungus1310/ChunRP) | [🐛 Report Issues](https://github.com/chungus1310/ChunRP/issues) | [💬 Discussions](https://github.com/chungus1310/ChunRP/discussions)

</div>