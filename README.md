# ⚡ GridPull CLI

> **Native high-performance terminal media downloader, catalog search engine, and stream processing toolkit.**

[![Version](https://img.shields.io/badge/version-4.1.0-blue.svg?style=flat-square)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React Ink](https://img.shields.io/badge/TUI-React%20Ink%20v7-black.svg?style=flat-square)](https://github.com/vadimdemedes/ink)
[![Python](https://img.shields.io/badge/Engine-Python%203%20%2F%20yt--dlp-yellow.svg?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

```
  ██████╗ ██████╗ ██╗██████╗ ██████╗ ██╗   ██╗██╗     ██╗     
 ██╔════╝ ██╔══██╗██║██╔══██╗██╔══██╗██║   ██║██║     ██║     
 ██║  ███╗██████╔╝██║██║  ██║██████╔╝██║   ██║██║     ██║     
 ██║   ██║██╔══██╗██║██║  ██║██╔═══╝ ██║   ██║██║     ██║     
 ╚██████╔╝██║  ██║██║██████╔╝██║     ╚██████╔╝███████╗███████╗
  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝      ╚═════╝ ╚══════╝╚══════╝
```

---

## 📖 Overview

**GridPull CLI** is a developer-first terminal media toolkit. It seamlessly combines an interactive **React Ink Terminal User Interface (TUI)** with a robust, scriptable **Command Line Interface (CLI)**. Powered by Node.js, TypeScript, Python 3, `yt-dlp`, and FFmpeg, GridPull delivers instant format negotiation, lossless audio conversion, precision stream slicing, and concurrent batch processing across **YouTube, SoundCloud, Bandcamp, Bilibili, Archive.org, and 1,000+ supported platforms**.

Whether running interactively as a live terminal dashboard or invoked via standard shell commands in automation pipelines, GridPull provides an intuitive experience with global executable support and transparent system diagnostic logging.

---

## ✨ Key Features

- 🖥️ **Dual Interface Modes**:
  - **Interactive TUI**: Keyboard-driven React Ink dashboard with live telemetry meters, queue management, and settings control.
  - **Direct CLI Subcommands**: Instant single-line execution for search, stream inspection, audio extraction, clipping, batch processing, and configuration.
- 🌐 **Global Executable**: Installs directly into your system `$PATH` as a global `gridpull` command without depending on `npx`.
- ⚙️ **Simple Configuration**: Easy settings management via direct CLI commands (`gridpull config set <key> <value>`) or via the interactive TUI.
- ⚡ **Single-Pass Manifest Probing**: Instantly inspect stream manifests and resolve combined video/audio file size estimates upfront.
- 🎯 **Universal Quality Profiles**: Simple quality selectors like `1080p_mp4`, `720p_mp4`, `mp3_320`, `flac`, and `best_available`.
- ✂️ **Precision Stream Slicing (`clip`)**: Extract exact time ranges (e.g. `*00:01:00-00:02:30`) directly from remote streams.
- 🎵 **High-Fidelity Audio Extraction (`audio`)**: Extract and transcode audio to MP3 (up to 320 kbps), FLAC (lossless), M4A, Opus, or WAV with ID3 tagging.
- 📦 **Batch Downloader (`-b, --batch`)**: Process lists of URLs from text files with concurrent job scheduling and worker pool management.
- 🔍 **Multi-Source Catalog Search (`search`)**: Search YouTube, SoundCloud, Bandcamp, Bilibili, and Deezer directly from your terminal.
- 🖼️ **Media Extraction Tools**: Subcommands for high-resolution thumbnail artwork (`thumb`) and closed captions / subtitles (`subs`).
- 🩺 **Environment Health Diagnostics (`deps`)**: Built-in verification for Node.js, Python 3, `yt-dlp`, and FFmpeg.

---

## 📋 System Requirements

GridPull relies on standard media utilities:

| Component | Minimum Version | Required For |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` | Core TUI runtime and queue orchestrator |
| **Python 3** | `>= 3.8` | `yt-dlp` stream extraction engine |
| **yt-dlp** | Auto-managed | Stream manifest probing and network fetch |
| **FFmpeg** | Recommended | Stream merging and audio format transcoding |

---

## 🚀 Installation & First-Boot Setup

### Global Installation (Recommended)

To install GridPull as a global command accessible from any terminal window:

```bash
# Clone the repository
git clone https://github.com/ssemandaowen/GRIDPULL.git
cd GRIDPULL

# Install package globally
npm install -g .
```

The installer automatically verifies dependencies, downloads the managed `yt-dlp` stream engine, compiles the production bundle, and symlinks `gridpull` directly into your system `$PATH`.

### Local Development Setup

If you prefer installing locally without global system linking:

```bash
# Install dependencies and build
npm install
npm run setup

# Run via local executable
./bin/gridpull
```

---

## 💡 Usage Guide

### 1. Interactive Terminal UI (TUI)

Launch the full interactive terminal interface by running `gridpull` without arguments:

```bash
gridpull
```

#### TUI Keyboard Navigation

| Key | Action |
| :--- | :--- |
| `1` – `6` | Jump between views (Main Menu, Puller, Search, Downloads, Settings, Help) |
| `↑` / `↓` | Navigate items and selection options |
| `Enter` | Confirm selection, submit query, or start task |
| `P` | Pause / Resume active download queue |
| `X` | Remove selected item from queue or history |
| `R` | Retry failed downloads |
| `C` | Clear completed download history |
| `Esc` | Return to Main Menu or dismiss dialog |

---

### 2. Command Line Interface (CLI)

GridPull offers clean direct subcommands for scriptable shell usage:

#### Stream Extraction & Downloading

```bash
# Direct stream download using default profile
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Download specific quality profile
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f 1080p_mp4 -o ~/Videos

# Batch process URLs from a text file
gridpull -b urls.txt -o ~/Downloads/Batch
```

#### Multi-Source Catalog Search (`search`)

```bash
# Search YouTube (default)
gridpull search "lofi hip hop beats"

# Search SoundCloud or Bandcamp with page navigation
gridpull search "synthwave mix" --source soundcloud --page 2
```

#### Stream Formats & Upfront Sizing (`formats`)

```bash
# Query available raw streams and estimated combined file sizes
gridpull formats "https://archive.org/details/BigBuckBunny_124"
```

#### High-Fidelity Audio Extraction (`audio`)

```bash
# Extract MP3 audio at 320 kbps
gridpull audio "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f mp3 -q 320K

# Extract FLAC lossless audio
gridpull audio "https://soundcloud.com/artist/track" -f flac
```

#### Precision Time Slicing (`clip`)

```bash
# Trim exact segment without downloading full video
gridpull clip "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --section "*00:01:00-00:02:30"
```

#### Metadata Tools (`thumb`, `subs`)

```bash
# Download high-resolution poster thumbnail
gridpull thumb "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Download English subtitles (.srt)
gridpull subs "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --lang en
```

#### System Diagnostics (`deps`) & History (`history`)

```bash
# Verify system runtimes and binary dependencies
gridpull deps

# View recent download audit records
gridpull history --limit 15
```

---

## ⚙️ Configuration Management

GridPull stores persistent user settings in `~/.config/gridpull-cli/config.json`. You can easily view and modify settings either through the TUI Settings view or using direct CLI commands:

### CLI Configuration Commands

```bash
# Display all configuration settings and current values
gridpull config

# View a specific setting
gridpull config get downloadDir

# Update configuration settings
gridpull config set maxConcurrency 4
gridpull config set defaultFormat 1080p_mp4
gridpull config set subfoldersEnabled true
gridpull config set audioBitrate 320K

# Reset all settings to defaults
gridpull config reset
```

### Available Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `downloadDir` | `string` | `~/Downloads/GridPull` | Base directory for completed downloads |
| `subfoldersEnabled` | `boolean` | `true` | Route files into `audio/` and `videos/` subfolders |
| `maxConcurrency` | `number` | `2` | Maximum concurrent worker downloads |
| `parallelThreads` | `number` | `8` | Segmented parallel network connections (`-N`) |
| `defaultFormat` | `string` | `1080p_mp4` | Default video resolution profile |
| `defaultAudioFormat` | `string` | `mp3` | Default standalone audio format |
| `audioBitrate` | `string` | `320K` | Default audio extraction bitrate |
| `autoStartOnQueue` | `boolean` | `true` | Automatically start workers when jobs are enqueued |

---

## 🛠️ Diagnostics & Troubleshooting

Run diagnostic checks anytime to verify system state:

```bash
gridpull deps
```

Expected diagnostic output:

```
🩺 GridPull System Binary Diagnostics:
----------------------------------------------------
  ✔ Node.js     : v22.22.1
  ✔ Python3     : Python 3.12.13
  ✔ yt-dlp      : 2025.02.19
  ✔ FFmpeg      : ffmpeg version 6.1.1
```

If `FFmpeg` is missing:
- **macOS**: `brew install ffmpeg`
- **Ubuntu / Debian**: `sudo apt update && sudo apt install -y ffmpeg`
- **Arch Linux**: `sudo pacman -S ffmpeg`
- **Windows**: `winget install FFmpeg` or `choco install ffmpeg`

---



---

## 🐙 Publishing & Pushing to GitHub

To update or publish your repository to GitHub:

```bash
# 1. Initialize local Git repository (if needed)
git init

# 2. Stage all files (respecting .gitignore)
git add .

# 3. Create release commit
git commit -m "feat: GridPull CLI - high-performance terminal media engine"

# 4. Set primary branch to main
git branch -M main

# 5. Link to your remote GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/GRIDPULL.git

# 6. Push code to GitHub
git upload / push origin main
```

## 📄 License

Distributed under the **MIT License**.
