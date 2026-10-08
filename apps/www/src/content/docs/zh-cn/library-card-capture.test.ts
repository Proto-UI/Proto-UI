// @vitest-environment node
import { writeFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  captureCurrentViewport,
  closeEvidenceContext,
  type CleanupIssue,
} from './library-card-capture';
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
