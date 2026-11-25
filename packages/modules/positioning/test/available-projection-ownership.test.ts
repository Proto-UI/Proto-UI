import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConfig } from '@proto.ui/core';
import { createFloatingUiAnchoredPositionHost } from '../src';

// Hold the public geometry provider boundary. The host and its style/owner
// leases run unchanged; these cases certify ownership, not native geometry.
const pending = vi.hoisted(() => [] as Array<{ applySize(): void; finish(x: number): void }>);
const measurements = vi.hoisted(() => [] as Array<{ value: string; priority: string }>);
const measuring = vi.hoisted(() => ({
  current: undefined as ((element: HTMLElement) => void) | undefined,
}));
const cleanup = vi.hoisted(() => vi.fn());
vi.mock('@floating-ui/dom', () => ({
  platform: {
    getDimensions: (floating: HTMLElement) => {
      measurements.push({
        value: floating.style.getPropertyValue('--proto-ui-available-height'),
        priority: floating.style.getPropertyPriority('--proto-ui-available-height'),
      });
      measuring.current?.(floating);
      return { width: 100, height: 1000 };
    },
  },
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
  measurements.length = 0;
  measuring.current = undefined;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe('available-space projection ownership', () => {
  it('does not restore a read-side scroll change when it had no owned cap to suspend', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.scrollTop = 80;
    measuring.current = () => {
      floating.scrollTop = 12;
    };
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    expect(floating.scrollTop).toBe(12);
    lease.dispose();
  });

  it('does not restore a prior offset after a successor acquires the measured projection', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    const host = createFloatingUiAnchoredPositionHost();
    const first = host.attach({ anchor, floating, config });
    pending[0].applySize();
    floating.scrollTop = 80.5;
    let successor: ReturnType<typeof host.attach> | undefined;
    measuring.current = () => {
      measuring.current = undefined;
      successor = host.attach({ anchor, floating, config });
      pending[1].applySize();
      floating.scrollTop = 12.25;
    };
    first.requestUpdate();
    expect(successor).toBeDefined();
    expect(pending).toHaveLength(2);
    expect(floating.scrollTop).toBe(12.25);
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    first.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    successor!.dispose();
  });

  it('returns from a fresh measurement with the prior viewport and native offsets before yielding', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(anchor, floating);
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    pending[0].applySize();
    pending[0].finish(10);
    await Promise.resolve();
    floating.scrollTop = 80.5;
    floating.scrollLeft = -3.25;
    // Model the UA's clamp when the owned max-height disappears. This is a
    // synchronous host-boundary control, not evidence of a native wheel.
    const remove = floating.style.removeProperty.bind(floating.style);
    vi.spyOn(floating.style, 'removeProperty').mockImplementation((name) => {
      const result = remove(name);
      if (name === '--proto-ui-available-height') {
        floating.scrollTop = 0;
        floating.scrollLeft = 0;
      }
      return result;
    });
    try {
      lease.requestUpdate();
      expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
      expect(floating.scrollTop).toBe(80.5);
      expect(floating.scrollLeft).toBe(-3.25);
      // Later user input belongs to the user, not to the suspended solve.
      floating.scrollTop = 120.25;
      pending[1].applySize();
      pending[1].finish(20);
      await Promise.resolve();
      expect(floating.scrollTop).toBe(120.25);
    } finally {
      lease.dispose();
    }
  });

  it('restores author values and priorities before the next intrinsic measurement and at retirement', () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.style.setProperty('--proto-ui-available-height', '77px', 'important');
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    pending[0].applySize();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    lease.requestUpdate();
    // Natural measurement sees authored styles, but the live viewport is
    // restored before the provider's first asynchronous boundary.
    expect(pending).toHaveLength(2);
    expect(measurements.at(-1)).toEqual({ value: '77px', priority: 'important' });
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('');
    pending[1].applySize();
    lease.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('77px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
    expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
  });

  it('keeps a scrolled viewport bounded while measuring its author size', async () => {
    const anchor = document.createElement('button');
    const floating = document.createElement('div');
    floating.style.setProperty('--proto-ui-available-height', '770px', 'important');
    const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
    pending[0].applySize();
    pending[0].finish(10);
    await Promise.resolve();
    floating.scrollTop = 500;

    measuring.current = (element) => {
      if (element.style.getPropertyValue('--proto-ui-available-height') === '770px')
        element.scrollTop = 0;
    };
    lease.requestUpdate();
    expect(pending).toHaveLength(2);
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    expect(measurements.at(-1)).toEqual({ value: '770px', priority: 'important' });
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('234px');
    expect(floating.scrollTop).toBe(500);

    pending[1].applySize();
    pending[1].finish(20);
    await Promise.resolve();
    expect(floating.style.left).toBe('20px');
    expect(floating.scrollTop).toBe(500);
    lease.dispose();
    expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe('770px');
    expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
  });

  it.each(['dispose', 'author write'])(
    'leaves a scrolled projection retired after a synchronous %s during measurement',
    async (action) => {
      class ReentrantViewport extends HTMLElement {
        static observedAttributes = ['style'];
        changed?: () => void;
        attributeChangedCallback() {
          this.changed?.();
        }
      }
      const tag = 'positioning-scrolled-measurement';
      if (!customElements.get(tag)) customElements.define(tag, ReentrantViewport);
      const anchor = document.createElement('button');
      const floating = document.createElement(tag) as ReentrantViewport;
      floating.style.setProperty('--proto-ui-available-height', '770px', 'important');
      document.body.append(anchor, floating);
      const resolved = vi.fn();
      const lease = createFloatingUiAnchoredPositionHost().attach({
        anchor,
        floating,
        config,
        onResolved: resolved,
      });
      pending[0].applySize();
      pending[0].finish(10);
      await Promise.resolve();
      floating.scrollTop = 500;

      let changed = false;
      floating.changed = () => {
        if (changed || floating.style.getPropertyValue('--proto-ui-available-height') !== '770px')
          return;
        changed = true;
        if (action === 'dispose') lease.dispose();
        else floating.style.setProperty('--proto-ui-available-height', '900px', 'important');
      };
      lease.requestUpdate();
      expect(pending).toHaveLength(1);
      await Promise.resolve();
      expect(changed).toBe(true);
      expect(floating.style.left).toBe('10px');
      expect(floating.style.getPropertyValue('--proto-ui-available-height')).toBe(
        action === 'dispose' ? '770px' : '900px'
      );
      expect(floating.style.getPropertyPriority('--proto-ui-available-height')).toBe('important');
      expect(floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
      expect(resolved).toHaveBeenCalledOnce();
      lease.dispose();
    }
  );

  it.each(['left', 'side'] as const)(
    'unsized placement stops publishing after disposal from %s',
    async (field) => {
      class RetiringFloat extends HTMLElement {
        static observedAttributes = ['style', 'data-side'];
        changed?: () => void;
        attributeChangedCallback() {
          this.changed?.();
        }
      }
      const tag = 'positioning-retire-in-placement';
      if (!customElements.get(tag)) customElements.define(tag, RetiringFloat);
      const anchor = document.createElement('button');
      const floating = document.createElement(tag) as RetiringFloat;
      floating.style.top = '7px';
      floating.dataset.align = 'authored';
      document.body.append(anchor, floating);
      const resolved = vi.fn();
      const lease = createFloatingUiAnchoredPositionHost().attach({
        anchor,
        floating,
        config,
        onResolved: resolved,
      });
      let retired = false;
      floating.changed = () => {
        const reached =
          field === 'left' ? floating.style.left === '20px' : floating.dataset.side === 'bottom';
        if (retired || !reached) return;
        retired = true;
        lease.dispose();
      };

      pending[0].applySize();
      pending[0].finish(20);
      await Promise.resolve();

      expect(retired).toBe(true);
      expect(floating.style.top).toBe(field === 'left' ? '7px' : '20px');
      expect(floating.dataset.align).toBe('authored');
      expect(resolved).not.toHaveBeenCalled();
      expect(cleanup).toHaveBeenCalledOnce();
    }
  );

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
