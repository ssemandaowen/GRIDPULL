# ⚡ GridPull CLI

> **High-performance native terminal media stream processor, multi-source catalog search engine, and universal downloader.**

[![Version](https://img.shields.io/badge/version-4.1.0-blue.svg?style=flat-square)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React Ink](https://img.shields.io/badge/TUI-React%20Ink%20v7-black.svg?style=flat-square)](https://github.com/vadimdemedes/ink)
[![Python](https://img.shields.io/badge/Engine-Python%203%20%2F%20yt--dlp-yellow.svg?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20WSL-lightgrey.svg?style=flat-square)](#installation)

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

**GridPull** is a developer-first terminal media toolkit. It blends an interactive **React Ink Terminal User Interface (TUI)** with an automated, scriptable **Command Line Interface (CLI)**. Powered by a high-throughput multi-threaded engine using Node.js, TypeScript, Python 3, `yt-dlp`, and FFmpeg, GridPull delivers instant format negotiation, lossless audio conversion, lossless stream slicing, and concurrent batch processing.

Whether running as an interactive dashboard or integrated into automated shell scripts and CI/CD pipelines, GridPull provides reliable, error-resilient media processing across **YouTube, SoundCloud, Bandcamp, Bilibili, Archive.org, and 1,000+ supported platforms**.

---

## ✨ Key Features

- 🖥️ **Interactive Terminal UI (React Ink)**: Full-featured curses-style terminal dashboard with live telemetry meters, smooth keyboard navigation, and zero flickering.
- ⚡ **Single-Pass Manifest Probing**: Unified inspection that queries stream manifests and resolves human-readable quality tiers in a single fast pass.
- 🎯 **Universal Quality Tiers**: Eliminates cryptic format codes with clean semantic selectors like `1080p_mp4`, `720p_mp4`, `mp3_320`, `flac`, and `best_available`.
- ✂️ **Precision Stream Slicing (`clip`)**: Download exact time ranges (e.g., `*00:01:00-00:02:30`) directly from the remote stream without downloading the full video.
- 🎵 **High-Fidelity Audio Extraction (`audio`)**: Extract and transcode audio to MP3 (up to 320 kbps), FLAC (lossless), M4A, Opus, or WAV with automatic ID3 tagging and embedded artwork.
- 📦 **Batch Downloader (`-b, --batch`)**: Process lists of URLs from text files or terminal input with concurrent job scheduling, backoff retry logic, and real-time queue metrics.
- 🔍 **Multi-Source Catalog Search (`search`)**: Query YouTube, SoundCloud, Bandcamp, Bilibili, and Deezer directly from your terminal with paginated results.
- 🖼️ **Media Extraction Tools**: Dedicated subcommands for extracting original high-resolution poster artwork (`thumb`) and closed captions / subtitle tracks (`subs`).
- 🩺 **Environment Health Diagnostics (`deps`)**: Built-in verification for Node.js, Python 3, `yt-dlp`, and FFmpeg with actionable remediation hints.
- 💾 **Local Audit History & Config**: Built-in SQLite/JSON history logging and persistent configuration management (`~/.gridpull/`).

---

## 📋 System Requirements

GridPull relies on standard, battle-tested open-source media utilities:

| Dependency | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` | CLI runner & React Ink terminal interface |
| **Python** | `>= 3.8.0` | Host runtime for the extraction backend |
| **yt-dlp** | `latest recommended` | Underlying extractor engine |
| **FFmpeg** | `>= 4.4.0` | Stream muxing, audio transcoding & slicing |

### Installing Prerequisites

#### macOS (Homebrew)
```bash
brew install node python ffmpeg yt-dlp
```

#### Ubuntu / Debian / WSL
```bash
sudo apt update && sudo apt install -y nodejs npm python3 python3-pip ffmpeg
pip3 install yt-dlp
```

#### Windows (Winget or Chocolatey)
```powershell
# Using Windows Package Manager (Winget)
winget install OpenJS.NodeJS Python.Python.3 Gyan.FFmpeg yt-dlp.yt-dlp

# Or using Chocolatey
choco install nodejs python ffmpeg yt-dlp
```

---

## 🚀 Installation

### Option 1: Automated Script Setup (Recommended)

#### Windows (PowerShell)
Run the automated Windows installer to configure native wrappers and system `PATH`:
```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

#### Linux / macOS / WSL
Run the POSIX installer script:
```bash
bash install.sh
```

### Option 2: Clone and Setup via npm
```bash
git clone https://github.com/ssemandaowen245/gridpull-cli.git
cd gridpull-cli
npm install
npm run build
npm link
```

Verify that the CLI is accessible globally:
```bash
gridpull --version
gridpull deps
```

---

## 🎮 Interactive Terminal UI (TUI)

Launch the full-screen terminal experience:
```bash
gridpull
```
*(or explicitly: `gridpull tui`)*

```
================================================================================
  GRIDPULL CLI v4.1.0 — ACTIVE WORKSPACE [SINGLE STREAM PULLER]
================================================================================
  [1] Single Stream    [2] Batch Queue    [3] Search Catalog
  [4] Active Queue     [5] Audit History  [6] Diagnostics & Config
--------------------------------------------------------------------------------
  Target URL: https://archive.org/details/BigBuckBunny_124
  Title:      Big Buck Bunny (09:56)
  Uploader:   Blender Foundation

  Select Format Tier:
  ❯ [1080p_mp4]      MP4   1920x1080  ~116.7 MB   Standard Full HD crisp visual fidelity
    [720p_mp4]       MP4   1280x720   ~65.8 MB    High definition balanced stream
    [mp3_320]        MP3   320 kbps   ~8.0 MB     Studio grade audio with album art
    [best_available] Auto  Highest    ~116.7 MB   Highest resolution stream manifest
--------------------------------------------------------------------------------
  [Enter] Confirm & Enqueue   [Esc] Reset Input   [Ctrl+C] Exit
================================================================================
```

### Keyboard Navigation in TUI
| Key | Action |
| :--- | :--- |
| `1` – `6` | Quick-switch between workspace modules |
| `Tab` / `Shift+Tab` | Cycle focus between inputs and format lists |
| `↑` / `↓` | Navigate format tiers, history records, or search results |
| `Enter` | Confirm selection, execute search, or start download |
| `Esc` | Step backward or cancel current input |
| `Ctrl+C` | Prompt confirmation to safely exit |

---

## 💻 Command Line Interface (CLI)

GridPull offers a direct command line interface designed for speed, scripting, and shell integration.

### 1. Direct Video Download
Download any video stream directly with auto-selected or specified format:
```bash
# Download highest available resolution
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Specify a target format tier and output folder
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f 1080p_mp4 -o ~/Downloads/Videos

# Allocate 16 concurrent connection threads for maximum speed
gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f 1080p_mp4 -t 16
```

### 2. Multi-Item Batch Ingestion
Process a text file containing one URL per line:
```bash
# Download an entire batch using the 1080p preset
gridpull -b urls.txt -f 1080p_mp4 -o ./batch_output

# Batch download as high-fidelity MP3
gridpull -b urls.txt -f mp3_320 -o ./music
```

### 3. Audio Extraction & Transcoding (`audio`)
Extract and transcode audio to your preferred format and bitrate:
```bash
# Extract 320kbps MP3 (default)
gridpull audio "https://soundcloud.com/artist/track" -q 320K

# Extract lossless FLAC
gridpull audio "https://bandcamp.com/track/example" -f flac -o ~/Music

# Extract compact Opus audio
gridpull audio "https://www.youtube.com/watch?v=example" -f opus -q 160K
```

### 4. Precision Stream Trimming (`clip`)
Download a precise segment without downloading the entire file:
```bash
# Cut a 1-minute clip from 00:01:30 to 00:02:30
gridpull clip "https://www.youtube.com/watch?v=example" -s "*00:01:30-00:02:30" -o ./clips
```

### 5. Multi-Source Search (`search`)
Search streaming platforms directly from the command line:
```bash
# Search YouTube (default)
gridpull search "synthwave live radio"

# Search SoundCloud with 20 results
gridpull search "lo-fi beats" -s soundcloud -c 20

# Search Bandcamp and view page 2
gridpull search "ambient electronic" -s bandcamp --page 2
```
*Supported search sources: `youtube`, `soundcloud`, `bandcamp`, `bilibili`, `deezer`.*

### 6. Inspect Manifest & Format Tiers (`formats`)
Inspect raw stream manifests alongside GridPull's resolved semantic tiers:
```bash
gridpull formats "https://archive.org/details/BigBuckBunny_124"
```

### 7. Extract Artwork & Subtitles (`thumb`, `subs`)
```bash
# Download original high-resolution video thumbnail / cover art
gridpull thumb "https://www.youtube.com/watch?v=example" -o ./art

# Download subtitles as clean .srt
gridpull subs "https://www.youtube.com/watch?v=example" --lang en -o ./subs
```

### 8. System Diagnostics & History
```bash
# Run binary health check
gridpull deps

# View download audit history
gridpull history --limit 15

# Reset configuration to factory defaults
gridpull --reset-config
```

---

## 🎛️ Universal Format Tier Reference

GridPull abstracts complex stream IDs into standardized semantic format tiers:

| Tier Identifier | Container | Default Resolution / Quality | Description |
| :--- | :--- | :--- | :--- |
| `2160p_mp4` | `.mp4` | 3840x2160 (4K UHD) | Ultra high definition 60fps presentation |
| `1440p_mp4` | `.mp4` | 2560x1440 (2K QHD) | High-bitrate presentation for 1440p displays |
| `1080p_mp4` | `.mp4` | 1920x1080 (Full HD) | Standard crisp 1080p visual fidelity |
| `720p_mp4` | `.mp4` | 1280x720 (HD) | Balanced high definition for fast download |
| `480p_mp4` | `.mp4` | 854x480 (SD) | Standard definition with low bandwidth |
| `360p_mp4` | `.mp4` | 640x360 (Mobile) | Minimal bandwidth for storage conservation |
| `best_available` | Auto | Highest Available | Highest resolution stream manifest available |
| `mp3_320` | `.mp3` | 320 kbps CBR | Studio-grade audio with ID3 metadata |
| `mp3_192` | `.mp3` | 192 kbps VBR | Balanced MP3 transcode for mobile listening |
| `m4a` | `.m4a` | 256 kbps AAC | Native stream extraction without lossy re-encoding |
| `flac` | `.flac` | Bit-perfect Lossless | Lossless PCM preservation |
| `opus` | `.opus` | 160 kbps VBR | Modern open audio format with high acoustic fidelity |
| `thumbnail` | `.jpg` | Max Resolution | Video poster / album cover art |
| `subtitles` | `.srt` | Plain Text | Closed captions / subtitles converted to `.srt` |

*You can also pass raw format codes (e.g. `-f "137+140"` or `-f "bestvideo+bestaudio"`) at any time.*

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              GRIDPULL CLI                              │
├──────────────────────────────────┬─────────────────────────────────────┤
│     Interactive TUI (React Ink)  │       Headless CLI (Commander)      │
│  - Live Telemetry & Progress     │  - Scriptable flag parser           │
│  - Interactive Format Picker     │  - Direct piping & batch automation │
│  - Multi-tab navigation          │  - Subcommands: audio, clip, search │
├──────────────────────────────────┴─────────────────────────────────────┤
│                          CORE SUBSYSTEMS                               │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │     QueueManager      │  │   UrlInspector  │  │ FormatResolver   │  │
│  │  - Concurrency Pool   │  │  - Single Probe │  │  - Bitrate Math  │  │
│  │  - Pause / Cancel     │  │  - Search API   │  │  - Tier Mapping  │  │
│  │  - Retry & Backoff    │  │  - JSON Parse   │  │  - Raw Fallback  │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                          EXECUTION ENGINE                              │
│         Python Bridge (`python/yt_engine.py`) ──▶ yt-dlp & FFmpeg      │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19 + Ink 7 terminal layout engine with responsive terminal width calculations.
- **Controller**: TypeScript core with strict typing and EventEmitter-driven telemetry.
- **Subprocess Engine**: Caching resolver for Python 3, `yt-dlp`, and FFmpeg with zero-overhead execution.
- **Persistence**: File-based configuration (`ConfigStore`) and execution audit repository (`HistoryRepository`).

---

## 🛠️ Development & Building

```bash
# 1. Clone repository
git clone https://github.com/ssemandaowen245/gridpull-cli.git
cd gridpull-cli

# 2. Install development dependencies
npm install

# 3. Start local development server / live reloader
npm run dev

# 4. Typecheck and lint codebase
npm run lint

# 5. Build production bundles
npm run build

# 6. Test CLI bundle locally
node bin/gridpull.js --help
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feature/awesome-feature
   ```
2. Commit your changes following standard conventional commit conventions:
   ```bash
   git commit -m "feat(parser): add support for custom format selectors"
   ```
3. Ensure the project builds cleanly without TypeScript or linter errors:
   ```bash
   npm run lint && npm run build
   ```
4. Push your branch and open a Pull Request.

---

## ⚖️ License & Disclaimer

- **License**: Released under the permissive **[MIT License](LICENSE)**.
- **Disclaimer**: GridPull is an open-source stream processing utility developed for legitimate archival, fair use, educational research, and personal media backup. Users are responsible for adhering to the terms of service of the content providers and local copyright regulations.

---

<p align="center">
  Built with precision using <b>TypeScript</b>, <b>React Ink</b>, <b>Python</b>, <b>yt-dlp</b>, and <b>FFmpeg</b>.
</p>

