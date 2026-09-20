/**
 * @file src/tui/App.tsx
 * Master Ink React component providing persistent dual-pane terminal layout,
 * non-blocking background concurrency, intuitive format mapping, and keyboard handling.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, useInput, useApp, useStdin } from 'ink';
import * as fs from 'node:fs';
import {
  MainNavView,
  UrlPullerStep,
  ModalState,
  ProbedBatchItem,
} from './types.js';
import { Header } from './components/Header.js';
import { Footer, ShortcutItem } from './components/Footer.js';
import { Modal } from './components/Modal.js';
import { ActiveDownloadsPanel } from './components/ActiveDownloadsPanel.js';
import { MainMenuView, MAIN_MENU_ITEMS } from './views/MainMenuView.js';
import { UrlPullerView } from './views/UrlPullerView.js';
import { SearchMediaView } from './views/SearchMediaView.js';
import { DownloadsManagerView, DownloadsTab, DownloadEntryItem } from './views/DownloadsManagerView.js';
import { ConfigurationView } from './views/ConfigurationView.js';
import { HelpView } from './views/HelpView.js';

import { QueueManager } from '../core/QueueManager.js';
import { UrlInspector } from '../parser/UrlInspector.js';
import { ConfigStore } from '../storage/ConfigStore.js';
import { HistoryRepository } from '../storage/HistoryRepository.js';
import { useDownloadNotification } from './hooks/useDownloadNotification.js';
import { StreamAnalyzer, VideoTierOption, AudioTierOption, parseBatchInput } from '../parser/StreamAnalyzer.js';
import { MediaMetadata, DownloadJob, SearchResultItem, HistoryRecord } from '../types/index.js';

export const App: React.FC = () => {
  const { exit } = useApp();
  const isRawModeSupported = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function');
  const queueManager = QueueManager.getInstance();
  const configStore = ConfigStore.getInstance();
  const inspector = new UrlInspector();

  // Terminal Dimensions
  const [terminalWidth, setTerminalWidth] = useState<number>(
    process.stdout.columns || 100
  );
  const [terminalHeight, setTerminalHeight] = useState<number>(
    process.stdout.rows || 30
  );

  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(process.stdout.columns || 100);
      setTerminalHeight(process.stdout.rows || 30);
    };
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Application State
  const [currentView, setCurrentView] = useState<MainNavView>('MAIN_MENU');
  const [mainMenuIndex, setMainMenuIndex] = useState<number>(0);
  const [jobs, setJobs] = useState<DownloadJob[]>(() => [...queueManager.getSnapshot()]);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Select an action or paste a URL.');
  const [isError, setIsError] = useState<boolean>(false);

  // Modal Dialog State
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'ALERT',
    title: '',
    message: '',
  });

  // URL Puller State
  const [pullerStep, setPullerStep] = useState<UrlPullerStep>('URL_INPUT');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [probingMsg, setProbingMsg] = useState<string>('');
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [videoOptions, setVideoOptions] = useState<VideoTierOption[]>([]);
  const [audioOptions, setAudioOptions] = useState<AudioTierOption[]>([]);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(0);
  const [selectedFormatIndex, setSelectedFormatIndex] = useState<number>(0);
  const [batchRawInput, setBatchRawInput] = useState<string>('');
  const [batchItems, setBatchItems] = useState<ProbedBatchItem[]>([]);
  const [selectedBatchStrategyIndex, setSelectedBatchStrategyIndex] = useState<number>(0);

  // Search View State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSource, setSearchSource] = useState<string>('youtube');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState<number>(0);
  const [searchCurrentPage, setSearchCurrentPage] = useState<number>(1);

  // Configuration View State
  const [engineConfig, setEngineConfig] = useState(() => configStore.getAll());
  const [configSelectedIndex, setConfigSelectedIndex] = useState<number>(0);

  // Downloads Manager & History State
  const historyRepo = HistoryRepository.getInstance();
  const [downloadsTab, setDownloadsTab] = useState<DownloadsTab>('ACTIVE');
  const [historyRecords, setHistoryRecords] = useState<ReadonlyArray<HistoryRecord>>(() => historyRepo.list(100));
  const [downloadsSelectedIndex, setDownloadsSelectedIndex] = useState<number>(0);

  // System Notification Hook: Native terminal bell + OS-level desktop notification bridge
  useDownloadNotification(queueManager, {
    onNotify: (summary, _job) => {
      setStatusMessage(`✔ [DONE] ${summary.filename} (${summary.size}) → ${summary.location}`);
      setIsError(false);
    },
  });

  // Listen to QueueManager events
  useEffect(() => {
    const updateJobs = () => {
      setJobs([...queueManager.getSnapshot()]);
      setHistoryRecords(historyRepo.list(100));
    };

    queueManager.on('jobEnqueued', updateJobs);
    queueManager.on('jobStarted', updateJobs);
    queueManager.on('jobProgress', updateJobs);
    queueManager.on('telemetry', updateJobs);
    queueManager.on('jobCompleted', (job: DownloadJob) => {
      updateJobs();
      setStatusMessage(`✔ Download complete: ${job.filename || job.title || job.url}`);
      setIsError(false);
    });
    queueManager.on('jobFailed', (job: DownloadJob) => {
      updateJobs();
      setStatusMessage(`✖ Download failed: ${job.error || 'Unknown error'}`);
      setIsError(true);
    });
    queueManager.on('queuePaused', () => {
      setIsQueuePaused(true);
      updateJobs();
    });
    queueManager.on('queueResumed', () => {
      setIsQueuePaused(false);
      updateJobs();
    });

    return () => {
      queueManager.removeAllListeners();
    };
  }, [queueManager]);

  // Derived categorized download items with strict structural metadata
  const activeItems: DownloadEntryItem[] = useMemo(() => {
    return jobs
      .filter((j) => j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'RETRYING')
      .map((j) => {
        let tag: DownloadEntryItem['statusTag'] = '[QUEUED]';
        let color: DownloadEntryItem['statusColor'] = 'gray';

        if (j.status === 'RUNNING') {
          tag = '[RUNNING]';
          color = 'cyan';
        } else if (j.status === 'RETRYING') {
          tag = '[RETRYING]';
          color = 'yellow';
        } else if (isQueuePaused) {
          tag = '[PAUSED]';
          color = 'yellow';
        }

        return {
          id: j.id,
          sourceType: 'queue',
          title: j.title || j.filename || j.url,
          url: j.url,
          format: j.formatSelector || j.mediaType || 'best',
          progress: `${j.percent.toFixed(0)}%`,
          speed: j.speed || '--',
          eta: j.eta || '--:--',
          statusTag: tag,
          statusColor: color,
          targetPath: j.targetDirectory,
          rawJob: j,
        };
      });
  }, [jobs, isQueuePaused]);

  const finishedItems: DownloadEntryItem[] = useMemo(() => {
    const result: DownloadEntryItem[] = [];
    const seenIds = new Set<string>();

    for (const j of jobs) {
      if (j.status === 'COMPLETED' && !seenIds.has(j.id)) {
        seenIds.add(j.id);
        result.push({
          id: j.id,
          sourceType: 'queue',
          title: j.title || j.filename || j.url,
          url: j.url,
          format: j.formatSelector || j.mediaType || 'mp4',
          progress: '100%',
          speed: '--',
          eta: 'DONE',
          statusTag: '[DONE]',
          statusColor: 'green',
          targetPath: j.targetDirectory,
          rawJob: j,
        });
      }
    }

    for (const r of historyRecords) {
      if (r.status === 'COMPLETED' && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        result.push({
          id: r.id,
          sourceType: 'history',
          title: r.title || r.url,
          url: r.url,
          format: r.format || r.mediaType || 'mp4',
          progress: '100%',
          speed: '--',
          eta: 'DONE',
          statusTag: '[DONE]',
          statusColor: 'green',
          targetPath: r.targetPath,
          rawHistory: r,
        });
      }
    }

    return result;
  }, [jobs, historyRecords]);

  const failedItems: DownloadEntryItem[] = useMemo(() => {
    const result: DownloadEntryItem[] = [];
    const seenIds = new Set<string>();

    for (const j of jobs) {
      if (j.status === 'FAILED' && !seenIds.has(j.id)) {
        seenIds.add(j.id);
        result.push({
          id: j.id,
          sourceType: 'queue',
          title: j.title || j.filename || j.url,
          url: j.url,
          format: j.formatSelector || j.mediaType || 'unknown',
          progress: `${j.percent.toFixed(0)}%`,
          speed: '--',
          eta: 'ERR',
          statusTag: '[FAILED]',
          statusColor: 'red',
          error: j.error,
          targetPath: j.targetDirectory,
          rawJob: j,
        });
      }
    }

    for (const r of historyRecords) {
      if (r.status === 'FAILED' && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        result.push({
          id: r.id,
          sourceType: 'history',
          title: r.title || r.url,
          url: r.url,
          format: r.format || r.mediaType || 'unknown',
          progress: '0%',
          speed: '--',
          eta: 'ERR',
          statusTag: '[FAILED]',
          statusColor: 'red',
          error: r.error,
          targetPath: r.targetPath,
          rawHistory: r,
        });
      }
    }

    return result;
  }, [jobs, historyRecords]);

  // Flash status message helper
  const flashStatus = useCallback((msg: string, err: boolean = false) => {
    setStatusMessage(msg);
    setIsError(err);
  }, []);

  // Helper to reset input state whenever returning or after dispatch
  const resetInputs = useCallback(() => {
    setInputUrl('');
    setCursorPos(0);
    setBatchRawInput('');
    setBatchItems([]);
    setSelectedBatchStrategyIndex(0);
    setMetadata(null);
    setSelectedTypeIndex(0);
    setSelectedFormatIndex(0);
  }, []);

  // Probe single URL stream & formats (single-pass probe via yt-dlp)
  const probeUrl = useCallback(
    async (targetUrl: string) => {
      const trimmed = targetUrl.trim();
      if (!trimmed) {
        flashStatus('Please enter a valid media URL.', true);
        return;
      }

      setPullerStep('PROBING');
      setProbingMsg(`Inspecting manifest for: ${trimmed}`);
      try {
        const { metadata: meta, formats: liveFormats } = await inspector.probe(trimmed);
        const { videoOptions: vOpts, audioOptions: aOpts } = StreamAnalyzer.analyzeStreams(meta, liveFormats);

        setMetadata(meta);
        setVideoOptions(vOpts);
        setAudioOptions(aOpts);
        setSelectedTypeIndex(0);
        setSelectedFormatIndex(0);
        setPullerStep('TYPE_SELECT');
        flashStatus(`Probed: "${meta.title.slice(0, 36)}" (${meta.durationString})`);
      } catch (err: any) {
        flashStatus(`Probe failed: ${err.message || err}`, true);
        setPullerStep('URL_INPUT');
      }
    },
    [inspector, flashStatus]
  );

  // Probe batch input items with generic format tiers
  const probeBatch = useCallback(
    async (rawInput: string) => {
      let urls: string[] = [];
      const trimmed = rawInput.trim();

      // Check if user entered a file path
      if (fs.existsSync(trimmed)) {
        try {
          const content = fs.readFileSync(trimmed, 'utf8');
          urls = parseBatchInput(content);
        } catch {
          urls = parseBatchInput(trimmed);
        }
      } else {
        urls = parseBatchInput(trimmed);
      }

      if (urls.length === 0) {
        flashStatus('No valid URLs found in batch input.', true);
        return;
      }

      const initialItems: ProbedBatchItem[] = urls.map((u, i) => ({
        id: `batch_${i}_${Date.now()}`,
        originalUrl: u,
        title: u.split('/').pop()?.split('?')[0] || `Stream #${i + 1}`,
        durationString: '--:--',
        status: 'READY' as const,
      }));

      setBatchItems(initialItems);

      // Build generic resolution & audio tier selectors (fast — no per-item probing)
      const { videoOptions: batchVOpts, audioOptions: batchAOpts } = StreamAnalyzer.analyzeStreams(null, []);
      setVideoOptions(batchVOpts);
      setAudioOptions(batchAOpts);
      setMetadata(null);
      setSelectedTypeIndex(0);
      setSelectedFormatIndex(0);
      setPullerStep('TYPE_SELECT');
      flashStatus(`Batch ready: ${urls.length} items. Select format tier.`);
    },
    [flashStatus]
  );

  // Keyboard Controller
  useInput((input, key) => {
    // 1. Modal Navigation
    if (modal.isOpen) {
      if (key.return || input.toLowerCase() === 'y') {
        if (modal.onConfirm) modal.onConfirm();
        setModal((prev) => ({ ...prev, isOpen: false }));
      } else if (key.escape || input.toLowerCase() === 'n') {
        if (modal.onCancel) modal.onCancel();
        setModal((prev) => ({ ...prev, isOpen: false }));
      }
      return;
    }

    // 2. Global Ctrl+C / Exit
    if (key.ctrl && input === 'c') {
      setModal({
        isOpen: true,
        type: 'EXIT_CONFIRM',
        title: '🚪 Confirm Application Exit',
        message: 'Are you sure you want to stop background workers and exit GridPull?',
        confirmLabel: 'Exit App',
        cancelLabel: 'Stay',
        onConfirm: () => {
          exit();
          process.exit(0);
        },
      });
      return;
    }

    // 3. MAIN MENU ROUTING
    if (currentView === 'MAIN_MENU') {
      if (input === '1') {
        setCurrentView('SEARCH');
      } else if (input === '2') {
        resetInputs();
        setCurrentView('URL_PULLER');
        setPullerStep('URL_INPUT');
      } else if (input === '3') {
        setCurrentView('CONFIG');
      } else if (input === '4') {
        setCurrentView('DOWNLOADS');
      } else if (input === '5') {
        setCurrentView('HELP');
      } else if (input === '6') {
        setModal({
          isOpen: true,
          type: 'EXIT_CONFIRM',
          title: '🚪 Confirm Application Exit',
          message: 'Quit GridPull and return to terminal?',
          onConfirm: () => {
            exit();
            process.exit(0);
          },
        });
      } else if (key.upArrow) {
        setMainMenuIndex((prev) => (prev > 0 ? prev - 1 : MAIN_MENU_ITEMS.length - 1));
      } else if (key.downArrow) {
        setMainMenuIndex((prev) => (prev < MAIN_MENU_ITEMS.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const item = MAIN_MENU_ITEMS[mainMenuIndex];
        if (item.title === 'Exit') {
          setModal({
            isOpen: true,
            type: 'EXIT_CONFIRM',
            title: '🚪 Confirm Application Exit',
            message: 'Quit GridPull and return to terminal?',
            onConfirm: () => {
              exit();
              process.exit(0);
            },
          });
        } else {
          setCurrentView(item.targetView);
          if (item.targetView === 'URL_PULLER') {
            resetInputs();
            setPullerStep('URL_INPUT');
          }
        }
      }
      return;
    }

    // 4. URL PULLER VIEW
    if (currentView === 'URL_PULLER') {
      // Step: URL_INPUT
      if (pullerStep === 'URL_INPUT') {
        if (key.escape) {
          resetInputs();
          setCurrentView('MAIN_MENU');
          return;
        }
        if (key.tab) {
          // Paste standard public domain test URL
          setInputUrl('https://archive.org/details/BigBuckBunny_124');
          setCursorPos(44);
          return;
        }
        if ((input === 'b' || input === 'B') && !inputUrl) {
          setBatchRawInput('');
          setBatchItems([]);
          setSelectedBatchStrategyIndex(0);
          setPullerStep('BATCH_INPUT');
          return;
        }
        if (key.return) {
          probeUrl(inputUrl);
          return;
        }
        if (key.backspace || key.delete) {
          if (cursorPos > 0) {
            setInputUrl((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
            setCursorPos((prev) => prev - 1);
          }
          return;
        }
        if (key.leftArrow) {
          setCursorPos((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setCursorPos((prev) => Math.min(inputUrl.length, prev + 1));
          return;
        }
        if (input) {
          setInputUrl((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
          setCursorPos((prev) => prev + input.length);
        }
        return;
      }

      // Step: TYPE_SELECT
      if (pullerStep === 'TYPE_SELECT') {
        const isBatch = batchItems.length > 0;
        const maxIndex = isBatch ? 2 : 3;

        if (key.escape || input === '0') {
          if (isBatch) {
            flashStatus('Batch discarded.');
          }
          resetInputs();
          setCurrentView('MAIN_MENU');
          return;
        }
        if (input === '1') {
          setPullerStep('VIDEO_FORMAT');
          setSelectedFormatIndex(0);
          return;
        }
        if (input === '2') {
          setPullerStep('AUDIO_FORMAT');
          setSelectedFormatIndex(0);
          return;
        }
        if (!isBatch && input === '3') {
          setBatchRawInput('');
          setBatchItems([]);
          setSelectedBatchStrategyIndex(0);
          setPullerStep('BATCH_INPUT');
          return;
        }
        if (key.upArrow) {
          setSelectedTypeIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
        } else if (key.downArrow) {
          setSelectedTypeIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
        } else if (key.return) {
          if (selectedTypeIndex === 0) {
            setPullerStep('VIDEO_FORMAT');
            setSelectedFormatIndex(0);
          } else if (selectedTypeIndex === 1) {
            setPullerStep('AUDIO_FORMAT');
            setSelectedFormatIndex(0);
          } else if (!isBatch && selectedTypeIndex === 2) {
            setBatchRawInput('');
            setBatchItems([]);
            setSelectedBatchStrategyIndex(0);
            setPullerStep('BATCH_INPUT');
          } else {
            if (isBatch) {
              flashStatus('Batch discarded.');
            }
            resetInputs();
            setCurrentView('MAIN_MENU');
          }
        }
        return;
      }

      // Step: VIDEO_FORMAT
      if (pullerStep === 'VIDEO_FORMAT') {
        if (key.escape) {
          setPullerStep('TYPE_SELECT');
          return;
        }
        if (key.upArrow) {
          setSelectedFormatIndex((prev) => (prev > 0 ? prev - 1 : videoOptions.length - 1));
        } else if (key.downArrow) {
          setSelectedFormatIndex((prev) => (prev < videoOptions.length - 1 ? prev + 1 : 0));
        } else if (key.pageDown || input === '>' || input === ']') {
          setSelectedFormatIndex((prev) => Math.min(Math.max(0, videoOptions.length - 1), prev + 10));
        } else if (key.pageUp || input === '<' || input === '[') {
          setSelectedFormatIndex((prev) => Math.max(0, prev - 10));
        } else if (key.return) {
          const selected = videoOptions[selectedFormatIndex];
          if (selected) {
            if (batchItems.length > 0) {
              batchItems.forEach((item) => {
                queueManager.enqueue(item.originalUrl, {
                  format: selected.selector,
                  title: item.title,
                  mediaType: 'video',
                  autoStart: true,
                });
              });
              flashStatus(`Dispatched ${batchItems.length} items [${selected.resolution}] to worker pool.`);
              resetInputs();
              setCurrentView('MAIN_MENU');
            } else if (metadata) {
              queueManager.enqueue(metadata.originalUrl, {
                format: selected.selector,
                title: metadata.title,
                mediaType: 'video',
                autoStart: true,
              });
              flashStatus(`Queued: ${metadata.title} [${selected.resolution} // ${selected.estTotalSize}]`);
              resetInputs();
              setCurrentView('MAIN_MENU');
            }
          }
        }
        return;
      }

      // Step: AUDIO_FORMAT
      if (pullerStep === 'AUDIO_FORMAT') {
        if (key.escape) {
          setPullerStep('TYPE_SELECT');
          return;
        }
        if (key.upArrow) {
          setSelectedFormatIndex((prev) => (prev > 0 ? prev - 1 : audioOptions.length - 1));
        } else if (key.downArrow) {
          setSelectedFormatIndex((prev) => (prev < audioOptions.length - 1 ? prev + 1 : 0));
        } else if (key.pageDown || input === '>' || input === ']') {
          setSelectedFormatIndex((prev) => Math.min(Math.max(0, audioOptions.length - 1), prev + 10));
        } else if (key.pageUp || input === '<' || input === '[') {
          setSelectedFormatIndex((prev) => Math.max(0, prev - 10));
        } else if (key.return) {
          const selected = audioOptions[selectedFormatIndex];
          if (selected) {
            if (batchItems.length > 0) {
              batchItems.forEach((item) => {
                queueManager.enqueue(item.originalUrl, {
                  format: selected.selector,
                  title: item.title,
                  mediaType: 'audio',
                  autoStart: true,
                });
              });
              flashStatus(`Dispatched ${batchItems.length} audio items [${selected.format} ${selected.quality}] to worker pool.`);
              resetInputs();
              setCurrentView('MAIN_MENU');
            } else if (metadata) {
              queueManager.enqueue(metadata.originalUrl, {
                format: selected.selector,
                title: metadata.title,
                mediaType: 'audio',
                autoStart: true,
              });
              flashStatus(`Queued audio: ${metadata.title} [${selected.format} ${selected.quality}]`);
              resetInputs();
              setCurrentView('MAIN_MENU');
            }
          }
        }
        return;
      }

      // Step: BATCH_INPUT
      if (pullerStep === 'BATCH_INPUT') {
        if (key.escape) {
          resetInputs();
          setCurrentView('MAIN_MENU');
          return;
        }
        if (key.tab) {
          setBatchRawInput(
            'https://archive.org/details/BigBuckBunny_124 | https://archive.org/details/ElephantsDream_1080p'
          );
          return;
        }
        if (key.return) {
          probeBatch(batchRawInput);
          return;
        }
        if (key.backspace || key.delete) {
          setBatchRawInput((prev) => prev.slice(0, -1));
          return;
        }
        if (input) {
          setBatchRawInput((prev) => prev + input);
        }
        return;
      }

      // Step: BATCH_STRATEGY
      if (pullerStep === 'BATCH_STRATEGY') {
        if (key.escape) {
          resetInputs();
          setCurrentView('MAIN_MENU');
          return;
        }
        if (key.upArrow) {
          setSelectedBatchStrategyIndex((prev) => (prev > 0 ? prev - 1 : 2));
        } else if (key.downArrow) {
          setSelectedBatchStrategyIndex((prev) => (prev < 2 ? prev + 1 : 0));
        } else if (key.return) {
          if (selectedBatchStrategyIndex === 2) {
            flashStatus('Batch discarded.');
            resetInputs();
            setCurrentView('MAIN_MENU');
            return;
          }

          const format = selectedBatchStrategyIndex === 0 ? '720p_mp4' : 'mp3_192';
          const mediaType = selectedBatchStrategyIndex === 0 ? 'video' : 'audio';

          batchItems.forEach((item) => {
            queueManager.enqueue(item.originalUrl, {
              format,
              title: item.title,
              mediaType,
              autoStart: true,
            });
          });

          flashStatus(`Dispatched ${batchItems.length} items to background queue.`);
          resetInputs();
          setCurrentView('MAIN_MENU');
        }
        return;
      }
    }

    // 5. SEARCH VIEW
    if (currentView === 'SEARCH') {
      if (key.escape) {
        if (searchResults.length > 0) {
          setSearchResults([]);
          setSearchSelectedIndex(0);
          setSearchCurrentPage(1);
          return;
        }
        setCurrentView('MAIN_MENU');
        return;
      }
      if (key.tab) {
        const sources = ['youtube', 'soundcloud', 'bandcamp', 'bilibili'];
        const nextIdx = (sources.indexOf(searchSource) + 1) % sources.length;
        setSearchSource(sources[nextIdx]);
        return;
      }
      if (searchResults.length > 0) {
        const items = searchResults;
        const totalPages = Math.max(1, Math.ceil(items.length / 10));
        const effectivePage = Math.min(Math.max(1, searchCurrentPage), totalPages);
        const startIndex = (effectivePage - 1) * 10;
        const visibleCount = Math.min(10, items.length - startIndex);

        // Dynamic direct number jump keys: [1-9, 0] mapped to visible items on current page
        if ((input >= '1' && input <= '9') || input === '0') {
          const slot = input === '0' ? 10 : parseInt(input, 10);
          if (slot >= 1 && slot <= visibleCount) {
            const targetIndex = startIndex + (slot - 1);
            setSearchSelectedIndex(targetIndex);
            return;
          }
        }

        // PageUp / PageDown pagination navigation: safely clamp within 1 <= currentPage <= totalPages
        if (key.pageDown || input === '>' || input === ']') {
          const nextPage = Math.min(totalPages, searchCurrentPage + 1);
          setSearchCurrentPage(nextPage);
          const nextStartIndex = (nextPage - 1) * 10;
          setSearchSelectedIndex(Math.min(items.length - 1, nextStartIndex));
          return;
        }
        if (key.pageUp || input === '<' || input === '[') {
          const prevPage = Math.max(1, searchCurrentPage - 1);
          setSearchCurrentPage(prevPage);
          const prevStartIndex = (prevPage - 1) * 10;
          setSearchSelectedIndex(Math.max(0, prevStartIndex));
          return;
        }

        // ArrowUp / ArrowDown navigation with boundary rollovers
        if (key.downArrow) {
          let nextIndex: number;
          let nextPage: number;
          if (searchSelectedIndex < items.length - 1) {
            nextIndex = searchSelectedIndex + 1;
            nextPage = Math.floor(nextIndex / 10) + 1;
          } else {
            // Boundary rollover: wrap from end to first item on page 1
            nextIndex = 0;
            nextPage = 1;
          }
          setSearchSelectedIndex(nextIndex);
          setSearchCurrentPage(Math.min(Math.max(1, nextPage), totalPages));
          return;
        }

        if (key.upArrow) {
          let prevIndex: number;
          let prevPage: number;
          if (searchSelectedIndex > 0) {
            prevIndex = searchSelectedIndex - 1;
            prevPage = Math.floor(prevIndex / 10) + 1;
          } else {
            // Boundary rollover: wrap from top of page 1 to last item on last page
            prevIndex = items.length - 1;
            prevPage = totalPages;
          }
          setSearchSelectedIndex(prevIndex);
          setSearchCurrentPage(Math.min(Math.max(1, prevPage), totalPages));
          return;
        }

        if (key.return) {
          const selected = searchResults[searchSelectedIndex];
          if (selected) {
            setInputUrl(selected.url);
            setCurrentView('URL_PULLER');
            probeUrl(selected.url);
          }
          return;
        }
      }

      // Query typing
      if (key.return) {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        flashStatus(`Searching ${searchSource} for "${searchQuery}"...`);
        inspector
          .search(searchQuery, searchSource, 50)
          .then((res) => {
            setSearchResults(res);
            setSearchSelectedIndex(0);
            setSearchCurrentPage(1);
            setIsSearching(false);
            const totalP = Math.max(1, Math.ceil(res.length / 10));
            flashStatus(`Found ${res.length} search results across ${totalP} page${totalP > 1 ? 's' : ''}.`);
          })
          .catch((err) => {
            setIsSearching(false);
            flashStatus(`Search error: ${err.message}`, true);
          });
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }
      if (input) {
        setSearchQuery((prev) => prev + input);
      }
      return;
    }

    // 6. DOWNLOADS MANAGER & HISTORY ENGINE VIEW
    if (currentView === 'DOWNLOADS') {
      const currentList =
        downloadsTab === 'ACTIVE'
          ? activeItems
          : downloadsTab === 'FINISHED'
          ? finishedItems
          : failedItems;

      if (key.escape) {
        setCurrentView('MAIN_MENU');
        return;
      }

      // Tab switching: [Tab], [1], [2], [3], [Left], [Right]
      if (key.tab) {
        setDownloadsTab((prev) =>
          prev === 'ACTIVE' ? 'FINISHED' : prev === 'FINISHED' ? 'FAILED' : 'ACTIVE'
        );
        setDownloadsSelectedIndex(0);
        return;
      }
      if (input === '1') {
        setDownloadsTab('ACTIVE');
        setDownloadsSelectedIndex(0);
        return;
      }
      if (input === '2') {
        setDownloadsTab('FINISHED');
        setDownloadsSelectedIndex(0);
        return;
      }
      if (input === '3') {
        setDownloadsTab('FAILED');
        setDownloadsSelectedIndex(0);
        return;
      }
      if (key.leftArrow) {
        setDownloadsTab((prev) =>
          prev === 'FAILED' ? 'FINISHED' : prev === 'FINISHED' ? 'ACTIVE' : 'FAILED'
        );
        setDownloadsSelectedIndex(0);
        return;
      }
      if (key.rightArrow) {
        setDownloadsTab((prev) =>
          prev === 'ACTIVE' ? 'FINISHED' : prev === 'FINISHED' ? 'FAILED' : 'ACTIVE'
        );
        setDownloadsSelectedIndex(0);
        return;
      }

      // List navigation with bound wrap
      if (key.upArrow) {
        setDownloadsSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, currentList.length - 1)
        );
        return;
      }
      if (key.downArrow) {
        setDownloadsSelectedIndex((prev) =>
          prev < currentList.length - 1 ? prev + 1 : 0
        );
        return;
      }

      // Responsive keyboard-driven pagination: [PgUp] / [PgDn] or [<] / [>]
      if (key.pageDown || input === '>' || input === ']') {
        setDownloadsSelectedIndex((prev) =>
          Math.min(Math.max(0, currentList.length - 1), prev + 10)
        );
        return;
      }
      if (key.pageUp || input === '<' || input === '[') {
        setDownloadsSelectedIndex((prev) => Math.max(0, prev - 10));
        return;
      }

      // Action: [P] Pause / Resume Queue
      if (input.toLowerCase() === 'p') {
        if (isQueuePaused) {
          queueManager.start();
          flashStatus('Queue resumed.');
        } else {
          queueManager.pause();
          flashStatus('Queue paused.');
        }
        return;
      }

      // Action: [R] Retry Failed Items
      if (input.toLowerCase() === 'r') {
        const selected = currentList[downloadsSelectedIndex];
        if (selected && selected.statusTag === '[FAILED]') {
          if (selected.sourceType === 'queue') {
            queueManager.retryJob(selected.id);
          } else {
            queueManager.enqueue(selected.url, {
              format: selected.format,
              title: selected.title,
              autoStart: true,
            });
          }
          flashStatus(`Retrying failed download: ${selected.title.slice(0, 24)}`);
        } else {
          const retried = queueManager.retryAllFailed();
          flashStatus(`Retried ${retried} failed jobs.`);
        }
        return;
      }

      // Action: [C] Clear Download History (purging local metadata logs of recent tasks)
      if (input.toLowerCase() === 'c') {
        historyRepo.clear();
        jobs.filter((j) => j.status === 'COMPLETED').forEach((j) => queueManager.removeJob(j.id));
        setHistoryRecords([]);
        setDownloadsSelectedIndex(0);
        flashStatus('✔ Cleared download history and purged local metadata audit logs.');
        return;
      }

      // Action: [X] or [Delete] Remove Selected Item
      if (input.toLowerCase() === 'x' || key.delete) {
        const selected = currentList[downloadsSelectedIndex];
        if (selected) {
          if (selected.sourceType === 'queue') {
            queueManager.removeJob(selected.id);
          }
          historyRepo.remove(selected.id);
          setHistoryRecords(historyRepo.list(100));
          flashStatus(`Removed: ${selected.title.slice(0, 26)}`);
          setDownloadsSelectedIndex((prev) => Math.max(0, prev - 1));
        }
        return;
      }
      return;
    }

    // 7. CONFIGURATION VIEW
    if (currentView === 'CONFIG') {
      if (key.escape) {
        setCurrentView('MAIN_MENU');
        return;
      }
      if (key.upArrow) {
        setConfigSelectedIndex((prev) => (prev > 0 ? prev - 1 : 6));
      } else if (key.downArrow) {
        setConfigSelectedIndex((prev) => (prev < 6 ? prev + 1 : 0));
      } else if (key.return || input === ' ') {
        if (configSelectedIndex === 1) {
          // Cycle Max Concurrency
          const nextVal = (engineConfig.maxConcurrency % 6) + 1;
          configStore.set('maxConcurrency', nextVal);
          setEngineConfig(configStore.getAll());
          flashStatus(`Concurrency set to ${nextVal}`);
        } else if (configSelectedIndex === 2) {
          // Cycle Parallel Threads
          const nextVal = engineConfig.parallelThreads === 16 ? 4 : engineConfig.parallelThreads + 4;
          configStore.set('parallelThreads', nextVal);
          setEngineConfig(configStore.getAll());
          flashStatus(`Parallel threads set to ${nextVal}`);
        } else if (configSelectedIndex === 5) {
          // Toggle Auto-Start
          const nextVal = !engineConfig.autoStartOnQueue;
          configStore.set('autoStartOnQueue', nextVal);
          setEngineConfig(configStore.getAll());
          flashStatus(`Auto-start ${nextVal ? 'enabled' : 'disabled'}`);
        } else if (configSelectedIndex === 6) {
          // Reset Config
          configStore.reset();
          setEngineConfig(configStore.getAll());
          flashStatus('Configuration reset to defaults.');
        }
      }
      return;
    }

    // 8. HELP VIEW
    if (currentView === 'HELP') {
      if (key.escape) {
        setCurrentView('MAIN_MENU');
      }
      return;
    }
  }, { isActive: isRawModeSupported });

  // Calculate layout widths
  const leftWidth = Math.max(38, Math.floor((terminalWidth - 3) / 2));
  const rightWidth = Math.max(38, terminalWidth - 3 - leftWidth);
  const bodyHeight = Math.max(16, terminalHeight - 7);

  const activeCount = jobs.filter((j) => j.status === 'RUNNING').length;

  // Dynamic unified footer shortcuts mapped to current view state
  const currentShortcuts = useMemo((): ShortcutItem[] => {
    if (currentView === 'SEARCH') {
      if (searchResults.length > 0) {
        const items = searchResults;
        const totalPages = Math.max(1, Math.ceil(items.length / 10));
        const effectivePage = Math.min(Math.max(1, searchCurrentPage), totalPages);
        const startIndex = (effectivePage - 1) * 10;
        const visibleCount = Math.min(10, items.length - startIndex);
        const jumpKey = visibleCount === 10 ? '[1-9, 0]' : visibleCount > 1 ? `[1-${visibleCount}]` : '[1]';

        const list: ShortcutItem[] = [
          { key: jumpKey, label: 'Jump' },
          { key: '[↑↓]', label: 'Select' },
          { key: '[Enter]', label: 'Inspect item' },
        ];
        if (totalPages > 1) {
          list.push({ key: '[PgUp/PgDn]', label: 'Page' });
        }
        list.push({ key: '[Tab]', label: 'Source' });
        list.push({ key: '[Esc]', label: 'Clear' });
        return list;
      }
      return [
        { key: '[Enter]', label: 'Search' },
        { key: '[Tab]', label: 'Source' },
        { key: '[Esc]', label: 'Menu' },
      ];
    }

    if (currentView === 'MAIN_MENU') {
      return [
        { key: '[1-6]', label: 'Jump' },
        { key: '[↑↓]', label: 'Select' },
        { key: '[Enter]', label: 'Run' },
      ];
    }

    if (currentView === 'URL_PULLER') {
      if (pullerStep === 'URL_INPUT') {
        return [
          { key: '[Enter]', label: 'Probe' },
          { key: '[Esc]', label: 'Menu' },
        ];
      }
      if (pullerStep === 'TYPE_SELECT') {
        return [
          { key: '[1-3]', label: 'Jump' },
          { key: '[↑↓]', label: 'Select' },
          { key: '[Enter]', label: 'Next' },
          { key: '[Esc]', label: 'Back' },
        ];
      }
      return [
        { key: '[↑↓]', label: 'Select' },
        { key: '[Enter]', label: 'Queue' },
        { key: '[Esc]', label: 'Back' },
      ];
    }

    if (currentView === 'DOWNLOADS') {
      return [
        { key: '[1-3]', label: 'Tabs' },
        { key: '[↑↓]', label: 'Select' },
        { key: '[P]', label: 'Pause/Resume' },
        { key: '[X]', label: 'Remove' },
        { key: '[R]', label: 'Retry' },
        { key: '[C]', label: 'Clear' },
        { key: '[Esc]', label: 'Menu' },
      ];
    }

    if (currentView === 'CONFIG') {
      return [
        { key: '[↑↓]', label: 'Select' },
        { key: '[Enter]', label: 'Toggle' },
        { key: '[Esc]', label: 'Menu' },
      ];
    }

    return [
      { key: '[Esc]', label: 'Menu' },
    ];
  }, [currentView, searchResults, searchCurrentPage, pullerStep]);

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* Top Banner & Header */}
      <Header
        activeCount={activeCount}
        totalQueueCount={jobs.length}
        isPaused={isQueuePaused}
        currentView={currentView}
        totalWidth={terminalWidth}
      />

      {/* Main Dual-Column Body */}
      <Box flexDirection="row" height={bodyHeight}>
        {/* Left Interactive Panel */}
        <Box width={leftWidth} height={bodyHeight}>
          {currentView === 'MAIN_MENU' && (
            <MainMenuView
              selectedIndex={mainMenuIndex}
              onSelect={(v) => setCurrentView(v)}
              width={leftWidth}
              height={bodyHeight}
            />
          )}

          {currentView === 'URL_PULLER' && (
            <UrlPullerView
              step={pullerStep}
              inputUrl={inputUrl}
              cursorPos={cursorPos}
              probingMsg={probingMsg}
              metadata={metadata}
              videoOptions={videoOptions}
              audioOptions={audioOptions}
              selectedTypeIndex={selectedTypeIndex}
              selectedFormatIndex={selectedFormatIndex}
              batchRawInput={batchRawInput}
              batchItems={batchItems}
              selectedBatchStrategyIndex={selectedBatchStrategyIndex}
              width={leftWidth}
              height={bodyHeight}
            />
          )}

          {currentView === 'SEARCH' && (
            <SearchMediaView
              query={searchQuery}
              source={searchSource}
              isSearching={isSearching}
              results={searchResults}
              selectedIndex={searchSelectedIndex}
              currentPage={searchCurrentPage}
              width={leftWidth}
              height={bodyHeight}
            />
          )}

          {currentView === 'DOWNLOADS' && (
            <DownloadsManagerView
              activeTab={downloadsTab}
              activeItems={activeItems}
              finishedItems={finishedItems}
              failedItems={failedItems}
              selectedIndex={downloadsSelectedIndex}
              isPaused={isQueuePaused}
              width={leftWidth}
              height={bodyHeight}
            />
          )}

          {currentView === 'CONFIG' && (
            <ConfigurationView
              config={engineConfig}
              selectedIndex={configSelectedIndex}
              width={leftWidth}
              height={bodyHeight}
            />
          )}

          {currentView === 'HELP' && (
            <HelpView width={leftWidth} height={bodyHeight} />
          )}
        </Box>

        {/* Right Active Downloads & Worker Monitor Panel */}
        <Box width={rightWidth} height={bodyHeight}>
          <ActiveDownloadsPanel
            jobs={jobs}
            width={rightWidth}
            height={bodyHeight}
          />
        </Box>
      </Box>

      {/* Persistent Consolidated Footer & Shortcuts */}
      <Footer statusMessage={statusMessage} isError={isError} shortcuts={currentShortcuts} />

      {/* Pop-Up Modal Dialog Overlays */}
      <Modal modal={modal} width={terminalWidth} />
    </Box>
  );
};
