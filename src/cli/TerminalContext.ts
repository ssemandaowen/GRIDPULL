/**
 * @file src/cli/TerminalContext.ts
 * Pure terminal ANSI formatting, cursor control, and raw-mode TTY helpers.
 */

import * as readline from 'node:readline';

export class TerminalContext {
  // ANSI Styling Codes
  public static readonly RESET = '\x1B[0m';
  public static readonly BOLD = '\x1B[1m';
  public static readonly DIM = '\x1B[2m';
  public static readonly UNDERLINE = '\x1B[4m';
  public static readonly INVERT = '\x1B[7m';

  // Colors
  public static readonly BLACK = '\x1B[30m';
  public static readonly RED = '\x1B[31m';
  public static readonly GREEN = '\x1B[32m';
  public static readonly YELLOW = '\x1B[33m';
  public static readonly BLUE = '\x1B[34m';
  public static readonly MAGENTA = '\x1B[35m';
  public static readonly CYAN = '\x1B[36m';
  public static readonly WHITE = '\x1B[37m';
  public static readonly GRAY = '\x1B[90m';

  // Backgrounds
  public static readonly BG_CYAN = '\x1B[46m';
  public static readonly BG_YELLOW = '\x1B[43m';
  public static readonly BG_GREEN = '\x1B[42m';
  public static readonly BG_RED = '\x1B[41m';
  public static readonly BG_GRAY = '\x1B[100m';

  public static initialize(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      readline.emitKeypressEvents(process.stdin);
    }
  }

  public static restore(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdout.write('\x1B[?25h'); // Show cursor
  }

  public static clear(): void {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1B[?25l'); // Clear screen & hide cursor
  }

  public static showCursor(): void {
    process.stdout.write('\x1B[?25h');
  }

  public static hideCursor(): void {
    process.stdout.write('\x1B[?25l');
  }

  public static write(text: string): void {
    process.stdout.write(text);
  }

  public static writeLine(text: string = ''): void {
    process.stdout.write(`${text}\n`);
  }

  public static renderBar(percent: number, width: number = 24): string {
    const clamped = Math.max(0, Math.min(100, percent || 0));
    const filled = Math.round((clamped / 100) * width);
    const empty = width - filled;
    return `${this.CYAN}${'█'.repeat(filled)}${this.GRAY}${'░'.repeat(empty)}${this.RESET} ${clamped.toFixed(1)}%`;
  }
}
