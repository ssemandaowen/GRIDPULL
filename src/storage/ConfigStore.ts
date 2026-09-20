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

  public set<K extends keyof EngineConfig>(key: K, value: EngineConfig[K]): void {
    this.configData[key] = value;
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
      autoResumeOnStartup: false,
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
        return defaults;
      }
    }
    return defaults;
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.configData, null, 2), 'utf8');
    } catch {
      // Best-effort atomic flush
    }
  }
}
