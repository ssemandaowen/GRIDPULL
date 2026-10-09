/**
 * @file src/tui/components/Modal.tsx
 * GridPull CLI native dialog modal with clean fine-line borders and generous padding.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ModalState } from '../types.js';

interface ModalProps {
  modal: ModalState;
  width: number;
}

export const Modal: React.FC<ModalProps> = ({ modal, width }) => {
  if (!modal.isOpen) return null;

  const boxWidth = Math.min(width - 6, 56);
  const isExit = modal.type === 'EXIT_CONFIRM';

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      marginY={1}
    >
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isExit ? 'red' : 'gray'}
        paddingX={2}
        paddingY={1}
        width={boxWidth}
      >
        <Box marginBottom={1}>
          <Text bold color={isExit ? 'red' : 'white'}>
            {modal.title}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="gray">{modal.message}</Text>
        </Box>

        <Box justifyContent="flex-end" gap={2}>
          <Text color="gray">
            <Text bold color="cyan">[Enter / Y]</Text> {modal.confirmLabel || 'Confirm'}
          </Text>
          <Text color="gray">
            <Text bold color="gray">[Esc / N]</Text> {modal.cancelLabel || 'Cancel'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
