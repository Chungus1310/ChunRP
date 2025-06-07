# 🎭 ChunRP - Immersive Roleplay Chat

<div align="center">

![ChunRP Logo](src/frontend/assets/splash.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-v28+-blue.svg)](https://electronjs.org/)

**A powerful, local AI roleplay chatbot with advanced memory and multiple LLM provider support**

[✨ Features](#-features) • [🚀 Getting Started](#-getting-started) • [📖 Documentation](#-documentation) • [🛠️ Development](#️-development)

</div>

---

## 🌟 What is ChunRP?

ChunRP is an **immersive local roleplay chatbot** that brings your AI characters to life! Unlike simple chatbots, ChunRP creates deep, persistent relationships with characters that remember your conversations, evolve over time, and maintain rich emotional connections.

### ✨ Key Highlights

- 🧠 **Advanced Memory System** - Characters remember everything with vector-based long-term memory
- 🎯 **Multiple AI Providers** - Support for 8+ LLM providers including Gemini, OpenRouter, DeepSeek, and more
- 🏠 **100% Local** - Your conversations stay private on your machine
- 📱 **Mobile Responsive** - Works beautifully on desktop, tablet, and mobile
- 🎨 **Beautiful Themes** - Dark/Light themes with customizable bubble styles
- ⚡ **Real-time Experience** - Instant responses with streaming support

---

## ✨ Features

### 🎭 Character Management
- **Rich Character Profiles**: Create detailed characters with personas, appearances, scenarios, and custom system prompts
- **Avatar Support**: Add custom avatars via URL or use the default avatar
- **Character Import/Export**: Share characters or backup your creations
- **Settings Override**: Customize LLM settings per character for unique personalities

### 🧠 Advanced Memory System
- **Vector Memory Storage**: Characters remember conversations using advanced embedding technology
- **Emotional Analysis**: Characters understand and remember emotional context
- **Smart Retrieval**: Relevant memories are automatically surfaced during conversations
- **Journal Summaries**: Long conversations are intelligently summarized
- **Memory Visualization**: Browse and explore character memories through the UI

### 🤖 Multi-Provider LLM Support

<details>
<summary><strong>🌐 Supported Providers (Click to expand)</strong></summary>

| Provider | Models Available | Free Tier | Features |
|----------|-----------------|-----------|----------|
| **Gemini** | Gemini 2.5 Pro, 2.0 Flash, Thinking models | ✅ | Advanced reasoning, multimodal |
| **OpenRouter (Recommended)** | 10+ models including DeepSeek R1, QWQ 32B | ✅ | Community models, competitive pricing |
| **Chutes (Recommended)** | DeepSeek R1, V3, ArliAI models | ✅ | Reasoning models, fast inference |
| **NVIDIA** | Llama variants, Nemotron, QWQ | ✅ | High-performance inference |
| **Hugging Face** | Llama 3.3, Mixtral, Dolphin models | ✅ | Open source models |
| **Cohere** | Command R+, Command R7B | ✅ | Enterprise-grade models |
| **Mistral** | Mistral Large, Small, Nemo | ✅ | French AI excellence |
| **Requesty** | Various community models | ✅ | Alternative access |

</details>

### 💬 Chat Features
- **Markdown Support**: Rich text formatting in messages
- **Message Actions**: Edit, delete, regenerate any message
- **Chat History**: Persistent conversation history per character
- **Import/Export Chats**: Backup or share conversations
- **Emoji Picker**: Express yourself with emojis
- **Mobile Optimized**: Seamless experience on any device

### 🎨 Customization
- **Themes**: Dark and Light themes with smooth transitions
- **Bubble Styles**: Choose between rounded, square, or other message styles
- **User Personas**: Customize how you appear to characters
- **Temperature Control**: Fine-tune AI creativity and consistency
- **Token Management**: Control context length and response size

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

### 🔧 Configuration

1. **Set up API Keys** - Click the settings gear ⚙️ and add your API keys
2. **Create Your First Character** - Click "Create Character" and fill in the details
3. **Start Chatting** - Select your character and begin your adventure!

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
<summary><strong>Memory System Settings</strong></summary>

- **Journal Frequency**: How often to create memory summaries
- **Retrieval Count**: Number of memories to recall
- **History Message Count**: Recent messages to keep in context
- **Embedding Provider**: Service for creating memory embeddings
- **Query Enrichment**: How to enhance memory queries

</details>

### 🎨 Themes and Customization

Switch between **Dark** and **Light** themes in settings. Each theme includes:
- Carefully crafted color palettes
- Smooth animations and transitions
- Glassmorphism effects
- Customizable message bubble styles

### 📱 Mobile Experience

ChunRP is fully responsive with:
- Touch-optimized interface
- Swipe gestures
- Mobile-friendly character selector
- Optimized keyboard input
- Responsive message bubbles

---

## 🛠️ Development

### 📁 Project Structure

```
ChunRP/
├── 📁 src/
│   ├── 📁 backend/
│   │   ├── 🔧 server.js           # Express server & API routes
│   │   ├── 👤 character-system.js  # Character CRUD operations
│   │   ├── 🤖 llm-providers.js     # AI provider integrations
│   │   ├── 🧠 memory-system.js     # Vector memory system
│   │   └── 📊 vectra-wrapper.js    # Vector database wrapper
│   ├── 📁 frontend/
│   │   ├── 🏠 index.html           # Main HTML structure
│   │   ├── 📁 css/
│   │   │   ├── 🎨 main.css         # Core styles
│   │   │   ├── 🌙 themes.css       # Theme definitions
│   │   │   └── 📱 mobile.css       # Mobile responsiveness
│   │   ├── 📁 js/
│   │   │   ├── ⚡ app.js           # Main application logic
│   │   │   └── 📱 mobile-ui.js     # Mobile-specific features
│   │   └── 📁 assets/              # Images and icons
│   └── ⚡ electron.js              # Desktop app entry point
├── 📁 data/
│   ├── 👥 characters/              # Character JSON files
│   ├── 💬 chat-history/            # Conversation histories
│   ├── 🧠 memory-vectra/           # Vector memory storage
│   └── ⚙️ settings.json            # User configuration
└── 📦 package.json                # Dependencies and scripts
```

### 🔨 Available Scripts

```bash
# Development
npm run dev          # Start with auto-reload
npm start           # Production server
npm run electron    # Desktop app
npm run build       # Build desktop app
npm test           # Run tests

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
       { id: "my-model-1", name: "My Model 1" }
     ]
   };
   ```

3. **Update frontend settings** to include the new provider option.

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

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Vectra** - Local vector database for memory storage
- **Express** - Web framework for the backend API
- **Electron** - Cross-platform desktop app framework
- **All AI Providers** - For making this ecosystem possible

---

<div align="center">

**Made with ❤️ for the AI roleplay community**

[⭐ Star this repo](https://github.com/chungus1310/ChunRP) | [🐛 Report Issues](https://github.com/chungus1310/ChunRP/issues) | [💬 Discussions](https://github.com/chungus1310/ChunRP/discussions)

</div>
