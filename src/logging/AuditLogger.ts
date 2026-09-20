/**
 * @file src/logging/AuditLogger.ts
 * Structured audit logging for CLI executions, errors, and lifecycle events.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export class AuditLogger {
  private static readonly logDir = path.join(os.homedir(), '.config', 'gridpull-cli');
  private static readonly logFile = path.join(AuditLogger.logDir, 'audit.log');

  public static log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, meta?: Record<string, any>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {}),
    };

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Best-effort
    }
  }

  public static info(message: string, meta?: Record<string, any>): void {
    this.log('INFO', message, meta);
  }

  public static warn(message: string, meta?: Record<string, any>): void {
    this.log('WARN', message, meta);
  }

  public static error(message: string, meta?: Record<string, any>): void {
    this.log('ERROR', message, meta);
  }

  public static debug(message: string, meta?: Record<string, any>): void {
    this.log('DEBUG', message, meta);
  }

  public static getLogPath(): string {
    return this.logFile;
  }
}
