/**
 * @file src/tui/components/Footer.tsx
 * Google Developer CLI / gcloud style bottom notifications and shortcut reference bar.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface ShortcutItem {
  key: string;
  label: string;
}

export interface FooterProps {
  statusMessage?: string;
  isError?: boolean;
  shortcuts?: ShortcutItem[];
}

export const Footer: React.FC<FooterProps> = ({ statusMessage, isError, shortcuts }) => {
  const defaultShortcuts: ShortcutItem[] = [
    { key: '[1-6]', label: 'Jump' },
    { key: '[↑↓]', label: 'Select' },
    { key: '[Enter]', label: 'Run' },
    { key: '[Esc]', label: 'Back' },
  ];

  const activeShortcuts = shortcuts && shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Dynamic Status Notification */}
      {statusMessage ? (
        <Box paddingX={1} marginBottom={0}>
          <Text color={isError ? 'red' : 'cyan'}>
            {isError ? '✖ ' : 'ℹ '}
            <Text color={isError ? 'red' : 'white'}>{statusMessage}</Text>
          </Text>
        </Box>
      ) : null}

      {/* Hairline Divider */}
      <Box paddingX={1}>
        <Text color="gray" dimColor>{'─'.repeat(78)}</Text>
      </Box>

      {/* Single Consolidated Status Bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1} flexWrap="wrap">
          <Text color="gray" dimColor>Keys:</Text>
          {activeShortcuts.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <Text color="gray" dimColor>•</Text>}
              <Text color="gray">
                <Text color="white">{item.key}</Text> {item.label}
              </Text>
            </React.Fragment>
          ))}
        </Box>
        <Box>
          <Text color="gray">
            <Text color="gray" dimColor>[Ctrl+C]</Text> Exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
