/**
 * @file src/core/ProcessRegistry.ts
 * Atomic subprocess group supervisor and signal trap manager.
 */

import { ChildProcess, spawnSync } from 'node:child_process';

export class ProcessRegistry {
  private static readonly trackedProcesses = new Set<ChildProcess>();
  private static handlersInstalled = false;

  public static track(proc: ChildProcess): ChildProcess {
    this.ensureSignalTraps();
    this.trackedProcesses.add(proc);

    const cleanup = () => {
      this.trackedProcesses.delete(proc);
    };

    proc.once('exit', cleanup);
    proc.once('close', cleanup);
    return proc;
  }

  public static terminateAll(): void {
    for (const proc of this.trackedProcesses) {
      if (proc.pid && !proc.killed) {
        try {
          if (process.platform === 'win32') {
            spawnSync('taskkill', ['/F', '/T', '/PID', proc.pid.toString()]);
          } else {
            // Signal negative PID to terminate the entire process group
            process.kill(-proc.pid, 'SIGTERM');
          }
        } catch {
          try {
            proc.kill('SIGTERM');
          } catch {
            // Process already terminated
          }
        }
      }
    }
    this.trackedProcesses.clear();
  }

  public static count(): number {
    return this.trackedProcesses.size;
  }

  private static ensureSignalTraps(): void {
    if (this.handlersInstalled) return;
    this.handlersInstalled = true;

    const onSignal = (sig: string, code: number) => {
      this.terminateAll();
      process.exit(code);
    };

    process.once('SIGINT', () => onSignal('SIGINT', 130));
    process.once('SIGTERM', () => onSignal('SIGTERM', 143));
    process.once('exit', () => this.terminateAll());
  }
}
