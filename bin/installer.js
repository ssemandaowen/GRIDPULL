#!/usr/bin/env node
/**
 * GridPull CLI — Universal Cross-Platform Installer Bootstrap
 * Inspects process.platform at runtime and coordinates native platform setup
 * (PowerShell for Windows, Bash for Unix/macOS/Linux/WSL, with pure JS fallback).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function printHeader() {
  console.log('');
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bold}${colors.white}  GridPull CLI — Universal Platform Installer & Setup${colors.reset}`);
  console.log(`${colors.gray}  Target Platform: ${colors.cyan}${process.platform}${colors.gray} (${os.type()} ${os.arch()}) // Node ${process.version}${colors.reset}`);
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log('');
}

function checkCommand(command) {
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${command}` : `command -v ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function ensureStreamEngine() {
  console.log(`${colors.bold}[1/5] Verifying Stream Processing Subsystem (yt-dlp)...${colors.reset}`);
  const pythonDir = path.join(projectRoot, 'python');
  const ytdlpPath = path.join(pythonDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

  if (!fs.existsSync(pythonDir)) {
    fs.mkdirSync(pythonDir, { recursive: true });
  }

  let needsDownload = true;
  if (fs.existsSync(ytdlpPath)) {
    try {
      const ver = execSync(`"${ytdlpPath}" --version`, { timeout: 3000, encoding: 'utf8' }).trim();
      console.log(`  ${colors.green}✔${colors.reset} Stream engine verified: ${colors.cyan}yt-dlp v${ver}${colors.reset}`);
      needsDownload = false;
    } catch {
      try {
        fs.unlinkSync(ytdlpPath);
      } catch {
        // Ignore
      }
    }
  }

  if (needsDownload) {
    const hasCurl = checkCommand('curl');
    const hasPs = checkCommand('powershell.exe') || checkCommand('powershell');

    if (!hasCurl && !hasPs) {
      console.log(`  ${colors.yellow}⚠${colors.reset} Neither curl nor powershell was found on PATH. Stream engine will use system yt-dlp.`);
      return;
    }

    console.log(`  ${colors.cyan}ℹ${colors.reset} Downloading managed yt-dlp binary to ./python/...`);
    const downloadUrl = process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    try {
      if (hasCurl) {
        execSync(`curl -fL -s "${downloadUrl}" -o "${ytdlpPath}"`, { stdio: 'ignore' });
      } else if (hasPs) {
        execSync(`powershell -NoProfile -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${ytdlpPath}'"`, { stdio: 'ignore' });
      }

      if (process.platform !== 'win32' && fs.existsSync(ytdlpPath)) {
        fs.chmodSync(ytdlpPath, 0o755);
      }

      const ver = execSync(`"${ytdlpPath}" --version`, { timeout: 4000, encoding: 'utf8' }).trim();
      console.log(`  ${colors.green}✔${colors.reset} Stream engine downloaded & verified: ${colors.cyan}yt-dlp v${ver}${colors.reset}`);
    } catch {
      if (fs.existsSync(ytdlpPath)) {
        try {
          fs.unlinkSync(ytdlpPath);
        } catch {
          // Ignore
        }
      }
      console.log(`  ${colors.yellow}⚠${colors.reset} Could not download valid local yt-dlp binary. Engine will rely on system yt-dlp.`);
    }
  }
}

function buildBundle() {
  console.log(`${colors.bold}[2/5] Building Executable Bundle...${colors.reset}`);
  try {
    execSync('npm run build', { cwd: projectRoot, stdio: 'ignore' });
    console.log(`  ${colors.green}✔${colors.reset} Bundle built cleanly in ./dist/`);
  } catch {
    console.log(`  ${colors.yellow}ℹ${colors.reset} esbuild not available; runtime will use tsx loader.`);
  }
}

function runUnixSetup() {
  console.log(`${colors.bold}[3/5] Setting File Execution Permissions...${colors.reset}`);
  try {
    fs.chmodSync(path.join(projectRoot, 'bin', 'cli.ts'), 0o755);
    fs.chmodSync(path.join(projectRoot, 'bin', 'gridpull'), 0o755);
    fs.chmodSync(path.join(projectRoot, 'bin', 'gridpull.js'), 0o755);
    console.log(`  ${colors.green}✔${colors.reset} Execution permissions applied to binaries in ./bin/`);
  } catch (e) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Could not set chmod (${e.message}).`);
  }

  console.log(`${colors.bold}[4/5] Linking Global 'gridpull' Command to User PATH...${colors.reset}`);
  const userBin = path.join(os.homedir(), '.local', 'bin');
  const targetLink = path.join(userBin, 'gridpull');
  const sourceBin = path.join(projectRoot, 'bin', 'gridpull');

  try {
    if (!fs.existsSync(userBin)) {
      fs.mkdirSync(userBin, { recursive: true });
    }
    if (fs.existsSync(targetLink)) {
      fs.unlinkSync(targetLink);
    }
    fs.symlinkSync(sourceBin, targetLink);
    console.log(`  ${colors.green}✔${colors.reset} Symlinked: ${colors.cyan}${targetLink}${colors.reset} -> ${sourceBin}`);
  } catch (err) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Symlink notice: ${err.message}`);
  }

  return true;
}

function runDiagnostics() {
  console.log(`${colors.bold}[5/5] Operational Toolchain Health Check...${colors.reset}`);

  const nodeVer = process.version;
  console.log(`  ${colors.green}✔${colors.reset} Node.js Runtime     : ${colors.cyan}${nodeVer}${colors.reset}`);

  const pyVer = getCommandOutput('python3 --version') || getCommandOutput('python --version');
  if (pyVer) {
    console.log(`  ${colors.green}✔${colors.reset} Python Subsystem    : ${colors.cyan}${pyVer}${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} Python Subsystem    : Not detected in PATH (Set GRIDPULL_PYTHON)`);
  }

  const ffmpegVer = getCommandOutput('ffmpeg -version');
  if (ffmpegVer) {
    const firstLine = ffmpegVer.split('\n')[0].substring(0, 42);
    console.log(`  ${colors.green}✔${colors.reset} FFmpeg Transcoder   : ${colors.cyan}${firstLine}...${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} FFmpeg Transcoder   : Not in PATH (format merging limited)`);
  }
}

try {
  printHeader();
  ensureStreamEngine();
  buildBundle();

  if (process.platform !== 'win32') {
    runUnixSetup();
  }

  runDiagnostics();

  console.log('');
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);

  const isGlobalReady = checkCommand('gridpull');
  if (isGlobalReady) {
    console.log(`${colors.bold}${colors.green}  ✔ GridPull CLI Setup Complete — Global Command Ready!${colors.reset}`);
  } else {
    console.log(`${colors.bold}${colors.yellow}  ⚠ GridPull CLI Setup Complete${colors.reset}`);
    if (process.platform === 'win32') {
      console.log(`  ${colors.yellow}Notice:${colors.reset} To run 'gridpull' globally, ensure your npm global bin folder is on your PATH.`);
      console.log(`  Run: ${colors.cyan}npm prefix -g${colors.reset} and add the output path to PATH.`);
    } else {
      const userBin = path.join(os.homedir(), '.local', 'bin');
      const envPath = process.env.PATH || '';
      if (!envPath.includes(userBin)) {
        console.log(`  ${colors.yellow}Notice:${colors.reset} ${userBin} is not on your PATH.`);
        console.log(`  Add to shell profile: ${colors.cyan}export PATH="$HOME/.local/bin:$PATH"${colors.reset}`);
      }
    }
  }

  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log('');
  console.log(`  Run interactive terminal interface:`);
  console.log(`    ${colors.cyan}gridpull${colors.reset}`);
  console.log('');
  console.log(`  Or view available commands & options:`);
  console.log(`    ${colors.cyan}gridpull --help${colors.reset}`);
  console.log('');
} catch (error) {
  console.error(`${colors.yellow}Installer warning:${colors.reset}`, error.message);
  if (process.env.npm_lifecycle_event === 'postinstall') {
    process.exit(0);
  } else {
    process.exit(1);
  }
}
