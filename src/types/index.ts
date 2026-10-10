/**
 * @file src/types/index.ts
 * Core domain types and interfaces for GridPull CLI.
 */

export type JobStatus = 'IDLE' | 'PENDING' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'SKIPPED';
export type MediaType = 'video' | 'audio' | 'dual';
export type StreamKind = 'video' | 'audio' | 'muxed' | 'unknown';

export interface StreamFormat {
  id: string;
  extension: string;
  resolution: string;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  totalBitrate: string;
  filesize: string | null;
  protocol: string;
  kind: StreamKind;
  rawLabel: string;
}

export interface QualityTier {
  id: string;
  label: string;
  hint: string;
  selector: string;
  container: 'mp4' | 'webm' | 'any' | 'audio';
  mergeFormat: string | null;
  audioQuality?: string;
  mode: 'video' | 'audio' | 'passthrough';
}

export interface DownloadJob {
  id: string;
  url: string;
  title: string | null;
  targetDirectory: string;
  formatSelector: string;
  mediaType: MediaType;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  percent: number;
  speed: string;
  eta: string;
  downloadedSize: string;
  totalSize: string;
  filename: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  section?: string | null;
  writeThumbnail?: boolean;
  writeSubs?: boolean;
  subLang?: string;
  cookies?: string | null;
  force?: boolean;
}

export interface QueueTelemetry {
  jobId: string;
  percent: number;
  speed: string;
  eta: string;
  size: string;
  filename: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  sanitizedTitle: string;
  duration: number;
  channel: string;
  thumbnailUrl: string;
  originalUrl: string;
  uploader?: string;
  durationString?: string;
  thumbnail?: string | null;
  url?: string;
  formatsCount?: number;
  viewCount?: number | null;
}

export interface SearchResultItem {
  id: string;
  title: string;
  uploader: string;
  duration: string;
  url: string;
  viewCount: number | null;
  source: string;
}

export interface EngineConfig {
  downloadDir: string;
  subfoldersEnabled: boolean;
  maxConcurrency: number;
  parallelThreads: number;
  defaultFormat: string;
  defaultAudioFormat: string;
  audioBitrate: string;
  diskSpaceHeadroomMB: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  autoStartOnQueue: boolean;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  url: string;
  title: string;
  format: string;
  mediaType: MediaType;
  targetDirectory: string;
  targetPath: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  error: string | null;
}

export type ErrorClassification =
  | 'THROTTLED'
  | 'GEO_BLOCKED'
  | 'AGE_RESTRICTED'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'SSL'
  | 'DISK_FULL'
  | 'RUNTIME'
  | 'UNKNOWN';

export interface ClassifiedError {
  kind: ErrorClassification;
  message: string;
  retryable: boolean;
}
