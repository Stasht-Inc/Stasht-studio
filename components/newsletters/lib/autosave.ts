// Debounced saving with at most one save in flight. A change made during a save causes exactly one more save.

export interface Autosaver {
  /** Something changed: save after `delayMs` of quiet. */
  schedule(): void;
  /** Save now if anything is pending, and wait for every running save to finish. */
  flush(): Promise<void>;
  /** Forget a pending save (a running one still finishes). */
  cancel(): void;
  readonly pending: boolean;
}

export interface AutosaverOptions {
  delayMs: number;
  /** Saves the latest state. Report failures yourself; a throw is swallowed so later saves still run. */
  run: () => Promise<void>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createAutosaver(opts: AutosaverOptions): Autosaver {
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let dirty = false;
  let running: Promise<void> | null = null;

  const drain = async (): Promise<void> => {
    while (dirty) {
      dirty = false;
      try {
        await opts.run();
      } catch {
        // run() reports its own errors; keep going so the next change still saves.
      }
    }
  };
  const start = (): Promise<void> => {
    if (!running) running = drain().finally(() => { running = null; });
    return running;
  };
  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  return {
    schedule() {
      dirty = true;
      stopTimer();
      timer = setTimer(() => { timer = null; void start(); }, opts.delayMs);
    },
    async flush() {
      stopTimer();
      if (running) await running;
      if (dirty) await start();
    },
    cancel() {
      stopTimer();
      dirty = false;
    },
    get pending() {
      return dirty || running !== null;
    },
  };
}
