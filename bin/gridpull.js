#!/usr/bin/env node
/**
 * @file bin/gridpull.js
 * Universal cross-platform executable launcher for GridPull CLI.
 * Compatible with Windows (PowerShell, CMD), macOS, and Linux/WSL.
 * Transparently orchestrates the tsx TypeScript runtime loader so that
 * npx gridpull, global gridpull, and direct node invocations execute seamlessly.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliTsPath = path.join(__dirname, 'cli.ts');
const distCliPath = path.join(projectRoot, 'dist', 'cli.cjs');

// 1. Verify that project dependencies exist
const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.error('\x1b[31m✖ GridPull dependencies are not installed.\x1b[0m');
  console.error('\x1b[33m  Please run the following command first:\x1b[0m');
  console.error('    \x1b[36mnpm install\x1b[0m');
  console.error('\x1b[33m  Then run:\x1b[0m');
  console.error('    \x1b[36mnpx gridpull\x1b[0m\n');
  process.exit(1);
}

// 2. High-performance startup: If compiled bundle dist/cli.cjs exists, invoke directly with node
if (fs.existsSync(distCliPath)) {
  const child = spawn(process.execPath, [distCliPath, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach((sig) => {
    process.on(sig, () => {
      if (!child.killed) {
        child.kill(sig);
      }
    });
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    console.error('\x1b[31m✖ Failed to spawn compiled GridPull CLI runner:\x1b[0m', err.message);
    process.exit(1);
  });
} else {
  // 3. Fallback path for dev mode: Locate tsx CLI entry point to run bin/cli.ts dynamically
  function findTsxCliPath() {
    // Check candidate locations
    const candidates = [
      // Standard relative location in project node_modules
      path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.cjs'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Try dynamic ESM resolution
    try {
      const resolved = import.meta.resolve('tsx/cli');
      if (resolved) {
        return fileURLToPath(resolved);
      }
    } catch {
      // Fallback to searching node_modules resolution
    }

    return null;
  }

  const tsxCli = findTsxCliPath();

  if (!tsxCli) {
    // If tsx isn't found in node_modules, try invoking npx tsx as fallback
    const fallback = spawn('npx', ['tsx', cliTsPath, ...process.argv.slice(2)], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    fallback.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });
  } else {
    // Spawn Node directly running tsx cli, inheriting stdin/stdout/stderr for full interactive TTY
    const child = spawn(process.execPath, [tsxCli, cliTsPath, ...process.argv.slice(2)], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    // Forward process termination signals
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    signals.forEach((sig) => {
      process.on(sig, () => {
        if (!child.killed) {
          child.kill(sig);
        }
      });
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });

    child.on('error', (err) => {
      console.error('\x1b[31m✖ Failed to spawn GridPull CLI runner:\x1b[0m', err.message);
      process.exit(1);
    });
  }
}
