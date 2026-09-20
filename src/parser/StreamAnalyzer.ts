/**
 * @file src/parser/StreamAnalyzer.ts
 * Stream parsing, audio-video pairing, and upfront combined file-size calculation.
 * Transforms raw developer formats into intuitive, consumer-grade options (VidMate / Snaptube style).
 */

import { MediaMetadata, StreamFormat } from '../types/index.js';

export interface VideoTierOption {
  id: string;
  resolution: string; // e.g. "1080p60", "720p60", "480p"
  fps: number;
  format: string; // "MP4" | "WEBM"
  estTotalSize: string; // e.g. "31.89 MiB"
  rawBytes: number;
  isRecommended: boolean;
  videoFormatId: string;
  audioFormatId: string;
  selector: string;
  videoSizeStr: string;
  audioSizeStr: string;
}

export interface AudioTierOption {
  id: string;
  format: string; // "MP3" | "M4A" | "WEBM" | "FLAC"
  quality: string; // "High (192 kbps)" | "Ultra (320 kbps)" | "Medium (128 kbps)" | "Opus (Low)"
  fileSize: string; // "~7.39 MiB"
  rawBytes: number;
  bitrateKbps: number;
  selector: string;
  container: string;
}

export function parseBatchInput(input: string): string[] {
  // Handles newlines, commas, spaces, pipes, or semicolons as flexible delimiters
  return input
    .split(/[\r\n,\s|;]+/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
}

export class StreamAnalyzer {
  public static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return 'Unknown Size';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let val = bytes;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return `${val.toFixed(2)} ${units[idx]}`;
  }

  public static parseBytesFromStr(str: string | null | undefined): number {
    if (!str) return 0;
    const match = str.match(/([0-9.]+)\s*([A-Za-z]+)/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit.startsWith('G')) return num * 1024 * 1024 * 1024;
    if (unit.startsWith('M')) return num * 1024 * 1024;
    if (unit.startsWith('K')) return num * 1024;
    return num;
  }

  /**
   * Process raw stream formats, discard storyboards/mhtml,
   * pair video tracks with best audio track, and calculate true payload size upfront.
   */
  public static analyzeStreams(
    metadata: MediaMetadata | null,
    rawFormats: StreamFormat[] = []
  ): {
    videoOptions: VideoTierOption[];
    audioOptions: AudioTierOption[];
  } {
    const duration = metadata?.duration && metadata.duration > 0 ? metadata.duration : 210;

    // Filter out storyboards, mhtml, protocol fragments
    const validFormats = rawFormats.filter((f) => {
      if (!f) return false;
      const proto = (f.protocol || '').toLowerCase();
      const label = (f.rawLabel || '').toLowerCase();
      const ext = (f.extension || '').toLowerCase();
      if (label.includes('storyboard') || ext.includes('mhtml') || proto.includes('mhtml')) return false;
      return true;
    });

    // 1. Identify best audio stream (highest bitrate audio or highest filesize audio)
    const audioStreams = validFormats.filter((f) => f.kind === 'audio' || (f.audioCodec && !f.videoCodec));
    let bestAudioBytes = 0;
    let bestAudioId = '140'; // standard m4a audio id fallback
    let bestAudioStr = '~6.19 MiB';

    if (audioStreams.length > 0) {
      // Sort by filesize or bitrate
      audioStreams.sort((a, b) => {
        const bytesA = this.parseBytesFromStr(a.filesize);
        const bytesB = this.parseBytesFromStr(b.filesize);
        if (bytesB !== bytesA) return bytesB - bytesA;
        return parseFloat(b.totalBitrate || '0') - parseFloat(a.totalBitrate || '0');
      });
      const topAudio = audioStreams[0];
      bestAudioId = topAudio.id;
      const parsedBytes = this.parseBytesFromStr(topAudio.filesize);
      if (parsedBytes > 0) {
        bestAudioBytes = parsedBytes;
        bestAudioStr = this.formatBytes(bestAudioBytes);
      } else {
        const bitrate = parseFloat(topAudio.totalBitrate || '128');
        bestAudioBytes = (bitrate * 1000 / 8) * duration;
        bestAudioStr = `~${this.formatBytes(bestAudioBytes)}`;
      }
    } else {
      // Default standard 128k audio track size
      bestAudioBytes = (128 * 1000 / 8) * duration;
      bestAudioStr = `~${this.formatBytes(bestAudioBytes)}`;
    }

    // 2. Extract and pair Video Qualities
    // Standard targets
    const targetHeights = [
      { height: 2160, label: '2160p (4K)', fps: 60, bitrate: 22000 },
      { height: 1440, label: '1440p (2K)', fps: 60, bitrate: 11000 },
      { height: 1080, label: '1080p60', fps: 60, bitrate: 4800, recommended: true },
      { height: 1080, label: '1080p', fps: 30, bitrate: 3600 },
      { height: 720, label: '720p60', fps: 60, bitrate: 2800 },
      { height: 720, label: '720p', fps: 30, bitrate: 1900 },
      { height: 480, label: '480p', fps: 30, bitrate: 1000 },
      { height: 360, label: '360p', fps: 30, bitrate: 600 },
      { height: 240, label: '240p', fps: 30, bitrate: 350 },
      { height: 144, label: '144p', fps: 30, bitrate: 200 },
    ];

    const videoOptions: VideoTierOption[] = [];
    const usedLabels = new Set<string>();

    for (const target of targetHeights) {
      // Find matching live stream if available
      const matching = validFormats.find((f) => {
        if (f.kind === 'audio') return false;
        const resMatch = f.resolution?.includes(`${target.height}`) || f.resolution?.includes(`x${target.height}`);
        const fpsMatch = target.fps >= 60 ? (f.fps && f.fps >= 50) : (!f.fps || f.fps < 50);
        return resMatch && fpsMatch;
      });

      let videoBytes = 0;
      let videoId = matching ? matching.id : `bv*[height<=${target.height}]`;
      let ext = matching?.extension?.toUpperCase() || 'MP4';
      if (ext === 'WEBM' && target.height <= 1080) ext = 'MP4'; // prefer MP4 container for standard compatibility

      if (matching && this.parseBytesFromStr(matching.filesize) > 0) {
        videoBytes = this.parseBytesFromStr(matching.filesize);
      } else {
        videoBytes = (target.bitrate * 1000 / 8) * duration;
      }

      const totalBytes = videoBytes + bestAudioBytes;
      const estTotalSize = this.formatBytes(totalBytes);
      const isRecommended = !!target.recommended;

      // Unique label check
      const displayLabel = target.label;
      if (!usedLabels.has(displayLabel)) {
        usedLabels.add(displayLabel);
        videoOptions.push({
          id: `vid_${target.height}_${target.fps}`,
          resolution: displayLabel,
          fps: target.fps,
          format: ext,
          estTotalSize,
          rawBytes: totalBytes,
          isRecommended,
          videoFormatId: videoId,
          audioFormatId: bestAudioId,
          selector: matching
            ? `${matching.id}+${bestAudioId}/${matching.id}+ba/b`
            : `bv*[height<=${target.height}][fps>=${target.fps}]+ba/bv*[height<=${target.height}]+ba/b`,
          videoSizeStr: this.formatBytes(videoBytes),
          audioSizeStr: bestAudioStr,
        });
      }
    }

    // 3. Audio-Only Formats
    const audioOptions: AudioTierOption[] = [
      {
        id: 'aud_mp3_192',
        format: 'MP3',
        quality: 'High (192 kbps)',
        fileSize: `~${this.formatBytes((192 * 1000 / 8) * duration)}`,
        rawBytes: (192 * 1000 / 8) * duration,
        bitrateKbps: 192,
        selector: 'mp3',
        container: 'mp3',
      },
      {
        id: 'aud_mp3_320',
        format: 'MP3',
        quality: 'Ultra (320 kbps)',
        fileSize: `~${this.formatBytes((320 * 1000 / 8) * duration)}`,
        rawBytes: (320 * 1000 / 8) * duration,
        bitrateKbps: 320,
        selector: 'mp3',
        container: 'mp3',
      },
      {
        id: 'aud_m4a_128',
        format: 'M4A',
        quality: 'Medium (128 kbps)',
        fileSize: `~${this.formatBytes((128 * 1000 / 8) * duration)}`,
        rawBytes: (128 * 1000 / 8) * duration,
        bitrateKbps: 128,
        selector: 'm4a',
        container: 'm4a',
      },
      {
        id: 'aud_webm_opus',
        format: 'WEBM',
        quality: 'Opus (Low)',
        fileSize: `~${this.formatBytes((96 * 1000 / 8) * duration)}`,
        rawBytes: (96 * 1000 / 8) * duration,
        bitrateKbps: 96,
        selector: 'opus',
        container: 'webm',
      },
      {
        id: 'aud_flac',
        format: 'FLAC',
        quality: 'Lossless Studio',
        fileSize: `~${this.formatBytes((900 * 1000 / 8) * duration)}`,
        rawBytes: (900 * 1000 / 8) * duration,
        bitrateKbps: 900,
        selector: 'flac',
        container: 'flac',
      },
    ];

    return { videoOptions, audioOptions };
  }
}
