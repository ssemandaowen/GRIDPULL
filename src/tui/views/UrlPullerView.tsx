/**
 * @file src/tui/views/UrlPullerView.tsx
 * GridPull CLI native multi-step interactive URL Puller.
 * Features stream probing, upfront combined size calculations, and batch ingestion.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { UrlPullerStep, ProbedBatchItem } from '../types.js';
import { MediaMetadata } from '../../types/index.js';
import { VideoTierOption, AudioTierOption } from '../../parser/StreamAnalyzer.js';

interface UrlPullerViewProps {
  step: UrlPullerStep;
  inputUrl: string;
  cursorPos: number;
  probingMsg: string;
  metadata: MediaMetadata | null;
  videoOptions: VideoTierOption[];
  audioOptions: AudioTierOption[];
  selectedTypeIndex: number;
  selectedFormatIndex: number;
  batchRawInput: string;
  batchItems: ProbedBatchItem[];
  selectedBatchStrategyIndex: number;
  width: number;
  height: number;
}

export const UrlPullerView: React.FC<UrlPullerViewProps> = ({
  step,
  inputUrl,
  cursorPos,
  probingMsg,
  metadata,
  videoOptions,
  audioOptions,
  selectedTypeIndex,
  selectedFormatIndex,
  batchRawInput,
  batchItems,
  selectedBatchStrategyIndex,
  width,
  height,
}) => {
  const contentWidth = Math.max(34, width - 3);

  // 1. URL INPUT STEP
  if (step === 'URL_INPUT') {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={1}>
          <Text bold color="white">
            ENTER TARGET MEDIA URL OR BATCH SPECIFICATION:
          </Text>
        </Box>

        {/* Input Field */}
        <Box marginBottom={1} paddingLeft={1}>
          <Text color="cyan" bold>❯ </Text>
          <Text color="white">
            {inputUrl.slice(0, cursorPos)}
            <Text backgroundColor="white" color="black">
              {inputUrl.slice(cursorPos, cursorPos + 1) || ' '}
            </Text>
            {inputUrl.slice(cursorPos + 1)}
          </Text>
        </Box>

        {/* Guidelines */}
        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text color="gray" dimColor>
            • Supports YouTube, SoundCloud, Bandcamp, Vimeo, or direct stream URLs
          </Text>
          <Text color="gray" dimColor>
            • Press <Text color="white">[Enter]</Text> to probe streams & calculate upfront file sizes
          </Text>
          <Text color="gray" dimColor>
            • Press <Text color="white">[Tab]</Text> to insert test demo link
          </Text>
          <Text color="gray" dimColor>
            • Press <Text color="white">[B]</Text> to open Batch Download Wizard
          </Text>
          <Text color="gray" dimColor>
            • Press <Text color="white">[Esc]</Text> to return to Main Menu
          </Text>
        </Box>
      </Box>
    );
  }

  // 2. PROBING STEP
  if (step === 'PROBING') {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={1}>
          <Text color="cyan">
            ℹ <Text bold color="white">Probing Stream Metadata...</Text>
          </Text>
        </Box>
        <Box paddingLeft={2} marginBottom={1}>
          <Text color="gray">{probingMsg || 'Inspecting formats via native stream analyzer...'}</Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            Calculating manifest byte totals, filtering storyboards, and pairing tracks.
          </Text>
        </Box>
      </Box>
    );
  }

  // 3. TYPE SELECT STEP (Preview Card or Batch Summary)
  if (step === 'TYPE_SELECT' && (metadata || batchItems.length > 0)) {
    const isBatch = batchItems.length > 0;
    const typeItems = isBatch
      ? [
          { id: '1', title: 'Video Stream (All Items)', desc: 'Paired video & audio tier applied to every item' },
          { id: '2', title: 'Audio Extraction (All Items)', desc: 'MP3, M4A, Opus, or FLAC applied to every item' },
          { id: '0', title: 'Cancel Batch', desc: 'Discard batch and return to main menu' },
        ]
      : [
          { id: '1', title: 'Video Stream', desc: 'Paired with best matching audio track' },
          { id: '2', title: 'Audio Extraction', desc: 'MP3, M4A, Opus, or FLAC lossless' },
          { id: '3', title: 'Batch Ingestion', desc: 'Multiple URLs or local batch file' },
          { id: '0', title: 'Cancel', desc: 'Return to main menu' },
        ];

    const maxTitleLen = Math.max(20, contentWidth - 10);
    const displayTitle = metadata
      ? metadata.title.length > maxTitleLen
        ? `${metadata.title.slice(0, maxTitleLen - 3)}...`
        : metadata.title
      : `${batchItems.length} streams ready`;

    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        {/* Stream Metadata Summary */}
        <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
          <Text bold color="white">
            {isBatch ? `BATCH INGESTION (${batchItems.length} ITEMS)` : 'STREAM METADATA'}
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            {isBatch ? (
              <>
                <Text color="gray">
                  Targets: <Text bold color="white">{batchItems.length} URLs queued for parallel execution</Text>
                </Text>
                <Text color="gray" dimColor>
                  Preview: {batchItems.slice(0, 3).map((b) => b.title).join(', ')}{batchItems.length > 3 ? ` (+${batchItems.length - 3} more)` : ''}
                </Text>
              </>
            ) : metadata ? (
              <>
                <Text color="gray">
                  Title: <Text bold color="white">{displayTitle}</Text>
                </Text>
                <Text color="gray">
                  Channel: <Text color="white">{metadata.channel}</Text> │ Duration: <Text color="white">{metadata.durationString || '--:--'}</Text>
                </Text>
              </>
            ) : null}
          </Box>
        </Box>

        <Box marginBottom={1}>
          <Text bold color="white">
            {isBatch ? 'SELECT BATCH DOWNLOAD TARGET:' : 'SELECT DOWNLOAD TARGET:'}
          </Text>
        </Box>

        {typeItems.map((item, idx) => {
          const isSelected = idx === selectedTypeIndex;
          return (
            <Box key={item.id} flexDirection="column" marginBottom={0}>
              <Box>
                <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                  {isSelected ? (
                    <Text color="cyan">➜  </Text>
                  ) : (
                    '   '
                  )}
                  <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>
                    [{item.id}]
                  </Text>{' '}
                  {item.title} <Text color="gray" dimColor>— {item.desc}</Text>
                </Text>
              </Box>
            </Box>
          );
        })}

        <Box marginTop={1} paddingLeft={3}>
          <Text color="gray" dimColor>
            Use [↑↓] arrows or [1-{isBatch ? '2' : '3'}] then [Enter]. Press [Esc] to go back.
          </Text>
        </Box>
      </Box>
    );
  }

  // 4. VIDEO FORMAT SELECTION STEP
  if (step === 'VIDEO_FORMAT') {
    const isBatch = batchItems.length > 0;
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={0}>
          <Text bold color="white">
            {isBatch
              ? `BATCH VIDEO RESOLUTION TIERS (${batchItems.length} items)`
              : 'PAIRED VIDEO RESOLUTIONS (Upfront Total Sizes)'}
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            {isBatch
              ? 'Dynamic format selector applied to each queued batch item:'
              : 'Combined with highest fidelity audio track:'}
          </Text>
        </Box>

        {/* Minimal Table Header */}
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>
            {'#   Resolution  FPS   Format   Est. Size     Details'}
          </Text>
        </Box>
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>{'─'.repeat(Math.min(52, contentWidth - 4))}</Text>
        </Box>

        {/* Table Rows */}
        <Box flexDirection="column">
          {(() => {
            const PAGE_SIZE = 10;
            const totalCount = videoOptions.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
            const currentPage = totalCount > 0 ? Math.min(Math.floor(selectedFormatIndex / PAGE_SIZE), totalPages - 1) : 0;
            const startIndex = currentPage * PAGE_SIZE;
            const pageItems = videoOptions.slice(startIndex, startIndex + PAGE_SIZE);
            const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);

            return (
              <>
                {pageItems.map((opt, idx) => {
                  const absoluteIdx = startIndex + idx;
                  const isSelected = absoluteIdx === selectedFormatIndex;
                  const numPad = String(absoluteIdx + 1).padEnd(3);
                  const resPad = opt.resolution.padEnd(10);
                  const fpsPad = String(opt.fps).padEnd(4);
                  const fmtPad = opt.format.padEnd(6);
                  const sizePad = opt.estTotalSize.padEnd(11);
                  const badge = opt.isRecommended ? ' [Recommended]' : '';

                  return (
                    <Box key={opt.id} paddingLeft={0}>
                      <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                        {isSelected ? (
                          <Text color="cyan">➜  </Text>
                        ) : (
                          '   '
                        )}
                        {numPad} {resPad}  {fpsPad}  {fmtPad}  {sizePad}
                        <Text color="green">{badge}</Text>
                      </Text>
                    </Box>
                  );
                })}

                {/* Muted Gray Footer Pagination Tracker */}
                <Box marginTop={1} paddingLeft={2}>
                  <Text color="gray" dimColor>
                    Page {currentPage + 1} of {totalPages} (Items {startIndex + 1}-{endIndex} of {totalCount})
                  </Text>
                </Box>
              </>
            );
          })()}
        </Box>

        {/* Stream Mapping Detail */}
        {videoOptions[selectedFormatIndex] && (
          <Box marginTop={1} paddingLeft={3}>
            <Text color="gray">
              ℹ <Text color="white" bold>{videoOptions[selectedFormatIndex].resolution} {videoOptions[selectedFormatIndex].format}</Text> <Text color="gray" dimColor>──</Text> {isBatch ? `Generic Selector: ${videoOptions[selectedFormatIndex].selector} ➜ Dispatches to ${batchItems.length} items` : `Video (${videoOptions[selectedFormatIndex].videoSizeStr}) + Audio (${videoOptions[selectedFormatIndex].audioSizeStr}) ➜ `}<Text color="green" bold>{videoOptions[selectedFormatIndex].estTotalSize}</Text>
            </Text>
          </Box>
        )}

        <Box marginTop={1} paddingLeft={3}>
          <Text color="gray" dimColor>
            Use [↑↓] to choose, <Text color="white">[Enter]</Text> to queue download, <Text color="white">[Esc]</Text> back.
          </Text>
        </Box>
      </Box>
    );
  }

  // 5. AUDIO FORMAT SELECTION STEP
  if (step === 'AUDIO_FORMAT') {
    const isBatch = batchItems.length > 0;
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={0}>
          <Text bold color="white">
            {isBatch
              ? `BATCH AUDIO EXTRACTION TIERS (${batchItems.length} items)`
              : 'AUDIO EXTRACTION TIERS (Bitrate & Codec)'}
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            {isBatch
              ? 'Dynamic audio codec selector applied to each queued batch item:'
              : 'Standardized consumer audio profiles with upfront byte estimations:'}
          </Text>
        </Box>

        {/* Minimal Table Header */}
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>
            {'#   Format  Quality / Bitrate       Est. Size'}
          </Text>
        </Box>
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>{'─'.repeat(Math.min(48, contentWidth - 4))}</Text>
        </Box>

        {/* Table Rows */}
        <Box flexDirection="column">
          {(() => {
            const PAGE_SIZE = 10;
            const totalCount = audioOptions.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
            const currentPage = totalCount > 0 ? Math.min(Math.floor(selectedFormatIndex / PAGE_SIZE), totalPages - 1) : 0;
            const startIndex = currentPage * PAGE_SIZE;
            const pageItems = audioOptions.slice(startIndex, startIndex + PAGE_SIZE);
            const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);

            return (
              <>
                {pageItems.map((opt, idx) => {
                  const absoluteIdx = startIndex + idx;
                  const isSelected = absoluteIdx === selectedFormatIndex;
                  const numPad = String(absoluteIdx + 1).padEnd(3);
                  const fmtPad = opt.format.padEnd(6);
                  const qualPad = opt.quality.padEnd(22);
                  const sizePad = opt.fileSize;

                  return (
                    <Box key={opt.id} paddingLeft={0}>
                      <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                        {isSelected ? (
                          <Text color="cyan">➜  </Text>
                        ) : (
                          '   '
                        )}
                        {numPad} {fmtPad}  {qualPad}  {sizePad}
                      </Text>
                    </Box>
                  );
                })}

                {/* Muted Gray Footer Pagination Tracker */}
                <Box marginTop={1} paddingLeft={2}>
                  <Text color="gray" dimColor>
                    Page {currentPage + 1} of {totalPages} (Items {startIndex + 1}-{endIndex} of {totalCount})
                  </Text>
                </Box>
              </>
            );
          })()}
        </Box>

        {/* Audio Tier Detail */}
        {audioOptions[selectedFormatIndex] && (
          <Box marginTop={1} paddingLeft={3}>
            <Text color="gray">
              ℹ <Text color="white" bold>{audioOptions[selectedFormatIndex].format} ({audioOptions[selectedFormatIndex].quality})</Text> <Text color="gray" dimColor>──</Text> {isBatch ? `Generic Selector: ${audioOptions[selectedFormatIndex].selector} ➜ Dispatches to ${batchItems.length} items` : `Audio Stream ➜ `}<Text color="green" bold>{audioOptions[selectedFormatIndex].fileSize}</Text>
            </Text>
          </Box>
        )}

        <Box marginTop={1} paddingLeft={3}>
          <Text color="gray" dimColor>
            Use [↑↓] to choose, <Text color="white">[Enter]</Text> to queue extraction, <Text color="white">[Esc]</Text> back.
          </Text>
        </Box>
      </Box>
    );
  }

  // 6. BATCH INPUT STEP
  if (step === 'BATCH_INPUT') {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={0}>
          <Text bold color="white">
            BATCH DOWNLOAD WIZARD
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            Enter multiple URLs (separated by newlines, commas, pipes) or a local .txt file path:
          </Text>
        </Box>

        <Box paddingLeft={1} marginBottom={1}>
          <Text color="cyan" bold>❯ </Text>
          <Text color="white">
            {batchRawInput || '(Paste URLs here or type path/to/links.txt)'}
          </Text>
        </Box>

        <Box flexDirection="column" paddingLeft={2}>
          <Text color="gray" dimColor>
            Examples:
          </Text>
          <Text color="gray" dimColor>
            • https://youtu.be/abc | https://youtu.be/xyz
          </Text>
          <Text color="gray" dimColor>
            • /downloads/my_links.txt
          </Text>
          <Box marginTop={1}>
            <Text color="white">
              Press [Enter] to probe links, [Esc] to return to main menu.
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // 7. BATCH PROBING & STRATEGY STEP
  if (step === 'BATCH_PROBING' || step === 'BATCH_STRATEGY') {
    const strategyOptions = [
      { id: '1', label: 'Apply Global Best Video (1080p/720p to all)' },
      { id: '2', label: 'Apply Global High Audio (MP3 192k to all)' },
      { id: '3', label: 'Cancel & Discard Batch' },
    ];

    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={1}>
          <Text bold color="white">
            BATCH ITEMS PROBED ({batchItems.length} streams found)
          </Text>
        </Box>

        {/* Minimal Table */}
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>{'#  Title Preview                Duration   Status'}</Text>
        </Box>
        <Box paddingLeft={2} marginBottom={0}>
          <Text color="gray" dimColor>{'─'.repeat(Math.min(50, contentWidth - 4))}</Text>
        </Box>

        <Box flexDirection="column">
          {(() => {
            const PAGE_SIZE = 10;
            const totalCount = batchItems.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
            const pageItems = batchItems.slice(0, PAGE_SIZE);

            return (
              <>
                {pageItems.map((item, idx) => {
                  const titlePad = item.title.slice(0, 24).padEnd(26);
                  const durPad = item.durationString.padEnd(8);
                  const statusColor = item.status === 'READY' ? 'green' : 'yellow';

                  return (
                    <Box key={item.id} paddingLeft={2}>
                      <Text color="gray">
                        {String(idx + 1).padEnd(3)} <Text color="white">{titlePad}</Text>  {durPad}  <Text color={statusColor}>[{item.status}]</Text>
                      </Text>
                    </Box>
                  );
                })}

                {totalCount > 0 && (
                  <Box marginTop={1} paddingLeft={2}>
                    <Text color="gray" dimColor>
                      Page 1 of {totalPages} (Items 1-{Math.min(PAGE_SIZE, totalCount)} of {totalCount})
                    </Text>
                  </Box>
                )}
              </>
            );
          })()}
        </Box>

        <Box marginTop={1} marginBottom={0}>
          <Text bold color="white">
            SELECT FORMAT STRATEGY:
          </Text>
        </Box>

        {strategyOptions.map((opt, idx) => {
          const isSelected = idx === selectedBatchStrategyIndex;
          return (
            <Box key={opt.id} paddingLeft={0}>
              <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                {isSelected ? (
                  <Text color="cyan">➜  </Text>
                ) : (
                  '   '
                )}
                [{opt.id}] {opt.label}
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1} paddingLeft={3}>
          <Text color="gray" dimColor>
            Use [↑↓] to select strategy, [Enter] to dispatch to worker pool.
          </Text>
        </Box>
      </Box>
    );
  }

  // 8. DISPATCH FLASH
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text color="green">
          ✔ <Text bold color="white">Dispatched to Background Worker Pool</Text>
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">
          The left panel is now freed. You can queue another download immediately
          or monitor real-time worker progress in the right panel.
        </Text>
      </Box>
    </Box>
  );
};
