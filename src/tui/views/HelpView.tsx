/**
 * @file src/tui/views/HelpView.tsx
 * GridPull CLI native workflow guide, keybindings reference, and architecture details.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GRIDPULL_COMPACT_BANNER } from '../components/Banner.js';

interface HelpViewProps {
  width: number;
  height: number;
}

export const HelpView: React.FC<HelpViewProps> = ({ width, height }) => {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text color="cyan">{GRIDPULL_COMPACT_BANNER}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="white">
          GRIDPULL CLI ARCHITECTURE & WORKFLOW:
        </Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color="white">
            1. Intelligent Format Pairing & Sizing
          </Text>
          <Box paddingLeft={3}>
            <Text color="gray" dimColor>
              Calculates combined file payloads upfront by pairing pure video streams with
              highest-bitrate matching audio before starting download transfers.
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold color="white">
            2. Non-Blocking Terminal Architecture
          </Text>
          <Box paddingLeft={3}>
            <Text color="gray" dimColor>
              Left workspace panel instantly unblocks upon queue dispatch, allowing concurrent
              searches and URL inputs while the right worker pool processes transfers.
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold color="white">
            3. Multi-Runtime Cross-Platform Installers
          </Text>
          <Box paddingLeft={3}>
            <Text color="gray" dimColor>
              Dedicated installers for Windows (install.ps1), Unix/macOS/Linux/WSL (install.sh),
              and cross-platform Node.js bootstrap (bin/installer.js).
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold color="white">
            4. Shortcut Navigation Reference
          </Text>
          <Box paddingLeft={3} flexDirection="column">
            <Text color="gray" dimColor>
              • <Text color="white">[1-6]</Text> Jump directly between workspace views
            </Text>
            <Text color="gray" dimColor>
              • <Text color="white">[↑↓]</Text> Navigate rows and selection options
            </Text>
            <Text color="gray" dimColor>
              • <Text color="white">[Enter]</Text> Confirm selection or submit form
            </Text>
            <Text color="gray" dimColor>
              • <Text color="white">[Esc]</Text> Return to Main Menu or dismiss prompt
            </Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} paddingLeft={3}>
        <Text color="gray" dimColor>
          Press <Text color="white">[Esc]</Text> to return to Main Menu.
        </Text>
      </Box>
    </Box>
  );
};
