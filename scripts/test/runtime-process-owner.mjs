import { spawn as spawnChild } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { liveOwned, observeChildren } from './linux-process-ownership.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const OWNER_ENV = 'PROTO_UI_RUNTIME_PROCESS_OWNER';

// The wrapper owns every command it launches, including Vitest and preparation.
// Linux also follows detached descendants (for example Chromium) using the
// existing Sprint 1 PID/start-time and inherited-marker ownership checks.
export function createRuntimeProcessOwner({
  platform = process.platform,
  spawn = spawnChild,
  kill = (pid, signal) => process.kill(pid, signal),
  graceMs = 5_000,
  killMs = 1_000,
} = {}) {
  const children = new Map();
  const failures = [];
  let stopping = false;
  let stopped;

  const groupSignal = (entry, signal) => {
    if (!entry.child.pid) return false;
    try {
      kill(-entry.child.pid, signal);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
  };
  const observe = (entry) => {
    if (entry.child.pid) observeChildren(entry.child.pid, entry.owned, entry.ownership);
    return liveOwned(entry.owned);
  };
  const signalLinux = (entry, signal) => {
    const errors = [];
    for (const fact of observe(entry).reverse()) {
      try {
        kill(fact.pid, signal);
      } catch (error) {
        // One inaccessible process must not prevent attempts on the remaining
        // confirmed descendants or their parent.
        if (error.code !== 'ESRCH') errors.push(error);
      }
    }
    return errors;
  };
  async function waitUntilGone(alive, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (alive()) {
      if (Date.now() >= deadline) return false;
      await delay(Math.min(25, Math.max(1, deadline - Date.now())));
    }
    return true;
  }

  function stop(entry) {
    if (entry.stopped) return entry.stopped;
    clearInterval(entry.observer);
    entry.stopped = Promise.resolve().then(async () => {
      if (!entry.child.pid) return;
      if (platform === 'win32') {
        // Windows does not provide POSIX process groups. Keep taskkill scoped
        // to this owned PID; never kill by executable name.
        if (entry.child.exitCode !== null || entry.child.signalCode !== null) return;
        await new Promise((resolve, reject) => {
          const killer = spawn('taskkill', ['/PID', String(entry.child.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
            shell: false,
          });
          const timer = setTimeout(() => {
            killer.kill();
            reject(new Error(`taskkill timed out for owned PID ${entry.child.pid}`));
          }, graceMs + killMs);
          const finish = (error) => {
            clearTimeout(timer);
            if (error) reject(error);
            else resolve();
          };
          killer.once('error', finish);
          killer.once('exit', (code) => {
            const exited = entry.child.exitCode !== null || entry.child.signalCode !== null;
            finish(code === 0 || exited ? null : new Error(`taskkill exited with code ${code}`));
          });
        });
      } else if (platform === 'linux') {
        const errors = signalLinux(entry, 'SIGTERM');
        const alive = () => observe(entry).length > 0;
        if (!(await waitUntilGone(alive, graceMs))) {
          errors.push(...signalLinux(entry, 'SIGKILL'));
          if (!(await waitUntilGone(alive, killMs)))
            errors.push(
              new Error(`Owned runtime descendants remain after SIGKILL: ${entry.child.pid}`)
            );
        }
        if (errors.length)
          throw new AggregateError(
            errors,
            `Owned runtime process cleanup failed: ${entry.child.pid}`
          );
      } else {
        if (!groupSignal(entry, 'SIGTERM')) return;
        const alive = () => groupSignal(entry, 0);
        if (!(await waitUntilGone(alive, graceMs))) {
          groupSignal(entry, 'SIGKILL');
          if (!(await waitUntilGone(alive, killMs)))
            throw new Error(
              `Owned runtime process group remains after SIGKILL: ${entry.child.pid}`
            );
        }
      }
    });
    // Wake the individual command even when surviving descendants keep its
    // pipes open. The wrapper must not wait for EOF before learning of failure.
    entry.stopped.then(entry.resolveCompleted, (error) => {
      failures.push(error);
      entry.rejectCompleted(error);
    });
    return entry.stopped;
  }

  return {
    spawn(command, args, options = {}) {
      if (stopping) throw new Error('Runtime process owner is shutting down');
      const marker = randomUUID();
      const child = spawn(command, args, {
        ...options,
        env: { ...(options.env ?? process.env), [OWNER_ENV]: marker },
        detached: platform !== 'win32',
        windowsHide: true,
      });
      let resolveCompleted, rejectCompleted;
      const completed = new Promise((resolve, reject) => {
        resolveCompleted = resolve;
        rejectCompleted = reject;
      });
      // Long-lived server owners may observe failures only at stopAll().
      completed.catch(() => {});
      const entry = {
        child,
        completed,
        resolveCompleted,
        rejectCompleted,
        owned: new Map(),
        ownership: {
          uid: process.geteuid?.(),
          started: null,
          unmarked: new Set(),
          match: Buffer.from(`\0${OWNER_ENV}=${marker}\0`),
        },
        observer: null,
        stopped: null,
      };
      children.set(child, entry);
      if (platform === 'linux') {
        child.once('spawn', () => observe(entry));
        entry.observer = setInterval(() => observe(entry), 500);
        entry.observer.unref();
      }
      // An exited parent can leave descendants alive, even holding its pipes
      // open. Start cleanup on exit, not only after the later close event.
      child.once('exit', () => void stop(entry));
      child.once('error', () => void stop(entry));
      return child;
    },
    completed(child) {
      const entry = children.get(child);
      if (!entry) throw new Error('Command does not belong to this runtime process owner');
      return entry.completed;
    },
    stopAll() {
      if (stopped) return stopped;
      stopping = true;
      stopped = Promise.resolve().then(async () => {
        await Promise.allSettled([...children.values()].map(stop));
        if (failures.length) throw new AggregateError(failures, 'Runtime process cleanup failed');
      });
      return stopped;
    },
  };
}
