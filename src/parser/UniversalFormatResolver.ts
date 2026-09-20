/**
 * @file src/parser/UniversalFormatResolver.ts
 * Single source of truth for unified format inspection, stream categorization,
 * and deterministic file-size calculation across all ingestion vectors.
 */

import { MediaMetadata, StreamFormat } from '../types/index.js';

export interface ResolvedFormatItem {
  id: string;
  category: 'video' | 'audio' | 'tool';
  label: string;
  badge: string;
  container: string;
  resolution: string;
  size: string;
  selector: string;
  description: string;
}

export class UniversalFormatResolver {
  /**
   * Format raw bytes into human-readable KiB, MiB, GiB.
   */
  public static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return 'Unknown Size';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let val = bytes;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return idx === 0 ? `${Math.round(val)} ${units[idx]}` : `${val.toFixed(1)} ${units[idx]}`;
  }

  /**
   * Calculate expected file size based on bitrate and duration.
   */
  public static calculateSize(bitrateKbps: number, durationSeconds: number | null): string {
    if (!durationSeconds || durationSeconds <= 0) {
      // Return a standard average duration estimate (~3.5 minutes)
      const avgDuration = 210;
      const bytes = (bitrateKbps * 1000 / 8) * avgDuration;
      return `~${this.formatBytes(bytes)}`;
    }
    const totalBytes = (bitrateKbps * 1000 / 8) * durationSeconds;
    return `~${this.formatBytes(totalBytes)}`;
  }

  /**
   * Universal resolution pipeline that outputs normalized options with verified or calculated sizes.
   */
  public static resolveFormats(
    metadata?: MediaMetadata | null,
    liveFormats?: StreamFormat[]
  ): ResolvedFormatItem[] {
    const duration = metadata?.duration ?? null;

    // Helper to find actual probed size if available in live formats
    const findLiveSize = (resPattern: RegExp, isAudio: boolean = false): string | null => {
      if (!liveFormats || liveFormats.length === 0) return null;
      for (const lf of liveFormats) {
        if (isAudio && lf.kind === 'audio' && lf.filesize) {
          return lf.filesize;
        }
        if (!isAudio && resPattern.test(lf.resolution) && lf.filesize) {
          return lf.filesize;
        }
      }
      return null;
    };

    const size4K = findLiveSize(/2160|3840x2160/) || this.calculateSize(22000, duration);
    const size2K = findLiveSize(/1440|2560x1440/) || this.calculateSize(11000, duration);
    const size1080p = findLiveSize(/1080|1920x1080/) || this.calculateSize(4660, duration);
    const size720p = findLiveSize(/720|1280x720/) || this.calculateSize(2628, duration);
    const size480p = findLiveSize(/480|854x480/) || this.calculateSize(1328, duration);
    const size360p = findLiveSize(/360|640x360/) || this.calculateSize(696, duration);

    const sizeMp3_320 = findLiveSize(/audio/, true) || this.calculateSize(320, duration);
    const sizeMp3_192 = this.calculateSize(192, duration);
    const sizeM4a = this.calculateSize(256, duration);
    const sizeFlac = this.calculateSize(900, duration);
    const sizeOpus = this.calculateSize(160, duration);

    const options: ResolvedFormatItem[] = [
      // Video Tiers
      {
        id: '2160p_mp4',
        category: 'video',
        label: '4K Ultra HD (2160p)',
        badge: '4K UHD',
        container: 'mp4',
        resolution: '3840x2160',
        size: size4K,
        selector: 'bv*[height<=2160][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'Ultra high definition 60fps presentation',
      },
      {
        id: '1440p_mp4',
        category: 'video',
        label: '1440p Quad HD (2K)',
        badge: '2K QHD',
        container: 'mp4',
        resolution: '2560x1440',
        size: size2K,
        selector: 'bv*[height<=1440][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'High bitrate presentation for 1440p displays',
      },
      {
        id: '1080p_mp4',
        category: 'video',
        label: '1080p Full HD',
        badge: '1080p',
        container: 'mp4',
        resolution: '1920x1080',
        size: size1080p,
        selector: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'Standard Full HD crisp visual fidelity',
      },
      {
        id: '720p_mp4',
        category: 'video',
        label: '720p HD',
        badge: '720p',
        container: 'mp4',
        resolution: '1280x720',
        size: size720p,
        selector: 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'High definition balanced for fast download',
      },
      {
        id: '480p_mp4',
        category: 'video',
        label: '480p Standard (SD)',
        badge: '480p',
        container: 'mp4',
        resolution: '854x480',
        size: size480p,
        selector: 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'Standard definition with low bandwidth consumption',
      },
      {
        id: '360p_mp4',
        category: 'video',
        label: '360p Data Saver',
        badge: '360p',
        container: 'mp4',
        resolution: '640x360',
        size: size360p,
        selector: 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        description: 'Minimal bandwidth consumption for storage conservation',
      },
      {
        id: 'best_available',
        category: 'video',
        label: 'Best Available Stream',
        badge: 'MAX',
        container: 'auto',
        resolution: 'Highest',
        size: size1080p,
        selector: 'bv*+ba/b',
        description: 'Highest resolution stream manifest available',
      },

      // Audio Studio Tiers (VidMate / Snaptube style)
      {
        id: 'mp3_320',
        category: 'audio',
        label: 'MP3 Audio (320 kbps Ultra HQ)',
        badge: 'MP3 320k',
        container: 'mp3',
        resolution: '320 kbps',
        size: sizeMp3_320,
        selector: 'mp3',
        description: 'Studio grade audio with embedded artwork & metadata',
      },
      {
        id: 'mp3_192',
        category: 'audio',
        label: 'MP3 Audio (192 kbps Standard)',
        badge: 'MP3 192k',
        container: 'mp3',
        resolution: '192 kbps',
        size: sizeMp3_192,
        selector: 'mp3',
        description: 'High efficiency balanced MP3 transcode',
      },
      {
        id: 'm4a',
        category: 'audio',
        label: 'M4A / AAC Audio (Apple Native)',
        badge: 'M4A AAC',
        container: 'm4a',
        resolution: '256 kbps',
        size: sizeM4a,
        selector: 'm4a',
        description: 'Native stream extraction without lossy re-encoding',
      },
      {
        id: 'flac',
        category: 'audio',
        label: 'FLAC Audio (Studio Lossless)',
        badge: 'FLAC',
        container: 'flac',
        resolution: 'Lossless',
        size: sizeFlac,
        selector: 'flac',
        description: 'Bit-perfect lossless PCM audio preservation',
      },
      {
        id: 'opus',
        category: 'audio',
        label: 'Opus Audio (High Efficiency)',
        badge: 'OPUS',
        container: 'opus',
        resolution: '160 kbps',
        size: sizeOpus,
        selector: 'opus',
        description: 'Modern open audio format with supreme acoustic efficiency',
      },

      // Utility Downloads (Snaptube / VidMate tools)
      {
        id: 'thumbnail',
        category: 'tool',
        label: 'Download High-Res Cover Art / Thumbnail',
        badge: 'IMAGE',
        container: 'jpg',
        resolution: 'Max Res',
        size: '~350 KB',
        selector: 'thumbnail',
        description: 'Download original video poster / album cover art',
      },
      {
        id: 'subtitles',
        category: 'tool',
        label: 'Download English Subtitles (.srt)',
        badge: 'SUBS',
        container: 'srt',
        resolution: 'Text',
        size: '~45 KB',
        selector: 'subtitles',
        description: 'Extract closed captions / auto-subs to standard .srt file',
      },
      {
        id: 'clip',
        category: 'tool',
        label: 'Clip Stream Segment (Trim Audio/Video)',
        badge: 'CLIP',
        container: 'mp4',
        resolution: 'Slice',
        size: 'Dynamic',
        selector: 'clip',
        description: 'Extract a time slice (e.g. 00:01:00 to 00:02:30)',
      },
      {
        id: 'custom',
        category: 'tool',
        label: 'Custom Stream Code (Manual Passthrough)',
        badge: 'CUSTOM',
        container: 'raw',
        resolution: 'Manual',
        size: 'Dynamic',
        selector: 'custom',
        description: 'Manually specify raw yt-dlp format code (e.g. 137+140)',
      },
    ];

    return options;
  }
}
