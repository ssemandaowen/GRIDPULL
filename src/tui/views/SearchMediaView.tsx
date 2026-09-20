/**
 * @file src/tui/views/SearchMediaView.tsx
 * Google Developer CLI style multi-source catalog search interface
 * featuring dynamic client-side pagination with a strict limit of 10 items per page,
 * boundary rollover navigation, and dynamic table footer indicator.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SearchResultItem } from '../../types/index.js';

export interface SearchMediaViewProps {
  query: string;
  source: string;
  isSearching: boolean;
  results: SearchResultItem[];
  selectedIndex: number;
  currentPage?: number;
  width: number;
  height: number;
}

export const SearchMediaView: React.FC<SearchMediaViewProps> = ({
  query,
  source,
  isSearching,
  results,
  selectedIndex,
  currentPage = 1,
  width,
  height,
}) => {
  const contentWidth = Math.max(34, width - 3);

  // Dynamic client-side pagination math: strict 10 items per page
  const items = results;
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / 10));

  // Safe currentPage bound enforcement: 1 <= currentPage <= totalPages
  const effectivePage = typeof currentPage === 'number' && currentPage >= 1
    ? Math.min(currentPage, totalPages)
    : totalCount > 0
      ? Math.min(Math.floor(selectedIndex / 10) + 1, totalPages)
      : 1;

  const startIndex = (effectivePage - 1) * 10;
  const pageItems = items.slice(startIndex, startIndex + 10);
  const endIndex = Math.min(startIndex + 10, totalCount);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      paddingX={1}
      paddingY={0}
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="white">
          SEARCH MEDIA CATALOG
        </Text>
        <Text color="gray">
          Provider: <Text color="cyan">[{source.toUpperCase()}]</Text>
        </Text>
      </Box>

      {/* Search Input Bar */}
      <Box marginBottom={1} paddingLeft={1}>
        <Text color="cyan" bold>❯ </Text>
        <Text color="white">
          {query || '(Type search keywords then press Enter)'}
        </Text>
      </Box>

      {isSearching ? (
        <Box paddingLeft={2} marginY={1}>
          <Text color="cyan">ℹ Querying {source} API streams...</Text>
        </Box>
      ) : totalCount > 0 ? (
        <Box flexDirection="column">
          {/* Table Header */}
          <Box paddingLeft={1} marginBottom={0}>
            <Text color="gray" dimColor>
              {'   #   Key  Title Preview                 Channel          Duration'}
            </Text>
          </Box>
          <Box paddingLeft={1} marginBottom={0}>
            <Text color="gray" dimColor>{'─'.repeat(Math.min(60, contentWidth - 2))}</Text>
          </Box>

          {/* Strict 10-Item Paged Rows */}
          {pageItems.map((item, idx) => {
            const absoluteIdx = startIndex + idx;
            const isSelected = absoluteIdx === selectedIndex;
            const itemNumber = absoluteIdx + 1;
            const numPad = String(itemNumber).padStart(3, ' ');
            const slotKey = idx === 9 ? '0' : String(idx + 1);
            const titlePad = item.title.slice(0, 24).padEnd(26);
            const channelPad = (item.uploader || 'Unknown').slice(0, 14).padEnd(16);
            const dur = item.duration || '--:--';

            return (
              <Box key={item.id || absoluteIdx} paddingLeft={0}>
                <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                  {isSelected ? (
                    <Text color="cyan">➜ </Text>
                  ) : (
                    '  '
                  )}
                  {numPad} <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>[{slotKey}]</Text> {titlePad} {channelPad} {dur}
                </Text>
              </Box>
            );
          })}

          {/* Dynamic Responsive Table Footer Pagination Indicator */}
          <Box marginTop={1} paddingLeft={1} justifyContent="space-between">
            <Text color="cyan" bold>
              Page {effectivePage} of {totalPages}{' '}
              <Text color="gray" dimColor>
                (Items {startIndex + 1}-{endIndex} of {totalCount})
              </Text>
            </Text>
            {totalPages > 1 && (
              <Text color="gray" dimColor>
                [PgUp/PgDn] Page
              </Text>
            )}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" paddingLeft={2} marginY={1}>
          <Text color="gray" dimColor>No search results currently displayed.</Text>
          <Text color="gray" dimColor>
            • Type query keywords and press <Text color="white">[Enter]</Text>
          </Text>
          <Text color="gray" dimColor>
            • Press <Text color="white">[Tab]</Text> to toggle provider (YouTube, SoundCloud, Bandcamp, Bilibili)
          </Text>
        </Box>
      )}
    </Box>
  );
};
