/**
 * @file src/utils/paths.ts
 * Cross-environment path resolution helpers for GridPull CLI.
 * Correctly resolves project root both in tsx development mode and esbuild dist bundle.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedProjectRoot: string | null = null;

export function getProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        if (pkg.name === 'gridpull-cli') {
          cachedProjectRoot = currentDir;
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // Fallback to process.cwd() if not found
  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
}

export function getEngineScriptPath(): string {
  return path.join(getProjectRoot(), 'python', 'yt_engine.py');
}
