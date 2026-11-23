import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import type { StyleHandle } from '@proto.ui/core';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const off of cleanups.splice(0)) off();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function fixture(scope: 'document' | 'shadow' = 'document') {
  const parent = document.createElement('div');
  parent.style.display = 'block';
  const el = document.createElement('div');
  el.style.display = 'block';
  el.style.cssFloat = 'left';
  if (scope === 'shadow') {
    const bridge = document.createElement('div');
    bridge.style.display = 'contents';
    bridge.attachShadow({ mode: 'open' }).append(el);
    parent.append(bridge);
  } else parent.append(el);
  document.body.append(parent);
  const sheet = document.createElement('style');
  // Finite CSSOM host evidence. Percentage ownership is tested in the module,
  // runtime contract and real Progress browser suite, not Happy DOM layout.
  sheet.textContent = renderProtoStyleTokenCss(
    [0, 80, 100, 200, 300, 400, 600].map((value) => `w-[${value}px]`)
  )
    .replace(/@layer proto-ui \{\n([\s\S]*)\n\}\n$/, '$1')
    .replace(
      /(\[data-pui-style~=")([^"]+)("\])/g,
      (_match, prefix: string, token: string, suffix: string) =>
        prefix + token.replace(/[\[\]]/g, '\\$&') + suffix
    );
  const tree = el.getRootNode();
  (tree instanceof ShadowRoot ? tree : document.head).append(sheet);
  cleanups.push(() => sheet.remove());
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  let now = 0,
    revision = 0,
    next = 0;
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  let reduced = false;
  const preferenceListeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(((query: string) => ({
    get matches() {
      return query.includes(': reduce') ? reduced : !reduced;
    },
    media: query,
    addEventListener: (_key: string, listener: () => void) => preferenceListeners.add(listener),
    removeEventListener: (_key: string, listener: () => void) =>
      preferenceListeners.delete(listener),
  })) as any);
  let resize = (() => {}) as ResizeObserverCallback;
  const observed = new Set<Element>();
  const old = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }
    observe(target: Element) {
      observed.add(target);
    }
    unobserve(target: Element) {
      observed.delete(target);
    }
    disconnect() {
      observed.clear();
    }
  } as typeof ResizeObserver;
  cleanups.push(() => {
    window.ResizeObserver = old;
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
  const queueStyle = vi.fn((style: StyleHandle) => {
    pending = style;
  });
  const sink = createWebResidentMotionSink(el, {
    queueStyle,
    requestFlush() {
      if (pending) el.setAttribute('data-pui-style', pending.tokens.join(' '));
    },
  });
  cleanups.push(() => sink.release(1));
  const commit = (widthPx: number, tokens = [`w-[${widthPx}px]`]) => {
    sink.commit({
      view: 1,
      revision: ++revision,
      style: createRootStyleEffect(tokens.map((token) => resolveRootStyleEntry(token, 'rule'))),
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
  const measure = (target: Element, width: number) => {
    resize(
      [
        {
          target,
          contentBoxSize: [{ inlineSize: width, blockSize: 20 }],
          borderBoxSize: [{ inlineSize: width, blockSize: 20 }],
          contentRect: { width, height: 20 },
        },
      ] as any,
      {} as any
    );
  };
  return {
    el,
    parent,
    sink,
    frames,
    queueStyle,
    commit,
    frame,
    measure,
    observed,
    reduce() {
      reduced = true;
      preferenceListeners.forEach((listener) => listener());
    },
  };
}
describe('Web resident finite width lease and containing-block lifecycle (CSSOM harness)', () => {
  it.each(['document', 'shadow'] as const)(
    '%s projects only active width and releases on settlement',
    async (scope) => {
      const h = fixture(scope);
      h.commit(100);
      h.measure(h.parent, 400);
      h.measure(h.el, 17); // An unrelated own-box measurement does not change the typed px target.
      h.frame(0);
      expect(h.el.style.width).toBe('');
      h.commit(300);
      expect(h.el.style.width).toBe('100px');
      h.frame(50);
      expect(h.el.style.width).toBe('200px');
      expect(h.queueStyle.mock.calls.at(-1)![0].tokens).toEqual(['w-[300px]']);
      h.frame(100);
      expect(h.el.style.width).toBe('');
      expect(h.frames.size).toBe(0);
      h.commit(100);
      h.frame(125);
      expect(h.el.style.width).toBe('250px');
      h.reduce();
      await Promise.resolve();
      expect(h.el.style.width).toBe('');
      expect(h.frames.size).toBe(0);
    }
  );

  it('preserves an external inline owner and never reclaims its priority in the same view', () => {
    const h = fixture();
    h.commit(0);
    h.measure(h.parent, 400);
    h.frame(0);
    h.commit(400);
    h.frame(25);
    expect(h.el.style.width).toBe('100px');
    h.el.style.setProperty('width', '77px', 'important');
    h.frame(50);
    expect(h.el.style.width).toBe('77px');
    expect(h.el.style.getPropertyPriority('width')).toBe('important');
    h.commit(80);
    expect(h.el.style.width).toBe('77px');
    expect(h.sink.diagnostics?.()).toContain('width:external-inline-owner');
    h.sink.release(1);
    expect(h.el.style.width).toBe('77px');
  });

  it('rejects a pre-existing inline width, clamps and incompatible flex layout', () => {
    const h = fixture();
    h.el.style.width = '51px';
    h.commit(0);
    h.measure(h.parent, 400);
    h.frame(0);
    h.commit(400);
    expect(h.el.style.width).toBe('51px');
    expect(h.sink.diagnostics?.()).toContain('width:external-inline-owner');
    h.parent.style.display = 'flex';
    h.commit(200);
    expect(h.sink.diagnostics?.()).toContain('width:layout-profile-unavailable');
  });

  it('refuses min/max width clamps instead of acknowledging a constrained sample', () => {
    const h = fixture();
    h.el.style.minWidth = '200px';
    h.commit(0);
    h.measure(h.parent, 400);
    h.frame(0);
    h.commit(400);
    expect(h.el.style.width).toBe('');
    expect(h.sink.diagnostics?.()).toContain('width:layout-profile-unavailable');
    h.el.style.minWidth = '0px';
    h.el.style.maxWidth = '300px';
    h.commit(200);
    expect(h.el.style.width).toBe('');
    expect(h.sink.diagnostics?.()).toContain('width:layout-profile-unavailable');
  });

  it('rejects a sample whose containing block changes while host styles are flushed', () => {
    const h = fixture();
    h.commit(100);
    h.measure(h.parent, 400);
    h.frame(0);
    const parent = document.createElement('div');
    parent.style.display = 'block';
    document.body.append(parent);
    h.queueStyle.mockImplementationOnce(() => parent.append(h.el));
    h.commit(300);
    expect(h.el.style.width).toBe('');
    expect(h.frames.size).toBe(0);
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    h.measure(parent, 800);
    expect(h.el.style.width).toBe('');
  });

  it('retires old containing-block observations while finite px continuity remains independent of that basis', () => {
    const h = fixture();
    h.commit(100);
    h.measure(h.parent, 400);
    h.frame(0);
    h.commit(300);
    h.frame(25);
    expect(h.el.style.width).toBe('150px');
    const replacement = document.createElement('div');
    replacement.style.display = 'block';
    document.body.append(replacement);
    replacement.append(h.el);
    h.commit(400);
    expect(h.el.style.width).toBe('150px');
    expect(h.observed.has(h.parent)).toBe(false);
    expect(h.observed.has(replacement)).toBe(true);
    h.measure(replacement, 800);
    expect(h.el.style.width).toBe('150px');
    expect(h.frames.size).toBe(1);
    h.commit(600);
    expect(h.el.style.width).toBe('150px');
    h.frame(75);
    expect(h.el.style.width).toBe('375px');
  });
});
