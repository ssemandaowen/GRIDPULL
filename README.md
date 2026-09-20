# GridPull CLI v4.0.0

High-performance native terminal media stream processor and downloader.

## Quick Start (Windows / macOS / Linux)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Launch Interactive Terminal UI
Run directly using any of the following:
```powershell
npx gridpull
```
or:
```powershell
npm run cli
```

---

## Windows Installation (PowerShell & CMD)

To configure `gridpull` as a global system command in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

This will:
- Check Node.js (v18+), Python 3, and FFmpeg
- Create native command wrappers (`bin\gridpull.cmd` and `bin\gridpull.ps1`)
- Add the `bin` directory to your User `PATH`
- Add the `gridpull` function to your `$PROFILE` so you can simply type `gridpull` from any directory

---

## Unix / macOS / Linux / WSL Installation

```bash
bash install.sh
```
or:
```bash
npm run setup
```

---

## Command Line Usage

```bash
# Interactive TUI
gridpull

# Direct Download
gridpull https://youtu.be/EXAMPLE -f 1080p_mp4 -o ./downloads

# Extract High-Fidelity Audio
gridpull audio https://youtu.be/EXAMPLE -f mp3 -b 320k

# Multi-Source Catalog Search
gridpull search "query terms"

# Check Operational Dependencies
gridpull deps
```
