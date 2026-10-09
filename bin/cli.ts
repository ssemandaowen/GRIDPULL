#!/usr/bin/env node
/**
 * @file bin/cli.ts
 * Main CLI entry point with command flag parsing, interactive TUI fallback,
 * universal format resolver, and VidMate / Snaptube media tool suite.
 */

import { Command } from 'commander';
import { runTui } from '../src/tui/runTui.js';
import { QueueManager } from '../src/core/QueueManager.js';
import { UrlInspector } from '../src/parser/UrlInspector.js';
import { FormatRegistry } from '../src/parser/FormatRegistry.js';
import { UniversalFormatResolver } from '../src/parser/UniversalFormatResolver.js';
import { DependencyChecker } from '../src/core/DependencyChecker.js';
import { ConfigStore } from '../src/storage/ConfigStore.js';
import { HistoryRepository } from '../src/storage/HistoryRepository.js';
import { GRIDPULL_ASCII_BANNER } from '../src/tui/components/Banner.js';
import * as fs from 'node:fs';

const program = new Command();
const queueManager = QueueManager.getInstance();
const configStore = ConfigStore.getInstance();

program
  .name('gridpull')
  .description('GridPull — Native high-performance terminal media downloader and stream processing engine')
  .version('4.1.0')
  .addHelpText('before', '\n' + GRIDPULL_ASCII_BANNER + '\n\n')
  .argument('[url]', 'Target video, audio, or playlist URL')
  .option('-f, --format <format>', 'Quality tier (e.g. 1080p_mp4, mp3) or raw selector (e.g. 137+140, bv*+ba/b)')
  .option('-o, --out-dir <directory>', 'Destination directory')
  .option('-t, --threads <number>', 'Parallel connection thread count (-N)', '8')
  .option('-b, --batch <file>', 'Path to batch .txt file containing 1 URL per line')
  .option('--section <range>', 'Clip section time range (e.g. *00:01:00-00:02:30)')
  .option('--cookies <file>', 'Path to Netscape cookies.txt file')
  .option('--reset-config', 'Reset configuration settings to defaults')
  .action(async (url, options) => {
    if (options.resetConfig) {
      configStore.reset();
      console.log('✔ Configuration reset to factory defaults.');
      process.exit(0);
    }

    if (options.batch) {
      if (!fs.existsSync(options.batch)) {
        console.error(`✖ Batch file not found: ${options.batch}`);
        process.exit(1);
      }
      const raw = fs.readFileSync(options.batch, 'utf8');
      const urls = raw.split(/\r?\n/).map((u) => u.trim()).filter((u) => u.length > 0);
      console.log(`⚡ Ingesting ${urls.length} URLs from batch file: ${options.batch}...`);
      queueManager.enqueueBatch(urls, {
        format: options.format,
        targetDirectory: options.outDir,
      });

      queueManager.on('jobCompleted', (job) => {
        console.log(`✔ [COMPLETED] ${job.title || job.url}`);
      });
      queueManager.on('jobFailed', (job) => {
        console.error(`✖ [FAILED] ${job.url}: ${job.error}`);
      });
      queueManager.on('queueDrained', () => {
        console.log('\n🎉 All batch downloads completed.');
        process.exit(0);
      });
      return;
    }

    if (url) {
      const resolved = FormatRegistry.resolve(options.format);
      console.log(`\n⚡ Initializing download for: ${url}`);
      console.log(`   Format: ${resolved.label} [${resolved.selector}]`);

      const job = queueManager.enqueue(url, {
        format: resolved.selector,
        targetDirectory: options.outDir,
        mediaType: resolved.mode === 'audio' ? 'audio' : 'video',
        section: options.section,
        cookies: options.cookies,
        autoStart: true,
      });

      queueManager.on('telemetry', (t) => {
        if (t.jobId === job.id) {
          process.stdout.write(`\r⏬ [${t.percent.toFixed(1)}%] ${t.size} @ ${t.speed} (ETA: ${t.eta})      `);
        }
      });

      queueManager.on('jobCompleted', (completedJob) => {
        if (completedJob.id === job.id) {
          process.stdout.write('\r                                                                 \r');
          console.log(`✔ Download finished: ${completedJob.filename || completedJob.title || completedJob.url}\n`);
          process.exit(0);
        }
      });

      queueManager.on('jobFailed', (failedJob) => {
        if (failedJob.id === job.id) {
          process.stdout.write('\r                                                                 \r');
          console.error(`✖ Download failed: ${failedJob.error}\n`);
          process.exit(1);
        }
      });
      return;
    }

    // Default: Pure Ink React Terminal User Interface (TUI)
    runTui();
  });

program
  .command('tui')
  .description('Launch pure Node.js Ink React Terminal User Interface')
  .action(() => {
    runTui();
  });

program
  .command('search <query>')
  .description('Search multi-source media catalog with dynamic pagination')
  .option('-s, --source <source>', 'Search source (youtube, soundcloud, bandcamp, bilibili, deezer)', 'youtube')
  .option('-c, --count <number>', 'Total number of items to query', '30')
  .option('-p, --page <number>', 'Page number to display (10 items per page)', '1')
  .action(async (query, opts) => {
    const inspector = new UrlInspector();
    const count = parseInt(opts.count, 10) || 30;
    const requestedPage = Math.max(1, parseInt(opts.page, 10) || 1);
    console.log(`\n🔍 Searching ${opts.source} for "${query}"...\n`);
    try {
      const items = await inspector.search(query, opts.source, count);
      if (items.length === 0) {
        console.log('  No results found.\n');
        return;
      }
      const totalPages = Math.max(1, Math.ceil(items.length / 10));
      const currentPage = Math.min(requestedPage, totalPages);
      const startIndex = (currentPage - 1) * 10;
      const pageItems = items.slice(startIndex, startIndex + 10);
      const endIndex = Math.min(startIndex + 10, items.length);

      pageItems.forEach((r, idx) => {
        const itemNumber = startIndex + idx + 1;
        console.log(`  [${itemNumber.toString().padStart(2, ' ')}] ${r.title.slice(0, 55)} (${r.duration || 'Stream'})`);
        console.log(`       Channel: ${r.uploader} | URL: ${r.url}`);
      });
      console.log();
      console.log(`  Page ${currentPage} of ${totalPages} (Items ${startIndex + 1}-${endIndex} of ${items.length})`);
      if (totalPages > 1 && currentPage < totalPages) {
        console.log(`  Tip: Run "gridpull search \\"${query}\\" --page ${currentPage + 1}" to view next page.`);
      }
      console.log();
    } catch (err: any) {
      console.error(`✖ Search failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('formats <url>')
  .description('Inspect available live stream formats and calculated sizes for a URL')
  .action(async (url) => {
    const inspector = new UrlInspector();
    console.log(`\n📋 Querying stream format table & sizes for: ${url}...\n`);
    try {
      const [meta, formats] = await Promise.all([
        inspector.inspect(url).catch(() => null),
        inspector.getAvailableFormats(url).catch(() => []),
      ]);

      if (meta) {
        console.log(`  Title:    ${meta.title}`);
        console.log(`  Uploader: ${meta.uploader} (${meta.durationString || '--:--'})`);
        console.log();
      }

      if (formats.length > 0) {
        console.log('  [RAW MANIFEST STREAMS]');
        console.log('  ID         EXT    RESOLUTION  FPS   VCODEC          ACODEC          SIZE');
        console.log('  -----------------------------------------------------------------------------');
        formats.slice(0, 20).forEach((f) => {
          const id = (f.id || '').padEnd(10, ' ');
          const ext = (f.extension || '').padEnd(6, ' ');
          const res = (f.resolution || '').padEnd(11, ' ');
          const fps = (f.fps ? `${f.fps}fps` : '').padEnd(5, ' ');
          const vc = (f.videoCodec || '-').slice(0, 14).padEnd(15, ' ');
          const ac = (f.audioCodec || '-').slice(0, 14).padEnd(15, ' ');
          const sz = f.filesize || '-';
          console.log(`  ${id} ${ext} ${res} ${fps} ${vc} ${ac} ${sz}`);
        });
        console.log();
      }

      console.log('  [UNIVERSAL DOWNLOAD TIERS & ESTIMATED SIZES]');
      console.log('  TIER CODE        CONTAINER  RESOLUTION   ESTIMATED SIZE  DESCRIPTION');
      console.log('  ---------------------------------------------------------------------------------');
      const resolved = UniversalFormatResolver.resolveFormats(meta, formats);
      resolved.forEach((t) => {
        const id = t.id.padEnd(16, ' ');
        const cnt = t.container.padEnd(10, ' ');
        const res = t.resolution.padEnd(12, ' ');
        const sz = t.size.padEnd(15, ' ');
        console.log(`  ${id} ${cnt} ${res} ${sz} ${t.description}`);
      });
      console.log('\n  Tip: Download any tier above using: gridpull <url> -f <TIER_CODE>\n');
    } catch (err: any) {
      console.error(`✖ Format inspection failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('audio <url>')
  .description('VidMate / Snaptube Tool: Extract and convert stream directly to high-fidelity audio')
  .option('-f, --format <format>', 'Audio container (mp3, flac, m4a, opus, wav)', 'mp3')
  .option('-q, --quality <quality>', 'Audio bitrate quality (e.g. 320K, 192K, 0)', '320K')
  .option('-o, --out-dir <directory>', 'Destination directory')
  .action((url, opts) => {
    console.log(`\n🎵 Extracting audio (${opts.format.toUpperCase()} @ ${opts.quality}) from: ${url}`);
    const job = queueManager.enqueue(url, {
      format: opts.format,
      targetDirectory: opts.outDir,
      mediaType: 'audio',
      autoStart: true,
    });

    queueManager.on('telemetry', (t) => {
      if (t.jobId === job.id) {
        process.stdout.write(`\r⏬ [${t.percent.toFixed(1)}%] ${t.size} @ ${t.speed} (ETA: ${t.eta})      `);
      }
    });
    queueManager.on('jobCompleted', (completedJob) => {
      if (completedJob.id === job.id) {
        process.stdout.write('\r                                                                 \r');
        console.log(`✔ Audio converted & saved: ${completedJob.filename || completedJob.title || completedJob.url}\n`);
        process.exit(0);
      }
    });
    queueManager.on('jobFailed', (failedJob) => {
      if (failedJob.id === job.id) {
        process.stdout.write('\r                                                                 \r');
        console.error(`✖ Audio extraction failed: ${failedJob.error}\n`);
        process.exit(1);
      }
    });
  });

program
  .command('clip <url>')
  .description('VidMate / Snaptube Tool: Download trimmed video or audio time slice without full download')
  .requiredOption('-s, --section <range>', 'Time slice specification (e.g. *00:00:30-00:01:45)')
  .option('-f, --format <format>', 'Video format tier', 'bv*+ba/b')
  .option('-o, --out-dir <directory>', 'Destination directory')
  .action((url, opts) => {
    console.log(`\n✂️  Clipping segment [${opts.section}] from: ${url}`);
    const job = queueManager.enqueue(url, {
      format: opts.format,
      section: opts.section,
      targetDirectory: opts.outDir,
      autoStart: true,
    });

    queueManager.on('telemetry', (t) => {
      if (t.jobId === job.id) {
        process.stdout.write(`\r⏬ [${t.percent.toFixed(1)}%] ${t.size} @ ${t.speed} (ETA: ${t.eta})      `);
      }
    });
    queueManager.on('jobCompleted', (completedJob) => {
      if (completedJob.id === job.id) {
        process.stdout.write('\r                                                                 \r');
        console.log(`✔ Stream segment trimmed & saved: ${completedJob.filename || completedJob.title}\n`);
        process.exit(0);
      }
    });
    queueManager.on('jobFailed', (failedJob) => {
      if (failedJob.id === job.id) {
        process.stdout.write('\r                                                                 \r');
        console.error(`✖ Clipping failed: ${failedJob.error}\n`);
        process.exit(1);
      }
    });
  });

program
  .command('thumb <url>')
  .description('VidMate / Snaptube Tool: Extract original high-resolution poster artwork / thumbnail')
  .option('-o, --out-dir <directory>', 'Destination directory')
  .action((url, opts) => {
    console.log(`\n🖼️  Downloading high-resolution poster artwork for: ${url}`);
    const job = queueManager.enqueue(url, {
      format: 'thumbnail',
      writeThumbnail: true,
      targetDirectory: opts.outDir,
      autoStart: true,
    });

    queueManager.on('jobCompleted', (completedJob) => {
      if (completedJob.id === job.id) {
        console.log(`✔ Thumbnail saved to disk: ${completedJob.filename || completedJob.title}\n`);
        process.exit(0);
      }
    });
    queueManager.on('jobFailed', (failedJob) => {
      if (failedJob.id === job.id) {
        console.error(`✖ Thumbnail download failed: ${failedJob.error}\n`);
        process.exit(1);
      }
    });
  });

program
  .command('subs <url>')
  .description('VidMate / Snaptube Tool: Extract subtitles / closed captions as standard .srt')
  .option('-l, --lang <lang>', 'Subtitle language code', 'en')
  .option('-o, --out-dir <directory>', 'Destination directory')
  .action((url, opts) => {
    console.log(`\n📝 Downloading subtitles (${opts.lang}) for: ${url}`);
    const job = queueManager.enqueue(url, {
      format: 'subtitles',
      writeSubs: true,
      subLang: opts.lang,
      targetDirectory: opts.outDir,
      autoStart: true,
    });

    queueManager.on('jobCompleted', (completedJob) => {
      if (completedJob.id === job.id) {
        console.log(`✔ Subtitles saved to disk: ${completedJob.filename || completedJob.title}\n`);
        process.exit(0);
      }
    });
    queueManager.on('jobFailed', (failedJob) => {
      if (failedJob.id === job.id) {
        console.error(`✖ Subtitle extraction failed: ${failedJob.error}\n`);
        process.exit(1);
      }
    });
  });

program
  .command('deps')
  .description('Verify system binaries and operational dependencies')
  .action(() => {
    console.log('\n🩺 GridPull System Binary Diagnostics:');
    console.log('----------------------------------------------------');
    const deps = DependencyChecker.verifyAll();
    deps.forEach((d) => {
      const icon = d.installed ? '✔' : '✖';
      console.log(`  ${icon} ${d.name.padEnd(12)}: ${d.installed ? d.version : 'MISSING'}`);
    });
    console.log();
  });

program
  .command('history')
  .description('View download audit records')
  .option('-l, --limit <count>', 'Maximum records to display', '20')
  .action((opts) => {
    const history = HistoryRepository.getInstance();
    const records = history.list(parseInt(opts.limit, 10) || 20);
    console.log('\n📊 Recent Downloads History:');
    console.log('----------------------------------------------------');
    if (records.length === 0) {
      console.log('  (No records found)\n');
      return;
    }
    records.forEach((r) => {
      const icon = r.status === 'COMPLETED' ? '✔' : '✖';
      console.log(`  ${icon} [${r.timestamp.slice(0, 19)}] ${r.title.slice(0, 48)}`);
      console.log(`     Format: ${r.format} | Path: ${r.targetPath}`);
    });
    console.log();
  });


const configCmd = program.command("config").description("View or manage persistent configuration settings");

configCmd
  .command("list", { isDefault: true })
  .description("Display all current configuration settings")
  .action(() => {
    const cfg = configStore.getAll();
    console.log("\n⚙️  GridPull Configuration Settings (~/.config/gridpull-cli/config.json):");
    console.log("─────────────────────────────────────────────────────────────────────────────────");
    console.log("KEY                   VALUE                                 DESCRIPTION");
    console.log("─────────────────────────────────────────────────────────────────────────────────");
    console.log(`downloadDir           ${cfg.downloadDir.padEnd(36)} Base storage directory`);
    console.log(`subfoldersEnabled     ${String(cfg.subfoldersEnabled).padEnd(36)} Sort into audio/ & videos/ folders`);
    console.log(`maxConcurrency        ${String(cfg.maxConcurrency).padEnd(36)} Max concurrent worker tasks`);
    console.log(`parallelThreads       ${String(cfg.parallelThreads).padEnd(36)} Multi-connection network streams (-N)`);
    console.log(`defaultFormat         ${cfg.defaultFormat.padEnd(36)} Default video resolution profile`);
    console.log(`defaultAudioFormat    ${cfg.defaultAudioFormat.padEnd(36)} Default audio container extension`);
    console.log(`audioBitrate          ${cfg.audioBitrate.padEnd(36)} Standalone audio bitrate quality`);
    console.log(`autoStartOnQueue      ${String(cfg.autoStartOnQueue).padEnd(36)} Auto-start queued tasks`);
    console.log("─────────────────────────────────────────────────────────────────────────────────");
    console.log("Tip: Modify settings via CLI: \"gridpull config set <key> <value>\" or run TUI.\n");
  });

configCmd
  .command("get <key>")
  .description("Get value of a specific configuration key")
  .action((key) => {
    const val = configStore.get(key as any);
    if (val === undefined) {
      console.error(`✖ Unknown configuration key: "${key}"`);
      process.exit(1);
    }
    console.log(`${key} = ${val}`);
  });

configCmd
  .command("set <key> <value>")
  .description("Set value for a configuration key")
  .action((key, value) => {
    let parsed: any = value;
    if (value === "true") parsed = true;
    else if (value === "false") parsed = false;
    else if (!isNaN(Number(value)) && key !== "audioBitrate") parsed = Number(value);

    try {
      configStore.set(key as any, parsed);
      console.log(`✔ Updated configuration setting: ${key} = ${parsed}`);
    } catch (err: any) {
      console.error(`✖ Failed to update configuration setting: ${err.message}`);
      process.exit(1);
    }
  });

configCmd
  .command("reset")
  .description("Reset configuration settings to defaults")
  .action(() => {
    configStore.reset();
    console.log("✔ Configuration reset to installation defaults.");
  });

program.parse(process.argv);
