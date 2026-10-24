```ansi
[1;36m   _____ ____  __  ______  ____________  [1;35m__________  ___    ____________ [0m
[1;36m  / ___// __ \/ / / / __ \/ ____/ ____/ [1;35m/ ____/ __ \/   |  / ____/_  __/ [0m
[1;36m  \__ \/ / / / / / / /_/ / /   / __/   [1;35m/ /   / /_/ / /| | / /_    / /    [0m
[1;36m ___/ / /_/ / /_/ / _, _/ /___/ /___  [1;35m/ /___/ _, _/ ___ |/ __/   / /     [0m
[1;36m/____/\____/\____/_/ |_|\____/_____/  [1;35m\____/_/ |_/_/  |_/_/     /_/      [0m
```

# SourceCraft — Your Private, Local-First AI Knowledge Assistant

<p align="center">
  <strong>Turn documents, audio recordings, and meeting notes into verifiable knowledge — running 100% on your machine.</strong>
</p>

<p align="center">
  <a href="https://github.com/hoanghainh1188/source-craft/releases/latest"><img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square" alt="Platform" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License MIT" /></a>
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local--First-brightgreen?style=flat-square" alt="Local First" />
  <img src="https://img.shields.io/badge/Telemetry-Zero%20Egress-blueviolet?style=flat-square" alt="Zero Telemetry" />
  <a href="https://github.com/hoanghainh1188/source-craft/releases/latest"><img src="https://img.shields.io/github/v/release/hoanghainh1188/source-craft?style=flat-square&color=orange" alt="Release" /></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.vi.md">Tiếng Việt</a>
</p>

---

## ⚡ What is SourceCraft?

**SourceCraft** is an open-source desktop application (macOS & Windows) designed for deep document research and note synthesis with AI. Think of it as **NotebookLM**, but **without uploading a single byte to the cloud**.

Add PDFs, Word docs, web links, audio files, images, or even live microphone recordings into notebooks. SourceCraft parses, indexes, and searches them locally, answering your questions with **verifiable, highlighted citations**.

> **Built for privacy-conscious professionals:** Researchers, legal practitioners, journalists, engineers, and students dealing with sensitive notes, proprietary research, or confidential contracts that should never touch third-party servers.

---

## 🌟 Why SourceCraft?

| Feature | Cloud AI (NotebookLM / Web Chat) | **SourceCraft** |
| :--- | :--- | :--- |
| **Data Privacy** | Uploaded to remote corporate servers | 🔒 **100% on your machine; never leaves your disk** |
| **Verifiable Citations** | Frequent hallucinations, vague citations | 🎯 **Direct chip `[n]` jumps to exact text span or audio timestamp** |
| **Offline Capability** | Requires constant internet connection | ✈️ **Fully functional offline on planes, trains, or off-grid** |
| **Meeting Capture** | Upload audio to third-party APIs | 🎙️ **Live mic recording + on-device Whisper transcription** |
| **Cost & Limits** | Monthly subscriptions & token quotas | 💡 **Free forever, open-source (MIT), unlimited local usage** |
| **Model Choice** | Locked to proprietary provider | 🧩 **Use Ollama models (Qwen, Llama, Mistral) or bring your own API key** |

---

## ✨ Key Features

### 🎯 1. Verifiable Chat with Exact Citations
- **Zero Hallucination Citations:** Every single answer cites the exact passage from your sources. Click any `[n]` badge to open the source viewer with the corresponding paragraph, table row, or time interval highlighted.
- **Strict Grounded Mode:** If your documents don't contain the answer, SourceCraft says *"Not found in the sources"* instead of guessing.
- **Hybrid Retrieval:** Blends semantic vector search (LanceDB + multilingual embeddings) with full-text keyword search (SQLite FTS5) for pinpoint precision.
- **Relevance Checker:** A built-in local cross-encoder model verifies passage relevance before answering.

### 📚 2. Deep Multi-Format Knowledge Ingestion
- **Documents:** PDF (reconstructs reading order, multi-column layouts, tables, and rotated pages), `.docx`, `.txt`, `.md`.
- **Web Pages:** Clean article extraction directly from URLs via Readability.
- **Audio & Video:** `.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.mp4`, `.mov`, `.webm`, `.mkv` — transcribed locally with Whisper (auto-detects English & Vietnamese).
- **Images:** `.png`, `.jpg`, `.webp`, `.bmp`, `.tiff` — built-in OCR via Tesseract.

### 🎙️ 3. Meeting Recording & Transcription *(Experimental)*
- Record straight from your microphone into your notebook.
- Live draft transcript with timestamps and audio level indicators while recording.
- Quick markers during the meeting: **Decision**, **Action Item**, **Question** (`⌘/Ctrl+M`).
- Post-meeting viewer: click any sentence to seek audio playback, search transcripts, and export to Markdown.
- Crash recovery protection: interrupted recordings can be cleanly recovered on relaunch.

### 💡 4. AI Studio — 8 Synthesis Artifacts
Transform your collection of sources into structured deliverables with one click:
- 📝 **Summary** & 📌 **Key Points**
- ❓ **FAQ** & 📖 **Study Guide**
- 🗂️ **Detailed Outline** & ⏱️ **Chronological Timeline**
- 👔 **Executive Briefing** & 📖 **Glossary**
- ✍️ **Custom Request:** Type any custom prompt (up to 500 characters) scoped to specific sources.
- Keeps version history for the last 10 generations with export to Markdown.

### 🔒 5. Privacy, Local Sovereignty & Encrypted Backup
- **Zero Telemetry:** No tracking, analytics, or background telemetry.
- **Optional Online AI:** Want extra horsepower? Connect Claude, Gemini, or OpenAI using your personal API keys (securely stored in your OS Keychain). A visual privacy badge alerts you whenever data is sent externally.
- **Portable Backups:** Export and restore your complete workspace into an encrypted `.ivbackup` file (AES-256-GCM).

### 🌐 6. Native Bilingual Support
- Clean UI available in **English** and **Tiếng Việt** (switches instantly in Settings).
- AI automatically answers in the language of your prompt.

---

## 🚀 Quick Start & Installation

### Step 1: Download SourceCraft
Grab the latest pre-built package for your operating system from [Releases](https://github.com/hoanghainh1188/source-craft/releases/latest):

- **macOS (Apple Silicon):** `SourceCraft-<version>-arm64.dmg`
- **Windows (x64):** `SourceCraft-<version>-Setup.exe`

> [!NOTE]
> **First Launch Notice:** Builds are currently unsigned.
> - **macOS:** Right-click the app in `/Applications` $\rightarrow$ choose **Open**, or run:
>   ```bash
>   xattr -dr com.apple.quarantine /Applications/SourceCraft.app
>   ```
> - **Windows:** If SmartScreen appears, click **More info** $\rightarrow$ **Run anyway**.

### Step 2: Install Ollama (Local AI Engine)
1. Download and install [Ollama](https://ollama.com).
2. Pull your preferred chat model (e.g. Qwen 2.5 7B or Llama 3.1 8B):
   ```bash
   ollama pull qwen2.5:7b
   ```
*(Embedding, ASR, OCR, and reranker models download automatically inside the app on first use).*

### Step 3: Start Crafting Knowledge
Open SourceCraft, create your first notebook, drop in files, and ask your first question!

---

## 👥 Who is SourceCraft for?

- 🔬 **Researchers & Academics:** Query hundreds of research papers, compare methodologies, and cross-reference exact page citations.
- ⚖️ **Legal Practitioners:** Analyze contracts, depositions, and case laws under strict confidentiality requirements.
- 💼 **Executives & Product Managers:** Keep meeting minutes, transcribe recordings, and generate executive summaries with verifiable takeaways.
- 📰 **Journalists & Writers:** Investigate leaked documents, conduct interviews, and fact-check source material offline.
- 🎓 **Students:** Turn lecture slides, textbooks, and audio recordings into personalized study guides and FAQs.

---

## 🛠️ For Developers

### Tech Stack
- **Desktop Shell:** Electron + electron-vite
- **Frontend:** React 18, TypeScript, Vite, Zustand, TanStack Query
- **Local Database & FTS:** SQLite (FTS5) in main process
- **Vector Database:** LanceDB (embedded serverless vector store)
- **Local AI Pipelines:** `@huggingface/transformers` (multilingual-e5-small, Whisper) + `tesseract.js` + Ollama
- **Audio/Video Extraction:** Custom LGPL-compliant FFmpeg build

### Development Setup
```bash
# Clone the repository
git clone git@github.com:hoanghainh1188/source-craft.git
cd source-craft

# Install dependencies
npm install

# Start development mode with hot-reload
npm run dev

# Run test suites (Vitest unit + Playwright e2e)
npm test
npm run test:e2e

# Build production artifacts
npm run build
npm run dist
```

---

## ⚠️ Known Limitations

- **Near-topic queries without answers:** If a question is close to a document's topic (e.g., asking about elevators in a railway document), the relevance checker may occasionally pass the passage. The chat model usually rejects it with *"Not found in the sources"* (see issue [#187](https://github.com/hoanghainh1188/source-craft/issues/187)).
- **Complex PDF infoboxes:** Merged text across complex Wikipedia-style infoboxes or multi-cell tables can occasionally lead to incomplete extraction ([#206](https://github.com/hoanghainh1188/source-craft/issues/206)).
- **Experimental Windows Microphone Capture:** Microphone testing on Windows with Bluetooth headsets is ongoing ([#186](https://github.com/hoanghainh1188/source-craft/issues/186)).

---

## 🤝 Contributing & Community

Contributions, bug reports, and feature requests are welcome!
- Check out our [Contributing Guidelines](CONTRIBUTING.md).
- Open an issue or join discussions on [GitHub Issues](https://github.com/hoanghainh1188/source-craft/issues).
- Issues and PRs are accepted in both **English** and **Tiếng Việt**.

---

## 📄 License

- SourceCraft is open-source under the [MIT License](LICENSE).
- Third-party dependency notices and license attributions are detailed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
