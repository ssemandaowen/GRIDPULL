/**
 * @file src/cli/CLIController.ts
 * Interactive terminal state machine controller and renderer.
 * Pure terminal engine with raw TTY keyboard routing, universal format resolution,
 * and comprehensive VidMate / Snaptube stream processing tools.
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { TerminalContext } from './TerminalContext.js';
import { AppState } from './StateMachine.js';
import { QueueManager } from '../core/QueueManager.js';
import { UrlInspector } from '../parser/UrlInspector.js';
import { FormatRegistry } from '../parser/FormatRegistry.js';
import { UniversalFormatResolver, ResolvedFormatItem } from '../parser/UniversalFormatResolver.js';
import { HistoryRepository } from '../storage/HistoryRepository.js';
import { ConfigStore } from '../storage/ConfigStore.js';
import { DependencyChecker } from '../core/DependencyChecker.js';
import { MediaMetadata, SearchResultItem, StreamFormat } from '../types/index.js';

interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  action: () => void | Promise<void>;
}

export class CLIController {
  private currentState: AppState = AppState.MAIN_MENU;
  private cursorIndex = 0;
  private menuItems: MenuItem[] = [];
  private inputBuffer = '';
  private isRunning = true;
  private statusMessage = '';
  private isBusy = false;

  // Domain state
  private inspectedMedia: MediaMetadata | null = null;
  private targetUrl: string = '';
  private liveFormats: StreamFormat[] = [];
  private resolvedFormats: ResolvedFormatItem[] = [];
  private searchResults: SearchResultItem[] = [];
  private selectedResult: SearchResultItem | null = null;
  private searchSource = 'youtube';

  // Tool specific inputs
  private clipRange = '*00:00:00-00:01:00';
  private cookiesPath = '';

  private readonly queueManager: QueueManager;
  private readonly urlInspector: UrlInspector;
  private readonly historyRepo: HistoryRepository;
  private readonly configStore: ConfigStore;

  constructor() {
    this.queueManager = QueueManager.getInstance();
    this.urlInspector = new UrlInspector();
    this.historyRepo = HistoryRepository.getInstance();
    this.configStore = ConfigStore.getInstance();

    this.queueManager.on('jobCompleted', () => {
      if (this.currentState === AppState.QUEUE_MONITOR) this.render();
    });
    this.queueManager.on('jobFailed', () => {
      if (this.currentState === AppState.QUEUE_MONITOR) this.render();
    });
    this.queueManager.on('telemetry', () => {
      if (this.currentState === AppState.QUEUE_MONITOR) this.render();
    });
  }

  public async start(): Promise<void> {
    TerminalContext.initialize();
    this.setupKeyBindings();
    this.transitionTo(AppState.MAIN_MENU);

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(interval);
          TerminalContext.restore();
          TerminalContext.clear();
          resolve();
        }
      }, 50);
    });
  }

  public transitionTo(state: AppState, statusMsg?: string): void {
    this.currentState = state;
    this.cursorIndex = 0;
    this.inputBuffer = '';
    if (statusMsg !== undefined) this.statusMessage = statusMsg;

    switch (state) {
      case AppState.MAIN_MENU:
        this.setupMainMenu();
        break;
      case AppState.TOOLS_MENU:
        this.setupToolsMenu();
        break;
      case AppState.QUEUE_MONITOR:
        this.setupQueueMonitorMenu();
        break;
      case AppState.HISTORY_VIEW:
        this.setupHistoryMenu();
        break;
      case AppState.SETTINGS_VIEW:
        this.setupSettingsMenu();
        break;
      case AppState.DEPS_CHECK:
        this.setupDepsMenu();
        break;
      case AppState.CONFIRM_EXIT:
        this.menuItems = [
          { id: 'y', label: 'Yes, terminate application', action: () => { this.isRunning = false; } },
          { id: 'n', label: 'No, return to main menu', action: () => this.transitionTo(AppState.MAIN_MENU) },
        ];
        break;
      default:
        this.menuItems = [];
        break;
    }

    this.render();
  }

  private setupMainMenu(): void {
    const counts = this.queueManager.getStatusCounts();
    const queueHint = `${counts.running} active, ${counts.pending} queued${counts.failed ? `, ${counts.failed} failed` : ''}`;

    this.menuItems = [
      {
        id: 'url',
        label: '📥 Download Single URL',
        hint: 'Paste video/audio URL & select format with size',
        action: () => this.transitionTo(AppState.URL_INPUT),
      },
      {
        id: 'search',
        label: '🔍 Search & Download',
        hint: 'Direct query across YouTube, SoundCloud, etc.',
        action: () => this.transitionTo(AppState.SEARCH_PROMPT),
      },
      {
        id: 'batch',
        label: '📦 Batch File Ingestion',
        hint: 'Multi-URL batch processing (.txt file)',
        action: () => this.transitionTo(AppState.BATCH_PROMPT),
      },
      {
        id: 'tools',
        label: '🛠️  Media Processing Tools (VidMate / Snaptube)',
        hint: 'Extract MP3, high-res posters, clip trimmer, subtitles',
        action: () => this.transitionTo(AppState.TOOLS_MENU),
      },
      {
        id: 'queue',
        label: '⚡ Active Queue Monitor',
        hint: queueHint,
        action: () => this.transitionTo(AppState.QUEUE_MONITOR),
      },
      {
        id: 'history',
        label: '📊 Audit History Log',
        hint: 'Inspect previous downloads and target files',
        action: () => this.transitionTo(AppState.HISTORY_VIEW),
      },
      {
        id: 'settings',
        label: '⚙️  Engine Configuration',
        hint: 'Threads, directory paths, bandwidth limits',
        action: () => this.transitionTo(AppState.SETTINGS_VIEW),
      },
      {
        id: 'deps',
        label: '🩺 System Binary Diagnostics',
        hint: 'Check Node, Python, FFmpeg, and yt-dlp status',
        action: () => this.transitionTo(AppState.DEPS_CHECK),
      },
      {
        id: 'exit',
        label: '🚪 Exit Application',
        hint: 'Safely terminate background processes',
        action: () => this.transitionTo(AppState.CONFIRM_EXIT),
      },
    ];
  }

  private setupToolsMenu(): void {
    this.menuItems = [
      {
        id: 'tool_audio',
        label: '🎵 Extract Audio to MP3 / FLAC Studio Master',
        hint: 'Convert any video stream into pristine 320k audio',
        action: () => {
          this.statusMessage = 'Enter URL to convert to audio:';
          this.transitionTo(AppState.URL_INPUT);
        },
      },
      {
        id: 'tool_thumb',
        label: '🖼️  Extract High-Resolution Cover Art / Thumbnail',
        hint: 'Download HD video poster or album artwork as JPG',
        action: () => {
          this.statusMessage = 'Enter URL to extract album artwork / thumbnail:';
          this.transitionTo(AppState.THUMBNAIL_PROMPT);
        },
      },
      {
        id: 'tool_subs',
        label: '📝 Download Subtitles & Closed Captions (.srt)',
        hint: 'Extract automatic or translated English subtitles',
        action: () => {
          this.statusMessage = 'Enter URL to extract subtitles:';
          this.transitionTo(AppState.SUBTITLES_PROMPT);
        },
      },
      {
        id: 'tool_clip',
        label: '✂️  Stream Trimmer / Section Clipper',
        hint: 'Download only a designated time range (e.g. 01:00 to 02:30)',
        action: () => {
          this.statusMessage = 'Enter URL to clip segment:';
          this.transitionTo(AppState.CLIP_PROMPT);
        },
      },
      {
        id: 'tool_cookies',
        label: '🍪 Netscape Cookies Configuration',
        hint: 'Bypass age restrictions & bot protections',
        action: () => this.transitionTo(AppState.COOKIES_PROMPT),
      },
      {
        id: 'back',
        label: '↩  Back to Main Menu',
        action: () => this.transitionTo(AppState.MAIN_MENU),
      },
    ];
  }

  private setupQueueMonitorMenu(): void {
    const counts = this.queueManager.getStatusCounts();
    this.menuItems = [
      {
        id: 'toggle_pause',
        label: counts.isPaused ? '▶  Resume All Downloads' : '⏸  Pause Active Queue',
        action: () => {
          if (counts.isPaused) this.queueManager.start();
          else this.queueManager.pause();
          this.setupQueueMonitorMenu();
          this.render();
        },
      },
      {
        id: 'retry_failed',
        label: '↻  Retry All Failed Downloads',
        action: () => {
          const retried = this.queueManager.retryAllFailed();
          this.statusMessage = `Retried ${retried} failed items.`;
          this.setupQueueMonitorMenu();
          this.render();
        },
      },
      {
        id: 'back',
        label: '↩  Back to Main Menu',
        action: () => this.transitionTo(AppState.MAIN_MENU),
      },
    ];
  }

  private setupHistoryMenu(): void {
    this.menuItems = [
      {
        id: 'clear',
        label: '🗑  Clear Audit History',
        action: () => {
          this.historyRepo.clear();
          this.statusMessage = 'History log cleared.';
          this.render();
        },
      },
      {
        id: 'back',
        label: '↩  Back to Main Menu',
        action: () => this.transitionTo(AppState.MAIN_MENU),
      },
    ];
  }

  private setupSettingsMenu(): void {
    const cfg = this.configStore.getAll();
    this.menuItems = [
      {
        id: 'dir',
        label: `📁 Output Folder: ${cfg.downloadDir}`,
        action: () => {
          this.statusMessage = 'Output directory configured in ~/.config/gridpull-cli/config.json';
          this.render();
        },
      },
      {
        id: 'threads',
        label: `⚡ Concurrency: ${cfg.maxConcurrency} jobs | Parallel Threads: ${cfg.parallelThreads}`,
        action: () => {
          const next = cfg.maxConcurrency === 2 ? 4 : 2;
          this.configStore.set('maxConcurrency', next);
          this.setupSettingsMenu();
          this.render();
        },
      },
      {
        id: 'reset',
        label: '♻ Reset Settings to Factory Defaults',
        action: () => {
          this.configStore.reset();
          this.statusMessage = 'Configuration restored to defaults.';
          this.setupSettingsMenu();
          this.render();
        },
      },
      {
        id: 'back',
        label: '↩  Back to Main Menu',
        action: () => this.transitionTo(AppState.MAIN_MENU),
      },
    ];
  }

  private setupDepsMenu(): void {
    this.menuItems = [
      {
        id: 'refresh',
        label: '↻  Re-run Dependency Check',
        action: () => {
          this.setupDepsMenu();
          this.render();
        },
      },
      {
        id: 'back',
        label: '↩  Back to Main Menu',
        action: () => this.transitionTo(AppState.MAIN_MENU),
      },
    ];
  }

  private setupFormatSelectionMenu(targetUrl: string, mediaTitle?: string): void {
    this.targetUrl = targetUrl;
    this.resolvedFormats = UniversalFormatResolver.resolveFormats(this.inspectedMedia, this.liveFormats);

    this.menuItems = this.resolvedFormats.map((f) => {
      let icon = '🎬';
      if (f.category === 'audio') icon = '🎵';
      else if (f.id === 'thumbnail') icon = '🖼️ ';
      else if (f.id === 'subtitles') icon = '📝';
      else if (f.id === 'clip') icon = '✂️ ';
      else if (f.id === 'custom') icon = '✏️ ';

      return {
        id: f.id,
        label: `${icon} [${f.badge.padEnd(8, ' ')}] ${f.label.padEnd(34, ' ')} ${f.size}`,
        hint: f.description,
        action: () => {
          if (f.id === 'custom') {
            this.transitionTo(AppState.CUSTOM_FORMAT_INPUT);
            return;
          }
          if (f.id === 'clip') {
            this.transitionTo(AppState.CLIP_PROMPT);
            return;
          }
          if (f.id === 'thumbnail') {
            this.queueManager.enqueue(targetUrl, {
              format: 'thumbnail',
              title: `${mediaTitle || 'Media'} [Cover Art]`,
              writeThumbnail: true,
              mediaType: 'video',
            });
            this.transitionTo(AppState.QUEUE_MONITOR, `Queued Thumbnail Extraction for: ${mediaTitle || targetUrl}`);
            return;
          }
          if (f.id === 'subtitles') {
            this.queueManager.enqueue(targetUrl, {
              format: 'subtitles',
              title: `${mediaTitle || 'Media'} [Subtitles]`,
              writeSubs: true,
              subLang: 'en',
              mediaType: 'video',
            });
            this.transitionTo(AppState.QUEUE_MONITOR, `Queued Subtitle Extraction for: ${mediaTitle || targetUrl}`);
            return;
          }

          const isAudio = f.category === 'audio';
          this.queueManager.enqueue(targetUrl, {
            format: f.selector,
            title: mediaTitle,
            mediaType: isAudio ? 'audio' : 'video',
          });
          this.transitionTo(AppState.QUEUE_MONITOR, `Queued: ${f.label} (${f.size})`);
        },
      };
    });

    this.menuItems.push({
      id: 'back',
      label: '↩  Cancel & Return to Main Menu',
      action: () => this.transitionTo(AppState.MAIN_MENU),
    });
  }

  private setupKeyBindings(): void {
    process.stdin.on('keypress', (str: string, key: readline.Key) => {
      if (!this.isRunning) return;

      if (key.ctrl && key.name === 'c') {
        this.transitionTo(AppState.CONFIRM_EXIT);
        return;
      }

      this.handleInput(str, key);
    });
  }

  private async handleInput(str: string, key: readline.Key): Promise<void> {
    if (this.isBusy) return;

    switch (this.currentState) {
      case AppState.MAIN_MENU:
      case AppState.TOOLS_MENU:
      case AppState.FORMAT_SELECTION:
      case AppState.SEARCH_RESULTS:
      case AppState.QUEUE_MONITOR:
      case AppState.HISTORY_VIEW:
      case AppState.SETTINGS_VIEW:
      case AppState.DEPS_CHECK:
      case AppState.CONFIRM_EXIT:
        if (key.name === 'up' || str === 'k') {
          this.cursorIndex = (this.cursorIndex - 1 + this.menuItems.length) % this.menuItems.length;
          this.render();
        } else if (key.name === 'down' || str === 'j') {
          this.cursorIndex = (this.cursorIndex + 1) % this.menuItems.length;
          this.render();
        } else if (key.name === 'return') {
          const selected = this.menuItems[this.cursorIndex];
          if (selected) await selected.action();
        } else if (key.name === 'escape') {
          if (this.currentState !== AppState.MAIN_MENU) {
            this.transitionTo(AppState.MAIN_MENU);
          }
        }
        break;

      case AppState.URL_INPUT:
      case AppState.THUMBNAIL_PROMPT:
      case AppState.SUBTITLES_PROMPT:
        if (key.name === 'return') {
          const trimmed = this.inputBuffer.trim();
          if (trimmed) {
            if (this.currentState === AppState.THUMBNAIL_PROMPT) {
              this.queueManager.enqueue(trimmed, {
                format: 'thumbnail',
                writeThumbnail: true,
                title: 'Media Poster / Artwork',
              });
              this.transitionTo(AppState.QUEUE_MONITOR, `Queued Thumbnail download for: ${trimmed}`);
            } else if (this.currentState === AppState.SUBTITLES_PROMPT) {
              this.queueManager.enqueue(trimmed, {
                format: 'subtitles',
                writeSubs: true,
                subLang: 'en',
                title: 'Closed Captions / Subtitles',
              });
              this.transitionTo(AppState.QUEUE_MONITOR, `Queued Subtitle download for: ${trimmed}`);
            } else {
              await this.inspectAndSelectFormat(trimmed);
            }
          }
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.MAIN_MENU);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;

      case AppState.CLIP_PROMPT:
        if (key.name === 'return') {
          const trimmed = this.inputBuffer.trim();
          if (trimmed) {
            const parts = trimmed.split(' ');
            const url = parts[0];
            const section = parts[1] || '*00:00:10-00:01:00';
            this.queueManager.enqueue(url, {
              format: 'best',
              section,
              title: `Clip [${section}]`,
            });
            this.transitionTo(AppState.QUEUE_MONITOR, `Queued Clip (${section}) for: ${url}`);
          }
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.MAIN_MENU);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;

      case AppState.COOKIES_PROMPT:
        if (key.name === 'return') {
          const trimmed = this.inputBuffer.trim();
          if (trimmed) {
            this.cookiesPath = trimmed;
            this.statusMessage = `Cookies set to: ${trimmed}`;
          }
          this.transitionTo(AppState.MAIN_MENU);
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.MAIN_MENU);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;

      case AppState.CUSTOM_FORMAT_INPUT:
        if (key.name === 'return') {
          const customCode = this.inputBuffer.trim() || 'bv*+ba/b';
          const targetUrl = this.inspectedMedia?.url || this.targetUrl;
          this.queueManager.enqueue(targetUrl, {
            format: customCode,
            title: this.inspectedMedia?.title,
          });
          this.transitionTo(AppState.QUEUE_MONITOR, `Queued format [${customCode}]`);
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.FORMAT_SELECTION);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;

      case AppState.SEARCH_PROMPT:
        if (key.name === 'return') {
          const query = this.inputBuffer.trim();
          if (query) {
            await this.performSearch(query);
          }
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.MAIN_MENU);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;

      case AppState.BATCH_PROMPT:
        if (key.name === 'return') {
          const filePath = this.inputBuffer.trim();
          if (filePath && fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const urls = raw.split(/\r?\n/).map((u) => u.trim()).filter((u) => u.length > 0);
            this.queueManager.enqueueBatch(urls);
            this.transitionTo(AppState.QUEUE_MONITOR, `Enqueued ${urls.length} URLs from batch file.`);
          } else {
            this.statusMessage = `File not found: ${filePath}`;
            this.render();
          }
        } else if (key.name === 'backspace') {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.render();
        } else if (key.name === 'escape') {
          this.transitionTo(AppState.MAIN_MENU);
        } else if (str && !key.ctrl && !key.meta) {
          this.inputBuffer += str;
          this.render();
        }
        break;
    }
  }

  private async inspectAndSelectFormat(url: string): Promise<void> {
    this.isBusy = true;
    this.currentState = AppState.URL_INSPECTING;
    this.render();

    try {
      // Parallel fetch metadata & format probe for accurate manifest sizing
      const [meta, formats] = await Promise.all([
        this.urlInspector.inspect(url),
        this.urlInspector.getAvailableFormats(url).catch(() => []),
      ]);
      this.inspectedMedia = meta;
      this.liveFormats = formats;
      this.setupFormatSelectionMenu(url, this.inspectedMedia.title);
      this.currentState = AppState.FORMAT_SELECTION;
      this.statusMessage = `Stream inspected: ${this.inspectedMedia.title}`;
    } catch (err: any) {
      this.statusMessage = `Notice: ${err.message}`;
      this.setupFormatSelectionMenu(url);
      this.currentState = AppState.FORMAT_SELECTION;
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  private async performSearch(query: string): Promise<void> {
    this.isBusy = true;
    this.currentState = AppState.SEARCH_RUNNING;
    this.render();

    try {
      this.searchResults = await this.urlInspector.search(query, this.searchSource);
      this.menuItems = [
        ...this.searchResults.map((r) => ({
          id: r.id,
          label: `${r.title.slice(0, 52)} [${r.duration || 'Stream'}]`,
          hint: r.uploader,
          action: () => {
            this.selectedResult = r;
            this.inspectAndSelectFormat(r.url);
          },
        })),
        {
          id: 'back',
          label: '↩  Back to Search Prompt',
          action: () => this.transitionTo(AppState.SEARCH_PROMPT),
        },
      ];
      this.currentState = AppState.SEARCH_RESULTS;
      this.statusMessage = `Found ${this.searchResults.length} results for: "${query}"`;
    } catch (err: any) {
      this.statusMessage = `Search failed: ${err.message}`;
      this.transitionTo(AppState.SEARCH_PROMPT);
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  public render(): void {
    TerminalContext.clear();

    // Header Banner
    TerminalContext.writeLine(`${TerminalContext.BOLD}${TerminalContext.CYAN}================================================================================${TerminalContext.RESET}`);
    TerminalContext.writeLine(`${TerminalContext.BOLD}${TerminalContext.CYAN}  ⚡ GRIDPULL CLI // MULTI-SOURCE STREAM INGESTION & PROCESSING ENGINE          ${TerminalContext.RESET}`);
    TerminalContext.writeLine(`${TerminalContext.BOLD}${TerminalContext.CYAN}================================================================================${TerminalContext.RESET}`);

    // Status bar
    const counts = this.queueManager.getStatusCounts();
    TerminalContext.writeLine(
      `${TerminalContext.DIM}State: ${TerminalContext.RESET}${TerminalContext.YELLOW}${this.currentState}${TerminalContext.RESET}  |  ${TerminalContext.DIM}Queue: ${TerminalContext.GREEN}${counts.running} Active${TerminalContext.RESET}, ${TerminalContext.YELLOW}${counts.pending} Queued${TerminalContext.RESET}, ${TerminalContext.RED}${counts.failed} Failed${TerminalContext.RESET}${counts.isPaused ? ` [${TerminalContext.RED}PAUSED${TerminalContext.RESET}]` : ''}`
    );

    if (this.statusMessage) {
      TerminalContext.writeLine(`${TerminalContext.DIM}Notice:${TerminalContext.RESET} ${TerminalContext.CYAN}${this.statusMessage}${TerminalContext.RESET}`);
    }
    TerminalContext.writeLine();

    switch (this.currentState) {
      case AppState.MAIN_MENU:
      case AppState.TOOLS_MENU:
      case AppState.CONFIRM_EXIT:
      case AppState.HISTORY_VIEW:
      case AppState.SETTINGS_VIEW:
      case AppState.DEPS_CHECK:
        this.renderMenuList();
        if (this.currentState === AppState.HISTORY_VIEW) {
          this.renderHistoryTable();
        } else if (this.currentState === AppState.DEPS_CHECK) {
          this.renderDiagnosticsTable();
        }
        break;

      case AppState.URL_INPUT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Video, Audio, or Playlist URL:${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to Inspect formats & sizes, Esc to return to Main Menu]${TerminalContext.RESET}`);
        break;

      case AppState.THUMBNAIL_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Video URL to extract HD Cover Art / Poster:${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to extract original JPG, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.SUBTITLES_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Video URL to download English Subtitles (.srt):${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to extract English SRT, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.CLIP_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter URL and Time Range (e.g. <URL> *00:00:30-00:01:45):${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to clip section, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.COOKIES_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Path to Netscape cookies.txt file:${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to save cookies, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.URL_INSPECTING:
        TerminalContext.writeLine(`${TerminalContext.YELLOW}⌛ Extracting stream manifests and calculating format sizes...${TerminalContext.RESET}`);
        break;

      case AppState.FORMAT_SELECTION:
        if (this.inspectedMedia) {
          TerminalContext.writeLine(`${TerminalContext.BOLD}Target Title:   ${TerminalContext.RESET}${TerminalContext.GREEN}${this.inspectedMedia.title}${TerminalContext.RESET}`);
          TerminalContext.writeLine(`${TerminalContext.BOLD}Creator:        ${TerminalContext.RESET}${this.inspectedMedia.uploader}  (${this.inspectedMedia.durationString})`);
          TerminalContext.writeLine();
        }
        TerminalContext.writeLine(`${TerminalContext.BOLD}Select Stream Quality Tier & Estimated Download Size:${TerminalContext.RESET}`);
        this.renderMenuList();
        break;

      case AppState.CUSTOM_FORMAT_INPUT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Raw yt-dlp Format Code or Stream Pair:${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.DIM}Examples: 137+140, 248+251, bv*[height<=720]+ba, mp3${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to queue, Esc to return to tiers]${TerminalContext.RESET}`);
        break;

      case AppState.SEARCH_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Media Search Query:${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to query ${this.searchSource}, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.SEARCH_RUNNING:
        TerminalContext.writeLine(`${TerminalContext.YELLOW}⌛ Querying ${this.searchSource} catalog...${TerminalContext.RESET}`);
        break;

      case AppState.SEARCH_RESULTS:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Search Results (Select item to inspect formats & sizes):${TerminalContext.RESET}`);
        this.renderMenuList();
        break;

      case AppState.BATCH_PROMPT:
        TerminalContext.writeLine(`${TerminalContext.BOLD}Enter Path to Batch File (.txt):${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.DIM}File must contain 1 URL per line.${TerminalContext.RESET}`);
        TerminalContext.writeLine(`${TerminalContext.CYAN}> ${TerminalContext.RESET}${this.inputBuffer}${TerminalContext.INVERT} ${TerminalContext.RESET}`);
        TerminalContext.writeLine(`\n${TerminalContext.DIM}[Press Enter to load URLs, Esc to return]${TerminalContext.RESET}`);
        break;

      case AppState.QUEUE_MONITOR:
        this.renderActiveQueueView();
        this.renderMenuList();
        break;
    }

    TerminalContext.writeLine();
    TerminalContext.writeLine(`${TerminalContext.DIM}↑/↓ or j/k: Navigate | Enter: Select | Esc: Back | Ctrl+C: Exit${TerminalContext.RESET}`);
  }

  private renderMenuList(): void {
    this.menuItems.forEach((item, idx) => {
      const isSelected = idx === this.cursorIndex;
      const prefix = isSelected ? `${TerminalContext.GREEN} ❯ ` : '   ';
      const label = isSelected ? `${TerminalContext.BOLD}${TerminalContext.UNDERLINE}${item.label}${TerminalContext.RESET}` : item.label;
      const hint = item.hint ? `  ${TerminalContext.GRAY}(${item.hint})${TerminalContext.RESET}` : '';
      TerminalContext.writeLine(`${prefix}${label}${hint}`);
    });
  }

  private renderActiveQueueView(): void {
    const jobs = this.queueManager.getSnapshot();
    if (jobs.length === 0) {
      TerminalContext.writeLine(`  ${TerminalContext.DIM}(Queue is currently empty. Add URLs from main menu)${TerminalContext.RESET}\n`);
      return;
    }

    TerminalContext.writeLine(`${TerminalContext.BOLD}Active Jobs:${TerminalContext.RESET}`);
    jobs.slice(0, 8).forEach((j) => {
      const title = (j.title || j.filename || j.url).slice(0, 38);
      const bar = TerminalContext.renderBar(j.percent, 16);
      const statusColor =
        j.status === 'RUNNING'
          ? TerminalContext.CYAN
          : j.status === 'COMPLETED'
          ? TerminalContext.GREEN
          : j.status === 'FAILED'
          ? TerminalContext.RED
          : TerminalContext.YELLOW;

      TerminalContext.writeLine(
        `  ${statusColor}[${j.status.padEnd(9)}]${TerminalContext.RESET} ${title.padEnd(40)} ${bar} ${TerminalContext.DIM}${j.speed || ''} ETA: ${j.eta || ''}${TerminalContext.RESET}`
      );
      if (j.error) {
        TerminalContext.writeLine(`    ${TerminalContext.RED}↳ Error: ${j.error.slice(0, 75)}${TerminalContext.RESET}`);
      }
    });
    TerminalContext.writeLine();
  }

  private renderHistoryTable(): void {
    TerminalContext.writeLine();
    TerminalContext.writeLine(`${TerminalContext.BOLD}Recent Downloads Audit Log:${TerminalContext.RESET}`);
    const records = this.historyRepo.list(8);
    if (records.length === 0) {
      TerminalContext.writeLine(`  ${TerminalContext.DIM}(No past jobs logged)${TerminalContext.RESET}`);
      return;
    }
    records.forEach((r) => {
      const icon = r.status === 'COMPLETED' ? `${TerminalContext.GREEN}✔` : `${TerminalContext.RED}✖`;
      const title = r.title.slice(0, 45);
      const date = new Date(r.timestamp).toLocaleTimeString();
      TerminalContext.writeLine(`  ${icon} [${date}] ${title.padEnd(46)} ${TerminalContext.DIM}${r.format}${TerminalContext.RESET}`);
    });
  }

  private renderDiagnosticsTable(): void {
    TerminalContext.writeLine();
    TerminalContext.writeLine(`${TerminalContext.BOLD}System Dependencies Status:${TerminalContext.RESET}`);
    const deps = DependencyChecker.verifyAll();
    deps.forEach((d) => {
      const status = d.installed ? `${TerminalContext.GREEN}✔ INSTALLED (${d.version})` : `${TerminalContext.RED}✖ MISSING`;
      TerminalContext.writeLine(`  ${d.name.padEnd(14)}: ${status}${TerminalContext.RESET}`);
    });
  }
}
