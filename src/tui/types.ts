/**
 * @file src/tui/types.ts
 * Type definitions for Ink Terminal User Interface state, navigation, and modal management.
 */

import { MediaMetadata, DownloadJob, SearchResultItem } from '../types/index.js';
import { VideoTierOption, AudioTierOption } from '../parser/StreamAnalyzer.js';

export type MainNavView =
  | 'MAIN_MENU'
  | 'SEARCH'
  | 'URL_PULLER'
  | 'CONFIG'
  | 'DOWNLOADS'
  | 'HELP';

export type UrlPullerStep =
  | 'URL_INPUT'
  | 'PROBING'
  | 'TYPE_SELECT' // [1] Video, [2] Audio Only, [3] Batch Download, [0] Exit/Back
  | 'VIDEO_FORMAT' // Interactive resolution table
  | 'AUDIO_FORMAT' // Interactive audio bitrate table
  | 'BATCH_INPUT' // Text paste or file path
  | 'BATCH_PROBING' // Probing multi-URLs
  | 'BATCH_STRATEGY' // [1] Global format, [2] Individual, [3] Cancel
  | 'DISPATCH_CONFIRMED'; // Brief success flash before returning

export interface ProbedBatchItem {
  id: string;
  originalUrl: string;
  title: string;
  durationString: string;
  status: 'PROBING' | 'READY' | 'ERROR';
  selectedFormat?: string;
  mediaType?: 'video' | 'audio';
}

export interface ModalState {
  isOpen: boolean;
  type: 'EXIT_CONFIRM' | 'ALERT' | 'ACTION_PROMPT';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}
