/**
 * @file src/tui/views/ConfigurationView.tsx
 * GridPull CLI native configuration settings view.
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
      label: 'Subfolders Routing',
      value: config.subfoldersEnabled ? 'ENABLED (videos/ & audio/)' : 'DISABLED (flat directory)',
      hint: 'Sort completed files into separate audio/ and videos/ subfolders',
    },
    {
      label: 'Worker Concurrency Limit',
      value: `${config.maxConcurrency} concurrent workers`,
      hint: 'Parallel worker allocation for active queue downloads',
    },
    {
      label: 'Segmented Network Threads (-N)',
      value: `${config.parallelThreads} streams`,
      hint: 'yt-dlp multi-segmented parallel connection threads',
    },
    {
      label: 'Default Video Profile',
      value: config.defaultFormat,
      hint: 'Initial resolution profile preference for video downloads',
    },
    {
      label: 'Default Audio Format',
      value: config.defaultAudioFormat,
      hint: 'Default container extension (mp3, flac, m4a, opus, wav)',
    },
    {
      label: 'Audio Transcode Bitrate',
      value: config.audioBitrate,
      hint: 'Target audio bitrate quality for extraction',
    },
    {
      label: 'Auto-Start Queue',
      value: config.autoStartOnQueue ? 'ENABLED' : 'DISABLED',
      hint: 'Automatically start queue execution when enqueuing new jobs',
    },
    {
      label: 'Reset Configuration',
      value: '[Restore Installation Defaults]',
      hint: 'Reset all configuration settings to factory defaults (~/.config/gridpull-cli/config.json)',
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
          [↑↓] Navigate  •  [Enter / Space] Toggle/Cycle  •  [Esc] Back
        </Text>
      </Box>
    </Box>
  );
};
