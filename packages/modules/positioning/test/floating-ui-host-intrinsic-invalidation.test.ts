import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredPositionConfig } from '@proto.ui/core';
import { createFloatingUiAnchoredPositionHost } from '../src';

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect;

const config: AnchoredPositionConfig = {
  side: 'bottom',
  align: 'start',
  sideOffset: 4,
  alignOffset: 0,
  strategy: 'fixed',
  avoidCollisions: true,
  collisionBoundary: 'viewport',
  collisionPadding: 4,
};

async function observerTurn() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

/**
 * Real Happy DOM elements, styles and MutationObserver delivery; explicit box
 * and scroll-range model, not native CSS layout, font loading or wheel input.
 * Each character contributes one font-size-high row. The used height follows
 * the host's available-height projection, so measuring without that cap can
 * clamp the modeled scroll offset. Floating UI itself is not mocked.
 */
function fixture(characters: number) {
  const restores: (() => void)[] = [];
  const replace = (target: object, name: string, value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, value });
    restores.push(() => {
      if (original) Object.defineProperty(target, name, original);
      else Reflect.deleteProperty(target, name);
    });
  };
  replace(window, 'visualViewport', undefined);
  replace(window, 'innerWidth', 1024);
  replace(window, 'innerHeight', 768);
  replace(document.documentElement, 'clientWidth', 1024);
  replace(document.documentElement, 'clientHeight', 768);

  const observers = new Set<ControlledResizeObserver>();
  class ControlledResizeObserver {
    readonly targets = new Set<Element>();
    constructor(readonly callback: ResizeObserverCallback) {
      observers.add(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }
  }
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
  replace(window, 'ResizeObserver', ControlledResizeObserver);

  const stylesheet = document.createElement('style');
  stylesheet.textContent = `
    .intrinsic-invalidation-panel { font-size: 20px; width: 100px; overflow: auto; }
    .intrinsic-invalidation-panel.large-type { font-size: 240px; }
  `;
  document.head.append(stylesheet);
  const anchor = document.createElement('button');
  const floating = document.createElement('div');
  floating.className = 'intrinsic-invalidation-panel';
  const text = document.createTextNode('x'.repeat(characters));
  floating.append(text);
  document.body.append(anchor, floating);
  anchor.getBoundingClientRect = () => rect(100, 600, 100, 40);
  Object.defineProperties(anchor, {
    offsetWidth: { configurable: true, value: 100 },
    offsetHeight: { configurable: true, value: 40 },
  });

  let fontMetric = 1;
  let scroll = 0;
  const naturalHeight = () =>
    text.data.length * Number.parseFloat(getComputedStyle(floating).fontSize) * fontMetric;
  const usedHeight = () => {
    const natural = naturalHeight();
    const cap = Number.parseFloat(floating.style.getPropertyValue('--proto-ui-available-height'));
    const height = Number.isFinite(cap) ? Math.min(natural, Math.max(0, cap)) : natural;
    scroll = Math.max(0, Math.min(scroll, natural - height));
    return height;
  };
  floating.getBoundingClientRect = () =>
    rect(
      Number.parseFloat(floating.style.left) || 0,
      Number.parseFloat(floating.style.top) || 0,
      100,
      usedHeight()
    );
  Object.defineProperties(floating, {
    offsetWidth: { configurable: true, value: 100 },
    clientWidth: { configurable: true, value: 100 },
    offsetHeight: { configurable: true, get: usedHeight },
    clientHeight: { configurable: true, get: usedHeight },
    scrollHeight: { configurable: true, get: naturalHeight },
    scrollTop: {
      configurable: true,
      get: () => {
        usedHeight();
        return scroll;
      },
      set: (value: number) => {
        scroll = Math.max(0, Math.min(value, naturalHeight() - usedHeight()));
      },
    },
  });
  const mutations: MutationRecord[] = [];
  const mutation = new MutationObserver((records) => mutations.push(...records));
  mutation.observe(floating, {
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    subtree: true,
  });
  const lease = createFloatingUiAnchoredPositionHost().attach({ anchor, floating, config });
  return {
    anchor,
    floating,
    text,
    lease,
    mutations,
    setFontMetric(value: number) {
      fontMetric = value;
    },
    resizeFloating() {
      const contentRect = floating.getBoundingClientRect();
      const box = { inlineSize: contentRect.width, blockSize: contentRect.height };
      const receivers = [...observers].filter((observer) => observer.targets.has(floating));
      if (!receivers.length) throw new Error('No active resize observer watches the floating box');
      for (const observer of receivers) {
        observer.callback(
          [
            {
              target: floating,
              contentRect,
              borderBoxSize: [box],
              contentBoxSize: [box],
              devicePixelContentBoxSize: [box],
            },
          ],
          observer as unknown as ResizeObserver
        );
      }
    },
    dispose() {
      lease.dispose();
      mutation.disconnect();
      stylesheet.remove();
      anchor.remove();
      floating.remove();
      for (const restore of restores.reverse()) restore();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('anchored positioning: intrinsic invalidation through the public lease', () => {
  it('preserves scrollable extent through owned mutation delivery followed by a resize echo', async () => {
    const f = fixture(50);
    try {
      await vi.waitFor(() => expect(f.floating.dataset.side).toBe('top'));
      await observerTurn();
      expect(
        f.mutations.some(
          (record) => record.target === f.floating && record.attributeName === 'style'
        )
      ).toBe(true);
      expect(f.floating.scrollHeight).toBe(1000);
      expect(f.floating.clientHeight).toBe(592);
      f.floating.scrollTop = 80;
      expect(f.floating.scrollTop).toBe(80);
      const cap = f.floating.style.getPropertyValue('--proto-ui-available-height');

      // The real style MutationObserver turn has already completed. A later
      // ResizeObserver delivery for the published used box is not fresh input.
      f.resizeFloating();
      await observerTurn();
      expect(f.floating.dataset.side).toBe('top');
      expect(f.floating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
      expect(f.floating.scrollHeight - f.floating.clientHeight).toBe(408);
      expect(f.floating.scrollTop).toBe(80);
    } finally {
      f.dispose();
    }
  });

  it('preserves scroll through equivalent connection updates while still refreshing anchor geometry', async () => {
    const f = fixture(50);
    try {
      await vi.waitFor(() => expect(f.floating.dataset.side).toBe('top'));
      await observerTurn();
      expect(f.floating.scrollHeight - f.floating.clientHeight).toBe(408);
      f.floating.scrollTop = 80;
      const cap = f.floating.style.getPropertyValue('--proto-ui-available-height');

      for (const left of [100, 140]) {
        f.anchor.getBoundingClientRect = () => rect(left, 600, 100, 40);
        // Fresh connection/config objects model ordinary reconciliation. The
        // second update must move the panel, so ignoring all equal-config
        // updates cannot satisfy this continuity control.
        f.lease.update({ anchor: f.anchor, floating: f.floating, config: { ...config } });
        await observerTurn();
        expect(f.floating.style.left).toBe(`${left}px`);
        expect(f.floating.dataset.side).toBe('top');
        expect(f.floating.style.getPropertyValue('--proto-ui-available-height')).toBe(cap);
        expect(f.floating.scrollHeight - f.floating.clientHeight).toBe(408);
        expect(f.floating.scrollTop).toBe(80);
      }
    } finally {
      f.dispose();
    }
  });

  it('reconsiders root class, authored style and text changes before the next reference refresh', async () => {
    const f = fixture(1);
    const refresh = async () => {
      // Let real mutation delivery precede a public geometry notification;
      // this test does not require every mutation to solve immediately.
      await observerTurn();
      window.dispatchEvent(new Event('scroll'));
      await observerTurn();
    };
    try {
      await vi.waitFor(() => expect(f.floating.dataset.side).toBe('bottom'));
      expect(f.floating.clientHeight).toBe(20);

      f.floating.classList.add('large-type');
      expect(f.floating.scrollHeight).toBe(240);
      expect(f.floating.clientHeight).toBe(120);
      await refresh();
      expect(f.floating.dataset.side).toBe('top');
      expect(f.floating.clientHeight).toBe(240);

      f.floating.style.fontSize = '20px';
      await refresh();
      expect(f.floating.dataset.side).toBe('bottom');
      expect(f.floating.clientHeight).toBe(20);

      f.text.data = 'x'.repeat(50);
      expect(f.floating.scrollHeight).toBe(1000);
      expect(f.floating.clientHeight).toBe(120);
      await refresh();
      expect(f.floating.dataset.side).toBe('top');
      expect(f.floating.clientHeight).toBe(592);
      expect(f.floating.scrollHeight - f.floating.clientHeight).toBe(408);

      f.text.data = 'x';
      await refresh();
      expect(f.floating.dataset.side).toBe('bottom');
      expect(f.floating.clientHeight).toBe(20);
      expect(f.mutations.some((record) => record.attributeName === 'class')).toBe(true);
      expect(f.mutations.some((record) => record.attributeName === 'style')).toBe(true);
      expect(f.mutations.some((record) => record.type === 'characterData')).toBe(true);
    } finally {
      f.dispose();
    }
  });

  it('remeasures for requestUpdate when intrinsic input changes without a DOM mutation', async () => {
    const f = fixture(50);
    try {
      await vi.waitFor(() => expect(f.floating.dataset.side).toBe('top'));
      await observerTurn();
      expect(f.floating.clientHeight).toBe(592);
      expect(f.floating.scrollHeight).toBe(1000);
      const authoredText = f.text.data;
      const authoredClass = f.floating.className;
      // An explicit injected metric change models an input without a DOM
      // mutation. It does not claim to simulate native font loading.
      f.setFontMetric(0.02);
      f.lease.requestUpdate();
      await vi.waitFor(() => expect(f.floating.dataset.side).toBe('bottom'));
      expect(f.floating.clientHeight).toBe(20);
      expect(f.floating.scrollHeight).toBe(20);
      expect(f.text.data).toBe(authoredText);
      expect(f.floating.className).toBe(authoredClass);
    } finally {
      f.dispose();
    }
  });
});
