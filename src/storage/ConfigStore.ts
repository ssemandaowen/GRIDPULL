/**
 * @file src/storage/ConfigStore.ts
 * Cross-platform persistent configuration store resolving against ~/.config/gridpull-cli/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EngineConfig } from '../types/index.js';

export class ConfigStore {
  private static instance: ConfigStore | null = null;
  private readonly configDir: string;
  private readonly configFile: string;
  private configData: EngineConfig;

  private constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'gridpull-cli');
    this.configFile = path.join(this.configDir, 'config.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    this.configData = this.loadConfig();
  }

  public static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  public get<K extends keyof EngineConfig>(key: K): EngineConfig[K] {
    return this.configData[key];
  }

  public getAll(): Readonly<EngineConfig> {
    return { ...this.configData };
  }

  public set<K extends keyof EngineConfig>(key: K, value: any): void {
    const validKeys: Array<keyof EngineConfig> = [
      'downloadDir',
      'subfoldersEnabled',
      'maxConcurrency',
      'parallelThreads',
      'defaultFormat',
      'defaultAudioFormat',
      'audioBitrate',
      'diskSpaceHeadroomMB',
      'retryMaxAttempts',
      'retryBackoffMs',
      'autoStartOnQueue',
    ];

    if (!validKeys.includes(key)) {
      throw new Error(`Unknown configuration key "${String(key)}". Valid keys are: ${validKeys.join(', ')}`);
    }

    let parsedValue = value;

    if (key === 'subfoldersEnabled' || key === 'autoStartOnQueue') {
      if (typeof value === 'boolean') {
        parsedValue = value;
      } else if (value === 'true' || value === '1') {
        parsedValue = true;
      } else if (value === 'false' || value === '0') {
        parsedValue = false;
      } else {
        throw new Error(`Invalid boolean value for "${String(key)}": "${value}". Must be true or false.`);
      }
    } else if (
      key === 'maxConcurrency' ||
      key === 'parallelThreads' ||
      key === 'retryMaxAttempts' ||
      key === 'diskSpaceHeadroomMB' ||
      key === 'retryBackoffMs'
    ) {
      const num = Number(value);
      if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
        throw new Error(`Invalid positive integer for "${String(key)}": "${value}".`);
      }
      parsedValue = num;
    } else if (key === 'audioBitrate') {
      const strVal = String(value).trim().toUpperCase();
      if (strVal !== '0' && !/^\d+K$/.test(strVal)) {
        throw new Error(`Invalid audioBitrate "${value}". Must be matching format like "320K", "192K", or "0".`);
      }
      parsedValue = strVal;
    } else if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid string value for "${String(key)}".`);
    }

    this.configData[key] = parsedValue as EngineConfig[K];
    this.saveConfig();
  }

  public reset(): void {
    this.configData = this.getDefaults();
    this.saveConfig();
  }

  public resolveTargetDirectory(mediaType: 'video' | 'audio' | 'dual' = 'video'): string {
    const base = this.configData.downloadDir;
    if (!this.configData.subfoldersEnabled) {
      if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
      return base;
    }

    const target = path.join(base, mediaType === 'audio' ? 'audio' : 'videos');
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }

  private getDefaults(): EngineConfig {
    return {
      downloadDir: path.join(os.homedir(), 'Downloads', 'GridPull'),
      subfoldersEnabled: true,
      maxConcurrency: 2,
      parallelThreads: 8,
      defaultFormat: '1080p_mp4',
      defaultAudioFormat: 'mp3',
      audioBitrate: '320K',
      diskSpaceHeadroomMB: 500,
      retryMaxAttempts: 3,
      retryBackoffMs: 4000,
      autoStartOnQueue: true,
    };
  }

  private loadConfig(): EngineConfig {
    const defaults = this.getDefaults();
    if (fs.existsSync(this.configFile)) {
      try {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      } catch {
        const corruptFile = `${this.configFile}.corrupt-${Date.now()}`;
        try {
          fs.renameSync(this.configFile, corruptFile);
        } catch {
          // Ignore rename errors
        }
        return defaults;
      }
    }
    return defaults;
  }

  private saveConfig(): void {
    const tmpFile = `${this.configFile}.tmp`;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(this.configData, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.configFile);
    } catch {
      // Best-effort atomic flush
    }
  }
}
