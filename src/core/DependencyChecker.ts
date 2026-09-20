/**
 * @file src/core/DependencyChecker.ts
 * Verifies system binaries and dependencies.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DependencyStatus {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  required: boolean;
}

export class DependencyChecker {
  public static verifyAll(): DependencyStatus[] {
    return [
      this.checkBinary('Node.js', 'node --version', true),
      this.checkBinary('Python 3', 'python3 --version', true),
      this.checkBinary('FFmpeg', 'ffmpeg -version', true),
      this.checkYtDlp(),
    ];
  }

  private static checkBinary(name: string, command: string, required: boolean): DependencyStatus {
    try {
      const output = execSync(command, { timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const firstLine = output.split('\n')[0].trim();
      return {
        name,
        installed: true,
        version: firstLine,
        path: 'System PATH',
        required,
      };
    } catch {
      return {
        name,
        installed: false,
        version: null,
        path: null,
        required,
      };
    }
  }

  private static checkYtDlp(): DependencyStatus {
    const localPy = path.resolve(__dirname, '..', '..', 'python', 'yt-dlp');
    if (fs.existsSync(localPy)) {
      try {
        const out = execSync(`"${localPy}" --version`, { timeout: 4000, encoding: 'utf8' }).trim();
        return {
          name: 'yt-dlp',
          installed: true,
          version: out.split('\n')[0],
          path: localPy,
          required: true,
        };
      } catch {
        // Fallback to system check
      }
    }
    return this.checkBinary('yt-dlp', 'yt-dlp --version', true);
  }
}
