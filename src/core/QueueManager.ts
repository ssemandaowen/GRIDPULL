/**
 * @file src/core/QueueManager.ts
 * High-performance concurrent download queue orchestrator with
 * individual/multiple pause, resume, stop, and remove capabilities,
 * process abort tracking, and atomic state transitions.
 */

import { EventEmitter } from 'node:events';
import { DownloadJob, JobStatus, QueueTelemetry } from '../types/index.js';
import { ConfigStore } from '../storage/ConfigStore.js';
import { HistoryRepository } from '../storage/HistoryRepository.js';
import { DiskGuard } from '../storage/DiskGuard.js';
import { DownloadEngine } from './DownloadEngine.js';
import { FormatRegistry } from '../parser/FormatRegistry.js';

export class QueueManager extends EventEmitter {
  private static instance: QueueManager | null = null;
  private readonly queue: DownloadJob[] = [];
  private readonly activeEngines = new Map<string, DownloadEngine>();
  private activeWorkers = 0;
  private isPaused = false;
  private readonly configStore: ConfigStore;
  private readonly historyRepo: HistoryRepository;

  private constructor() {
    super();
    this.configStore = ConfigStore.getInstance();
    this.historyRepo = HistoryRepository.getInstance();
    this.isPaused = !this.configStore.get('autoStartOnQueue');
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public enqueue(
    url: string,
    options: {
      format?: string;
      title?: string;
      targetDirectory?: string;
      mediaType?: 'video' | 'audio' | 'dual';
      maxRetries?: number;
      autoStart?: boolean;
      section?: string | null;
      writeThumbnail?: boolean;
      writeSubs?: boolean;
      subLang?: string;
      cookies?: string | null;
    } = {}
  ): DownloadJob {
    const config = this.configStore.getAll();
    const resolvedTier = FormatRegistry.resolve(options.format || config.defaultFormat);
    const mediaType = options.mediaType || (resolvedTier.mode === 'audio' ? 'audio' : 'video');
    const targetDir = options.targetDirectory || this.configStore.resolveTargetDirectory(mediaType);

    const job: DownloadJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url,
      title: options.title || null,
      targetDirectory: targetDir,
      formatSelector: resolvedTier.selector,
      mediaType,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: options.maxRetries ?? config.retryMaxAttempts,
      percent: 0,
      speed: '0 KiB/s',
      eta: '--:--',
      downloadedSize: '0 MiB',
      totalSize: '0 MiB',
      filename: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
      section: options.section,
      writeThumbnail: options.writeThumbnail,
      writeSubs: options.writeSubs,
      subLang: options.subLang,
      cookies: options.cookies,
    };

    this.queue.push(job);
    this.emit('jobEnqueued', job);

    if (options.autoStart || config.autoStartOnQueue) {
      this.isPaused = false;
    }

    this.dispatchNext();
    return job;
  }

  public enqueueBatch(
    urls: string[],
    options: {
      format?: string;
      targetDirectory?: string;
      mediaType?: 'video' | 'audio';
    } = {}
  ): DownloadJob[] {
    const jobs = urls
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((url) => this.enqueue(url, { ...options, autoStart: false }));

    this.isPaused = false;
    this.dispatchNext();
    return jobs;
  }

  public start(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.emit('queueResumed');
      this.dispatchNext();
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.pauseAll();
    this.emit('queuePaused');
  }

  public pauseJob(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (!job) return false;

    if (job.status === 'RUNNING') {
      const engine = this.activeEngines.get(id);
      if (engine) {
        engine.abort();
        this.activeEngines.delete(id);
      }
      job.status = 'PAUSED';
      this.emit('jobPaused', job);
      this.emit('jobUpdated', job);
      return true;
    } else if (job.status === 'PENDING') {
      job.status = 'PAUSED';
      this.emit('jobPaused', job);
      this.emit('jobUpdated', job);
      return true;
    }
    return false;
  }

  public resumeJob(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (!job || (job.status !== 'PAUSED' && job.status !== 'STOPPED')) return false;

    job.status = 'PENDING';
    job.error = null;
    this.emit('jobResumed', job);
    this.emit('jobUpdated', job);
    this.isPaused = false;
    this.dispatchNext();
    return true;
  }

  public stopJob(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (!job) return false;

    if (job.status === 'RUNNING') {
      const engine = this.activeEngines.get(id);
      if (engine) {
        engine.abort();
        this.activeEngines.delete(id);
      }
    }
    job.status = 'STOPPED';
    job.speed = '0 KiB/s';
    this.emit('jobStopped', job);
    this.emit('jobUpdated', job);
    return true;
  }

  public pauseAll(): void {
    for (const job of this.queue) {
      if (job.status === 'RUNNING' || job.status === 'PENDING') {
        this.pauseJob(job.id);
      }
    }
  }

  public resumeAll(): void {
    this.isPaused = false;
    for (const job of this.queue) {
      if (job.status === 'PAUSED' || job.status === 'STOPPED') {
        job.status = 'PENDING';
      }
    }
    this.dispatchNext();
  }

  public stopAll(): void {
    for (const job of this.queue) {
      if (job.status === 'RUNNING' || job.status === 'PENDING' || job.status === 'PAUSED') {
        this.stopJob(job.id);
      }
    }
  }

  public retryJob(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (!job || (job.status !== 'FAILED' && job.status !== 'STOPPED')) return false;
    job.status = 'PENDING';
    job.retryCount = 0;
    job.error = null;
    job.percent = 0;
    this.emit('jobUpdated', job);
    this.isPaused = false;
    this.dispatchNext();
    return true;
  }

  public retryAllFailed(): number {
    let count = 0;
    for (const job of this.queue) {
      if (job.status === 'FAILED' || job.status === 'STOPPED') {
        job.status = 'PENDING';
        job.retryCount = 0;
        job.error = null;
        count++;
      }
    }
    if (count > 0) {
      this.isPaused = false;
      this.dispatchNext();
    }
    return count;
  }

  public removeJob(id: string): boolean {
    const idx = this.queue.findIndex((j) => j.id === id);
    if (idx === -1) return false;

    const [removed] = this.queue.splice(idx, 1);
    if (removed.status === 'RUNNING') {
      const engine = this.activeEngines.get(id);
      if (engine) {
        engine.abort();
        this.activeEngines.delete(id);
      }
    }
    this.emit('jobRemoved', removed);
    this.dispatchNext();
    return true;
  }

  public removeAll(ids?: string[]): number {
    const targetIds = ids || this.queue.map((j) => j.id);
    let count = 0;
    for (const id of targetIds) {
      if (this.removeJob(id)) {
        count++;
      }
    }
    return count;
  }

  public getSnapshot(): ReadonlyArray<Readonly<DownloadJob>> {
    return [...this.queue];
  }

  public getStatusCounts() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((j) => j.status === 'PENDING').length,
      running: this.queue.filter((j) => j.status === 'RUNNING').length,
      paused: this.queue.filter((j) => j.status === 'PAUSED').length,
      stopped: this.queue.filter((j) => j.status === 'STOPPED').length,
      failed: this.queue.filter((j) => j.status === 'FAILED').length,
      retrying: this.queue.filter((j) => j.status === 'RETRYING').length,
      isPaused: this.isPaused,
    };
  }

  private dispatchNext(): void {
    const maxConcurrency = this.configStore.get('maxConcurrency');
    if (this.isPaused || this.activeWorkers >= maxConcurrency) {
      return;
    }

    const nextJob = this.queue.find((j) => j.status === 'PENDING');
    if (!nextJob) {
      if (this.activeWorkers === 0) {
        this.emit('queueDrained');
      }
      return;
    }

    // Disk space check
    const headroomMB = this.configStore.get('diskSpaceHeadroomMB');
    const headroom = DiskGuard.checkHeadroom(nextJob.targetDirectory, headroomMB);
    if (!headroom.ok) {
      nextJob.status = 'FAILED';
      nextJob.error = `Insufficient disk space in ${nextJob.targetDirectory} (${headroom.info.readableFree} free, ${headroomMB} MB required).`;
      this.historyRepo.record({
        url: nextJob.url,
        title: nextJob.title || nextJob.url,
        format: nextJob.formatSelector,
        mediaType: nextJob.mediaType,
        targetPath: nextJob.targetDirectory,
        status: 'FAILED',
        error: nextJob.error,
      });
      this.emit('jobFailed', nextJob);
      return;
    }

    // Deduplication check
    if (this.historyRepo.isDuplicate(nextJob.url, nextJob.targetDirectory)) {
      nextJob.status = 'SKIPPED';
      const idx = this.queue.indexOf(nextJob);
      if (idx >= 0) this.queue.splice(idx, 1);
      this.emit('jobSkipped', nextJob);
      this.dispatchNext();
      return;
    }

    this.activeWorkers++;
    nextJob.status = 'RUNNING';
    nextJob.error = null;
    this.emit('jobStarted', nextJob);

    const engine = new DownloadEngine();
    this.activeEngines.set(nextJob.id, engine);

    const resolvedTier = FormatRegistry.resolve(nextJob.formatSelector);

    engine.on('metadata', (meta) => {
      if (meta.title && (!nextJob.title || nextJob.title === nextJob.url)) {
        nextJob.title = meta.title;
      }
      if (meta.filename) {
        nextJob.filename = meta.filename;
      }
      this.emit('jobProgress', nextJob);
    });

    engine.on('progress', (telemetry) => {
      if (nextJob.status !== 'RUNNING') return;
      nextJob.percent = telemetry.percent;
      nextJob.speed = telemetry.speed;
      nextJob.eta = telemetry.eta;
      if (telemetry.size) nextJob.downloadedSize = telemetry.size;
      if (telemetry.filename) nextJob.filename = telemetry.filename;

      const evt: QueueTelemetry = {
        jobId: nextJob.id,
        percent: telemetry.percent,
        speed: telemetry.speed,
        eta: telemetry.eta,
        size: telemetry.size,
        filename: telemetry.filename || nextJob.title || 'Media',
      };
      this.emit('telemetry', evt);
      this.emit('jobProgress', nextJob);
    });

    engine
      .execute({
        url: nextJob.url,
        format: nextJob.formatSelector,
        targetDirectory: nextJob.targetDirectory,
        parallelThreads: this.configStore.get('parallelThreads'),
        audioQuality: resolvedTier.audioQuality,
        retries: this.configStore.get('retryMaxAttempts'),
        mergeFormat: resolvedTier.mergeFormat,
        section: nextJob.section,
        writeThumbnail: nextJob.writeThumbnail,
        writeSubs: nextJob.writeSubs,
        subLang: nextJob.subLang,
        cookies: nextJob.cookies,
      })
      .then((targetPath) => {
        if (nextJob.status === 'PAUSED' || nextJob.status === 'STOPPED') return;

        nextJob.status = 'COMPLETED';
        nextJob.percent = 100;
        nextJob.completedAt = Date.now();

        this.historyRepo.record({
          url: nextJob.url,
          title: nextJob.title || nextJob.filename || nextJob.url,
          format: nextJob.formatSelector,
          mediaType: nextJob.mediaType,
          targetPath,
          status: 'COMPLETED',
          error: null,
        });

        const idx = this.queue.indexOf(nextJob);
        if (idx >= 0) this.queue.splice(idx, 1);

        this.emit('jobCompleted', nextJob);
      })
      .catch((err) => {
        if (nextJob.status === 'PAUSED' || nextJob.status === 'STOPPED') return;

        const isRetryable = err.retryable || /network|throttled|429|ssl|eof/i.test(err.message);
        if (isRetryable && nextJob.retryCount < nextJob.maxRetries) {
          nextJob.retryCount++;
          nextJob.status = 'RETRYING';
          const backoff = this.configStore.get('retryBackoffMs') * Math.pow(2, nextJob.retryCount - 1);
          this.emit('jobRetrying', nextJob, backoff);

          setTimeout(() => {
            if (nextJob.status === 'RETRYING') {
              nextJob.status = 'PENDING';
              this.dispatchNext();
            }
          }, backoff);
          return;
        }

        nextJob.status = 'FAILED';
        nextJob.error = err.message;

        this.historyRepo.record({
          url: nextJob.url,
          title: nextJob.title || nextJob.url,
          format: nextJob.formatSelector,
          mediaType: nextJob.mediaType,
          targetPath: nextJob.targetDirectory,
          status: 'FAILED',
          error: err.message,
        });

        this.emit('jobFailed', nextJob);
      })
      .finally(() => {
        this.activeEngines.delete(nextJob.id);
        this.activeWorkers--;
        this.dispatchNext();
      });

    this.dispatchNext();
  }
}
