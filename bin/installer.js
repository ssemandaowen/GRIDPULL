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

// Clean typography styling helpers
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
  console.log(`${colors.bold}${colors.white}  GridPull CLI — Universal Platform Installer${colors.reset}`);
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

// ----------------------------------------------------------------------------
// Windows Native Configuration
// ----------------------------------------------------------------------------
function runWindowsSetup() {
  console.log(`${colors.bold}[1/4] Inspecting Windows Environment & Shell Support...${colors.reset}`);
  const ps1Path = path.join(projectRoot, 'install.ps1');

  // Try delegating to install.ps1 via PowerShell if available
  if (checkCommand('powershell.exe') && fs.existsSync(ps1Path)) {
    console.log(`  ${colors.cyan}ℹ${colors.reset} Invoking native PowerShell installer (install.ps1)...`);
    try {
      const psResult = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
        { stdio: 'inherit', cwd: projectRoot }
      );
      if (psResult.status === 0) {
        return true;
      }
      console.log(`  ${colors.yellow}⚠${colors.reset} PowerShell script returned status ${psResult.status}. Falling back to universal JS linker.`);
    } catch (err) {
      console.log(`  ${colors.yellow}⚠${colors.reset} Could not spawn powershell.exe (${err.message}). Using JavaScript fallback.`);
    }
  }

  // JS Fallback for Windows
  console.log(`  ${colors.green}✔${colors.reset} Configuring CMD and PowerShell batch runners...`);
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

// ----------------------------------------------------------------------------
// Unix / Linux / macOS / WSL Setup
// ----------------------------------------------------------------------------
function runUnixSetup() {
  console.log(`${colors.bold}[1/4] Inspecting Unix / POSIX Shell Environment...${colors.reset}`);
  const shPath = path.join(projectRoot, 'install.sh');

  // Try delegating to install.sh via bash if available
  if (checkCommand('bash') && fs.existsSync(shPath)) {
    console.log(`  ${colors.cyan}ℹ${colors.reset} Invoking native Bash installer (install.sh)...`);
    try {
      const shResult = spawnSync('bash', [shPath], { stdio: 'inherit', cwd: projectRoot });
      if (shResult.status === 0) {
        return true;
      }
      console.log(`  ${colors.yellow}⚠${colors.reset} Bash installer returned status ${shResult.status}. Falling back to universal JS linker.`);
    } catch (err) {
      console.log(`  ${colors.yellow}⚠${colors.reset} Could not spawn bash (${err.message}). Using JavaScript fallback.`);
    }
  }

  // JS Fallback for Unix/macOS
  console.log(`${colors.bold}[2/4] Setting Execution Permissions...${colors.reset}`);
  try {
    fs.chmodSync(path.join(projectRoot, 'bin', 'cli.ts'), 0o755);
    fs.chmodSync(path.join(projectRoot, 'bin', 'gridpull'), 0o755);
    console.log(`  ${colors.green}✔${colors.reset} Execution permissions applied.`);
  } catch (e) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Could not set chmod (${e.message}).`);
  }

  console.log(`${colors.bold}[3/4] Linking Binary to User Path...${colors.reset}`);
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
    console.log(`  ${colors.green}✔${colors.reset} Linked ${colors.cyan}${targetLink}${colors.reset} -> ${sourceBin}`);
  } catch (err) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Symlink notice: ${err.message}`);
  }

  return true;
}

// ----------------------------------------------------------------------------
// Universal Health & Dependency Audit
// ----------------------------------------------------------------------------
function runDiagnostics() {
  console.log('');
  console.log(`${colors.bold}[4/4] Verifying Core Operational Toolchain...${colors.reset}`);

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
    console.log(`  ${colors.green}✔${colors.reset} FFmpeg Media Transcoder: ${colors.cyan}${firstLine}...${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} FFmpeg Transcoder   : Not in PATH (merging limited)`);
  }

  // Local yt-dlp check
  const ytdlpPath = path.join(projectRoot, 'python', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(ytdlpPath)) {
    console.log(`  ${colors.green}✔${colors.reset} Managed Stream Engine: Present in ./python/`);
  } else {
    console.log(`  ${colors.cyan}ℹ${colors.reset} Stream Engine       : Uses system yt-dlp binary`);
  }
}

// ----------------------------------------------------------------------------
// Main Execution
// ----------------------------------------------------------------------------
try {
  printHeader();

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    runWindowsSetup();
  } else {
    runUnixSetup();
  }

  runDiagnostics();

  console.log('');
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bold}${colors.green}  ✔ GridPull CLI Setup Complete${colors.reset}`);
  console.log(`${colors.gray}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log('');
  console.log(`  Run interactive terminal interface:`);
  console.log(`    ${colors.cyan}gridpull${colors.reset}`);
  console.log('');
  console.log(`  Or inspect commands:`);
  console.log(`    ${colors.cyan}gridpull --help${colors.reset}`);
  console.log('');
} catch (error) {
  console.error(`${colors.red}Installation error:${colors.reset}`, error);
  process.exit(1);
}
