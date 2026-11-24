import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConfig } from '@proto.ui/core';
import { createFloatingUiAnchoredPositionHost } from '../src';

// Hold the public geometry provider boundary. The host and its style/owner
// leases run unchanged; these cases certify ownership, not native geometry.
const pending = vi.hoisted(() => [] as Array<{ applySize(): void; finish(x: number): void }>);
const cleanup = vi.hoisted(() => vi.fn());
vi.mock('@floating-ui/dom', () => ({
  platform: {},
  autoUpdate: vi.fn((_anchor, _floating, update) => {
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
          applySize: () =>
            options.middleware.at(-1).apply({
              availableWidth: 123,
              availableHeight: 234,
              rects: { reference: { width: 50, height: 20 } },
              elements: { floating },
            }),
          finish: (x) =>
            resolve({ x, y: x, strategy: options.strategy, placement: options.placement }),
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
  document.body.replaceChildren();
});

describe('available-space projection ownership', () => {
  it('restores author values and priorities before the next intrinsic measurement and at retirement', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.style.setProperty('--proto-ui-available-height', '77px', 'important');
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    pending[0].applySize();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    lease.requestUpdate();
    // The provider is now suspended before the second size publication.
    expect(pending).toHaveLength(2);
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('77px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
    pending[1].applySize();
    lease.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('77px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
  });

  it('preserves a newer authored override through disposal and late middleware delivery', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const resolved = vi.fn();
    const lease = createFloatingUiAnchoredPositionHost().attach({
      anchor,
      floating,
      config,
      onResolved: resolved,
    });
    pending[0].applySize();
    floating.style.setProperty('--proto-ui-available-height', '91px', 'important');
    lease.dispose();
    pending[0].applySize();
    pending[0].finish(20);
    await Promise.resolve();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('91px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
    expect(floating.style.left).toBe('');
    expect(resolved).not.toHaveBeenCalled();
  });

  it('an equal successor projection survives retirement of the previous owner', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.style.setProperty('--proto-ui-available-height', '77px', 'important');
    const host = createFloatingUiAnchoredPositionHost();
    const first = host.attach({ anchor, floating, config });
    pending[0].applySize();
    const second = host.attach({ anchor, floating, config });
    pending[1].applySize();
    first.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('50px');
    second.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('77px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
  });

  it('a previously solved owner cannot publish a pending result after a successor owns the size projection', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    const host = createFloatingUiAnchoredPositionHost();
    const resolved = vi.fn();
    const first = host.attach({ anchor, floating, config, onResolved: resolved });
    pending[0].applySize();
    pending[0].finish(10);
    await Promise.resolve();
    expect(floating.style.left).toBe('10px');
    expect(resolved).toHaveBeenCalledOnce();

    // Completed coordinates have no temporary pin claim. On this next solve,
    // only the available-size projection can witness a successor's ownership.
    first.requestUpdate();
    pending[1].applySize();
    const second = host.attach({ anchor, floating, config });
    pending[2].applySize();
    pending[2].finish(20);
    await Promise.resolve();
    expect(floating.style.left).toBe('20px');
    pending[1].finish(99);
    await Promise.resolve();
    expect(floating.style.left).toBe('20px');
    expect(resolved).toHaveBeenCalledOnce();
    first.dispose();
    second.dispose();
  });

  it('does not reacquire preparation when restoring a custom element style disposes the lease', () => {
    class ReentrantFloating extends HTMLElement {
      static observedAttributes = ['style'];
      changed?: () => void;
      attributeChangedCallback() {
        this.changed?.();
      }
    }
    const tag = 'positioning-available-style-retirement';
    if (!customElements.get(tag)) customElements.define(tag, ReentrantFloating);
    const anchor = document.createElement('button');
    const floating = document.createElement(tag) as ReentrantFloating;
    document.body.append(anchor, floating);
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    pending[0].applySize();
    let retired = false;
    floating.changed = () => {
      if (retired || floating.style.getPropertyValue('--proto-ui-anchor-width') !== '') return;
      retired = true;
      lease.dispose();
    };
    lease.requestUpdate();
    expect(retired).toBe(true);
    expect(pending).toHaveLength(1);
    expect(floating.style.cssText).toBe('');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('retires a size publication when its own custom-element style callback disposes the lease', () => {
    class ReentrantFloating extends HTMLElement {
      static observedAttributes = ['style'];
      changed?: () => void;
      attributeChangedCallback() {
        this.changed?.();
      }
    }
    const tag = 'positioning-available-style-publication';
    if (!customElements.get(tag)) customElements.define(tag, ReentrantFloating);
    const anchor = document.createElement('button');
    const floating = document.createElement(tag) as ReentrantFloating;
    document.body.append(anchor, floating);
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    let retired = false;
    floating.changed = () => {
      if (retired || floating.style.getPropertyValue('--proto-ui-anchor-width') !== '50px') return;
      retired = true;
      lease.dispose();
    };
    pending[0].applySize();
    expect(retired).toBe(true);
    expect(floating.style.cssText).toBe('');
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
