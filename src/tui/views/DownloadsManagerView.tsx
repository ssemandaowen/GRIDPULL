/**
 * @file src/tui/views/DownloadsManagerView.tsx
 * GridPull CLI native Download Manager and History Engine with
 * state categorization tabs (Active Queue, Finished, Failed),
 * strict 10-item pagination, queue control actions, and muted corporate color coding.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { DownloadJob, HistoryRecord } from '../../types/index.js';

export type DownloadsTab = 'ACTIVE' | 'FINISHED' | 'FAILED';

export interface DownloadEntryItem {
  id: string;
  sourceType: 'queue' | 'history';
  title: string;
  url: string;
  format: string;
  progress: string;
  speed: string;
  eta: string;
  statusTag: '[RUNNING]' | '[PAUSED]' | '[QUEUED]' | '[DONE]' | '[FAILED]' | '[RETRYING]';
  statusColor: 'cyan' | 'yellow' | 'green' | 'red' | 'gray';
  targetPath?: string;
  error?: string | null;
  rawJob?: DownloadJob;
  rawHistory?: HistoryRecord;
}

interface DownloadsManagerViewProps {
  activeTab: DownloadsTab;
  activeItems: DownloadEntryItem[];
  finishedItems: DownloadEntryItem[];
  failedItems: DownloadEntryItem[];
  selectedIndex: number;
  isPaused: boolean;
  width: number;
  height: number;
}

const PAGE_SIZE = 10;

export const DownloadsManagerView: React.FC<DownloadsManagerViewProps> = ({
  activeTab,
  activeItems,
  finishedItems,
  failedItems,
  selectedIndex,
  isPaused,
  width,
  height,
}) => {
  const contentWidth = Math.max(34, width - 3);

  // Active dataset based on current tab
  const currentList =
    activeTab === 'ACTIVE'
      ? activeItems
      : activeTab === 'FINISHED'
      ? finishedItems
      : failedItems;

  const totalCount = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = totalCount > 0 ? Math.min(Math.floor(selectedIndex / PAGE_SIZE), totalPages - 1) : 0;
  const startIndex = currentPage * PAGE_SIZE;
  const pageItems = currentList.slice(startIndex, startIndex + PAGE_SIZE);
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);

  const selectedItem = currentList[selectedIndex];

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      paddingX={1}
      paddingY={0}
    >
      {/* Top Header & Tab Controls */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="white">
          DOWNLOAD MANAGER & HISTORY
        </Text>
        <Text color={isPaused ? 'yellow' : 'cyan'}>
          {isPaused ? '[QUEUE PAUSED]' : '[QUEUE RUNNING]'}
        </Text>
      </Box>

      {/* Minimalist Tab Navigation Bar */}
      <Box marginBottom={1} paddingLeft={1}>
        <Text color="gray" dimColor>Views: </Text>
        <Text bold={activeTab === 'ACTIVE'} color={activeTab === 'ACTIVE' ? 'cyan' : 'gray'}>
          [1] Active Queue ({activeItems.length})
        </Text>
        <Text color="gray" dimColor>  •  </Text>
        <Text bold={activeTab === 'FINISHED'} color={activeTab === 'FINISHED' ? 'green' : 'gray'}>
          [2] Finished ({finishedItems.length})
        </Text>
        <Text color="gray" dimColor>  •  </Text>
        <Text bold={activeTab === 'FAILED'} color={activeTab === 'FAILED' ? 'red' : 'gray'}>
          [3] Failed ({failedItems.length})
        </Text>
      </Box>

      {/* Empty State or Paginated Table */}
      {totalCount === 0 ? (
        <Box flexDirection="column" paddingLeft={2} marginY={1}>
          <Text color="gray" dimColor>
            {activeTab === 'ACTIVE'
              ? 'No downloads currently running or queued.'
              : activeTab === 'FINISHED'
              ? 'No completed download history found.'
              : 'No failed download tasks on record.'}
          </Text>
          <Text color="gray" dimColor>
            {activeTab === 'ACTIVE'
              ? 'Queue new streams from [2] URL Puller or [1] Search Media.'
              : 'Downloads will appear here as tasks finish or fail.'}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {/* Table Header */}
          <Box paddingLeft={2} marginBottom={0}>
            <Text color="gray" dimColor>
              {'#   Title / Stream        Format       Prog   Speed      ETA    Status'}
            </Text>
          </Box>
          <Box paddingLeft={2} marginBottom={0}>
            <Text color="gray" dimColor>{'─'.repeat(Math.min(64, contentWidth - 4))}</Text>
          </Box>

          {/* Strict 10-Item Paged Rows */}
          {pageItems.map((item, idx) => {
            const absoluteIdx = startIndex + idx;
            const isSelected = absoluteIdx === selectedIndex;
            const numPad = String(absoluteIdx + 1).padEnd(3);
            const titlePad = item.title.slice(0, 19).padEnd(21);
            const fmtPad = item.format.slice(0, 11).padEnd(12);
            const progPad = item.progress.padStart(5);
            const speedPad = item.speed.padStart(9);
            const etaPad = item.eta.padStart(6);
            const statusPad = item.statusTag.padEnd(11);

            return (
              <Box key={item.id || absoluteIdx} paddingLeft={0}>
                <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                  {isSelected ? (
                    <Text color="cyan">➜  </Text>
                  ) : (
                    '   '
                  )}
                  {numPad} {titlePad} {fmtPad} {progPad} {speedPad} {etaPad} <Text color={item.statusColor}>{statusPad}</Text>
                </Text>
              </Box>
            );
          })}

          {/* Unobtrusive Footer Pagination Tracker */}
          <Box marginTop={1} paddingLeft={2}>
            <Text color="gray" dimColor>
              Page {currentPage + 1} of {totalPages} (Items {startIndex + 1}-{endIndex} of {totalCount})
            </Text>
          </Box>
        </Box>
      )}

      {/* Selected Item Metadata Inspection */}
      {selectedItem && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color="gray" dimColor>
            Target: <Text color="white">{(selectedItem.title || selectedItem.url).slice(0, contentWidth - 10)}</Text>
          </Text>
          {selectedItem.targetPath && (
            <Text color="gray" dimColor>
              Folder: <Text color="gray">{selectedItem.targetPath.slice(0, contentWidth - 10)}</Text>
            </Text>
          )}
          {selectedItem.error && (
            <Text color="red">
              Error: {selectedItem.error.slice(0, contentWidth - 8)}
            </Text>
          )}
        </Box>
      )}

      {/* Keyboard Controls Action Bar */}
      <Box marginTop={1} paddingLeft={2}>
        <Text color="gray" dimColor>
          [Tab/1-3] View  •  [P] Pause/Resume  •  [X] Remove  •  [R] Retry  •  [C] Clear History  •  [Esc] Menu
        </Text>
      </Box>
    </Box>
  );
};
