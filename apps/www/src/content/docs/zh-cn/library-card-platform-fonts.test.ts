// @vitest-environment node
import type { Page } from 'playwright-core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readLibraryPlatformFonts } from './library-card-platform-fonts';
const pending = () => new Promise<never>(() => {});
const pageFor = (newCDPSession: () => Promise<unknown>) =>
  ({ context: () => ({ newCDPSession }) }) as unknown as Page;
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('reads actual protocol font records for all three targets without writing page state', async () => {
  const send = vi.fn(async (method: string) => {
    if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
    if (method === 'DOM.querySelector') return { nodeId: 2 };
    if (method === 'CSS.getPlatformFontsForNode')
      return { fonts: [{ familyName: 'Controlled face', glyphCount: 4, isCustomFont: true }] };
    return {};
  });
  const detach = vi.fn(async () => {});
  const result = await readLibraryPlatformFonts(pageFor(async () => ({ send, detach })));
  expect(result.nodes.map((node) => node.name)).toEqual(['caption', 'title', 'action']);
  expect(result.nodes.every((node) => Array.isArray(node.fonts))).toBe(true);
  expect(result.error).toBeUndefined();
  expect(result.cleanup).toEqual([]);
  expect(send.mock.calls.map(([method]) => method)).toEqual([
    'DOM.enable',
    'CSS.enable',
    'DOM.getDocument',
    'DOM.querySelector',
    'CSS.getPlatformFontsForNode',
    'DOM.querySelector',
    'CSS.getPlatformFontsForNode',
    'DOM.querySelector',
    'CSS.getPlatformFontsForNode',
  ]);
  expect(detach).toHaveBeenCalledOnce();
});

it('bounds acquisition and detaches a late session without sending', async () => {
  let resolve!: (value: unknown) => void;
  const acquisition = new Promise((yes) => {
    resolve = yes;
  });
  const resultPromise = readLibraryPlatformFonts(pageFor(() => acquisition));
  await vi.advanceTimersByTimeAsync(3000);
  const result = await resultPromise;
  expect(result.error).toContain('exceeded 3s');
  const send = vi.fn();
  const detach = vi.fn(async () => {});
  resolve({ send, detach });
  await vi.advanceTimersByTimeAsync(0);
  expect(send).not.toHaveBeenCalled();
  expect(detach).toHaveBeenCalledOnce();
  expect(result.nodes).toEqual([]);
});

it('bounds a hanging send and hanging cleanup independently', async () => {
  const result = readLibraryPlatformFonts(
    pageFor(async () => ({ send: pending, detach: pending }))
  );
  await vi.advanceTimersByTimeAsync(4000);
  expect(await result).toEqual({
    nodes: [],
    error: 'Error: font diagnostic exceeded 3s',
    cleanup: ['Error: font diagnostic detach exceeded 1s'],
  });
});

it('retains a protocol error separately from rejected cleanup', async () => {
  const result = await readLibraryPlatformFonts(
    pageFor(async () => ({
      send: async () => {
        throw new Error('primary protocol failure');
      },
      detach: async () => {
        throw new Error('secondary cleanup failure');
      },
    }))
  );
  expect(result.error).toBe('Error: primary protocol failure');
  expect(result.cleanup).toEqual(['Error: secondary cleanup failure']);
});

it('never continues a late protocol response or publishes late records', async () => {
  let resolve!: (value: unknown) => void;
  const late = new Promise((yes) => {
    resolve = yes;
  });
  const send = vi.fn(() => late);
  const resultPromise = readLibraryPlatformFonts(
    pageFor(async () => ({ send, detach: async () => {} }))
  );
  await vi.advanceTimersByTimeAsync(3000);
  const result = await resultPromise;
  resolve({});
  await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledOnce();
  expect(result.nodes).toEqual([]);
  expect(result.error).toContain('exceeded 3s');
});

it('keeps the default targets and permits the explicit Liquid family diagnostic', async () => {
  for (const family of ['brutalist', 'liquid-glass'] as const) {
    const selectors: string[] = [];
    const send = vi.fn(async (method: string, params?: { selector?: string }) => {
      if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
      if (method === 'DOM.querySelector') {
        selectors.push(params!.selector!);
        return { nodeId: 2 };
      }
      if (method === 'CSS.getPlatformFontsForNode') return { fonts: [] };
      return {};
    });
    const page = pageFor(async () => ({ send, detach: async () => {} }));
    await (family === 'brutalist'
      ? readLibraryPlatformFonts(page)
      : readLibraryPlatformFonts(page, family));
    expect(selectors).toHaveLength(3);
    expect(selectors.every((selector) => selector.startsWith(`[data-library="${family}"] `))).toBe(
      true
    );
  }
});
