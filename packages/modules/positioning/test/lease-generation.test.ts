import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConfig } from '@proto.ui/core';
import { createFloatingUiAnchoredPositionHost } from '../src';

const pending = vi.hoisted(
  () =>
    [] as Array<{
      finish(x: number): void;
      applySize(): void;
    }>
);
const cleanup = vi.hoisted(() => vi.fn());
vi.mock('@floating-ui/dom', () => ({
  autoUpdate: vi.fn((_a, _f, update) => {
    void update();
    return cleanup;
  }),
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
  size: (options: unknown) => options,
  computePosition: vi.fn(
    (_anchor, floating, options) =>
      new Promise((resolve) => {
        pending.push({
          finish: (x) =>
            resolve({ x, y: x, strategy: options.strategy, placement: options.placement }),
          applySize: () =>
            options.middleware.at(-1).apply({
              availableWidth: 123,
              availableHeight: 234,
              rects: { reference: { width: 50, height: 20 } },
              elements: { floating },
            }),
        });
      })
  ),
}));
const config: AnchoredPositionConfig = {
  side: 'bottom',
  align: 'start',
  sideOffset: 4,
  alignOffset: 0,
  strategy: 'fixed',
  avoidCollisions: true,
  collisionBoundary: 'clippingAncestors',
  collisionPadding: 0,
};
afterEach(() => {
  pending.length = 0;
  vi.clearAllMocks();
});

describe('Positioning lease generation', () => {
  it('T-ANCHORED-POSITIONING-0001-CASE-GENERATION: late computations cannot overwrite newer placement or size', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const oldResolved = vi.fn(),
      resolved = vi.fn();
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config,
      onResolved: oldResolved,
    });
    lease.update({ anchor, floating, config: { ...config, side: 'top' }, onResolved: resolved });
    pending[1].applySize();
    pending[1].finish(20);
    await Promise.resolve();
    floating.style.setProperty('--proto-ui-anchor-width', '70px');
    pending[0].applySize();
    pending[0].finish(10);
    await Promise.resolve();
    expect(floating.style.left).toBe('20px');
    expect(floating.dataset.side).toBe('top');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('70px');
    expect(oldResolved).not.toHaveBeenCalled();
    expect(resolved).toHaveBeenCalledTimes(1);
    lease.dispose();
  });
  it.each(['dispose', 'replace', 'invalid-target'] as const)(
    'revokes pending writes after %s',
    async (action) => {
      const anchor = document.createElement('button');
      const floating = document.createElement('div');
      const resolved = vi.fn();
      const lease = createFloatingUiAnchoredPositionHost().attach({
        anchor,
        floating,
        config,
        onResolved: resolved,
      });
      if (action === 'dispose') lease.dispose();
      else
        lease.update({
          anchor,
          floating: action === 'replace' ? document.createElement('div') : null,
          config,
        });
      pending[0].applySize();
      pending[0].finish(10);
      await Promise.resolve();
      expect(floating.style.cssText).toBe('');
      expect(floating.dataset.side).toBeUndefined();
      expect(resolved).not.toHaveBeenCalled();
      expect(cleanup).toHaveBeenCalledTimes(1);
      lease.dispose();
    }
  );
  it('a disposed lease cannot reinstall observation', () => {
    const anchor = document.createElement('button'),
      floating = document.createElement('div');
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    lease.dispose();
    lease.update({ anchor, floating: document.createElement('div'), config });
    lease.requestUpdate();
    expect(pending).toHaveLength(1);
    // Reinstalled observation would produce a second cleanup.
    lease.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
