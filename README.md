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
- 🤖 **9+ AI Providers** - Support for latest models including DeepSeek R1, Gemini 2.5, QWQ 32B, and more
- 🏠 **100% Local** - Your conversations stay private on your machine
- 📱 **Mobile Responsive** - Works beautifully on desktop, tablet, and mobile
- 🎨 **Beautiful Themes** - Dark/Light themes with customizable bubble styles
- ⚡ **Real-time Experience** - Instant responses with streaming support and robust reasoning model handling

---

## ✨ Features

### 🎭 Character Management
- **Rich Character Profiles**: Create detailed characters with personas, appearances, scenarios, and custom system prompts
- **Avatar Support**: Add custom avatars via URL or use the default avatar
- **Character Import/Export**: Share characters or backup your creations
- **Settings Override**: Customize LLM settings per character for unique personalities
- **SQLite Storage**: Characters are now stored in a fast, reliable SQLite database

### 🧠 Advanced Memory System

<div align="center">

> **🚀 NEW FEATURES**
> - **Memory Reranking** with Jina, Cohere, and NVIDIA APIs
> - **Memory Recycling** with real-time progress tracking
> - **Reasoning Model Support** with robust JSON extraction
> - **SQLite Database** for improved performance and reliability

</div>

- **Vector Memory Storage**: Characters remember conversations using advanced embedding technology with multiple provider support
- **Intelligent Reranking**: Memories are reranked using state-of-the-art reranking models for perfect context retrieval
- **Memory Recycling**: Complete memory regeneration with progress toasts and proper timeouts
- **Emotional Analysis**: Characters understand and remember emotional context with LLM-powered analysis
- **Smart Retrieval**: Relevant memories are automatically surfaced with LLM summaries, HyDE, or averaging methods
- **Robust Processing**: Handles reasoning model thinking blocks and malformed responses gracefully
- **Progress Tracking**: Real-time memory creation progress with detailed status updates
- **Database Integration**: Chat history stored in SQLite with efficient querying and relationships

### 🔄 Memory Reranking System

- **Multiple Providers**: Jina AI, Cohere, and NVIDIA reranking APIs
- **Automatic Fallback**: Seamless provider switching when one fails
- **Configurable**: Choose your preferred reranking provider and API key
- **Performance Optimized**: Smart query processing for optimal retrieval accuracy

### 🤖 Multi-Provider LLM Support

<details>
<summary><strong>🌐 Supported Providers & Latest Models (Click to expand)</strong></summary>

| Provider | Featured Models | Free Tier | Reasoning Models |
|----------|-----------------|-----------|------------------|
| **🔥 Chutes** | DeepSeek R1, R1-0528, ArliAI QwQ 32B, TNG Chimera | ✅ | ✅ DeepSeek R1 family |
| **🔥 Gemini** | Gemini 2.5 Pro, 2.0 Flash, **2.5 Flash Thinking** | ✅ | ✅ Thinking models |
| **🔥 OpenRouter** | DeepSeek R1, QWQ 32B RPR, MAI-DS R1, Gemini 2.0 Flash | ✅ | ✅ Multiple reasoning models |
| **NVIDIA** | Llama 4 Scout/Maverick, QWQ 32B, Nemotron family | ✅ | ✅ QWQ 32B |
| **Hugging Face** | Llama 3.3 70B, DeepSeek V3, Dolphin Mixtral family | ✅ | ❌ |
| **Cohere** | Command R+ 03-2025, Command R7B, Command R Plus | ✅ | ❌ |
| **Mistral** | Mistral Large, Magistral Medium/Small, Open Nemo | ✅ | ✅ Magistral family |
| **Requesty (No longer free)** | Gemini 2.0 models, Gemma 3 27B, L3-8B Lunaris | ❌ | ✅ Gemini Thinking |

**🔥 Popular Reasoning Models:**
- DeepSeek R1 & R1-0528 (Chutes, OpenRouter, NVIDIA)
- Gemini 2.5 Flash Thinking (Gemini, Requesty)
- QWQ 32B (NVIDIA, OpenRouter)
- ArliAI QwQ 32B RPR (Chutes, OpenRouter)
- MAI-DS R1 (OpenRouter)

</details>

### 💬 Enhanced Chat Features
- **Markdown Support**: Rich text formatting in messages
- **Message Actions**: Edit, delete, regenerate any message
- **Persistent History**: Conversation history stored in SQLite database with fast retrieval
- **Chat Import/Export**: Backup and restore individual character conversations
- **Emoji Picker**: Express yourself with emojis
- **Mobile Optimized**: Seamless experience on any device
- **Reasoning Model Support**: Handles thinking blocks and complex reasoning outputs
- **Real-time Sync**: All changes automatically saved to database

### 🎨 Modern UI & Themes

- **🌙 Dark Theme**: Sleek dark interface with glassmorphism effects
- **☀️ Light Theme**: Clean, bright interface perfect for daytime use
- **🎈 Bubble Styles**: Multiple message bubble styles (rounded, square, etc.)
- **📱 Responsive Design**: Perfect experience across all devices
- **✨ Smooth Animations**: Polished transitions and micro-interactions
- **🎯 Modern Components**: Contemporary UI elements with accessibility in mind

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

1. **Set up API Keys** - Click the settings gear ⚙️ and add your API keys
2. **Configure Memory System** - Set up reranking provider and embedding preferences  
3. **Create Your First Character** - Click "Create Character" and fill in the details
4. **Start Chatting** - Select your character and begin your adventure!

> **🔄 Migrating from JSON?** If you have an existing ChunRP installation with JSON files, run `npm run migrate` to automatically convert your data to the new SQLite format. Your original files will be safely backed up!

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
- **Retrieval Count**: Number of memories to recall (default: 3)
- **History Message Count**: Recent messages to keep in context (default: 300)

**🔍 Embedding & Analysis:**
- **Embedding Provider**: Service for creating memory embeddings (NVIDIA, Gemini, Mistral, Cohere)
- **Analysis Provider**: LLM provider for memory analysis (Gemini recommended)
- **Analysis Model**: Specific model for memory processing

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
- **Timeout Handling**: 6-second delays between memory creation for rate limiting
- **Error Recovery**: Continues processing even if individual chunks fail

</details>

### 🎨 Themes and Customization

Switch between **Dark** and **Light** themes in settings. Each theme includes:
- Carefully crafted color palettes optimized for readability
- Smooth animations and transitions
- Modern glassmorphism effects
- Customizable message bubble styles
- Accessibility-focused design choices

### 📱 Mobile Experience

ChunRP is fully responsive with:
- Touch-optimized interface
- Swipe gestures for navigation
- Mobile-friendly character selector
- Optimized keyboard input handling
- Responsive message bubbles and layouts

---

## 🛠️ Development

### 📁 Project Structure

```
ChunRP/
├── 📁 src/
│   ├── 📁 backend/
│   │   ├── 🔧 server.js                  # Express server & API routes
│   │   ├── 🗄️ database.js               # SQLite database layer
│   │   ├── 👤 character-system.js       # Character CRUD operations (now exports from SQLite)
│   │   ├── 👤 character-system-sqlite.js # SQLite-based character operations
│   │   ├── 🤖 llm-providers.js          # AI provider integrations (9+ providers)
│   │   ├── 🧠 memory-system.js          # Vector memory system with reranking
│   │   ├── 🔄 reranking-system.js       # Memory reranking with multiple APIs
│   │   ├── 📊 vectra-wrapper.js         # Vector database wrapper
│   │   ├── � migration.js              # Database migration utilities
│   │   └── 📍 app-paths.js              # Path management for different environments
│   ├── �📁 frontend/
│   │   ├── 🏠 index.html                # Main HTML structure
│   │   ├── 📁 css/
│   │   │   ├── 🎨 main.css              # Core styles with modern design
│   │   │   ├── 🌙 themes.css            # Dark/Light theme definitions
│   │   │   └── 📱 mobile.css            # Mobile responsiveness
│   │   ├── 📁 js/
│   │   │   ├── ⚡ app.js                # Main application logic
│   │   │   ├── 🧠 memories-api.js       # Memory management frontend
│   │   │   └── 📱 mobile-ui.js          # Mobile-specific features
│   │   └── 📁 assets/                   # Images and icons
│   └── ⚡ electron.js                   # Desktop app entry point
├── 📁 data/
│   ├── �️ chunrp.db                    # SQLite database (characters, messages, settings)
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

ChunRP now uses SQLite for reliable data storage:

<details>
<summary><strong>Database Tables</strong></summary>

**Characters Table**
```sql
CREATE TABLE characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  current_scenario TEXT DEFAULT '',
  persona TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  first_message TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  settings_override TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  modified_at INTEGER NOT NULL
);
```

**Chat Messages Table**
```sql
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);
```

**Character Relationships Table**
```sql
CREATE TABLE character_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'User',
  status TEXT DEFAULT 'neutral',
  sentiment REAL DEFAULT 0.0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);
```

**Settings Table**
```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
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

3. **Update frontend settings** to include the new provider option.

### 🔄 Adding Reranking Providers

1. **Update `reranking-system.js`** with new provider implementation
2. **Add API key configuration** in settings
3. **Update fallback chain** for robust error handling

---

## 🆕 Recent Updates

### 🎉 Latest Features (v3.0.0) - Major Database Migration!

- **�️ SQLite Database Migration**: Complete transition from JSON files to SQLite for better performance and reliability
- **�🔄 Memory Reranking System**: Intelligent memory retrieval with Jina, Cohere, and NVIDIA APIs
- **♻️ Memory Recycling**: Complete memory regeneration with progress tracking and error recovery
- **🤖 Reasoning Model Support**: Robust handling of thinking blocks and malformed JSON responses
- **📊 Progress Tracking**: Real-time memory creation progress with detailed status updates
- **🔧 Provider Expansion**: Added latest models including DeepSeek R1, Gemini 2.0 Thinking, QWQ 32B
- **⚡ Performance Improvements**: Significantly faster data operations with SQLite queries
- **🛡️ Data Integrity**: Foreign key constraints and ACID compliance prevent data corruption
- **🎨 Enhanced UI**: Improved themes, better mobile experience, and modern design elements

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
- Detailed description
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node.js version)
- Provider and model being used

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Vectra** - Local vector database for memory storage
- **Express** - Web framework for the backend API
- **Electron** - Cross-platform desktop app framework
- **Jina AI, Cohere, NVIDIA** - Reranking API providers
- **All AI Providers** - For making this diverse ecosystem possible
- **Open Source Community** - For the amazing tools and libraries

---

<div align="center">

**Made with ❤️ by Chun, for the AI roleplay community**

[⭐ Star this repo](https://github.com/chungus1310/ChunRP) | [🐛 Report Issues](https://github.com/chungus1310/ChunRP/issues) | [💬 Discussions](https://github.com/chungus1310/ChunRP/discussions)

</div>
