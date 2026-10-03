// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync(
  new URL('./brutalist-spinner.capture.browser.test.ts', import.meta.url),
  'utf8'
);
const parsed = ts.createSourceFile('browser.test.ts', source, ts.ScriptTarget.Latest, true);
// Execute the real suite's declarations and hooks, without importing/registering
// its browser tests or substituting a second implementation of the lifecycle.
const lifecycle = parsed.statements
  .filter(
    (node) =>
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some((item) =>
          ['browser', 'browserLaunch'].includes(item.name.getText(parsed))
        )) ||
      (ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        ['beforeAll', 'afterAll'].includes(node.expression.expression.getText(parsed)))
  )
  .map((node) => node.getText(parsed))
  .join('\n');

function hooks(launchBrowser: () => Promise<{ close(): Promise<void> }>) {
  let start!: () => Promise<void>;
  let stop!: () => Promise<void>;
  let cleanupTimeout = 10_000;
  vm.runInNewContext(transformSync(lifecycle, { loader: 'ts', target: 'es2022' }).code, {
    launchBrowser,
    beforeAll(callback: typeof start) {
      start = callback;
    },
    afterAll(callback: typeof stop, timeout = 10_000) {
      stop = callback;
      cleanupTimeout = timeout;
    },
  });
  return { start, stop, cleanupTimeout };
}

afterEach(() => vi.useRealTimers());

describe('Spinner capture browser resource lifecycle', () => {
  it('closes a successfully acquired browser exactly once', async () => {
    const close = vi.fn(async () => {});
    const { start, stop } = hooks(async () => ({ close }));
    await start();
    await stop();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('preserves the startup failure without adding an undefined-browser teardown failure', async () => {
    const failure = new Error('controlled launch failure');
    const { start, stop } = hooks(async () => {
      throw failure;
    });
    await expect(start()).rejects.toBe(failure);
    await expect(stop()).resolves.toBeUndefined();
  });

  it('closes an acquisition that settles after both setup and cleanup watchdogs', async () => {
    vi.useFakeTimers();
    let resolveLaunch!: (browser: { close(): Promise<void> }) => void;
    const close = vi.fn(async () => {});
    const { start, stop, cleanupTimeout } = hooks(
      () => new Promise((resolve) => (resolveLaunch = resolve))
    );
    const starting = start();
    // Model the runner timing out beforeAll; timing out a hook does not cancel
    // the in-flight launch. No Chromium process or timing claim is simulated.
    await vi.advanceTimersByTimeAsync(10_001);
    const stopping = stop();
    const watchdogFailure = new Error('controlled cleanup watchdog');
    const runnerResult = Promise.race([
      stopping,
      new Promise<void>((_, reject) => setTimeout(() => reject(watchdogFailure), cleanupTimeout)),
    ]);
    const observedTimeout = runnerResult.then(
      () => undefined,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(cleanupTimeout + 1);
    expect(close).not.toHaveBeenCalled();
    resolveLaunch({ close });
    await starting;
    await stopping.catch(() => {});
    expect(await observedTimeout).toBe(watchdogFailure);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports a browser close failure rather than swallowing it', async () => {
    const failure = new Error('controlled close failure');
    const { start, stop } = hooks(async () => ({
      close: async () => {
        throw failure;
      },
    }));
    await start();
    await expect(stop()).rejects.toBe(failure);
  });
});
