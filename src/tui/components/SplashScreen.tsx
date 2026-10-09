/**
 * @file src/tui/components/SplashScreen.tsx
 * TUI ASCII Splash Screen for boot loading sequence and graceful exit transition.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { GRIDPULL_ASCII_BANNER } from './Banner.js';

interface LoadingScreenProps {
  onComplete: () => void;
  width: number;
  height: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, width, height }) => {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(2), 350);
    const timer2 = setTimeout(() => setStep(3), 700);
    const timer3 = setTimeout(() => {
      setStep(4);
      setTimeout(onComplete, 350);
    }, 1050);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <Box flexDirection="column" width={width} height={height} justifyContent="center" alignItems="center">
      <Box marginBottom={1}>
        <Text color="cyan">{GRIDPULL_ASCII_BANNER}</Text>
      </Box>

      <Box flexDirection="column" alignItems="flex-start" marginY={1}>
        <Text color={step >= 1 ? 'green' : 'gray'}>
          {step >= 1 ? '✔' : '○'} [1/3] Initializing Node.js Ink TUI Engine...
        </Text>
        <Text color={step >= 2 ? 'green' : 'gray'}>
          {step >= 2 ? '✔' : '○'} [2/3] Verifying Stream Engine Subsystem...
        </Text>
        <Text color={step >= 3 ? 'green' : 'gray'}>
          {step >= 3 ? '✔' : '○'} [3/3] Loading Configuration & History Database...
        </Text>
      </Box>

      {step >= 4 && (
        <Box marginTop={1}>
          <Text bold color="cyan">
            ⚡ GridPull CLI ready. Opening Dashboard...
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const ExitScreen: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  return (
    <Box flexDirection="column" width={width} height={height} justifyContent="center" alignItems="center">
      <Box borderStyle="round" borderColor="cyan" paddingX={3} paddingY={1} flexDirection="column" alignItems="center">
        <Text bold color="white">
          ✔ GRIDPULL TERMINAL SESSION CLOSED
        </Text>
        <Box marginTop={1}>
          <Text color="gray">
            All active queue states and runtime configurations saved.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="cyan" dimColor>
            Thank you for using GridPull CLI!
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
