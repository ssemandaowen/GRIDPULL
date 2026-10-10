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

---

## ✨ Key Features

- 🖥️ **Dual Interface Modes**:
  - **Interactive TUI**: Keyboard-driven React Ink dashboard with live telemetry meters, individual/bulk queue management (pause, resume, stop, remove), and settings control.
  - **Direct CLI Subcommands**: Instant single-line execution for search, stream inspection, audio extraction, clipping, batch processing, and configuration.
- 🌐 **Global Executable**: Installs directly into your system `$PATH` as a global `gridpull` command.
- ⚙️ **Simple Configuration**: Easy settings management via direct CLI commands (`gridpull config set <key> <value>`) or via the interactive TUI.
- ⚡ **Single-Pass Manifest Probing**: Instantly inspect stream manifests and resolve combined video/audio file size estimates upfront.
- 🎯 **Universal Quality Profiles**: Simple quality selectors like `1080p_mp4`, `720p_mp4`, `mp3_320`, `flac`, and `best_available`.
- ✂️ **Precision Stream Slicing (`clip`)**: Extract exact time ranges (e.g. `*00:01:00-00:02:30`) directly from remote streams.
- 🎵 **High-Fidelity Audio Extraction (`audio`)**: Extract and transcode audio to MP3 (up to 320 kbps), FLAC (lossless), M4A, Opus, or WAV with ID3 tagging.
- 📦 **Batch Downloader (`-b, --batch`)**: Process lists of URLs from text files with concurrent job scheduling, comment/blank line filtering, and exit code reporting (exit 1 on failures, 0 on success).
- 🔍 **Multi-Source Catalog Search (`search`)**: Search YouTube, SoundCloud, Bandcamp, Bilibili, and Deezer directly from your terminal.
- 🖼️ **Media Extraction Tools**: Subcommands for high-resolution thumbnail artwork (`thumb`) and closed captions / subtitles (`subs`).
- 🩺 **Environment Health Diagnostics (`deps`)**: Built-in verification for Node.js, Python 3, `yt-dlp`, and FFmpeg.

---

## 📋 System Requirements & Environment

GridPull relies on standard media utilities:

| Component | Minimum Version | Required For |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` | Core TUI runtime and queue orchestrator |
| **Python 3** | `>= 3.8` | `yt-dlp` stream extraction engine |
| **yt-dlp** | Auto-managed | Stream manifest probing and network fetch |
| **FFmpeg** | Recommended | Stream merging and audio format transcoding |

### Environment Overrides

- `GRIDPULL_PYTHON`: Custom path to Python 3 interpreter (e.g. `GRIDPULL_PYTHON=/usr/bin/python3.11`).
- `GRIDPULL_INSECURE_TLS`: Set to `1` to disable SSL certificate verification for network requests (`--no-check-certificates`).

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
| `P` | Pause selected download task or active queue |
| `S` | Resume selected download task or active queue |
| `K` | Stop/Kill selected download task or active queue |
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

# Download specific quality profile with custom threads (-t)
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f 1080p_mp4 -t 12 -o ~/Videos

# Force re-download even if URL was previously completed
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --force

# Batch process URLs from a text file (ignores blank lines and # comments)
gridpull -b urls.txt -t 8 -o ~/Downloads/Batch
```

#### Multi-Source Catalog Search (`search`)

```bash
# Search YouTube (default)
gridpull search "lofi hip hop beats"

# Search SoundCloud or Bandcamp with page navigation
gridpull search "synthwave mix" --source soundcloud --page 2
```

#### High-Fidelity Audio Extraction (`audio`)

```bash
# Extract MP3 audio at 320 kbps with custom thread count (-t)
gridpull audio "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f mp3 -q 320K -t 8

# Extract FLAC lossless audio
gridpull audio "https://soundcloud.com/artist/track" -f flac
```

#### Precision Time Slicing (`clip`)

```bash
# Trim exact segment without downloading full video
gridpull clip "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --section "*00:01:00-00:02:30"
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
gridpull config set parallelThreads 12
gridpull config set diskSpaceHeadroomMB 1000
gridpull config set retryMaxAttempts 5
gridpull config set retryBackoffMs 2000

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
| `diskSpaceHeadroomMB` | `number` | `500` | Minimum required disk space headroom in MB |
| `retryMaxAttempts` | `number` | `3` | Retry attempt limit for transient errors |
| `retryBackoffMs` | `number` | `4000` | Exponential backoff delay base in milliseconds |
| `autoStartOnQueue` | `boolean` | `true` | Automatically start workers when jobs are enqueued |

---

## 🛠️ Diagnostics & Troubleshooting

Run diagnostic checks anytime to verify system state:

```bash
gridpull deps
```

---

## 📄 License

Distributed under the **MIT License**.
