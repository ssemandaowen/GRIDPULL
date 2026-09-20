/**
 * @file src/tui/runTui.tsx
 * TUI bootstrap entry point that mounts the Ink React component hierarchy.
 */

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export function runTui() {
  return render(<App />);
}
