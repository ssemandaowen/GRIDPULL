/**
 * @file src/tui/views/ConfigurationView.tsx
 * Google Developer CLI style configuration settings view.
 * Uses clean vertical grouping, indented field descriptions, and no bulky borders.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { EngineConfig } from '../../types/index.js';

interface ConfigurationViewProps {
  config: EngineConfig;
  selectedIndex: number;
  width: number;
  height: number;
}

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({
  config,
  selectedIndex,
  width,
  height,
}) => {
  const items = [
    {
      label: 'Download Directory',
      value: config.downloadDir,
      hint: 'Base disk storage location for completed media files',
    },
    {
      label: 'Worker Concurrency Limit',
      value: `${config.maxConcurrency} concurrent downloads`,
      hint: 'Parallel worker allocation for queue processing',
    },
    {
      label: 'Segmented Network Threads (-N)',
      value: `${config.parallelThreads} streams`,
      hint: 'yt-dlp multi-segmented network connections',
    },
    {
      label: 'Default Video Profile',
      value: config.defaultFormat,
      hint: 'Initial stream resolution and container preference',
    },
    {
      label: 'Audio Transcode Bitrate',
      value: config.audioBitrate,
      hint: 'Target bitrate for standalone audio extraction',
    },
    {
      label: 'Auto-Start Queue',
      value: config.autoStartOnQueue ? 'ENABLED' : 'DISABLED',
      hint: 'Automatically start workers upon enqueuing jobs',
    },
    {
      label: 'Reset Configuration',
      value: '[Restore Defaults]',
      hint: 'Reset all runtime settings to installation defaults',
    },
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
          ENGINE CONFIGURATION & RUNTIME SETTINGS:
        </Text>
      </Box>

      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box
            key={item.label}
            flexDirection="column"
            marginBottom={1}
          >
            <Box>
              <Text bold={isSelected} color={isSelected ? 'white' : 'gray'}>
                {isSelected ? (
                  <Text color="cyan">➜  </Text>
                ) : (
                  '   '
                )}
                {item.label}:{' '}
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {item.value}
                </Text>
              </Text>
            </Box>
            <Box paddingLeft={6}>
              <Text color="gray" dimColor={!isSelected}>
                {item.hint}
              </Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={0} paddingLeft={3}>
        <Text color="gray" dimColor>
          [↑↓] Navigate  •  [Enter / Space] Toggle  •  [Esc] Back
        </Text>
      </Box>
    </Box>
  );
};
