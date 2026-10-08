// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import type { Page } from 'playwright-core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  applyDoubleRootTextScale,
  captureCurrentViewport,
  closeEvidenceContext,
  writeFailureRecord,
  type CleanupIssue,
} from './library-card-capture';
vi.mock('node:fs/promises', () => ({ writeFile: vi.fn(async () => {}) }));
vi.mock('node:fs', () => ({ writeFileSync: vi.fn(() => {}) }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});
const pending = () => new Promise<never>(() => {});
const pageFor = (session: unknown) =>
  ({ context: () => ({ newCDPSession: async () => session }) }) as unknown as Page;

it('returns the primary send deadline even if detach never settles', async () => {
  const issues: CleanupIssue[] = [];
  const result = captureCurrentViewport(
    pageFor({ send: pending, detach: pending }),
    '/tmp/probe.png',
    undefined,
    (x) => issues.push(x)
  ).catch((error) => error);
  await vi.advanceTimersByTimeAsync(16_000);
  expect((await result).message).toBe('Current-frame screenshot exceeded 15s');
  expect(issues).toEqual([
    { operation: 'session.detach', error: 'Error: CDP detach exceeded 1000ms' },
  ]);
  expect(writeFileSync).not.toHaveBeenCalled();
});

it('preserves the original capture rejection and reports a separate detach rejection', async () => {
  const primary = new Error('original capture error');
  const issues: CleanupIssue[] = [];
  const error = await captureCurrentViewport(
    pageFor({
      send: async () => {
        throw primary;
      },
      detach: async () => {
        throw new Error('detach error');
      },
    }),
    '/tmp/probe.png',
    undefined,
    (x) => issues.push(x)
  ).catch((error) => error);
  expect(error).toBe(primary);
  expect(issues).toEqual([{ operation: 'session.detach', error: 'Error: detach error' }]);
});

it('bounds session acquisition and detaches a late session without capturing or writing', async () => {
  let deliver!: (session: unknown) => void;
  const session = { send: vi.fn(), detach: vi.fn(pending) };
  const issues: CleanupIssue[] = [];
  const page = {
    context: () => ({
      newCDPSession: () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    }),
  } as unknown as Page;
  const result = captureCurrentViewport(page, '/tmp/probe.png', undefined, (x) =>
    issues.push(x)
  ).catch((error) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect((await result).message).toBe('Current-frame screenshot exceeded 15s');
  deliver(session);
  await vi.advanceTimersByTimeAsync(1000);
  expect(session.send).not.toHaveBeenCalled();
  expect(session.detach).toHaveBeenCalledOnce();
  expect(writeFileSync).not.toHaveBeenCalled();
  expect(issues[0]?.operation).toBe('late-session.detach');
});

it('does not write an image that arrives after a send deadline', async () => {
  let deliver!: (image: { data: string }) => void;
  const session = {
    send: () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
    detach: async () => {},
  };
  const result = captureCurrentViewport(pageFor(session), '/tmp/probe.png').catch((error) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect((await result).message).toBe('Current-frame screenshot exceeded 15s');
  deliver({ data: Buffer.from('synthetic control bytes, not an image').toString('base64') });
  await vi.advanceTimersByTimeAsync(1);
  expect(writeFileSync).not.toHaveBeenCalled();
});

it('retains actual returned bytes and clip while independently reporting cleanup trouble', async () => {
  const send = vi.fn(async () => ({
    data: Buffer.from('synthetic control bytes, not an image').toString('base64'),
  }));
  const issues: CleanupIssue[] = [];
  const clip = { x: 0, y: 0, width: 320, height: 2400, scale: 1 };
  const result = captureCurrentViewport(
    pageFor({ send, detach: pending }),
    '/tmp/probe.png',
    clip,
    (x) => issues.push(x)
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect((await result).file).toBe('probe.png');
  expect(send).toHaveBeenCalledWith(
    'Page.captureScreenshot',
    expect.objectContaining({ clip, captureBeyondViewport: true })
  );
  expect(writeFileSync).toHaveBeenCalledOnce();
  expect(issues[0]?.operation).toBe('session.detach');
});

it.each(['hang', 'reject'])(
  'preserves the original test failure during context cleanup: %s',
  async (kind) => {
    const primary = new Error('original assertion error');
    const issues: CleanupIssue[] = [];
    const result = (async () => {
      try {
        throw primary;
      } finally {
        await closeEvidenceContext(
          {
            close:
              kind === 'hang'
                ? pending
                : async () => {
                    throw new Error('close error');
                  },
          },
          true,
          (x) => issues.push(x)
        );
      }
    })().catch((error) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe(primary);
    expect(issues[0]?.operation).toBe('context.close');
  }
);

it('does not turn a standalone context cleanup failure into a successful journey', async () => {
  const closeError = new Error('close error');
  const issues: CleanupIssue[] = [];
  const error = await closeEvidenceContext(
    {
      close: async () => {
        throw closeError;
      },
    },
    false,
    (x) => issues.push(x)
  ).catch((error) => error);
  expect(error).toBe(closeError);
  expect(issues[0]?.operation).toBe('context.close');
});

it('preserves an acquisition rejection without inventing a session cleanup', async () => {
  const primary = new Error('session acquisition failed');
  const issues: CleanupIssue[] = [];
  const page = {
    context: () => ({
      newCDPSession: async () => {
        throw primary;
      },
    }),
  } as unknown as Page;
  const error = await captureCurrentViewport(page, '/tmp/probe.png', undefined, (x) =>
    issues.push(x)
  ).catch((error) => error);
  expect(error).toBe(primary);
  expect(issues).toEqual([]);
  expect(writeFileSync).not.toHaveBeenCalled();
});

it('completes target publication before resolving, with no pending destination write', async () => {
  const events: string[] = [];
  vi.mocked(writeFileSync).mockImplementationOnce(() => {
    events.push('target-written');
  });
  const result = await captureCurrentViewport(
    pageFor({
      send: async () => ({
        data: Buffer.from('synthetic control bytes, not an image').toString('base64'),
      }),
      detach: async () => {},
    }),
    '/tmp/probe.png'
  );
  events.push('capture-returned');
  expect(result.file).toBe('probe.png');
  expect(events).toEqual(['target-written', 'capture-returned']);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(writeFileSync).toHaveBeenCalledOnce();
});

it('preserves a final publication error after separately logged cleanup failure', async () => {
  const primary = new Error('target write failed');
  const issues: CleanupIssue[] = [];
  vi.mocked(writeFileSync).mockImplementationOnce(() => {
    throw primary;
  });
  const error = await captureCurrentViewport(
    pageFor({
      send: async () => ({
        data: Buffer.from('synthetic control bytes, not an image').toString('base64'),
      }),
      detach: async () => {
        throw new Error('detach failed');
      },
    }),
    '/tmp/probe.png',
    undefined,
    (x) => issues.push(x)
  ).catch((error) => error);
  expect(error).toBe(primary);
  expect(issues).toEqual([{ operation: 'session.detach', error: 'Error: detach failed' }]);
});

it('applies and verifies 200% text synchronously without a load-event dependency', () => {
  const properties = new Map([['color', 'red']]);
  const priorities = new Map<string, string>();
  const root = {
    style: {
      setProperty(name: string, value: string, priority: string) {
        properties.set(name, value);
        priorities.set(name, priority);
      },
      getPropertyValue(name: string) {
        return properties.get(name) ?? '';
      },
      getPropertyPriority(name: string) {
        return priorities.get(name) ?? '';
      },
    },
  };
  const createElement = vi.fn(() => {
    throw new Error('No style element or load callback permitted');
  });
  vi.stubGlobal('document', { documentElement: root, createElement });
  // Controlled CSSOM values; actual browser scaling remains an official CI assertion.
  vi.stubGlobal('getComputedStyle', () => ({
    fontSize: properties.get('font-size') === '200%' ? '32px' : '16px',
  }));
  try {
    expect(applyDoubleRootTextScale()).toEqual({
      before: 16,
      after: 32,
      value: '200%',
      priority: 'important',
    });
    expect(createElement).not.toHaveBeenCalled();
    expect(properties.get('color')).toBe('red');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('rejects unapplied text scaling rather than silently using 100% text', () => {
  const root = {
    style: {
      setProperty: vi.fn(),
      getPropertyValue: () => '200%',
      getPropertyPriority: () => 'important',
    },
  };
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('getComputedStyle', () => ({ fontSize: '16px' }));
  try {
    expect(() => applyDoubleRootTextScale()).toThrow(
      'Required 200% root text scale was not applied'
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

it('retains the old injector pending when its style load callback is absent', async () => {
  const { readFileSync } = await vi.importActual<typeof import('node:fs')>('node:fs');
  const { createRequire } = await import('node:module');
  const { dirname, join } = await import('node:path');
  const require = createRequire(import.meta.url);
  const frames = readFileSync(
    join(dirname(require.resolve('playwright-core/package.json')), 'lib/server/frames.js'),
    'utf8'
  );
  // Execute the installed, lockfile-pinned injector body in a controlled DOM.
  // This models a withheld load event; it is not a claim to run Chromium here.
  const match = frames.match(/async function addStyleContent\(content2\) \{([\s\S]*?)\n    \}/);
  expect(match).not.toBeNull();
  const style: { onload?: () => void; appendChild: ReturnType<typeof vi.fn> } = {
    appendChild: vi.fn(),
  };
  const document = {
    createElement: vi.fn(() => style),
    createTextNode: vi.fn((value: string) => value),
    head: { appendChild: vi.fn() },
  };
  const inject = new Function('document', `return async function(content2) {${match![1]}}`)(
    document
  ) as (content: string) => Promise<unknown>;
  let settled = false;
  const pending = inject(':root { font-size: 200% !important; }').then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(90_000);
  expect(document.head.appendChild).toHaveBeenCalledWith(style);
  expect(settled).toBe(false);
  style.onload!();
  await pending;
  expect(settled).toBe(true);
});

for (const reporterRejects of [false, true])
  it(`retains the original no-script error when the failure record rejects (reporter throws=${reporterRejects})`, async () => {
    const primary = new Error('original scale failure');
    const secondary = new Error('failure JSON write failed');
    const issues: CleanupIssue[] = [];
    vi.mocked(writeFile).mockRejectedValueOnce(secondary);
    const run = async () => {
      try {
        throw primary;
      } catch (error) {
        await writeFailureRecord('/tmp/control-failure.json', { error: String(error) }, (issue) => {
          issues.push(issue);
          if (reporterRejects) throw new Error('reporter failed');
        });
        throw error;
      }
    };
    expect(await run().catch((error) => error)).toBe(primary);
    expect(issues).toEqual([{ operation: 'failure-record.write', error: String(secondary) }]);
  });

it('writes the original failure record unchanged when local I/O succeeds', async () => {
  const record = { phase: '200-percent-text', error: 'original scale failure' };
  await writeFailureRecord('/tmp/control-failure.json', record);
  expect(writeFile).toHaveBeenCalledWith(
    '/tmp/control-failure.json',
    JSON.stringify(record, null, 2)
  );
});
