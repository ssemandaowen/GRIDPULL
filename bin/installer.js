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

  if (!fs.existsSync(ytdlpPath)) {
    console.log(`  ${colors.cyan}ℹ${colors.reset} Downloading managed yt-dlp binary to ./python/...`);
    const downloadUrl = process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    try {
      if (checkCommand('curl')) {
        execSync(`curl -L -s "${downloadUrl}" -o "${ytdlpPath}"`, { stdio: 'inherit' });
      } else if (checkCommand('powershell.exe')) {
        execSync(`powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${ytdlpPath}'"`, { stdio: 'inherit' });
      }
      if (process.platform !== 'win32' && fs.existsSync(ytdlpPath)) {
        fs.chmodSync(ytdlpPath, 0o755);
      }
      console.log(`  ${colors.green}✔${colors.reset} Stream engine downloaded successfully.`);
    } catch (err) {
      console.log(`  ${colors.yellow}⚠${colors.reset} Could not download local yt-dlp (${err.message}). Will rely on system yt-dlp.`);
    }
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Stream engine verified: ${colors.cyan}${ytdlpPath}${colors.reset}`);
  }
}

function buildBundle() {
  console.log(`${colors.bold}[2/5] Building Executable Bundle...${colors.reset}`);
  const distDir = path.join(projectRoot, 'dist');
  try {
    console.log(`  ${colors.cyan}ℹ${colors.reset} Compiling CLI bundle with esbuild...`);
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    console.log(`  ${colors.green}✔${colors.reset} Bundle built cleanly in ./dist/`);
  } catch (err) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Build warning: ${err.message}. Runtime will use TSX loader.`);
  }
}

function runWindowsSetup() {
  console.log(`${colors.bold}[3/5] Inspecting Windows Environment & Launcher Integration...${colors.reset}`);
  const binDir = path.join(projectRoot, 'bin');
  const cmdFile = path.join(binDir, 'gridpull.cmd');
  const ps1File = path.join(binDir, 'gridpull.ps1');

  const cmdContent = `@ECHO OFF\r\nSETLOCAL\r\nSET "PROJECT_ROOT=${projectRoot}"\r\nSET "LAUNCHER=%PROJECT_ROOT%\\bin\\gridpull.js"\r\nnode "%LAUNCHER%" %*\r\n`;
  fs.writeFileSync(cmdFile, cmdContent, 'utf8');

  const ps1Content = `# GridPull PowerShell Launcher\r\nparam([Parameter(ValueFromRemainingArguments = $true)]$Args)\r\n$ProjectRoot = "${projectRoot}"\r\n$Launcher = Join-Path $ProjectRoot "bin\\gridpull.js"\r\n& node $Launcher @Args\r\n`;
  fs.writeFileSync(ps1File, ps1Content, 'utf8');

  console.log(`  ${colors.green}✔${colors.reset} Created ${colors.cyan}${cmdFile}${colors.reset}`);
  console.log(`  ${colors.green}✔${colors.reset} Created ${colors.cyan}${ps1File}${colors.reset}`);
  return true;
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

  // Node check
  const nodeVer = process.version;
  console.log(`  ${colors.green}✔${colors.reset} Node.js Runtime     : ${colors.cyan}${nodeVer}${colors.reset}`);

  // Python check
  const pyVer = getCommandOutput('python3 --version') || getCommandOutput('python --version');
  if (pyVer) {
    console.log(`  ${colors.green}✔${colors.reset} Python Subsystem    : ${colors.cyan}${pyVer}${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} Python Subsystem    : Not detected in PATH`);
  }

  // FFmpeg check
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

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    runWindowsSetup();
  } else {
    runUnixSetup();
  }

  runDiagnostics();

  console.log('');
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bold}${colors.green}  ✔ GridPull CLI Setup Complete — Global Command Ready!${colors.reset}`);
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log('');
  console.log(`  Run interactive terminal interface:`);
  console.log(`    ${colors.cyan}gridpull${colors.reset}`);
  console.log('');
  console.log(`  Or view available commands & options:`);
  console.log(`    ${colors.cyan}gridpull --help${colors.reset}`);
  console.log('');
} catch (error) {
  console.error(`${colors.red}Installation error:${colors.reset}`, error);
  process.exit(1);
}
