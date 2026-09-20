/**
 * @file src/tui/views/MainMenuView.tsx
 * Google Developer CLI / gcloud / Firebase style interactive action menu.
 * Built with clean vertical indentation, subtle gray secondary text, and zero bulky borders.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MainNavView } from '../types.js';

interface MainMenuViewProps {
  selectedIndex: number;
  onSelect: (view: MainNavView) => void;
  width: number;
  height: number;
}

interface MenuItem {
  key: string;
  title: string;
  desc: string;
  targetView: MainNavView;
}

export const MAIN_MENU_ITEMS: MenuItem[] = [
  {
    key: '1',
    title: 'Search Media Catalog',
    desc: 'Query YouTube, SoundCloud, and Bandcamp for streams',
    targetView: 'SEARCH',
  },
  {
    key: '2',
    title: 'URL Puller (Single / Batch)',
    desc: 'Inspect URLs, calculate upfront paired sizes, or process batch files',
    targetView: 'URL_PULLER',
  },
  {
    key: '3',
    title: 'Configuration Settings',
    desc: 'Adjust worker concurrency, destination directories, and network threads',
    targetView: 'CONFIG',
  },
  {
    key: '4',
    title: 'Downloads Queue Manager',
    desc: 'Pause, resume, retry, and monitor active and completed background tasks',
    targetView: 'DOWNLOADS',
  },
  {
    key: '5',
    title: 'Help & Architecture Guide',
    desc: 'View user guidelines, shortcut reference, and format pairing details',
    targetView: 'HELP',
  },
  {
    key: '6',
    title: 'Exit',
    desc: 'Quit GridPull session gracefully',
    targetView: 'MAIN_MENU',
  },
];

export const MainMenuView: React.FC<MainMenuViewProps> = ({
  selectedIndex,
  width,
  height,
}) => {
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
          SELECT WORKSPACE ACTION:
        </Text>
      </Box>

      {MAIN_MENU_ITEMS.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box
            key={item.key}
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
                <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>
                  [{item.key}]
                </Text>{' '}
                {item.title}
              </Text>
            </Box>
            <Box paddingLeft={6}>
              <Text color="gray" dimColor={!isSelected}>
                {item.desc}
              </Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1} paddingLeft={3}>
        <Text color="gray" dimColor>
          ℹ Press [1-6] to jump, or use [↑↓] then [Enter].
        </Text>
      </Box>
    </Box>
  );
};
