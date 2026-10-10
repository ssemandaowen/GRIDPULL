/**
 * @file src/utils/python.ts
 * Cross-platform Python 3 interpreter resolution helper for GridPull CLI.
 */

import { execSync } from 'node:child_process';

export interface PythonExecutable {
  command: string;
  args: string[];
}

let cachedPython: PythonExecutable | null = null;

export function resolvePython(): PythonExecutable {
  if (cachedPython) {
    return cachedPython;
  }

  // 1. Honor GRIDPULL_PYTHON env override if present
  if (process.env.GRIDPULL_PYTHON) {
    const customCmd = process.env.GRIDPULL_PYTHON.trim();
    try {
      execSync(`"${customCmd}" --version`, { timeout: 3000, stdio: 'ignore' });
      cachedPython = { command: customCmd, args: [] };
      return cachedPython;
    } catch {
      throw new Error(`GRIDPULL_PYTHON environment variable set to "${customCmd}", but running "${customCmd} --version" failed.`);
    }
  }

  // 2. Candidate commands to try
  const candidates: PythonExecutable[] = [
    { command: 'python3', args: [] },
    { command: 'python', args: [] },
  ];

  if (process.platform === 'win32') {
    candidates.push({ command: 'py', args: ['-3'] });
  }

  for (const candidate of candidates) {
    try {
      const fullCmd = candidate.args.length > 0
        ? `"${candidate.command}" ${candidate.args.join(' ')} --version`
        : `"${candidate.command}" --version`;

      const out = execSync(fullCmd, { timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (out.toLowerCase().includes('python 3') || out.toLowerCase().includes('python')) {
        cachedPython = candidate;
        return cachedPython;
      }
    } catch {
      // Try next candidate
    }
  }

  throw new Error('Python 3 not found. Install it or set GRIDPULL_PYTHON.');
}

export function resetPythonCache(): void {
  cachedPython = null;
}
