/**
 * @file src/parser/FormatRegistry.ts
 * Single source of truth for canonical quality tiers and raw selector resolution.
 */

import { QualityTier } from '../types/index.js';

export class FormatRegistry {
  private static readonly VIDEO_TIERS: ReadonlyArray<QualityTier> = [
    {
      id: '2160p_mp4',
      label: '4K Ultra HD (2160p)',
      hint: '3840x2160 AVC/HEVC/AV1',
      selector: 'bv*[height<=2160][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: '1440p_mp4',
      label: '1440p Quad HD (2K)',
      hint: '2560x1440 high bitrate',
      selector: 'bv*[height<=1440][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: '1080p_mp4',
      label: '1080p Full HD',
      hint: '1920x1080 standard balance',
      selector: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: '720p_mp4',
      label: '720p HD',
      hint: '1280x720 fast download',
      selector: 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: '480p_mp4',
      label: '480p Standard (SD)',
      hint: '854x480 low bandwidth',
      selector: 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: '360p_mp4',
      label: '360p Minimal',
      hint: '640x360 data saver',
      selector: 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      container: 'mp4',
      mergeFormat: 'mp4',
      mode: 'video',
    },
    {
      id: 'av1_efficient',
      label: 'AV1/VP9 High Efficiency',
      hint: 'Smaller file size at high visual fidelity',
      selector: 'bv*[vcodec^=av01][height<=1080]+ba/bv*[vcodec^=vp9]+ba/b',
      container: 'any',
      mergeFormat: null,
      mode: 'video',
    },
    {
      id: 'best_available',
      label: 'Best Available Stream',
      hint: 'Highest resolution and audio stream',
      selector: 'bv*+ba/b',
      container: 'any',
      mergeFormat: null,
      mode: 'video',
    },
  ];

  private static readonly AUDIO_TIERS: ReadonlyArray<QualityTier> = [
    {
      id: 'mp3',
      label: 'MP3 Audio (320 kbps)',
      hint: 'Extracted audio transcoded to 320k MP3',
      selector: 'mp3',
      container: 'audio',
      mergeFormat: null,
      audioQuality: '320K',
      mode: 'audio',
    },
    {
      id: 'm4a',
      label: 'M4A / AAC Audio',
      hint: 'Native stream extraction without lossy recode',
      selector: 'm4a',
      container: 'audio',
      mergeFormat: null,
      audioQuality: '0',
      mode: 'audio',
    },
    {
      id: 'opus',
      label: 'Opus Audio (High Fidelity)',
      hint: 'Modern high-efficiency open audio codec',
      selector: 'opus',
      container: 'audio',
      mergeFormat: null,
      audioQuality: '0',
      mode: 'audio',
    },
    {
      id: 'flac',
      label: 'FLAC Audio (Lossless)',
      hint: 'Full lossless PCM audio transcode',
      selector: 'flac',
      container: 'audio',
      mergeFormat: null,
      audioQuality: '0',
      mode: 'audio',
    },
  ];

  public static listVideoTiers(): ReadonlyArray<QualityTier> {
    return this.VIDEO_TIERS;
  }

  public static listAudioTiers(): ReadonlyArray<QualityTier> {
    return this.AUDIO_TIERS;
  }

  public static listAll(): ReadonlyArray<QualityTier> {
    return [...this.VIDEO_TIERS, ...this.AUDIO_TIERS];
  }

  public static resolve(input: string | null | undefined): QualityTier {
    if (!input || input.trim() === '') {
      return this.VIDEO_TIERS.find((t) => t.id === 'best_available')!;
    }

    const trimmed = input.trim();
    const matchedTier =
      this.VIDEO_TIERS.find((t) => t.id === trimmed) ||
      this.AUDIO_TIERS.find((t) => t.id === trimmed);

    if (matchedTier) {
      return matchedTier;
    }

    // Direct passthrough for custom format codes (e.g. "396+249", "137+140", "bv*")
    const isAudioCodec = ['mp3', 'aac', 'm4a', 'opus', 'flac', 'wav'].includes(trimmed);
    return {
      id: trimmed,
      label: `Custom Format [${trimmed}]`,
      hint: 'Direct engine selector passthrough',
      selector: trimmed,
      container: isAudioCodec ? 'audio' : 'any',
      mergeFormat: null,
      audioQuality: isAudioCodec ? '320K' : undefined,
      mode: isAudioCodec ? 'audio' : 'passthrough',
    };
  }
}
