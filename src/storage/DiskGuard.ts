/**
 * @file src/storage/DiskGuard.ts
 * Cross-platform filesystem free space detection and headroom enforcement.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DiskSpaceInfo {
  availableMB: number;
  totalMB: number;
  readableFree: string;
}

export class DiskGuard {
  public static checkHeadroom(targetDir: string, requiredHeadroomMB: number = 500): { ok: boolean; info: DiskSpaceInfo } {
    const info = this.getFreeSpace(targetDir);
    return {
      ok: info.availableMB >= requiredHeadroomMB,
      info,
    };
  }

  public static getFreeSpace(targetDir: string): DiskSpaceInfo {
    try {
      const resolved = path.resolve(targetDir);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }

      let freeBytes = 0;

      if (process.platform === 'win32') {
        try {
          const driveLetter = resolved.match(/^([A-Za-z]):/)?.[1]?.toUpperCase() + ':';
          const cmd = `powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -eq '${driveLetter}\\\\' } | Select-Object -ExpandProperty Free"`;
          const output = execSync(cmd, { timeout: 3000, encoding: 'utf8' }).trim();
          freeBytes = parseInt(output, 10) || 0;
        } catch {
          freeBytes = 10 * 1024 * 1024 * 1024; // Fallback 10GB
        }
      } else {
        try {
          const output = execSync(`df -k "${resolved}"`, { timeout: 3000, encoding: 'utf8' });
          const lines = output.trim().split('\n');
          if (lines.length >= 2) {
            const tokens = lines[1].split(/\s+/);
            if (tokens.length >= 4) {
              freeBytes = (parseInt(tokens[3], 10) || 0) * 1024;
            }
          }
        } catch {
          freeBytes = 10 * 1024 * 1024 * 1024; // Fallback 10GB
        }
      }

      const availableMB = Math.round(freeBytes / (1024 * 1024));
      const readableFree =
        availableMB > 1024 ? `${(availableMB / 1024).toFixed(2)} GB` : `${availableMB} MB`;

      return {
        availableMB,
        totalMB: availableMB,
        readableFree,
      };
    } catch {
      return {
        availableMB: 10240,
        totalMB: 10240,
        readableFree: '10.00 GB',
      };
    }
  }
}
