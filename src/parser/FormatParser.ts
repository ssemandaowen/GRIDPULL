/**
 * @file src/parser/FormatParser.ts
 * Parses live yt-dlp -F table output into structured, type-safe stream records.
 */

import { StreamFormat, StreamKind } from '../types/index.js';

export class FormatParser {
  private static readonly SIZE_REGEX = /~\s*([\d.]+(?:KiB|MiB|GiB|TiB))|\b([\d.]+(?:KiB|MiB|GiB|TiB))/;

  public static parseTable(rawTable: string): StreamFormat[] {
    if (!rawTable || typeof rawTable !== 'string') return [];

    const lines = rawTable.split('\n');
    const records: StreamFormat[] = [];
    let tableHeaderDetected = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (!tableHeaderDetected) {
        if (line.startsWith('ID') && line.includes('EXT')) {
          tableHeaderDetected = true;
        }
        continue;
      }

      if (/^-+\s+-+/.test(line) || line.startsWith('[') || line.startsWith('Available')) {
        continue;
      }

      const columns = line.split('|').map((col) => col.trim());
      if (columns.length < 3) continue;

      const [leftCol, midCol, rightCol] = columns;
      const leftTokens = leftCol.split(/\s+/);
      if (leftTokens.length < 2) continue;

      const formatId = leftTokens[0];
      const extension = leftTokens[1];

      const leftRemainder = leftCol.slice(leftCol.indexOf(extension) + extension.length).trim();
      let resolution = 'unknown';
      let fps: number | null = null;

      if (leftRemainder.includes('audio only')) {
        resolution = 'audio only';
      } else {
        const resMatch = leftRemainder.match(/^(\d+x\d+|\S+)?\s*(\d+)?/);
        resolution = resMatch && resMatch[1] ? resMatch[1] : 'unknown';
        fps = resMatch && resMatch[2] ? parseInt(resMatch[2], 10) : null;
      }

      const sizeMatch = this.SIZE_REGEX.exec(midCol);
      const filesize = sizeMatch ? sizeMatch[1] || sizeMatch[2] : null;

      const midTokens = midCol.split(/\s+/);
      let protocol = '';
      let totalBitrate = '';
      for (const token of midTokens) {
        if (/^(http|https|m3u8|mhtml)$/.test(token)) {
          protocol = token;
        } else if (/^\d+(\.\d+)?k$/.test(token)) {
          totalBitrate = token;
        }
      }

      const { vcodec, acodec, kind } = this.parseCodecColumn(rightCol, resolution);

      records.push({
        id: formatId,
        extension,
        resolution,
        fps,
        videoCodec: vcodec,
        audioCodec: acodec,
        totalBitrate,
        filesize,
        protocol,
        kind,
        rawLabel: `${formatId} [${extension}] ${resolution} ${vcodec ?? ''} ${acodec ?? ''}`.trim(),
      });
    }

    return records;
  }

  private static parseCodecColumn(
    codecCell: string,
    resolution: string
  ): { vcodec: string | null; acodec: string | null; kind: StreamKind } {
    const cell = codecCell.trim();
    if (cell.includes('audio only') || resolution === 'audio only') {
      const parts = cell.split(/\s+/);
      let acodec = 'unknown';
      for (const part of parts) {
        if (!part.endsWith('k') && !part.startsWith('[') && part !== 'audio' && part !== 'only') {
          acodec = part;
          break;
        }
      }
      return { vcodec: null, acodec, kind: 'audio' };
    }

    const videoMatch = cell.match(/^(\S+)\s+(\d+k)?\s*(video only)?/);
    if (videoMatch) {
      return { vcodec: videoMatch[1], acodec: null, kind: 'video' };
    }

    return { vcodec: 'unknown', acodec: null, kind: 'muxed' };
  }
}
