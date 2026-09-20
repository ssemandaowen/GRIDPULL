/**
 * @file src/tui/hooks/useDownloadNotification.ts
 * React hook connecting QueueManager download completion events to the terminal bell
 * and OS-level notification bridge.
 */

import { useEffect, useRef } from 'react';
import { QueueManager } from '../../core/QueueManager.js';
import { DownloadJob } from '../../types/index.js';
import { notifyDownloadCompleted, NotificationSummary } from '../../utils/notification.js';

export interface UseDownloadNotificationOptions {
  onNotify?: (summary: NotificationSummary, job: DownloadJob) => void;
}

/**
 * Hook that listens for completed download tasks and triggers both
 * the terminal bell and desktop notifications with filename, size, and destination path.
 */
export function useDownloadNotification(
  queueManager: QueueManager,
  options?: UseDownloadNotificationOptions
) {
  const onNotifyRef = useRef(options?.onNotify);
  onNotifyRef.current = options?.onNotify;

  useEffect(() => {
    const handleJobCompleted = (job: DownloadJob) => {
      // Trigger terminal bell + OS notification bridge
      const summary = notifyDownloadCompleted(job);

      if (onNotifyRef.current) {
        onNotifyRef.current(summary, job);
      }
    };

    queueManager.on('jobCompleted', handleJobCompleted);

    return () => {
      queueManager.off('jobCompleted', handleJobCompleted);
    };
  }, [queueManager]);
}
