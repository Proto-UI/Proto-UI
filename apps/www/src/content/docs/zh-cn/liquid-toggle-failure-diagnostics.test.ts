// @vitest-environment node
// Modeled protocol only: no browser, server, native input or acceptance run.
import { EventEmitter } from 'node:events';
import type { CDPSession, Locator, Page } from 'playwright-core';
import { afterEach, expect, it, vi } from 'vitest';
import { INPUT_PREFIX } from '../../../../scripts/diagnose-select-click';
import {
  attachLiquidToggleFailureDiagnostics,
  readLiquidToggleTriggerFacts,
} from '../../../../test/helpers/liquid-toggle-failure-diagnostics';

afterEach(() => vi.useRealTimers());
const never = () => new Promise<never>(() => {});
it('bounds the whole optional trigger read even when renderer evaluate never settles', async () => {
  vi.useFakeTimers();
  const trigger = { evaluate: vi.fn(never) } as unknown as Pick<Locator, 'evaluate'>;
  const reading = readLiquidToggleTriggerFacts(trigger);
  const rejected = expect(reading).rejects.toThrow('Diagnostic deadline: pre-click-trigger-facts');
  await vi.advanceTimersByTimeAsync(1000);
  await rejected;
  expect(trigger.evaluate).toHaveBeenCalledWith(expect.any(Function), undefined, { timeout: 1000 });
  expect(vi.getTimerCount()).toBe(0);
});
function fixture(stall?: string) {
  const page = new EventEmitter() as EventEmitter & { evaluate: ReturnType<typeof vi.fn> };
  page.evaluate = vi.fn(async () => (stall === 'evaluate' ? never() : undefined));
  const cdp = new EventEmitter() as EventEmitter & { send: ReturnType<typeof vi.fn> };
  cdp.send = vi.fn(async (method: string) => {
    if (stall === method || stall === 'all') return never();
    if (method === 'Debugger.pause' && stall !== 'pause-event') {
      cdp.emit('Debugger.paused', {
        callFrames: [
          {
            functionName: 'syncCurrentViewSideEffects',
            url: '',
            location: { scriptId: '17', lineNumber: 456, columnNumber: 9 },
            scopeChain: [{ private: 'must not be captured' }],
            this: { secret: 'excluded' },
          },
        ],
      });
    }
    return {};
  });
  const helper = attachLiquidToggleFailureDiagnostics(
    page as unknown as Page,
    cdp as unknown as CDPSession,
    { locale: 'en', stage: 'navigation' },
    { timeoutMs: 20 }
  );
  return { page, cdp, helper };
}
function input(page: EventEmitter, sequence = 1, extra = {}) {
  page.emit('console', {
    text: () =>
      INPUT_PREFIX +
      JSON.stringify({
        sequence,
        type: 'pointerdown',
        trusted: true,
        wallTime: 123,
        performanceTime: 12,
        phase: 1,
        tag: 'wc-shadcn-select-trigger',
        role: 'combobox',
        expanded: 'false',
        ...extra,
      }),
  });
}

it('imports without launching and enables instrumentation once before the probe', async () => {
  const { helper, page, cdp } = fixture();
  expect(cdp.send).not.toHaveBeenCalled();
  await Promise.all([helper.init(), helper.init()]);
  expect(cdp.send.mock.calls.map(([method]) => method)).toEqual(['Debugger.enable']);
  expect(page.evaluate).toHaveBeenCalledOnce();
  expect(page.evaluate.mock.calls[0][0]).toContain('capture: true, passive: true');
  expect(helper.receipt()).toMatchObject({ acceptance: false, failure: null });
  await helper.dispose();
  expect(cdp.send.mock.calls.map(([method]) => method)).toEqual([
    'Debugger.enable',
    'Debugger.disable',
  ]);
  expect(page.eventNames()).toEqual([]);
  expect(cdp.eventNames()).toEqual([]);
});

it('retains node-side stages, bounds observations, and whitelists primitive input facts', async () => {
  const { helper, page } = fixture();
  helper.stage({ runtime: 'wc', stage: 'choose-runtime' });
  for (let n = 0; n < 70; n++) input(page, n, { object: { secret: 'excluded' } });
  for (let n = 0; n < 30; n++) page.emit('pageerror', new Error('owned page error'));
  const receipt = helper.receipt();
  expect(receipt.inputEvents).toHaveLength(60);
  expect(receipt.pageErrors).toHaveLength(20);
  expect(receipt.inputEvents[0]).toMatchObject({
    locale: 'en',
    runtime: 'wc',
    stage: 'choose-runtime',
  });
  expect(receipt.inputEvents[0].input).not.toHaveProperty('object');
  receipt.stages[0].locale = 'mutated copy';
  expect(helper.receipt().stages[0].locale).toBe('en');
  await helper.dispose();
});

it('ignores malformed or oversized probe messages', async () => {
  const { helper, page } = fixture();
  page.emit('console', { text: () => INPUT_PREFIX + '{bad json' });
  input(page, 1, { trusted: 'true' });
  input(page, 2, { type: 'synthetic-unknown' });
  input(page, 3, { tag: 'x'.repeat(3000) });
  expect(helper.receipt().inputEvents).toEqual([]);
  await helper.dispose();
});

it('preserves original failure and captures only bounded stack source coordinates, then resumes', async () => {
  const { helper, cdp } = fixture();
  await helper.init();
  helper.stage({ locale: 'zh-cn', runtime: 'wc', stage: 'choose-runtime' });
  cdp.emit('Debugger.scriptParsed', { scriptId: '17', url: 'http://127.0.0.1/overlay.ts' });
  const original = new Error('locator.click: Timeout 15000ms exceeded.');
  const receipt = await helper.collectFailure(original);
  expect(receipt.failure).toMatchObject({
    locale: 'zh-cn',
    runtime: 'wc',
    stage: 'choose-runtime',
    error: String(original),
  });
  expect(receipt.pausedStack).toEqual([
    {
      functionName: 'syncCurrentViewSideEffects',
      url: 'http://127.0.0.1/overlay.ts',
      lineNumber: 456,
    },
  ]);
  expect(JSON.stringify(receipt)).not.toMatch(/scopeChain|secret|columnNumber/);
  expect(cdp.send.mock.calls.map(([method]) => method)).toEqual([
    'Debugger.enable',
    'Debugger.pause',
    'Debugger.resume',
  ]);
  await helper.collectFailure(new Error('secondary error'));
  expect(helper.receipt().failure?.error).toBe(String(original));
  await Promise.all([helper.dispose(), helper.dispose()]);
  expect(cdp.send.mock.calls.map(([method]) => method)).toEqual([
    'Debugger.enable',
    'Debugger.pause',
    'Debugger.resume',
    'Debugger.resume',
    'Debugger.disable',
  ]);
});

it.each(['Debugger.pause', 'pause-event', 'Debugger.resume'])(
  'bounds %s and still attempts resume and cleanup',
  async (stall) => {
    vi.useFakeTimers();
    const { helper, cdp } = fixture(stall);
    await helper.init();
    const pending = helper.collectFailure(new Error('original functional failure'));
    await vi.runAllTimersAsync();
    const receipt = await pending;
    expect(receipt.failure?.error).toBe('Error: original functional failure');
    expect(receipt.operations.some((entry) => entry.outcome === 'failed')).toBe(true);
    expect(cdp.send.mock.calls.map(([method]) => method)).toContain('Debugger.resume');
    const disposed = helper.dispose();
    await vi.runAllTimersAsync();
    await disposed;
    expect(cdp.send.mock.calls.map(([method]) => method)).toContain('Debugger.disable');
    expect(vi.getTimerCount()).toBe(0);
  }
);

it('bounds unavailable initialization without masking the eventual test error', async () => {
  vi.useFakeTimers();
  const { helper } = fixture('all');
  const initialized = helper.init();
  await vi.runAllTimersAsync();
  await initialized;
  const failed = helper.collectFailure(new Error('original test error'));
  await vi.runAllTimersAsync();
  expect((await failed).failure?.error).toBe('Error: original test error');
  const disposed = helper.dispose();
  await vi.runAllTimersAsync();
  await disposed;
  expect(helper.receipt().disposed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('handles a late pause after a timed-out acknowledgement with another bounded resume', async () => {
  vi.useFakeTimers();
  const { helper, cdp } = fixture('Debugger.pause');
  await helper.init();
  const failed = helper.collectFailure(new Error('original'));
  await vi.runAllTimersAsync();
  await failed;
  cdp.emit('Debugger.paused', { callFrames: [] });
  await vi.runAllTimersAsync();
  expect(helper.receipt().operations).toContainEqual(
    expect.objectContaining({ operation: 'late-pause-resume', outcome: 'completed' })
  );
  await helper.dispose();
});

it.each([0, -1, Infinity, NaN, 3001])('rejects unbounded or invalid timeout %s', (timeoutMs) => {
  expect(() =>
    attachLiquidToggleFailureDiagnostics(
      {} as Page,
      {} as CDPSession,
      { locale: 'en', stage: 'test' },
      { timeoutMs }
    )
  ).toThrow(RangeError);
});
