/**
 * @file src/tui/components/ActiveDownloadsPanel.tsx
 * Google Developer CLI / kilocode style non-blocking download & worker monitor.
 * Replaces heavy block ASCII with fine hairline progress indicators and clean vertical hierarchy.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { DownloadJob } from '../../types/index.js';

interface ActiveDownloadsPanelProps {
  jobs: ReadonlyArray<DownloadJob>;
  width: number;
  height: number;
}

export const ActiveDownloadsPanel: React.FC<ActiveDownloadsPanelProps> = ({
  jobs,
  width,
  height,
}) => {
  const contentWidth = Math.max(34, width - 3);
  const progressBarWidth = Math.min(20, Math.max(12, contentWidth - 20));

  const renderProgressBar = (percent: number, status: string) => {
    const clamped = Math.max(0, Math.min(100, percent || 0));
    const filledLength = Math.round((clamped / 100) * progressBarWidth);
    const emptyLength = Math.max(0, progressBarWidth - filledLength);
    const bar = '━'.repeat(filledLength) + '─'.repeat(emptyLength);

    if (status === 'COMPLETED') {
      return (
        <Text color="green">
          [{'━'.repeat(progressBarWidth)}] 100%
        </Text>
      );
    }
    if (status === 'FAILED') {
      return (
        <Text color="red">
          [{'─'.repeat(progressBarWidth)}] FAILED
        </Text>
      );
    }
    return (
      <Text color="cyan">
        [{bar}] {clamped.toFixed(0)}%
      </Text>
    );
  };

  // Sort: running, retrying, pending, failed, completed
  const visibleJobs = [...jobs]
    .sort((a, b) => {
      const order: Record<string, number> = {
        RUNNING: 1,
        RETRYING: 2,
        PENDING: 3,
        FAILED: 4,
        COMPLETED: 5,
      };
      return (order[a.status] || 9) - (order[b.status] || 9);
    })
    .slice(0, 5);

  if (visibleJobs.length === 0) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        paddingLeft={2}
        paddingRight={1}
      >
        <Box marginBottom={1}>
          <Text color="gray">
            ℹ <Text color="white">No active downloads in worker pool.</Text>
          </Text>
        </Box>
        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text color="gray" dimColor>
            • Select <Text color="cyan">[2] URL Puller</Text> to inspect and queue streams
          </Text>
          <Text color="gray" dimColor>
            • Select <Text color="cyan">[1] Search</Text> to browse multi-platform catalog
          </Text>
          <Text color="gray" dimColor>
            • Multi-segmented parallel threads (-N) run asynchronously
          </Text>
          <Text color="gray" dimColor>
            • Completed media is saved directly to ./downloads
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      paddingLeft={2}
      paddingRight={1}
      overflow="hidden"
    >
      {visibleJobs.map((job) => {
        const title = job.title || job.url;
        const maxTitleLen = Math.max(18, contentWidth - 6);
        const displayTitle =
          title.length > maxTitleLen
            ? `${title.slice(0, maxTitleLen - 3)}...`
            : title;

        let statusTag = <Text color="gray">[QUEUED]</Text>;
        if (job.status === 'RUNNING') {
          statusTag = <Text color="cyan">[RUNNING]</Text>;
        } else if (job.status === 'COMPLETED') {
          statusTag = <Text color="green">[DONE]</Text>;
        } else if (job.status === 'FAILED') {
          statusTag = <Text color="red">[ERROR]</Text>;
        } else if (job.status === 'RETRYING') {
          statusTag = <Text color="yellow">[RETRY]</Text>;
        }

        const metricsText =
          job.status === 'RUNNING'
            ? `${job.speed || '0 KB/s'} • ETA ${job.eta || '--:--'}`
            : job.formatSelector || 'stream';

        return (
          <Box
            key={job.id}
            flexDirection="column"
            marginBottom={1}
            paddingLeft={1}
          >
            {/* Title & Status Row */}
            <Box justifyContent="space-between">
              <Text bold color="white">
                • {displayTitle}
              </Text>
              {statusTag}
            </Box>

            {/* Progress Bar & Rate Row */}
            <Box justifyContent="space-between" paddingLeft={2}>
              {renderProgressBar(job.percent, job.status)}
              <Text color="gray" dimColor>
                {metricsText}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
