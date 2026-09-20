/**
 * @file src/storage/HistoryRepository.ts
 * Atomic historical audit log with single-record-per-URL deduplication.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { HistoryRecord } from '../types/index.js';

export class HistoryRepository {
  private static instance: HistoryRepository | null = null;
  private readonly storageFile: string;
  private records: HistoryRecord[] = [];

  private constructor() {
    const configDir = path.join(os.homedir(), '.config', 'gridpull-cli');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.storageFile = path.join(configDir, 'history.json');
    this.records = this.load();
  }

  public static getInstance(): HistoryRepository {
    if (!HistoryRepository.instance) {
      HistoryRepository.instance = new HistoryRepository();
    }
    return HistoryRepository.instance;
  }

  public record(item: Omit<HistoryRecord, 'id' | 'timestamp'>): HistoryRecord {
    const record: HistoryRecord = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...item,
    };

    // Single record per URL: update existing in place or prepend
    const existingIndex = this.records.findIndex((r) => r.url === record.url);
    if (existingIndex >= 0) {
      this.records[existingIndex] = {
        ...this.records[existingIndex],
        ...record,
        id: this.records[existingIndex].id,
      };
      // Move to front
      const updated = this.records.splice(existingIndex, 1)[0];
      this.records.unshift(updated);
    } else {
      this.records.unshift(record);
      if (this.records.length > 500) {
        this.records = this.records.slice(0, 500);
      }
    }

    this.persist();
    return record;
  }

  public isDuplicate(url: string, targetPath?: string): boolean {
    if (!url) return false;
    return this.records.some((r) => {
      if (r.url !== url || r.status !== 'COMPLETED') return false;
      if (!targetPath) return true;
      return r.targetPath === targetPath;
    });
  }

  public list(limit: number = 50): ReadonlyArray<HistoryRecord> {
    return this.records.slice(0, limit);
  }

  public clear(): void {
    this.records = [];
    this.persist();
  }

  public remove(id: string): void {
    this.records = this.records.filter((r) => r.id !== id);
    this.persist();
  }

  private load(): HistoryRecord[] {
    if (fs.existsSync(this.storageFile)) {
      try {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.records, null, 2), 'utf8');
    } catch {
      // Best-effort atomic flush
    }
  }
}
