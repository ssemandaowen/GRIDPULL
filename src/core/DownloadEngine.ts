/**
 * @file src/core/DownloadEngine.ts
 * Low-level execution engine wrapping yt-dlp with chunk-buffered stream decoding,
 * ASCII unit-separator parsing, and event throttling.
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { DownloadError } from '../errors/SystemErrors.js';
import { ErrorClassifier } from '../errors/ErrorClassifier.js';
import { ProcessRegistry } from './ProcessRegistry.js';
import { QueueTelemetry } from '../types/index.js';
import { getEngineScriptPath } from '../utils/paths.js';
import { resolvePython } from '../utils/python.js';

export interface ExecutionOptions {
  url: string;
  format: string;
  targetDirectory: string;
  parallelThreads?: number;
  audioQuality?: string;
  retries?: number;
  mergeFormat?: string | null;
  section?: string | null;
  writeThumbnail?: boolean;
  writeSubs?: boolean;
  subLang?: string;
  cookies?: string | null;
}

export class DownloadEngine extends EventEmitter {
  private readonly pyEnginePath: string;
  private currentProc: ChildProcess | null = null;

  constructor() {
    super();
    this.pyEnginePath = getEngineScriptPath();
  }

  public abort(): void {
    if (this.currentProc && !this.currentProc.killed) {
      try {
        if (process.platform === 'win32' && this.currentProc.pid) {
          spawn('taskkill', ['/F', '/T', '/PID', this.currentProc.pid.toString()]);
        } else if (this.currentProc.pid) {
          process.kill(-this.currentProc.pid, 'SIGTERM');
        } else {
          this.currentProc.kill('SIGTERM');
        }
      } catch {
        this.currentProc.kill();
      }
      this.currentProc = null;
    }
  }

  public execute(options: ExecutionOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        'download',
        '--url', options.url,
        '--format', options.format,
        '--out-dir', options.targetDirectory,
        '--threads', (options.parallelThreads || 8).toString(),
        '--retries', (options.retries || 3).toString(),
      ];

      if (options.audioQuality) {
        args.push('--audio-quality', options.audioQuality);
      }
      if (options.mergeFormat) {
        args.push('--merge-output-format', options.mergeFormat);
      }
      if (options.section) {
        args.push('--section', options.section);
      }
      if (options.writeThumbnail) {
        args.push('--write-thumbnail');
      }
      if (options.writeSubs) {
        args.push('--write-subs');
        if (options.subLang) {
          args.push('--sub-lang', options.subLang);
        }
      }
      if (options.cookies) {
        args.push('--cookies', options.cookies);
      }

      const py = resolvePython();
      const proc: ChildProcess = spawn(py.command, [...py.args, this.pyEnginePath, ...args], {
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.currentProc = proc;
      ProcessRegistry.track(proc);

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let lastTelemetryTime = 0;
      let downloadedFilePath: string = '';
      const rollingLogs: string[] = [];

      const recordLog = (msg: string) => {
        if (!msg) return;
        rollingLogs.push(msg);
        if (rollingLogs.length > 50) {
          rollingLogs.shift();
        }
        this.emit('log', msg);
      };

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf8');
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('JSON_EVENT:')) {
            try {
              const eventPayload = JSON.parse(trimmed.slice(11));
              if (eventPayload.type === 'META') {
                if (eventPayload.filepath) downloadedFilePath = eventPayload.filepath;
                this.emit('metadata', eventPayload);
              } else if (eventPayload.type === 'PROGRESS') {
                const now = Date.now();
                if (now - lastTelemetryTime >= 80) {
                  lastTelemetryTime = now;
                  this.emit('progress', {
                    percent: eventPayload.percent,
                    speed: eventPayload.speed,
                    eta: eventPayload.eta,
                    size: eventPayload.size,
                    filename: eventPayload.filename,
                  });
                }
              } else if (eventPayload.type === 'LOG') {
                recordLog(eventPayload.message);
              }
            } catch {
              recordLog(trimmed);
            }
            continue;
          }

          recordLog(trimmed);
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stderrBuffer += text;
      });

      proc.on('error', (err) => {
        this.currentProc = null;
        reject(new DownloadError(`Process spawn failure: ${err.message}`, 'RUNTIME', false));
      });

      proc.on('close', (code) => {
        this.currentProc = null;
        if (code === 0) {
          resolve(downloadedFilePath || options.targetDirectory);
        } else {
          const joinedLogs = rollingLogs.join('\n');
          const combinedLogText = [joinedLogs, stderrBuffer.trim(), stdoutBuffer.trim()]
            .filter(Boolean)
            .join('\n');

          const classified = ErrorClassifier.classify(combinedLogText);

          let displayMsg = classified.message;
          const errorLine = rollingLogs.find((l) => l.includes('ERROR:')) ||
            stderrBuffer.split('\n').find((l) => l.includes('ERROR:'));

          if (errorLine) {
            const idx = errorLine.indexOf('ERROR:');
            const cleanErrLine = errorLine.substring(idx).trim();
            if (cleanErrLine && !classified.message.includes(cleanErrLine)) {
              displayMsg = `${classified.message} (${cleanErrLine})`;
            }
          }

          reject(new DownloadError(displayMsg, classified.kind, classified.retryable, combinedLogText));
        }
      });
    });
  }
}
