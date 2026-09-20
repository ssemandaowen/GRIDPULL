/**
 * @file src/utils/notification.ts
 * Cross-platform terminal bell and OS-level desktop notification bridge.
 * Signals download task completions with filename, size, and destination summary.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { DownloadJob } from '../types/index.js';

export interface NotificationSummary {
  title: string;
  filename: string;
  size: string;
  location: string;
  formattedMessage: string;
}

/**
 * Format download completion metadata into a clean summary.
 */
export function formatCompletionSummary(job: DownloadJob): NotificationSummary {
  const filename = job.filename
    ? path.basename(job.filename)
    : job.title
    ? `${job.title.replace(/[\\/:*?"<>|]/g, '_')}`
    : 'Media File';

  const size = job.downloadedSize && job.downloadedSize !== '0 MiB'
    ? job.downloadedSize
    : job.totalSize && job.totalSize !== '0 MiB'
    ? job.totalSize
    : 'Complete';

  const location = job.targetDirectory || process.cwd();

  const formattedMessage = `${filename} (${size}) → ${location}`;

  return {
    title: 'GridPull: Download Finished',
    filename,
    size,
    location,
    formattedMessage,
  };
}

/**
 * Trigger native terminal bell (ASCII BEL \x07).
 */
export function ringTerminalBell(): void {
  try {
    if (process.stdout && typeof process.stdout.write === 'function') {
      process.stdout.write('\x07');
    }
  } catch {
    // Non-fatal if stdout cannot write bell
  }
}

/**
 * Dispatch an OS-level notification bridge asynchronously without blocking CLI execution.
 */
export function sendOsNotification(summary: NotificationSummary): void {
  const { title, filename, size, location } = summary;
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: Use background PowerShell balloon / toast notification
      const escapedTitle = title.replace(/'/g, "''");
      const escapedMsg = `File: ${filename}\nSize: ${size}\nFolder: ${location}`.replace(/'/g, "''");

      const psScript = `
        try {
          [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');
          $notify = New-Object System.Windows.Forms.NotifyIcon;
          $notify.Icon = [System.Drawing.SystemIcons]::Information;
          $notify.BalloonTipTitle = '${escapedTitle}';
          $notify.BalloonTipText = '${escapedMsg}';
          $notify.Visible = $true;
          $notify.ShowBalloonTip(4000);
          Start-Sleep -Milliseconds 600;
          $notify.Dispose();
        } catch {}
      `;

      const child = spawn(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }
      );
      child.on('error', () => {});
      child.unref();
    } else if (platform === 'darwin') {
      // macOS: Use osascript system notification
      const escapedTitle = title.replace(/"/g, '\\"');
      const escapedMsg = `${filename} (${size}) saved to ${location}`.replace(/"/g, '\\"');
      const script = `display notification "${escapedMsg}" with title "${escapedTitle}"`;

      const child = spawn('osascript', ['-e', script], {
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {});
      child.unref();
    } else if (platform === 'linux') {
      // Linux: Use notify-send if available
      const child = spawn(
        'notify-send',
        [
          '-a',
          'GridPull',
          title,
          `File: ${filename}\nSize: ${size}\nPath: ${location}`,
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      child.on('error', () => {});
      child.unref();
    }
  } catch {
    // Non-fatal fallback: Terminal bell was already triggered
  }
}

/**
 * High-level notification bridge orchestrator.
 * Rings the terminal bell, dispatches the OS notification, and returns the summary.
 */
export function notifyDownloadCompleted(job: DownloadJob): NotificationSummary {
  const summary = formatCompletionSummary(job);

  // 1. Terminal audio signal
  ringTerminalBell();

  // 2. OS-level visual alert
  sendOsNotification(summary);

  return summary;
}
