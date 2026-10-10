/**
 * @file src/parser/UrlInspector.ts
 * Multi-source metadata inspection and query resolution.
 */

import { spawn } from 'node:child_process';
import { MediaMetadata, SearchResultItem, StreamFormat } from '../types/index.js';
import { FormatParser } from './FormatParser.js';
import { InspectionError } from '../errors/SystemErrors.js';
import { ErrorClassifier } from '../errors/ErrorClassifier.js';
import { ProcessRegistry } from '../core/ProcessRegistry.js';
import { getEngineScriptPath } from '../utils/paths.js';
import { resolvePython } from '../utils/python.js';

export class UrlInspector {
  private get pyEnginePath(): string {
    return getEngineScriptPath();
  }

  public async inspect(url: string): Promise<MediaMetadata> {
    const sanitizeTitle = (title: string) => title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'media';
    try {
      const rawJson = await this.executeSubprocess(['info', '--url', url]);
      const parsed = JSON.parse(rawJson);
      if (parsed.error) {
        const cleanTitle = url.split('/').pop()?.split('?')[0] || 'Online Media';
        return {
          id: url,
          title: `Stream [${cleanTitle}]`,
          sanitizedTitle: sanitizeTitle(cleanTitle),
          channel: 'Multi-Source Media',
          duration: 0,
          thumbnailUrl: '',
          originalUrl: url,
          uploader: 'Multi-Source Media',
          durationString: '--:--',
          thumbnail: null,
          url,
          formatsCount: 10,
          viewCount: null,
        };
      }

      const item = parsed.type === 'single' ? parsed.data : parsed.items?.[0] || parsed;
      const durationSeconds = item.duration ? Math.round(Number(item.duration)) : 0;
      const durStr = durationSeconds > 0
        ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
        : '--:--';
      const rawTitle = item.title || 'Unknown Media';
      const channel = item.uploader || item.channel || 'Unknown Creator';
      const thumb = item.thumbnail || '';

      return {
        id: item.id || '',
        title: rawTitle,
        sanitizedTitle: sanitizeTitle(rawTitle),
        duration: durationSeconds,
        channel,
        thumbnailUrl: thumb,
        originalUrl: item.webpage_url || url,
        uploader: channel,
        durationString: durStr,
        thumbnail: thumb || null,
        url: item.webpage_url || url,
        formatsCount: Array.isArray(item.formats) ? item.formats.length : 0,
        viewCount: item.view_count ?? null,
      };
    } catch (err: any) {
      const cleanTitle = url.split('/').pop()?.split('?')[0] || 'Online Media';
      return {
        id: url,
        title: `Stream [${cleanTitle}]`,
        sanitizedTitle: sanitizeTitle(cleanTitle),
        channel: 'Multi-Source Media',
        duration: 0,
        thumbnailUrl: '',
        originalUrl: url,
        uploader: 'Multi-Source Media',
        durationString: '--:--',
        thumbnail: null,
        url,
        formatsCount: 10,
        viewCount: null,
      };
    }
  }

  public async probe(url: string): Promise<{ metadata: MediaMetadata; formats: StreamFormat[] }> {
    const sanitizeTitle = (title: string) => title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'media';
    try {
      const rawJson = await this.executeSubprocess(['probe', '--url', url]);
      const parsed = JSON.parse(rawJson);
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const m = parsed.metadata || {};
      const rawTitle = m.title || 'Unknown Media';
      const durationSeconds = m.duration ? Math.round(Number(m.duration)) : 0;
      const durStr = m.durationString || (durationSeconds > 0
        ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
        : '--:--');

      const metadata: MediaMetadata = {
        id: m.id || url,
        title: rawTitle,
        sanitizedTitle: sanitizeTitle(rawTitle),
        duration: durationSeconds,
        channel: m.channel || m.uploader || 'Multi-Source Media',
        thumbnailUrl: m.thumbnailUrl || m.thumbnail || '',
        originalUrl: m.originalUrl || m.url || url,
        uploader: m.uploader || m.channel || 'Multi-Source Media',
        durationString: durStr,
        thumbnail: m.thumbnail || null,
        url: m.url || m.originalUrl || url,
        formatsCount: Array.isArray(parsed.formats) ? parsed.formats.length : 10,
        viewCount: m.viewCount ?? null,
      };

      const formats: StreamFormat[] = (Array.isArray(parsed.formats) ? parsed.formats : []).map((r: any) => ({
        id: r.id,
        extension: r.ext || r.extension || '',
        resolution: r.resolution || '',
        fps: r.fps ?? null,
        videoCodec: r.vcodec || r.videoCodec || null,
        audioCodec: r.acodec || r.audioCodec || null,
        totalBitrate: r.tbr || r.totalBitrate || '',
        filesize: r.filesize || null,
        protocol: r.proto || r.protocol || 'https',
        kind: r.kind || 'video',
        rawLabel: r.label || r.rawLabel || '',
      }));

      return { metadata, formats };
    } catch (err: any) {
      const meta = await this.inspect(url);
      const formats = await this.getAvailableFormats(url);
      return { metadata: meta, formats };
    }
  }

  public async getAvailableFormats(url: string): Promise<StreamFormat[]> {
    const output = await this.executeSubprocess(['formats', '--url', url]);
    try {
      const jsonParsed = JSON.parse(output);
      if (Array.isArray(jsonParsed)) {
        return jsonParsed.map((r: any) => ({
          id: r.id,
          extension: r.ext,
          resolution: r.resolution,
          fps: r.fps,
          videoCodec: r.vcodec,
          audioCodec: r.acodec,
          totalBitrate: r.tbr,
          filesize: r.filesize,
          protocol: r.proto,
          kind: r.kind,
          rawLabel: r.label,
        }));
      }
    } catch {
      // Raw table fallback
    }
    return FormatParser.parseTable(output);
  }

  public async search(query: string, source: string = 'youtube', count: number = 15): Promise<SearchResultItem[]> {
    const rawJson = await this.executeSubprocess([
      'search',
      '--query', query,
      '--source', source,
      '--count', count.toString(),
    ]);

    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.error) {
        const classified = ErrorClassifier.classify(parsed.error);
        throw new InspectionError(classified.message, classified.kind);
      }
      return (parsed.results || []).map((r: any) => ({
        id: r.id,
        title: r.title || 'Untitled Stream',
        uploader: r.uploader || 'Unknown Channel',
        duration: r.duration || '',
        url: r.url,
        viewCount: r.view_count ?? null,
        source: parsed.source || source,
      }));
    } catch (err: any) {
      if (err instanceof InspectionError) throw err;
      throw new InspectionError(`Search lookup failed: ${err.message}`);
    }
  }

  private executeSubprocess(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let py;
      try {
        py = resolvePython();
      } catch (err: any) {
        return reject(new InspectionError(err.message));
      }

      const proc = spawn(py.command, [...py.args, this.pyEnginePath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      ProcessRegistry.track(proc);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      proc.on('error', (err) => {
        reject(new InspectionError(`Failed to spawn inspector subprocess: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          const errText = stderr.trim() || stdout.trim();
          const classified = ErrorClassifier.classify(errText);
          reject(new InspectionError(classified.message, classified.kind));
        }
      });
    });
  }
}
