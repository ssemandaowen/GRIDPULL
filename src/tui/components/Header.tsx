/**
 * @file src/tui/components/Header.tsx
 * Google Developer CLI / gcloud / Firebase style minimalist header and workspace breadcrumb.
 * Employs crisp typography, fine hairline rules, and generous negative space.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  activeCount: number;
  totalQueueCount: number;
  isPaused: boolean;
  currentView: string;
  totalWidth: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  totalQueueCount,
  isPaused,
  currentView,
  totalWidth,
}) => {
  const nodeVersion = process.version;
  const viewTitle = currentView.replace('_', ' ').toUpperCase();

  const leftWidth = Math.max(38, Math.floor((totalWidth - 3) / 2));
  const rightWidth = Math.max(38, totalWidth - 3 - leftWidth);

  // Status tag styling
  let statusBadge = <Text color="gray">[IDLE]</Text>;
  if (isPaused) {
    statusBadge = <Text color="yellow">[PAUSED]</Text>;
  } else if (activeCount > 0) {
    statusBadge = <Text color="cyan">[RUNNING: {activeCount}]</Text>;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Primary Brand & Status Bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box gap={1}>
          <Text bold color="white">GridPull CLI</Text>
          <Text color="gray">v4.0.0</Text>
          <Text color="gray" dimColor>│</Text>
          <Text color="gray" dimColor>runtime: local-host ({nodeVersion})</Text>
        </Box>
        <Box gap={1}>
          {statusBadge}
          <Text color="gray">Queue: {totalQueueCount}</Text>
        </Box>
      </Box>

      {/* Hairline Divider */}
      <Box paddingX={1}>
        <Text color="gray" dimColor>{'─'.repeat(Math.max(20, totalWidth - 2))}</Text>
      </Box>

      {/* Dual Column Headings */}
      <Box flexDirection="row" paddingX={1} marginTop={0}>
        <Box width={leftWidth}>
          <Text bold color="white">
            WORKSPACE <Text color="gray">›</Text> <Text color="cyan">{viewTitle}</Text>
          </Text>
        </Box>
        <Box width={rightWidth}>
          <Text bold color="white">
            WORKER POOL <Text color="gray">›</Text> <Text color={activeCount > 0 ? 'cyan' : 'gray'}>{activeCount} Active</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
