/**
 * @file src/core/DownloadEngine.ts
 * Low-level execution engine wrapping yt-dlp with chunk-buffered stream decoding,
 * ASCII unit-separator parsing, and event throttling.
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DownloadError } from '../errors/SystemErrors.js';
import { ErrorClassifier } from '../errors/ErrorClassifier.js';
import { ProcessRegistry } from './ProcessRegistry.js';
import { QueueTelemetry } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  constructor() {
    super();
    this.pyEnginePath = path.resolve(__dirname, '..', '..', 'python', 'yt_engine.py');
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

      const proc: ChildProcess = spawn('python3', [this.pyEnginePath, ...args], {
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      ProcessRegistry.track(proc);

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let lastTelemetryTime = 0;
      let downloadedFilePath: string = '';

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
                this.emit('log', eventPayload.message);
              }
            } catch {
              this.emit('log', trimmed);
            }
            continue;
          }

          this.emit('log', trimmed);
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString('utf8');
      });

      proc.on('error', (err) => {
        reject(new DownloadError(`Process spawn failure: ${err.message}`, 'RUNTIME', false));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(downloadedFilePath || options.targetDirectory);
        } else {
          const fullErr = stderrBuffer.trim() || stdoutBuffer.trim();
          const classified = ErrorClassifier.classify(fullErr);
          reject(new DownloadError(classified.message, classified.kind, classified.retryable, fullErr));
        }
      });
    });
  }
}
