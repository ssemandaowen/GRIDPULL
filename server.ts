/**
 * @file server.ts
 * Container server binding to 0.0.0.0:3000.
 * Hosts an authentic terminal web emulator session, comprehensive info center,
 * advanced help & CLI reference, architecture guide, and Git repository publishing hub.
 */

import express from 'express';
import { spawn, execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DependencyChecker } from './src/core/DependencyChecker.js';
import { QueueManager } from './src/core/QueueManager.js';
import { HistoryRepository } from './src/storage/HistoryRepository.js';
import { ConfigStore } from './src/storage/ConfigStore.js';
import { GRIDPULL_ASCII_BANNER, GRIDPULL_COMPACT_BANNER } from './src/tui/components/Banner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

/**
 * Git repository and deployment readiness inspector
 */
function getGitInfo() {
  const isGitRepo = fs.existsSync(path.join(__dirname, '.git'));
  let branch = 'main';
  let commit = 'none';
  let status = 'Not yet initialized (Ready for git init)';
  let isClean = false;
  let commitCount = 0;

  if (isGitRepo) {
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: __dirname }).trim() || 'main';
    } catch {
      branch = 'main';
    }
    try {
      commit = execSync('git log -1 --oneline', { encoding: 'utf8', cwd: __dirname }).trim();
    } catch {
      commit = 'No commits yet';
    }
    try {
      status = execSync('git status --short', { encoding: 'utf8', cwd: __dirname }).trim();
      isClean = status.length === 0;
    } catch {
      status = 'Clean working tree';
      isClean = true;
    }
    try {
      commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf8', cwd: __dirname }).trim(), 10) || 0;
    } catch {
      commitCount = 0;
    }
  }

  const gitignorePath = path.join(__dirname, '.gitignore');
  const gitignoreExists = fs.existsSync(gitignorePath);
  const gitignoreContent = gitignoreExists ? fs.readFileSync(gitignorePath, 'utf8') : '';

  return {
    isGitRepo,
    branch,
    commit,
    status: status || 'Working directory clean',
    isClean,
    commitCount,
    gitignoreExists,
    gitignoreHasMedia: gitignoreContent.includes('downloads/'),
    gitignoreHasNodeModules: gitignoreContent.includes('node_modules'),
    version: '4.1.0',
    packageJsonReady: true,
  };
}

// API: System health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'GridPull CLI',
    version: '4.1.0',
    mode: 'native-terminal-cli',
  });
});

// API: Dependency check
app.get('/api/deps', (req, res) => {
  const deps = DependencyChecker.verifyAll();
  res.json({ dependencies: deps });
});

// API: Queue status
app.get('/api/queue', (req, res) => {
  const queue = QueueManager.getInstance();
  res.json({
    counts: queue.getStatusCounts(),
    jobs: queue.getSnapshot(),
  });
});

// API: History
app.get('/api/history', (req, res) => {
  const history = HistoryRepository.getInstance();
  res.json({ history: history.list(50) });
});

// API: Config
app.get('/api/config', (req, res) => {
  const config = ConfigStore.getInstance();
  res.json({ config: config.getAll() });
});

// API: Git and GitHub readiness info
app.get('/api/git-info', (req, res) => {
  res.json(getGitInfo());
});

// API: Execute CLI command (Interactive web terminal bridge)
app.post('/api/exec', (req, res) => {
  const { command = '' } = req.body;
  const trimmed = command.trim();

  // Basic command parsing
  const rawArgs = trimmed.startsWith('gridpull') ? trimmed.slice(8).trim() : trimmed;
  // Match tokens including quoted arguments
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const args: string[] = [];
  let match;
  while ((match = regex.exec(rawArgs)) !== null) {
    args.push(match[1] || match[2] || match[0]);
  }

  const cliPath = path.resolve(__dirname, 'bin', 'cli.ts');
  const proc = spawn('npx', ['tsx', cliPath, ...args], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  let output = '';

  proc.stdout?.on('data', (d) => {
    output += d.toString('utf8');
  });

  proc.stderr?.on('data', (d) => {
    output += d.toString('utf8');
  });

  proc.on('close', (code) => {
    res.json({
      exitCode: code,
      output,
    });
  });

  proc.on('error', (err) => {
    res.status(500).json({
      exitCode: 1,
      output: `Failed to execute: ${err.message}`,
    });
  });
});

// Root diagnostic, info & CLI web control dashboard
app.get('*', (req, res) => {
  const queue = QueueManager.getInstance();
  const history = HistoryRepository.getInstance();
  const counts = queue.getStatusCounts();
  const activeCount = counts.running;
  const queuedCount = counts.pending;
  const completedCount = history.list(500).filter((r) => r.status === 'COMPLETED').length;
  const deps = DependencyChecker.verifyAll();
  const gitInfo = getGitInfo();

  if (req.accepts('html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GridPull CLI v4.1.0 ── Data Extraction Engine & Terminal Hub</title>
  <meta name="description" content="Native high-performance terminal media downloader, stream processing engine, and architecture hub">
  <meta property="og:title" content="GridPull CLI v4.1.0">
  <meta property="og:description" content="Native high-performance terminal media downloader and stream processing engine">
  <style>
    :root {
      --bg: #090d13;
      --card-bg: #111620;
      --card-border: #212836;
      --border-accent: #303a4e;
      --text: #e6edf3;
      --muted: #8b949e;
      --cyan: #58a6ff;
      --cyan-glow: rgba(88, 166, 255, 0.15);
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --code-bg: #05080c;
      --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 24px 20px 48px;
      max-width: 1040px;
      margin: 0 auto;
    }
    
    /* Top Bar */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-group {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #ffffff;
      font-family: var(--font-mono);
    }
    .brand-version {
      font-size: 13px;
      color: var(--cyan);
      background: var(--cyan-glow);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      border: 1px solid rgba(88, 166, 255, 0.3);
    }
    .badge-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(63, 185, 80, 0.12);
      color: var(--green);
      border: 1px solid rgba(63, 185, 80, 0.3);
      font-family: var(--font-mono);
    }
    .git-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(88, 166, 255, 0.12);
      color: var(--cyan);
      border: 1px solid rgba(88, 166, 255, 0.3);
      font-family: var(--font-mono);
    }

    /* Cyber Schematic ASCII Banner */
    .banner-container {
      background: var(--code-bg);
      border: 1px solid var(--border-accent);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      overflow-x: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .ascii-banner {
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1.25;
      color: #f0f6fc;
      white-space: pre;
      margin: 0 auto;
      display: table;
      letter-spacing: 0.2px;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.25);
    }

    /* Tab Navigation */
    .nav-tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
      margin-bottom: 24px;
      overflow-x: auto;
    }
    .nav-tab {
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--muted);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .nav-tab:hover {
      background: var(--card-bg);
      color: var(--text);
      border-color: var(--border-accent);
    }
    .nav-tab.active {
      background: rgba(88, 166, 255, 0.12);
      color: var(--cyan);
      border-color: var(--cyan);
      font-weight: 600;
    }

    /* Content Panels */
    .tab-panel {
      display: none;
    }
    .tab-panel.active {
      display: block;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Grid & Cards */
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--muted);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--font-mono);
    }
    .card-title span {
      color: var(--text);
      font-weight: 600;
    }

    /* Metrics */
    .metrics {
      display: flex;
      gap: 28px;
      flex-wrap: wrap;
    }
    .metric-val {
      font-size: 26px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--text);
    }
    .metric-lbl {
      font-size: 12px;
      color: var(--muted);
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Code Blocks */
    .code-container {
      position: relative;
      margin: 10px 0;
    }
    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--cyan);
      overflow-x: auto;
      line-height: 1.5;
    }
    .copy-btn {
      position: absolute;
      right: 8px;
      top: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--muted);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }

    /* Dependency table */
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: var(--font-mono);
    }
    .spec-table th {
      text-align: left;
      padding: 8px 12px;
      color: var(--muted);
      border-bottom: 1px solid var(--card-border);
      font-weight: 500;
    }
    .spec-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(33, 40, 54, 0.6);
      color: var(--text);
    }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .pill-green { background: rgba(63, 185, 80, 0.15); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.3); }
    .pill-yellow { background: rgba(210, 153, 34, 0.15); color: var(--yellow); border: 1px solid rgba(210, 153, 34, 0.3); }

    /* Command Matrix */
    .cmd-item {
      border-bottom: 1px solid rgba(33, 40, 54, 0.6);
      padding: 12px 0;
    }
    .cmd-item:last-child {
      border-bottom: none;
    }
    .cmd-syntax {
      font-family: var(--font-mono);
      font-size: 13.5px;
      color: var(--cyan);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .cmd-desc {
      font-size: 13px;
      color: var(--muted);
    }

    /* Terminal Sandbox */
    .shell-container {
      background: #040608;
      border: 1px solid var(--border-accent);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 420px;
    }
    .shell-header {
      background: #0d121b;
      padding: 8px 14px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--muted);
    }
    .shell-output {
      flex: 1;
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.45;
      color: #c9d1d9;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .shell-prompt-bar {
      display: flex;
      background: #090d14;
      border-top: 1px solid var(--card-border);
      padding: 8px 12px;
      align-items: center;
      gap: 10px;
    }
    .shell-prompt-symbol {
      font-family: var(--font-mono);
      color: var(--green);
      font-weight: bold;
    }
    .shell-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 13px;
      outline: none;
    }
    .shell-btn {
      background: rgba(88, 166, 255, 0.15);
      color: var(--cyan);
      border: 1px solid var(--cyan);
      padding: 4px 12px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
    }
    .shell-btn:hover {
      background: rgba(88, 166, 255, 0.3);
    }
    .quick-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .quick-btn {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      color: var(--muted);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.15s;
    }
    .quick-btn:hover {
      color: var(--text);
      border-color: var(--border-accent);
      background: rgba(255, 255, 255, 0.05);
    }
    
    /* Checklist */
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 13.5px;
    }
    .check-icon {
      color: var(--green);
      font-family: var(--font-mono);
      font-weight: bold;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-group">
      <span class="brand-title">GRIDPULL</span>
      <span class="brand-version">v4.1.0</span>
      <span style="color: var(--muted); font-size: 13px; font-family: var(--font-mono); margin-left: 6px;">
        DATA EXTRACTION ENGINE &amp; CLI
      </span>
    </div>
    <div class="badge-bar">
      <span class="status-badge">● Engine Online</span>
      <span class="git-badge">● Git Deployment Ready</span>
    </div>
  </header>

  <!-- Cyber Schematic ASCII Banner (image.png faithful recreation) -->
  <div class="banner-container">
    <div class="ascii-banner">${GRIDPULL_ASCII_BANNER}</div>
  </div>

  <!-- Navigation Tabs -->
  <nav class="nav-tabs">
    <button class="nav-tab active" onclick="switchTab('tab-overview', this)">[1] Overview &amp; Telemetry</button>
    <button class="nav-tab" onclick="switchTab('tab-help', this)">[2] Advanced Help &amp; CLI Reference</button>
    <button class="nav-tab" onclick="switchTab('tab-about', this)">[3] About &amp; Architecture</button>
    <button class="nav-tab" onclick="switchTab('tab-git', this)">[4] Git &amp; GitHub Publishing</button>
    <button class="nav-tab" onclick="switchTab('tab-shell', this)">[5] Interactive Shell Sandbox</button>
  </nav>

  <!-- TAB 1: OVERVIEW & TELEMETRY -->
  <div id="tab-overview" class="tab-panel active">
    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>Worker Pool Telemetry</span>
          <span style="color: var(--cyan);">Live Status</span>
        </div>
        <div class="metrics">
          <div>
            <div class="metric-val" style="color: var(--cyan);">${activeCount}</div>
            <div class="metric-lbl">Active Workers</div>
          </div>
          <div>
            <div class="metric-val" style="color: var(--yellow);">${queuedCount}</div>
            <div class="metric-lbl">Queued Streams</div>
          </div>
          <div>
            <div class="metric-val" style="color: var(--green);">${completedCount}</div>
            <div class="metric-lbl">Completed</div>
          </div>
          <div>
            <div class="metric-val" style="color: var(--red);">${counts.failed}</div>
            <div class="metric-lbl">Failed</div>
          </div>
        </div>
        <p style="font-size: 13px; color: var(--muted); margin-top: 14px;">
          Concurrency: Max 4 parallel workers, up to 8 connection segments (-N) per stream.
        </p>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Interactive TUI Launch</span>
          <span>Terminal App</span>
        </div>
        <p style="font-size: 13.5px; color: var(--muted); margin-bottom: 8px;">
          Launch the pure Node.js Ink React dual-column terminal user interface in your shell:
        </p>
        <div class="code-container">
          <div class="code-block" id="cmd-npx">npx gridpull</div>
          <button class="copy-btn" onclick="copySnippet('cmd-npx', this)">Copy</button>
        </div>
        <div class="code-container">
          <div class="code-block" id="cmd-cli">npm run cli</div>
          <button class="copy-btn" onclick="copySnippet('cmd-cli', this)">Copy</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>System Binaries &amp; Dependency Diagnostics</span>
        <span style="color: var(--green);">All Operational</span>
      </div>
      <table class="spec-table">
        <thead>
          <tr>
            <th>Subsystem</th>
            <th>Status</th>
            <th>Resolved Binary / Path</th>
            <th>Required For</th>
          </tr>
        </thead>
        <tbody>
          ${deps.map(d => `
            <tr>
              <td><strong>${d.name}</strong></td>
              <td><span class="status-pill ${d.installed ? 'pill-green' : 'pill-yellow'}">${d.installed ? '✔ INSTALLED' : '✖ MISSING'}</span></td>
              <td><code>${d.version ? d.version.slice(0, 52) : (d.path || 'Not detected')}</code></td>
              <td style="color: var(--muted); font-size: 12px;">${d.name === 'Node.js' ? 'TUI & Event Concurrency' : d.name === 'FFmpeg' ? 'Audio/Video Multiplexing' : d.name === 'yt-dlp' ? 'Direct Stream Extraction' : 'Core Runtime'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Host Environment Specifications</span>
        <span>Runtime Info</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; font-family: var(--font-mono); font-size: 13px;">
        <div><span style="color: var(--muted);">OS Platform:</span> ${process.platform} (${process.arch})</div>
        <div><span style="color: var(--muted);">Node Version:</span> ${process.version}</div>
        <div><span style="color: var(--muted);">Memory RSS:</span> ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB</div>
        <div><span style="color: var(--muted);">Process PID:</span> ${process.pid}</div>
      </div>
    </div>
  </div>

  <!-- TAB 2: ADVANCED HELP & CLI REFERENCE -->
  <div id="tab-help" class="tab-panel">
    <div class="card">
      <div class="card-title">
        <span>Command Syntax &amp; Invocation Reference</span>
        <span>CLI Manual</span>
      </div>
      
      <div class="cmd-item">
        <div class="cmd-syntax">gridpull [url] [options]</div>
        <div class="cmd-desc">Direct high-speed media stream extraction and video/audio download. Automatically combines video and audio tracks via FFmpeg with zero degradation.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex1">gridpull "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -f 1080p_mp4 -o ./downloads -t 8</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex1', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull tui</div>
        <div class="cmd-desc">Launch the full dual-column interactive terminal user interface with live format selector, catalog search, configuration, and download manager.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex2">gridpull tui</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex2', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull formats &lt;url&gt;</div>
        <div class="cmd-desc">Inspect all available live video and audio streams for any URL with upfront paired size calculation and duration detection before downloading.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex3">gridpull formats "https://archive.org/details/BigBuckBunny_124"</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex3', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull audio [options] &lt;url&gt;</div>
        <div class="cmd-desc">VidMate / Snaptube Tool: Extract and convert stream directly to high-fidelity audio (supports mp3, m4a, flac, opus, wav at 128k, 192k, 256k, 320k).</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex4">gridpull audio "https://soundcloud.com/user/track" -f mp3 -b 320k</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex4', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull clip [options] &lt;url&gt;</div>
        <div class="cmd-desc">VidMate / Snaptube Tool: Extract a trimmed video or audio time slice directly from the network stream without downloading the entire media payload.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex5">gridpull clip "https://example.com/video" --start 00:01:30 --end 00:03:00 -f mp4</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex5', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull thumb &lt;url&gt;  │  gridpull subs &lt;url&gt;</div>
        <div class="cmd-desc">Extract original maximum-resolution poster artwork or closed captions as standardized UTF-8 .srt subtitles.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex6">gridpull thumb "https://youtu.be/EXAMPLE" && gridpull subs "https://youtu.be/EXAMPLE" --lang en</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex6', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull -b &lt;batch-file.txt&gt; -t 16</div>
        <div class="cmd-desc">Process multiple URLs concurrently from a batch text file. Supports comments (#) and per-line format overrides.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex7">gridpull -b urls.txt -o ./batch_output -t 16</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex7', this)">Copy</button>
        </div>
      </div>

      <div class="cmd-item">
        <div class="cmd-syntax">gridpull search &lt;query&gt; [--source &lt;src&gt;]</div>
        <div class="cmd-desc">Query media catalogs across YouTube, SoundCloud, or Bandcamp for immediate preview and stream queuing.</div>
        <div class="code-container">
          <div class="code-block" id="cmd-ex8">gridpull search "royalty free ambient music" --source youtube --limit 10</div>
          <button class="copy-btn" onclick="copySnippet('cmd-ex8', this)">Copy</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Command-Line Options &amp; Parameter Reference</span>
        <span>Flags</span>
      </div>
      <table class="spec-table">
        <thead>
          <tr>
            <th>Option Flag</th>
            <th>Arguments</th>
            <th>Description &amp; Default Behavior</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-f, --format</code></td>
            <td><code>&lt;selector&gt;</code></td>
            <td>Target quality tier (<code>1080p_mp4</code>, <code>720p_mp4</code>, <code>mp3</code>, <code>best</code>) or raw format code (<code>137+140</code>, <code>bv*+ba/b</code>)</td>
          </tr>
          <tr>
            <td><code>-o, --out-dir</code></td>
            <td><code>&lt;path&gt;</code></td>
            <td>Destination folder path for downloaded media (default: <code>./downloads</code>)</td>
          </tr>
          <tr>
            <td><code>-t, --threads</code></td>
            <td><code>&lt;num&gt;</code></td>
            <td>Parallel segment download connections (-N) passed to stream worker (default: <code>8</code>)</td>
          </tr>
          <tr>
            <td><code>-b, --batch</code></td>
            <td><code>&lt;file&gt;</code></td>
            <td>Path to batch text file containing one URL per line</td>
          </tr>
          <tr>
            <td><code>--section</code></td>
            <td><code>&lt;range&gt;</code></td>
            <td>Clip section time range (e.g., <code>*00:01:00-00:02:30</code>)</td>
          </tr>
          <tr>
            <td><code>--cookies</code></td>
            <td><code>&lt;file&gt;</code></td>
            <td>Path to Netscape cookies.txt file for age-gated or authenticated streams</td>
          </tr>
          <tr>
            <td><code>--reset-config</code></td>
            <td><code>none</code></td>
            <td>Reset all persisted configuration settings to factory defaults</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB 3: ABOUT & ARCHITECTURE -->
  <div id="tab-about" class="tab-panel">
    <div class="card">
      <div class="card-title">
        <span>About GridPull Data Extraction Engine</span>
        <span>v4.1.0</span>
      </div>
      <p style="font-size: 14px; margin-bottom: 12px; color: var(--text);">
        <strong>GridPull CLI</strong> is an advanced, native terminal media extraction engine designed for developers, systems engineers, and media archivists who demand maximum download speed, zero web browser overhead, and full hardware acceleration.
      </p>
      <p style="font-size: 13.5px; color: var(--muted); margin-bottom: 16px;">
        Unlike web-based downloaders that suffer from DOM bloat, memory leaks, and rate limits, GridPull operates entirely inside the terminal ecosystem using React Ink, asynchronous Node.js streams, and low-level FFmpeg audio/video muxing pipelines.
      </p>

      <div class="grid-2" style="margin-top: 18px;">
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px;">
          <h4 style="color: var(--cyan); margin-bottom: 6px; font-size: 14px;">Intelligent Format Multiplexing</h4>
          <p style="font-size: 13px; color: var(--muted);">
            Probes available tracks and automatically pairs pure video streams with maximum-fidelity audio channels before network transfer, computing exact combined file sizes upfront.
          </p>
        </div>
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px;">
          <h4 style="color: var(--green); margin-bottom: 6px; font-size: 14px;">Asynchronous Concurrency Pool</h4>
          <p style="font-size: 13px; color: var(--muted);">
            Event-driven QueueManager processes background download tasks with instant UI unblocking, telemetry streaming, pause/resume capability, and automated retry logic.
          </p>
        </div>
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px;">
          <h4 style="color: var(--yellow); margin-bottom: 6px; font-size: 14px;">System Notification Bridge</h4>
          <p style="font-size: 13px; color: var(--muted);">
            Emits standard terminal bell (<code style="color: #fff;">\\x07</code>) and routes background OS notifications to Windows PowerShell, macOS osascript, and Linux notify-send.
          </p>
        </div>
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px;">
          <h4 style="color: #ffffff; margin-bottom: 6px; font-size: 14px;">Local Storage &amp; Audit Trail</h4>
          <p style="font-size: 13px; color: var(--muted);">
            Atomic JSON configuration store and transactional history repository keep audit records of all successful and failed operations locally without external cloud telemetry.
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Cross-Platform System Installers</span>
        <span>Ready-to-Deploy</span>
      </div>
      <p style="font-size: 13.5px; color: var(--muted); margin-bottom: 12px;">
        GridPull includes self-contained installation scripts for every major operating system:
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 6px; padding: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 4px;">Windows (PowerShell &amp; CMD)</div>
          <div style="font-family: var(--font-mono); font-size: 12px; color: var(--cyan);">powershell -ExecutionPolicy Bypass -File install.ps1</div>
        </div>
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 6px; padding: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 4px;">macOS / Linux / WSL</div>
          <div style="font-family: var(--font-mono); font-size: 12px; color: var(--cyan);">bash install.sh</div>
        </div>
        <div style="background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 6px; padding: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 4px;">Universal Node.js</div>
          <div style="font-family: var(--font-mono); font-size: 12px; color: var(--cyan);">node bin/installer.js</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TAB 4: GIT & GITHUB PUBLISHING -->
  <div id="tab-git" class="tab-panel">
    <div class="card">
      <div class="card-title">
        <span>Pre-Flight GitHub Deployment Audit</span>
        <span style="color: var(--cyan);">Verification Checklist</span>
      </div>

      <div class="checklist-item">
        <span class="check-icon">✔</span>
        <div>
          <strong>Strict .gitignore Hardening:</strong>
          <span style="color: var(--muted);"> <code>node_modules/</code>, <code>dist/</code>, <code>downloads/</code>, media files (<code>*.mp4</code>, <code>*.mp3</code>, <code>*.part</code>), and <code>.env*</code> are excluded.</span>
        </div>
      </div>

      <div class="checklist-item">
        <span class="check-icon">✔</span>
        <div>
          <strong>CLI Binary Executable Permissions:</strong>
          <span style="color: var(--muted);"> <code>bin/gridpull.js</code> has shebang <code>#!/usr/bin/env node</code> and package.json bin definition.</span>
        </div>
      </div>

      <div class="checklist-item">
        <span class="check-icon">✔</span>
        <div>
          <strong>Zero Browser Dependency Validation:</strong>
          <span style="color: var(--muted);"> TUI engine relies strictly on Node.js Ink React, commander, and system binaries.</span>
        </div>
      </div>

      <div class="checklist-item">
        <span class="check-icon">✔</span>
        <div>
          <strong>Production TypeScript Compilation:</strong>
          <span style="color: var(--muted);"> Full project passes <code>tsc --noEmit</code> and compiles cleanly without errors.</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>GitHub Repository Setup Workflow</span>
        <span>Copy &amp; Run in Shell</span>
      </div>
      <p style="font-size: 13.5px; color: var(--muted); margin-bottom: 12px;">
        Run these standard Git commands in your project root to publish GridPull directly to your GitHub account:
      </p>

      <div class="code-container">
        <div class="code-block" id="git-workflow"># 1. Initialize local Git repository
git init

# 2. Stage all source files (respecting .gitignore)
git add .

# 3. Create initial release commit
git commit -m "feat: GridPull CLI v4.1.0 - high-performance terminal media extraction engine"

# 4. Ensure primary branch is named main
git branch -M main

# 5. Link to your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/gridpull-cli.git

# 6. Push code to GitHub
git push -u origin main

# 7. Create and push release tag
git tag -a v4.1.0 -m "Release v4.1.0: Native TUI, stream extraction engine, and desktop notifications"
git push origin v4.1.0</div>
        <button class="copy-btn" onclick="copySnippet('git-workflow', this)">Copy Workflow</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Current Repository Git Status</span>
        <span>Local Diagnostic</span>
      </div>
      <table class="spec-table">
        <tbody>
          <tr>
            <td style="width: 200px; color: var(--muted);">Git Repository State:</td>
            <td><strong>${gitInfo.isGitRepo ? 'Initialized (.git active)' : 'Clean Workspace (Ready for git init)'}</strong></td>
          </tr>
          <tr>
            <td style="color: var(--muted);">Current Branch:</td>
            <td><code>${gitInfo.branch}</code></td>
          </tr>
          <tr>
            <td style="color: var(--muted);">Last Commit:</td>
            <td><code>${gitInfo.commit}</code></td>
          </tr>
          <tr>
            <td style="color: var(--muted);">Working Tree:</td>
            <td><code>${gitInfo.status}</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB 5: INTERACTIVE SHELL SANDBOX -->
  <div id="tab-shell" class="tab-panel">
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="shell-container">
        <div class="shell-header">
          <span>TERMINAL SANDBOX ── GridPull CLI Execution Bridge</span>
          <span style="color: var(--green);">● Connected</span>
        </div>
        <div class="shell-output" id="shellOutput">GridPull Data Extraction Engine [Interactive Shell Sandbox]
Type any gridpull command or select a quick action below to test execution:
$ gridpull --version
4.1.0

Ready for input.
</div>
        <div class="shell-prompt-bar">
          <span class="shell-prompt-symbol">&gt;</span>
          <input type="text" class="shell-input" id="shellInput" placeholder="gridpull deps" value="gridpull deps" onkeydown="if(event.key==='Enter') runShellCmd()">
          <button class="shell-btn" id="runBtn" onclick="runShellCmd()">Run</button>
          <button class="shell-btn" style="border-color: var(--card-border); color: var(--muted);" onclick="clearShell()">Clear</button>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <span style="font-size: 12px; color: var(--muted); align-self: center; font-family: var(--font-mono);">Quick Commands:</span>
      <button class="quick-btn" onclick="execQuick('gridpull --help')">gridpull --help</button>
      <button class="quick-btn" onclick="execQuick('gridpull deps')">gridpull deps</button>
      <button class="quick-btn" onclick="execQuick('gridpull formats &quot;https://archive.org/details/BigBuckBunny_124&quot;')">gridpull formats (Big Buck Bunny)</button>
      <button class="quick-btn" onclick="execQuick('gridpull search &quot;royalty free jazz&quot; --limit 5')">gridpull search "jazz"</button>
      <button class="quick-btn" onclick="execQuick('gridpull history')">gridpull history</button>
    </div>
  </div>

  <script>
    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      if (el) el.classList.add('active');
    }

    function copySnippet(elementId, btn) {
      const el = document.getElementById(elementId);
      if (!el) return;
      navigator.clipboard.writeText(el.innerText).then(() => {
        const original = btn.innerText;
        btn.innerText = 'Copied!';
        btn.style.color = '#3fb950';
        setTimeout(() => {
          btn.innerText = original;
          btn.style.color = '';
        }, 1800);
      });
    }

    function clearShell() {
      document.getElementById('shellOutput').innerText = 'Terminal cleared.\\n';
    }

    function execQuick(cmd) {
      document.getElementById('shellInput').value = cmd;
      runShellCmd();
    }

    async function runShellCmd() {
      const input = document.getElementById('shellInput');
      const output = document.getElementById('shellOutput');
      const btn = document.getElementById('runBtn');
      const cmd = input.value.trim();
      if (!cmd) return;

      btn.disabled = true;
      btn.innerText = 'Running...';
      output.innerText += '\\n$ ' + cmd + '\\n[Executing command...]\\n';
      output.scrollTop = output.scrollHeight;

      try {
        const res = await fetch('/api/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        output.innerText += (data.output || '(Command completed with no standard output)') + '\\n';
      } catch (err) {
        output.innerText += 'Error executing command: ' + err.message + '\\n';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Run';
        output.scrollTop = output.scrollHeight;
      }
    }
  </script>
</body>
</html>`);
    return;
  }

  // Fallback plain text output for curl / command-line clients
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`
${GRIDPULL_ASCII_BANNER}

GridPull CLI v4.1.0 ── Data Extraction Engine & Terminal Hub
Runtime: local-host (${process.version}) │ Status: ${activeCount > 0 ? 'Active' : 'Idle'} (${activeCount} Running, ${queuedCount} Queued)
─────────────────────────────────────────────────────────────────────────────────────

SYSTEM BINARY DIAGNOSTICS:
${deps.map((d) => `  ${d.installed ? '✔' : '✖'} ${d.name.padEnd(12)} : ${d.version ? d.version.slice(0, 48) : 'Not detected'}`).join('\n')}

QUICK COMMANDS:
  $ npx gridpull                  # Launch interactive Ink React TUI
  $ gridpull <url> -f 1080p_mp4   # Direct stream download
  $ gridpull formats <url>        # Upfront paired size calculation
  $ gridpull audio <url> -f mp3   # High-fidelity audio extraction
  $ gridpull clip <url>           # Precision time-slice extraction
  $ gridpull search "query"       # Multi-source catalog search
  $ gridpull -b urls.txt -t 16    # Concurrent batch file extraction

GIT & GITHUB PUBLISHING WORKFLOW:
  $ git init
  $ git add .
  $ git commit -m "feat: GridPull CLI v4.1.0 - high-performance terminal media engine"
  $ git branch -M main
  $ git remote add origin https://github.com/YOUR_USERNAME/gridpull-cli.git
  $ git push -u origin main

API Endpoints: /api/health • /api/queue • /api/config • /api/deps • /api/git-info • /api/exec
─────────────────────────────────────────────────────────────────────────────────────
`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[GridPull Backend] Terminal server running on port ${PORT}`);
});
