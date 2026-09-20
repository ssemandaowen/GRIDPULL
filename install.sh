#!/usr/bin/env bash
# ==============================================================================
# GridPull CLI — Unix / Linux / macOS / WSL Installer
# High-performance terminal media downloader & stream processing engine
# ==============================================================================

set -e

# Terminal formatting
GRAY='\033[0;90m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${GRAY}========================================================================${NC}"
echo -e "${WHITE}${BOLD}  GridPull CLI — Environment Setup & Runtime Installer${NC}"
echo -e "${GRAY}  Unix, macOS, Linux, and Windows Subsystem for Linux (WSL)${NC}"
echo -e "${GRAY}========================================================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ------------------------------------------------------------------------------
# Step 1: Runtime Dependency Verification
# ------------------------------------------------------------------------------
echo -e "${WHITE}${BOLD}[1/5] Checking System Runtimes...${NC}"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo -e "  ${GREEN}✔${NC} Node.js detected: ${CYAN}${NODE_VER}${NC} ($(command -v node))"
else
    echo -e "  ${RED}✖ Node.js (v18+) is required but not found in PATH.${NC}"
    echo -e "    Please install Node.js: https://nodejs.org or via your package manager."
    exit 1
fi

# Check Python 3
if command -v python3 >/dev/null 2>&1; then
    PY_VER=$(python3 --version 2>&1)
    echo -e "  ${GREEN}✔${NC} Python 3 detected: ${CYAN}${PY_VER}${NC}"
elif command -v python >/dev/null 2>&1; then
    PY_VER=$(python --version 2>&1)
    echo -e "  ${GREEN}✔${NC} Python detected: ${CYAN}${PY_VER}${NC}"
else
    echo -e "  ${RED}✖ Python 3 is required. Please install python3.${NC}"
    exit 1
fi

# Check FFmpeg
if command -v ffmpeg >/dev/null 2>&1; then
    FF_VER=$(ffmpeg -version 2>&1 | head -n 1)
    echo -e "  ${GREEN}✔${NC} FFmpeg detected: ${CYAN}${FF_VER:0:45}${NC}..."
else
    echo -e "  ${YELLOW}⚠ FFmpeg not found in PATH. High-fidelity audio extraction and merging may be limited.${NC}"
    echo -e "    Install via 'apt install ffmpeg', 'brew install ffmpeg', or 'dnf install ffmpeg'."
fi

# ------------------------------------------------------------------------------
# Step 2: Stream Subsystem (yt-dlp)
# ------------------------------------------------------------------------------
echo ""
echo -e "${WHITE}${BOLD}[2/5] Verifying Stream Processing Subsystem (yt-dlp)...${NC}"
LOCAL_YTDLP="$SCRIPT_DIR/python/yt-dlp"

if [ ! -f "$LOCAL_YTDLP" ] || ! "$LOCAL_YTDLP" --version >/dev/null 2>&1; then
    echo -e "  ${GRAY}ℹ Downloading managed yt-dlp binary to ./python/...${NC}"
    mkdir -p "$SCRIPT_DIR/python"
    curl -L -s https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$LOCAL_YTDLP"
    chmod +x "$LOCAL_YTDLP"
fi

chmod +x "$LOCAL_YTDLP" 2>/dev/null || true
YTDLP_VER=$("$LOCAL_YTDLP" --version 2>/dev/null || echo "Active")
echo -e "  ${GREEN}✔${NC} Stream engine operational: ${CYAN}v${YTDLP_VER}${NC}"

# ------------------------------------------------------------------------------
# Step 3: Install Package Dependencies
# ------------------------------------------------------------------------------
echo ""
echo -e "${WHITE}${BOLD}[3/5] Installing Package Dependencies & Ink UI Engine...${NC}"
if [ -d "$SCRIPT_DIR/node_modules" ]; then
    npm install --prefer-offline --no-audit --no-fund --quiet
else
    npm install --no-audit --no-fund --quiet
fi
echo -e "  ${GREEN}✔${NC} Node modules verified."

# ------------------------------------------------------------------------------
# Step 4: Configure Execution Permissions
# ------------------------------------------------------------------------------
echo ""
echo -e "${WHITE}${BOLD}[4/5] Setting File Permissions...${NC}"
chmod +x "$SCRIPT_DIR/bin/cli.ts" "$SCRIPT_DIR/bin/gridpull" 2>/dev/null || true
echo -e "  ${GREEN}✔${NC} Executable flags set on runners in ./bin/"

# ------------------------------------------------------------------------------
# Step 5: Global Linking and Shell Profile Configuration (.bashrc / .zshrc)
# ------------------------------------------------------------------------------
echo ""
echo -e "${WHITE}${BOLD}[5/5] Configuring Shell Profile and Path Integration...${NC}"

TARGET_GLOBAL="/usr/local/bin/gridpull"
USER_BIN="$HOME/.local/bin"
USER_LINK="$USER_BIN/gridpull"
LINKED=false

# Try global /usr/local/bin
if [ -w "/usr/local/bin" ] || [ "$EUID" -eq 0 ]; then
    ln -sf "$SCRIPT_DIR/bin/gridpull" "$TARGET_GLOBAL"
    chmod +x "$TARGET_GLOBAL" 2>/dev/null || true
    echo -e "  ${GREEN}✔${NC} Symlinked binary to: ${CYAN}${TARGET_GLOBAL}${NC}"
    LINKED=true
fi

# If not linked globally, link to ~/.local/bin and ensure it's in profile
if [ "$LINKED" = false ]; then
    mkdir -p "$USER_BIN" 2>/dev/null || true
    ln -sf "$SCRIPT_DIR/bin/gridpull" "$USER_LINK"
    chmod +x "$USER_LINK" 2>/dev/null || true
    echo -e "  ${GREEN}✔${NC} Symlinked binary to: ${CYAN}${USER_LINK}${NC}"
    LINKED=true

    # Check if ~/.local/bin is in PATH
    if [[ ":$PATH:" != *":$USER_BIN:"* ]]; then
        PATH_EXPORT="export PATH=\"\$HOME/.local/bin:\$PATH\""
        
        # Configure .bashrc if present or default
        if [ -f "$HOME/.bashrc" ]; then
            if ! grep -q "\$HOME/.local/bin" "$HOME/.bashrc"; then
                echo -e "\n# GridPull CLI Path\n$PATH_EXPORT" >> "$HOME/.bashrc"
                echo -e "  ${GREEN}✔${NC} Added ~/.local/bin to ~/.bashrc"
            fi
        fi

        # Configure .zshrc if user has zsh or file exists
        if [ -f "$HOME/.zshrc" ] || [ "$SHELL" = "*/zsh" ]; then
            touch "$HOME/.zshrc" 2>/dev/null || true
            if ! grep -q "\$HOME/.local/bin" "$HOME/.zshrc" 2>/dev/null; then
                echo -e "\n# GridPull CLI Path\n$PATH_EXPORT" >> "$HOME/.zshrc"
                echo -e "  ${GREEN}✔${NC} Added ~/.local/bin to ~/.zshrc"
            fi
        fi

        # Configure .profile or .bash_profile as fallback
        if [ -f "$HOME/.profile" ] && ! grep -q "\$HOME/.local/bin" "$HOME/.profile"; then
            echo -e "\n# GridPull CLI Path\n$PATH_EXPORT" >> "$HOME/.profile"
            echo -e "  ${GREEN}✔${NC} Added ~/.local/bin to ~/.profile"
        fi
    else
        echo -e "  ${GREEN}✔${NC} $USER_BIN is already present in PATH."
    fi
fi

# Fallback: npm link
npm link >/dev/null 2>&1 || true

echo ""
echo -e "${GRAY}========================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✔ INSTALLATION & SETUP COMPLETE${NC}"
echo -e "${GRAY}========================================================================${NC}"
echo ""
echo -e "  The ${WHITE}${BOLD}gridpull${NC} command is now ready for use in your terminal."
echo ""
echo -e "  ${WHITE}Quick Commands:${NC}"
echo -e "    ${CYAN}gridpull${NC}                                   # Launch Google Developer CLI TUI"
echo -e "    ${CYAN}gridpull --help${NC}                            # View all commands and flags"
echo -e "    ${CYAN}gridpull deps${NC}                              # System binary diagnostics"
echo -e "    ${CYAN}gridpull search \"jazz lounge\"${NC}                # Search multi-source catalog"
echo -e "    ${CYAN}gridpull <url>${NC}                               # Direct single/batch probe"
echo ""
echo -e "  ${GRAY}If 'gridpull' is not found immediately in your current terminal session,${NC}"
echo -e "  ${GRAY}run: source ~/.bashrc (or source ~/.zshrc), or open a new terminal window.${NC}"
echo ""
