// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Exercise the actual private stop body, not a copied implementation. These
// bounded child/timer doubles do not claim real process-group or browser QA.
const source = readFileSync('apps/www/src/content/docs/zh-cn/browser-harness.ts', 'utf8');
function stopBody(text: string) {
  const parsed = ts.createSourceFile('browser-harness.ts', text, ts.ScriptTarget.Latest, true);
  const declarations = parsed.statements.filter(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'stopDevServer'
  );
  expect(declarations).toHaveLength(1);
  return declarations[0]!.getText(parsed);
}
function fixture(text = source) {
  const listeners: Array<() => void> = [];
  const child = {
    pid: 4312,
    exitCode: null as number | null,
    signalCode: null as string | null,
    once: vi.fn((event: string, listener: () => void) => {
      expect(event).toBe('exit');
      listeners.push(listener);
    }),
  };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextTimer = 0;
  const setTimer = vi.fn((callback: () => void, delay: number) => {
    const id = ++nextTimer;
    timers.set(id, { callback, delay });
    return id;
  });
  const clearTimer = vi.fn((id: number) => timers.delete(id));
  const kill = vi.fn<(pid: number, signal: string) => void>();
  const spawn = vi.fn(() => {
    throw new Error('Unexpected real-process path');
  });
  const body = ts.transpileModule(stopBody(text), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const stop = runInNewContext(
    `${body}\nstopDevServer`,
    {
      devServer: child,
      process: { platform: 'linux', kill },
      spawn,
      setTimeout: setTimer,
      clearTimeout: clearTimer,
    },
    { timeout: 1000 }
  ) as () => Promise<void>;
  return {
    child,
    timers,
    kill,
    spawn,
    stop,
    setTimer,
    clearTimer,
    exit() {
      child.exitCode = 0;
      for (const listener of listeners.splice(0)) listener();
    },
    deadline() {
      expect(timers.size).toBe(1);
      const [id, timer] = [...timers][0]!;
      expect(timer.delay).toBe(5000);
      timers.delete(id);
      timer.callback();
    },
  };
}

describe('shared dev-server stop conflict integration, isolated body only', () => {
  it('does not signal an already exited child', async () => {
    const f = fixture();
    f.child.exitCode = 0;
    await f.stop();
    expect(f.kill).not.toHaveBeenCalled();
    expect(f.setTimer).not.toHaveBeenCalled();
  });
  it('preserves the main signalCode admission guard', async () => {
    const f = fixture();
    f.child.signalCode = 'SIGTERM';
    await f.stop();
    expect(f.kill).not.toHaveBeenCalled();
    expect(f.setTimer).not.toHaveBeenCalled();
  });
  it('keeps ESRCH terminal without creating a deadline', async () => {
    const f = fixture();
    f.kill.mockImplementation(() => {
      throw Object.assign(new Error('gone'), { code: 'ESRCH' });
    });
    await f.stop();
    expect(f.kill).toHaveBeenCalledWith(-4312, 'SIGTERM');
    expect(f.setTimer).not.toHaveBeenCalled();
  });
  it('retains a non-ESRCH termination error', async () => {
    const f = fixture();
    const error = Object.assign(new Error('denied'), { code: 'EPERM' });
    f.kill.mockImplementation(() => {
      throw error;
    });
    await expect(f.stop()).rejects.toBe(error);
    expect(f.setTimer).not.toHaveBeenCalled();
  });
  it('clears the unused 5000ms deadline on observed normal exit', async () => {
    const f = fixture();
    const pending = f.stop();
    expect(f.timers.size).toBe(1);
    f.exit();
    await pending;
    expect(f.kill.mock.calls).toEqual([[-4312, 'SIGTERM']]);
    expect(f.clearTimer).toHaveBeenCalledOnce();
    expect(f.timers.size).toBe(0);
  });
  it('retains the 5000ms SIGKILL path for a still-live child', async () => {
    const f = fixture();
    const pending = f.stop();
    f.deadline();
    await pending;
    expect(f.kill.mock.calls).toEqual([
      [-4312, 'SIGTERM'],
      [-4312, 'SIGKILL'],
    ]);
    expect(f.clearTimer).toHaveBeenCalledOnce();
    expect(f.timers.size).toBe(0);
  });
  it('does not SIGKILL a signal-exited child when the deadline wins', async () => {
    const f = fixture();
    const pending = f.stop();
    f.child.signalCode = 'SIGTERM';
    f.deadline();
    await pending;
    expect(f.kill.mock.calls).toEqual([[-4312, 'SIGTERM']]);
    expect(f.clearTimer).toHaveBeenCalledOnce();
    expect(f.timers.size).toBe(0);
  });
  it('clears the deadline while retaining a SIGKILL error', async () => {
    const f = fixture();
    const error = new Error('kill failed');
    f.kill.mockImplementation((_pid, signal) => {
      if (signal === 'SIGKILL') throw error;
    });
    const pending = f.stop();
    const rejected = expect(pending).rejects.toBe(error);
    f.deadline();
    await rejected;
    expect(f.clearTimer).toHaveBeenCalledOnce();
    expect(f.timers.size).toBe(0);
  });
});
