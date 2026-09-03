import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export interface ProcessGroupOptions {
  cmd: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

export class ManagedProcessGroup {
  public readonly child: ChildProcess;
  public readonly pid: number;
  private _isAlive = true;
  private _exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  private _resolveExit!: (value: { code: number | null; signal: NodeJS.Signals | null }) => void;

  constructor(options: ProcessGroupOptions) {
    const spawnOptions: SpawnOptions = {
      detached: true, // Creates a new process group with child as leader
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    this.child = spawn(options.cmd, options.args, spawnOptions);

    if (!this.child.pid) {
      throw new Error(`Failed to spawn child process for command: ${options.cmd}`);
    }

    this.pid = this.child.pid;

    this._exitPromise = new Promise((resolve) => {
      this._resolveExit = resolve;
    });

    this.child.on('exit', (code, signal) => {
      this._isAlive = false;
      this._resolveExit({ code, signal });
    });

    this.child.on('error', (err) => {
      // Process error (e.g. command not found)
      this._isAlive = false;
      this._resolveExit({ code: 1, signal: null });
    });
  }

  public get isAlive(): boolean {
    return this._isAlive;
  }

  public get exitPromise(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    return this._exitPromise;
  }

  public writeStdin(chunk: string): boolean {
    if (!this._isAlive || !this.child.stdin || this.child.stdin.destroyed) {
      return false;
    }
    return this.child.stdin.write(chunk);
  }

  public closeStdin(): void {
    if (this.child.stdin && !this.child.stdin.destroyed) {
      this.child.stdin.end();
    }
  }

  /**
   * Terminate the entire process group using negative PID:
   * Escalation: SIGINT -> wait 2.5s -> SIGTERM -> wait 1.0s -> SIGKILL.
   */
  public async terminate(): Promise<void> {
    if (!this._isAlive) {
      return;
    }

    const pgid = -this.pid;

    // Helper to send signal safely to negative PID process group
    const sendSignal = (signal: NodeJS.Signals): boolean => {
      try {
        process.kill(pgid, signal);
        return true;
      } catch (err: any) {
        if (err.code === 'ESRCH') {
          // Process or process group no longer exists
          this._isAlive = false;
          return false;
        }
        // If killing process group directly fails with EPERM, try single PID fallback
        try {
          process.kill(this.pid, signal);
          return true;
        } catch {
          return false;
        }
      }
    };

    // Helper to wait for exit with timeout
    const waitForExit = (timeoutMs: number): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        if (!this._isAlive) {
          resolve(true);
          return;
        }

        const timer = setTimeout(() => {
          cleanup();
          resolve(!this._isAlive);
        }, timeoutMs);

        const onDone = () => {
          cleanup();
          resolve(true);
        };

        const cleanup = () => {
          clearTimeout(timer);
          this.child.removeListener('exit', onDone);
        };

        this.child.once('exit', onDone);
      });
    };

    // Step 1: Send SIGINT
    if (sendSignal('SIGINT')) {
      const exited = await waitForExit(2500);
      if (exited) {
        this._isAlive = false;
        return;
      }
    }

    // Step 2: Escalate to SIGTERM
    if (sendSignal('SIGTERM')) {
      const exited = await waitForExit(1000);
      if (exited) {
        this._isAlive = false;
        return;
      }
    }

    // Step 3: Force kill with SIGKILL
    sendSignal('SIGKILL');
    await waitForExit(500);
    this._isAlive = false;
  }
}

/**
 * Registry to manage active process groups by session ID.
 */
class ProcessRegistry {
  private activeProcesses = new Map<string, ManagedProcessGroup>();

  public register(sessionId: string, proc: ManagedProcessGroup): void {
    // If an existing process is running for this session, terminate it first
    const existing = this.activeProcesses.get(sessionId);
    if (existing && existing.isAlive) {
      existing.terminate().catch(() => {});
    }

    this.activeProcesses.set(sessionId, proc);

    proc.exitPromise.finally(() => {
      if (this.activeProcesses.get(sessionId) === proc) {
        this.activeProcesses.delete(sessionId);
      }
    });
  }

  public get(sessionId: string): ManagedProcessGroup | undefined {
    const proc = this.activeProcesses.get(sessionId);
    if (proc && proc.isAlive) {
      return proc;
    }
    return undefined;
  }

  public async cancel(sessionId: string): Promise<boolean> {
    const proc = this.activeProcesses.get(sessionId);
    if (proc && proc.isAlive) {
      await proc.terminate();
      this.activeProcesses.delete(sessionId);
      return true;
    }
    return false;
  }

  public count(): number {
    let count = 0;
    for (const proc of this.activeProcesses.values()) {
      if (proc.isAlive) count++;
    }
    return count;
  }
}

export const processRegistry = new ProcessRegistry();
