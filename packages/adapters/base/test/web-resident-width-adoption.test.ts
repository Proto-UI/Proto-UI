// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import type { StyleHandle } from '@proto.ui/core';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const off of cleanups.splice(0).reverse()) off();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture() {
  const parent = document.createElement('div');
  parent.style.display = 'block';
  parent.style.width = '400px';
  const el = document.createElement('div');
  el.id = 'resident-width-adoption-probe';
  el.style.display = 'block';
  el.style.cssFloat = 'left';
  parent.append(el);
  document.body.append(parent);
  const stylesheet = document.createElement('style');
  // Happy DOM lacks cascade layers and misparses brackets inside quoted token
  // selectors. Keep the generated declarations and use equivalent string escapes.
  stylesheet.textContent = renderProtoStyleTokenCss(['w-[100px]', 'w-[300px]'])
    .replace('@layer proto-ui {', '')
    .replace(/\n}\s*$/, '')
    .replace(
      /\[data-pui-style~="([^"]+)"\]/g,
      (_match, token: string) =>
        '[data-pui-style~="' + token.replace(/\[/g, '\\[').replace(/\]/g, '\\]') + '"]'
    );
  document.head.append(stylesheet);
  cleanups.push(() => stylesheet.remove());
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation(((query: string) => ({
    get matches() {
      return query.includes('prefers-reduced-motion: no-preference');
    },
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as any);
  let now = 0,
    revision = 0,
    next = 0;
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  let resize = (() => {}) as ResizeObserverCallback;
  const oldResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
  cleanups.push(() => {
    window.ResizeObserver = oldResizeObserver;
  });
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  let pending: StyleHandle | undefined;
  const sink = createWebResidentMotionSink(el, {
    queueStyle(style) {
      pending = style;
    },
    requestFlush() {
      if (pending) el.setAttribute('data-pui-style', pending.tokens.join(' '));
    },
  });
  let cleanupView = 1;
  cleanups.push(() => sink.release(cleanupView));
  const commit = (width: 100 | 300, view = 1) => {
    cleanupView = Math.max(cleanupView, view);
    sink.commit({
      view,
      revision: ++revision,
      style: createRootStyleEffect([resolveRootStyleEntry(`w-[${width}px]`, 'rule')]),
      declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
    });
  };
  const frame = (time: number) => {
    now = time;
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(time);
    }
  };
  const start = () => {
    commit(100);
    resize(
      [
        {
          target: parent,
          contentBoxSize: [{ inlineSize: 400, blockSize: 20 }],
          borderBoxSize: [{ inlineSize: 400, blockSize: 20 }],
          contentRect: { width: 400, height: 20 },
        },
      ] as any,
      {} as any
    );
    frame(0);
  };
  const importantWidth = () => {
    const override = document.createElement('style');
    override.textContent = '#resident-width-adoption-probe { width: 0px !important; }';
    document.head.append(override);
    cleanups.push(() => override.remove());
    return override;
  };
  return { el, sink, frames, commit, frame, start, importantWidth };
}
describe('Web width CSS adoption (finite CSSOM harness, not browser layout)', () => {
  it('rejects an important cascade over an active width and retires its reversal anchor', () => {
    const h = fixture();
    h.start();
    expect(getComputedStyle(h.el).width).toBe('100px');
    h.commit(300);
    h.frame(25);
    expect(Number.parseFloat(h.el.style.width)).toBeCloseTo(150);
    expect(getComputedStyle(h.el).width).toBe(h.el.style.width);
    const override = h.importantWidth();
    h.frame(50);
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('0px');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.frames.size).toBe(0);
    override.remove();
    h.commit(100);
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('100px');
    expect(h.frames.size).toBe(0);
  });

  it('does not accept an important-blocked initial semantic target as an anchor', () => {
    const h = fixture();
    const override = h.importantWidth();
    h.start();
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('0px');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.frames.size).toBe(0);
    override.remove();
    h.commit(300);
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('300px');
    expect(h.frames.size).toBe(0);
  });

  it('releases the earlier lease when a host silently ignores the next width write', () => {
    const h = fixture();
    h.start();
    h.commit(300);
    h.frame(25);
    expect(Number.parseFloat(h.el.style.width)).toBeCloseTo(150);
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      if (name !== 'width') setProperty(name, value, priority);
    });
    h.frame(50);
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('300px');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.frames.size).toBe(0);
    h.commit(100);
    expect(h.el.style.width).toBe('');
    expect(getComputedStyle(h.el).width).toBe('100px');
  });

  it('preserves a synchronous foreign replacement and its priority when projection fails', () => {
    const h = fixture();
    h.start();
    h.commit(300);
    h.frame(25);
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      if (name === 'width') setProperty('width', '77px', 'important');
      else setProperty(name, value, priority);
    });
    h.frame(50);
    expect(h.el.style.width).toBe('77px');
    expect(h.el.style.getPropertyPriority('width')).toBe('important');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.frames.size).toBe(0);
    h.commit(100);
    expect(h.sink.diagnostics?.()).toContain('width:external-inline-owner');
    h.sink.release(1);
    expect(h.el.style.width).toBe('77px');
    expect(h.el.style.getPropertyPriority('width')).toBe('important');
  });

  it('accepts ordinary CSSOM subpixel serialization without treating it as a foreign owner', () => {
    const h = fixture();
    h.start();
    h.commit(300);
    const stylePrototype = Object.getPrototypeOf(h.el.style) as CSSStyleDeclaration;
    const setProperty = stylePrototype.setProperty;
    // A browser serializes the target and the detached canonicalizer alike.
    // Changing only the target would instead simulate a second writer.
    vi.spyOn(stylePrototype, 'setProperty').mockImplementation(function (
      this: CSSStyleDeclaration,
      name,
      value,
      priority
    ) {
      setProperty.call(
        this,
        name,
        name === 'width' ? Number.parseFloat(value ?? '').toFixed(3) + 'px' : value,
        priority
      );
    });
    h.frame(33.333333);
    expect(Number.parseFloat(h.el.style.width)).toBeCloseTo(166.667, 3);
    expect(h.sink.diagnostics?.()).not.toContain('width:projection-rejected');
    expect(h.frames.size).toBe(1);
  });

  it('rejects a nearby foreign width after its setter returns without claiming the declaration', () => {
    const h = fixture();
    h.start();
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      setProperty(name, value, priority);
      if (name === 'width') setProperty(name, '100.001px');
    });
    h.commit(300);
    expect(h.el.style.width).toBe('100.001px');
    expect(h.el.style.getPropertyPriority('width')).toBe('');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.frames.size).toBe(0);
    h.commit(100);
    expect(h.sink.diagnostics?.()).toContain('width:external-inline-owner');
    h.sink.release(1);
    expect(h.el.style.width).toBe('100.001px');
  });

  it('releases a first active declaration when its actual setter synchronously disposes the view', () => {
    const h = fixture();
    h.start();
    expect(getComputedStyle(h.el).width).toBe('100px');
    expect(h.el.style.width).toBe('');
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    let released = false;
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      setProperty(name, value, priority);
      if (name === 'width' && !released) {
        released = true;
        expect(h.el.style.width).toBe('100px');
        h.sink.release(1);
      }
    });
    h.commit(300);
    expect(released).toBe(true);
    expect(h.el.style.width).toBe('');
    expect(h.el.style.getPropertyPriority('width')).toBe('');
    expect(getComputedStyle(h.el).width).toBe('300px');
    expect(h.frames.size).toBe(0);
    h.commit(100);
    h.frame(100);
    expect(h.el.style.width).toBe('');
    expect(h.frames.size).toBe(0);
  });

  it('releases an updated active declaration when its actual setter disposes the view', () => {
    const h = fixture();
    h.start();
    h.commit(300);
    h.frame(25);
    expect(h.el.style.width).toBe('150px');
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      setProperty(name, value, priority);
      if (name === 'width') h.sink.release(1);
    });
    h.frame(50);
    expect(h.el.style.width).toBe('');
    expect(h.el.style.getPropertyPriority('width')).toBe('');
    expect(getComputedStyle(h.el).width).toBe('300px');
    expect(h.frames.size).toBe(0);
  });

  it.each([
    ['100.001px', ''],
    ['100px', 'important'],
  ])('preserves a synchronous foreign %s %s declaration during release', (foreign, priority) => {
    const h = fixture();
    h.start();
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    let released = false;
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, requestedPriority) => {
      setProperty(name, value, requestedPriority);
      if (name === 'width' && !released) {
        released = true;
        setProperty(name, foreign, priority);
        h.sink.release(1);
      }
    });
    h.commit(300);
    expect(h.el.style.width).toBe(foreign);
    expect(h.el.style.getPropertyPriority('width')).toBe(priority);
    expect(h.frames.size).toBe(0);
    h.frame(100);
    expect(h.el.style.width).toBe(foreign);
  });

  it('does not remove a same-value foreign owner installed after synchronous release', () => {
    const h = fixture();
    h.start();
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    let released = false;
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      setProperty(name, value, priority);
      if (name === 'width' && !released) {
        released = true;
        h.sink.release(1);
        expect(h.el.style.width).toBe('');
        // The new owner deliberately has exactly the old value and priority.
        setProperty(name, value, priority);
      }
    });
    h.commit(300);
    expect(h.el.style.width).toBe('100px');
    expect(h.el.style.getPropertyPriority('width')).toBe('');
    expect(h.frames.size).toBe(0);
    h.sink.release(1);
    expect(h.el.style.width).toBe('100px');
  });

  it('keeps a new view lease with the same value when an older setter returns', () => {
    const h = fixture();
    h.start();
    const setProperty = h.el.style.setProperty.bind(h.el.style);
    let replaced = false;
    vi.spyOn(h.el.style, 'setProperty').mockImplementation((name, value, priority) => {
      setProperty(name, value, priority);
      if (name === 'width' && !replaced) {
        replaced = true;
        h.commit(100, 2);
        h.frame(0);
        h.commit(300, 2);
      }
    });
    h.commit(300);
    expect(replaced).toBe(true);
    expect(h.el.style.width).toBe('100px');
    expect(h.frames.size).toBe(1);
    expect(h.sink.diagnostics?.()).not.toContain('width:external-inline-owner');
    h.frame(50);
    expect(h.el.style.width).toBe('200px');
    h.sink.release(1);
    expect(h.el.style.width).toBe('200px');
    expect(h.frames.size).toBe(1);
    h.sink.release(2);
    expect(h.el.style.width).toBe('');
    expect(h.frames.size).toBe(0);
  });

  it('keeps a reentrant new view lease established while an old lease is restored', () => {
    const h = fixture();
    h.start();
    h.commit(300);
    h.frame(25);
    expect(h.el.style.width).toBe('150px');
    const removeProperty = h.el.style.removeProperty.bind(h.el.style);
    let replaced = false;
    vi.spyOn(h.el.style, 'removeProperty').mockImplementation((name) => {
      const removed = removeProperty(name);
      if (name === 'width' && !replaced) {
        replaced = true;
        h.commit(100, 2);
        h.frame(100);
        h.commit(300, 2);
      }
      return removed;
    });
    h.frame(100);
    expect(replaced).toBe(true);
    expect(h.el.style.width).toBe('100px');
    expect(h.frames.size).toBe(1);
    h.frame(150);
    expect(h.el.style.width).toBe('200px');
    expect(h.sink.diagnostics?.()).not.toContain('width:external-inline-owner');
    h.sink.release(2);
    expect(h.el.style.width).toBe('');
    expect(h.frames.size).toBe(0);
  });
});
