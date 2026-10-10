import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigStore } from '../src/storage/ConfigStore.js';
import { HistoryRepository } from '../src/storage/HistoryRepository.js';
import { QueueManager } from '../src/core/QueueManager.js';

test('Task 6: ConfigStore set validation', () => {
  const store = ConfigStore.getInstance();

  // Valid number updates
  store.set('maxConcurrency', 4);
  assert.equal(store.get('maxConcurrency'), 4);

  store.set('parallelThreads', 16);
  assert.equal(store.get('parallelThreads'), 16);

  // Invalid numbers should throw
  assert.throws(() => store.set('maxConcurrency', -1));
  assert.throws(() => store.set('maxConcurrency', 'invalid'));
  assert.throws(() => store.set('maxConcurrency', 2.5));

  // Valid booleans
  store.set('subfoldersEnabled', 'true');
  assert.equal(store.get('subfoldersEnabled'), true);

  store.set('subfoldersEnabled', false);
  assert.equal(store.get('subfoldersEnabled'), false);

  assert.throws(() => store.set('subfoldersEnabled', 'not-a-bool'));

  // Valid audio bitrate
  store.set('audioBitrate', '320K');
  assert.equal(store.get('audioBitrate'), '320K');

  store.set('audioBitrate', '192K');
  assert.equal(store.get('audioBitrate'), '192K');

  assert.throws(() => store.set('audioBitrate', 'invalid-bitrate'));

  // Unknown keys should throw
  assert.throws(() => store.set('unknownKey' as any, 123));

  // Reset back to defaults
  store.reset();
});

test('Task 5: HistoryRepository deduplication and atomic loading', () => {
  const repo = HistoryRepository.getInstance();

  const tempFile = path.join(os.tmpdir(), `test_media_${Date.now()}.mp4`);
  fs.writeFileSync(tempFile, 'dummy media content');

  const testUrl = 'https://example.com/test-video';
  const targetDir = os.tmpdir();
  const format = '1080p_mp4';

  repo.record({
    url: testUrl,
    title: 'Test Video Title',
    format,
    mediaType: 'video',
    targetDirectory: targetDir,
    targetPath: tempFile,
    status: 'COMPLETED',
    error: null,
  });

  // Duplicate check matching url + targetDir + format should return true when file exists
  assert.equal(repo.isDuplicate(testUrl, targetDir, format), true);

  // Force flag should bypass deduplication check
  assert.equal(repo.isDuplicate(testUrl, targetDir, format, true), false);

  // Different format should not count as duplicate
  assert.equal(repo.isDuplicate(testUrl, targetDir, '720p_mp4'), false);

  // Deleting file should invalidate duplicate check
  fs.unlinkSync(tempFile);
  assert.equal(repo.isDuplicate(testUrl, targetDir, format), false);
});

test('Task 4: QueueManager force enqueueing and skipping', () => {
  const q = QueueManager.getInstance();
  const testUrl = 'https://example.com/queue-test';

  const job = q.enqueue(testUrl, {
    format: '1080p_mp4',
    force: true,
    autoStart: false,
  });

  assert.equal(job.url, testUrl);
  assert.equal(job.force, true);

  // Clean up test job
  q.removeJob(job.id);
});
