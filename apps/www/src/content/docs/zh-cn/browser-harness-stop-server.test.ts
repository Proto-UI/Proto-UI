// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mode = 'graceful' | 'ignore-term' | 'already-exited';
type OwnedChild = {
  child: ChildProcess;
  ready: Promise<void>;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  finished: boolean;
};
const state = vi.hoisted(() => ({
  mode: 'graceful' as Mode,
  owned: [] as OwnedChild[],
  generationOwned: [] as OwnedChild[],
}));
const nativeKill = process.kill.bind(process);

// The real harness still owns startServer/stopServer. Only its port/readiness
// and generation/app launch boundaries are replaced: no port, HTTP, app or browser starts.
// The generation substitute only emits the fixed successful IPC lifecycle; the
// upstream startup suite separately covers the actual supervisor implementation.
vi.mock('node:net', () => ({
  createServer: () => ({
    unref() {},
    on() {},
    listen(_port: number, _host: string, ready: () => void) {
      ready();
    },
    address: () => ({ port: 1 }),
    close(done?: (error?: Error) => void) {
      done?.();
    },
  }),
}));
vi.mock('../../../../../../scripts/test/server-readiness.mjs', () => ({
  waitForServerReadiness: async () => {
    const owned = state.owned.at(-1);
    if (!owned) throw new Error('No owned process was started.');
    await owned.ready;
  },
}));
vi.mock('playwright-core', () => ({
  chromium: {
    launch: () => {
      throw new Error('Browser launch is outside this test.');
    },
  },
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: (command: string, args: string[]) => {
      if (args.includes('--style-generation-supervisor')) {
        expect(command).toBe(process.execPath);
        expect(args).toEqual([
          '--eval',
          expect.any(String),
          '--',
          '--style-generation-supervisor',
          'corepack',
        ]);
        expect(state.generationOwned).toHaveLength(0);
        // Owned literal IPC substitute only: do not evaluate the received
        // supervisor source or invoke Corepack/the application.
        const child = actual.spawn(
          process.execPath,
          [
            '-e',
            [
              "process.on('message', (message) => {",
              "  if (message?.kind === 'release') process.disconnect();",
              '});',
              "process.send({ kind: 'spawn', pid: process.pid });",
              "process.send({ kind: 'exit', code: 0, signal: null });",
              "process.send({ kind: 'closed' });",
            ].join('\n'),
          ],
          {
            detached: true,
            env: {},
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          }
        );
        let finish!: (value: { code: number | null; signal: NodeJS.Signals | null }) => void;
        const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (resolve) => {
            finish = resolve;
          }
        );
        const owned: OwnedChild = { child, ready: Promise.resolve(), closed, finished: false };
        child.once('close', (code, signal) => {
          owned.finished = true;
          finish({ code, signal });
        });
        state.generationOwned.push(owned);
        console.info(
          '[stop-server-generation-substitute]',
          JSON.stringify({ pid: child.pid ?? null })
        );
        return child;
      }
      expect(state.generationOwned).toHaveLength(1);
      expect(state.generationOwned[0]!.finished).toBe(true);
      expect(command).toBe('corepack');
      expect(args).toEqual([
        'pnpm@10.32.1',
        '--filter',
        'apps-www',
        'exec',
        'astro',
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        '1',
        '--strictPort',
      ]);
      // startServer retries readiness failures; never create a second child in one case.
      expect(state.owned).toHaveLength(0);
      const mode = state.mode;
      // Literal owned code only; never invoke corepack, a shell or repo code.
      const source = [
        mode === 'ignore-term' ? "process.on('SIGTERM', () => {});" : '',
        mode !== 'already-exited' ? 'setInterval(() => {}, 1000);' : '',
        "process.stdout.write('READY\\n', () => {",
        mode === 'already-exited' ? 'process.exit(0);' : '',
        '});',
      ].join('\n');
      const child = actual.spawn(process.execPath, ['-e', source], {
        detached: true,
        env: {},
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let finish!: (value: { code: number | null; signal: NodeJS.Signals | null }) => void;
      const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          finish = resolve;
        }
      );
      const owned: OwnedChild = { child, ready: Promise.resolve(), closed, finished: false };
      owned.ready = new Promise<void>((resolve, reject) => {
        let output = '';
        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
          if (output.includes('READY\n')) resolve();
        });
        child.once('error', (error) => {
          console.info(
            '[stop-server-owned-child-error]',
            JSON.stringify({ mode, message: error.message })
          );
          reject(error);
        });
        child.once('close', () => {
          if (!output.includes('READY\n')) reject(new Error('Owned child closed before READY.'));
        });
      });
      child.once('close', (code, signal) => {
        owned.finished = true;
        finish({ code, signal });
      });
      state.owned.push(owned);
      console.info('[stop-server-owned-child]', JSON.stringify({ mode, pid: child.pid ?? null }));
      return child;
    },
  };
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', '');
  state.mode = 'graceful';
  state.owned = [];
  state.generationOwned = [];
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  // Cleanup is confined to recorded children of this test. No broad pkill or
  // parent/sibling signal, and no timeout/budget relaxation.
  for (const owned of [...state.generationOwned, ...state.owned]) {
    const { child } = owned;
    if (!owned.finished && child.exitCode === null && child.signalCode === null && child.pid) {
      try {
        nativeKill(-child.pid, 'SIGKILL');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
    await owned.closed;
  }
});

function observeOwnedSignals(onSignal?: (signal: string | number | undefined) => void) {
  return vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    const owned = state.owned.find(({ child }) => child.pid && pid === -child.pid);
    if (!owned) throw new Error('A signal outside this test owned process group was attempted.');
    const result = nativeKill(pid, signal);
    onSignal?.(signal);
    return result;
  });
}

// Negative-PID process groups are POSIX behavior. Fixed Linux validation must
// collect all five cases without skips; Windows behavior is not claimed here.
describe.skipIf(process.platform === 'win32')('shared browser stopServer timer ownership', () => {
  it('does nothing before a child has been started', async () => {
    const { stopServer } = await import('./browser-harness');
    const signals = observeOwnedSignals();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await stopServer();
    expect(signals).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(state.owned).toHaveLength(0);
  });

  it('clears the deadline after a real child exits on SIGTERM', async () => {
    const { startServer, stopServer } = await import('./browser-harness');
    await startServer('/');
    const owned = state.owned[0]!;
    const signals = observeOwnedSignals();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await stopServer();
    expect(await owned.closed).toEqual({ code: null, signal: 'SIGTERM' });
    expect(signals.mock.calls).toEqual([[-owned.child.pid!, 'SIGTERM']]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the full 5000ms deadline before killing a child that ignores SIGTERM', async () => {
    state.mode = 'ignore-term';
    const { startServer, stopServer } = await import('./browser-harness');
    await startServer('/');
    const owned = state.owned[0]!;
    let observedTerm!: () => void;
    const term = new Promise<void>((resolve) => {
      observedTerm = resolve;
    });
    const signals = observeOwnedSignals((signal) => {
      if (signal === 'SIGTERM') observedTerm();
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const stopping = stopServer();
    // main awaits generation teardown before sending TERM. Observe that real
    // owned signal request before starting the unchanged 4999 + 1ms deadline.
    await term;
    expect(signals.mock.calls).toEqual([[-owned.child.pid!, 'SIGTERM']]);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signals.mock.calls).toEqual([[-owned.child.pid!, 'SIGTERM']]);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await stopping;
    expect(await owned.closed).toEqual({ code: null, signal: 'SIGKILL' });
    expect(signals.mock.calls).toEqual([
      [-owned.child.pid!, 'SIGTERM'],
      [-owned.child.pid!, 'SIGKILL'],
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not signal or schedule a deadline for an already-exited child', async () => {
    state.mode = 'already-exited';
    const { startServer, stopServer } = await import('./browser-harness');
    await startServer('/');
    expect(await state.owned[0]!.closed).toEqual({ code: 0, signal: null });
    const signals = observeOwnedSignals();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await stopServer();
    expect(signals).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the deadline when exit-listener registration rejects the race', async () => {
    const { startServer, stopServer } = await import('./browser-harness');
    await startServer('/');
    const owned = state.owned[0]!;
    const signals = observeOwnedSignals();
    // Fault injection is limited to the real child's next listener registration.
    // It is not a claim that native EventEmitter ordinarily throws here.
    vi.spyOn(owned.child, 'once').mockImplementationOnce(() => {
      throw new Error('controlled exit listener failure');
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await expect(stopServer()).rejects.toThrow('controlled exit listener failure');
    expect(await owned.closed).toEqual({ code: null, signal: 'SIGTERM' });
    expect(signals.mock.calls).toEqual([[-owned.child.pid!, 'SIGTERM']]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
