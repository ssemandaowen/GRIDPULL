/**
 * @file src/errors/SystemErrors.ts
 * Structured error taxonomy for the GridPull application.
 */

import { ErrorClassification } from '../types/index.js';

export class GridPullError extends Error {
  public readonly kind: ErrorClassification;
  public readonly retryable: boolean;
  public readonly rawOutput?: string;

  constructor(message: string, kind: ErrorClassification = 'UNKNOWN', retryable: boolean = false, rawOutput?: string) {
    super(message);
    this.name = 'GridPullError';
    this.kind = kind;
    this.retryable = retryable;
    this.rawOutput = rawOutput;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DownloadError extends GridPullError {
  constructor(message: string, kind: ErrorClassification, retryable: boolean, rawOutput?: string) {
    super(message, kind, retryable, rawOutput);
    this.name = 'DownloadError';
  }
}

export class DependencyError extends GridPullError {
  constructor(message: string) {
    super(message, 'RUNTIME', false);
    this.name = 'DependencyError';
  }
}

export class DiskSpaceError extends GridPullError {
  constructor(message: string) {
    super(message, 'DISK_FULL', false);
    this.name = 'DiskSpaceError';
  }
}

export class InspectionError extends GridPullError {
  constructor(message: string, kind: ErrorClassification = 'UNKNOWN') {
    super(message, kind, kind === 'NETWORK' || kind === 'THROTTLED' || kind === 'SSL');
    this.name = 'InspectionError';
  }
}
