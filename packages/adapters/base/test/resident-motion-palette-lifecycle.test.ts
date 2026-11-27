import { afterEach, expect, it, vi } from 'vitest';
import type { ResidentMotionProperty } from '@proto.ui/core';
import {
  createWebResidentMotionSink,
  type ResidentMotionPaletteSource,
} from '../src/motion/web-resident-motion';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it('binds one source to each replacement surface and unsubscribes the retired view', () => {
  const calls: HTMLElement[] = [];
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const invalidations: (() => void)[] = [];
  const factory = (surface: HTMLElement) => {
    calls.push(surface);
    const off = vi.fn();
    cleanups.push(off);
    return {
      current: () => ({
        revision: 1,
        colors: { input: [0, 0, 0, 1] as const },
      }),
      subscribe(cb: () => void) {
        invalidations.push(cb);
        return off;
      },
    };
  };
  const one = document.createElement('div'),
    two = document.createElement('div');
  document.body.append(one, two);
  const write = vi.fn();
  const options = { palette: factory };
  const first = createWebResidentMotionSink(one, { queueStyle: write, requestFlush() {} }, options);
  const frame = {
    view: 1,
    revision: 1,
    style: { kind: 'tw' as const, tokens: ['bg-input'] },
    declarations: [
      {
        properties: ['background-color' as const],
        durationMs: 100,
        easing: [0, 0, 1, 1] as const,
      },
    ],
  };
  first.commit(frame);
  expect(calls).toEqual([one]);
  first.release(1);
  expect(cleanups[0]).toHaveBeenCalledTimes(1);
  const count = write.mock.calls.length;
  invalidations[0]();
  expect(write).toHaveBeenCalledTimes(count);
  const second = createWebResidentMotionSink(
    two,
    { queueStyle: write, requestFlush() {} },
    options
  );
  second.commit({ ...frame, view: 2 });
  expect(calls).toEqual([one, two]);
  second.release(2);
  expect(cleanups[1]).toHaveBeenCalledTimes(1);
});

function motionClock() {
  let now = 0;
  let ticket = 0;
  const scheduled = new Map<number, FrameRequestCallback>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    Object.assign(new EventTarget(), {
      matches: !query.includes(': reduce'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
    })
  );
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    scheduled.set(++ticket, callback);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    scheduled.delete(id);
  });
  return (time: number) => {
    now = time;
    for (const [id, callback] of [...scheduled]) {
      scheduled.delete(id);
      callback(now);
    }
  };
}

it.each([
  { label: 'translate', properties: ['translate'] },
  { label: 'width', properties: ['width'] },
  { label: 'translate and width', properties: ['translate', 'width'] },
] as const)('does not read color authority for $label frames', ({ properties }) => {
  const nextFrame = motionClock();
  const surface = document.createElement('div');
  document.body.append(surface);
  const current = vi.fn(() => ({ revision: 1, colors: {} }));
  let invalidate = () => {};
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((callback: () => void) => {
    invalidate = callback;
    return unsubscribe;
  });
  const queueStyle = vi.fn();
  const sink = createWebResidentMotionSink(
    surface,
    { queueStyle, requestFlush() {} },
    {
      palette: {
        current,
        subscribe,
      },
    }
  );
  try {
    const commit = (revision: number) =>
      sink.commit({
        view: 1,
        revision,
        style: { kind: 'tw', tokens: ['translate-x-0', 'w-4'] },
        declarations: [{ properties, durationMs: 100, easing: [0, 0, 1, 1] }],
      });
    commit(1);
    nextFrame(0);
    commit(2);
    invalidate();
    expect(queueStyle).toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  } finally {
    sink.release(1);
  }
  expect(unsubscribe).not.toHaveBeenCalled();
});

it('reads current color authority on each admitted color frame without retaining stale colors', () => {
  const nextFrame = motionClock();
  const computed = vi.spyOn(window, 'getComputedStyle');
  const surface = document.createElement('div');
  document.body.append(surface);
  let palette: ReturnType<ResidentMotionPaletteSource['current']>;
  const current = vi.fn(() => palette);
  let invalidate = () => {};
  const callbacks: (() => void)[] = [];
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const queueStyle = vi.fn();
  const sink = createWebResidentMotionSink(
    surface,
    { queueStyle, requestFlush() {} },
    {
      palette: {
        current,
        subscribe(callback) {
          invalidate = callback;
          callbacks.push(callback);
          const off = vi.fn();
          cleanups.push(off);
          return off;
        },
      },
    }
  );
  const commit = (revision: number, properties: readonly ResidentMotionProperty[], token: string) =>
    sink.commit({
      view: 1,
      revision,
      style: { kind: 'tw', tokens: [token] },
      declarations: [{ properties, durationMs: 100, easing: [0, 0, 1, 1] }],
    });
  try {
    palette = {
      revision: 1,
      colors: { input: [0, 0, 0, 1], primary: [1, 1, 1, 1] },
    };
    commit(1, ['background-color'], 'bg-input');
    expect(current).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
    nextFrame(0);
    expect(current).toHaveBeenCalledTimes(2);
    commit(2, ['background-color'], 'bg-primary');
    expect(current).toHaveBeenCalledTimes(3);
    nextFrame(50);
    expect(current).toHaveBeenCalledTimes(4);
    expect(surface.style.getPropertyValue('background-color')).not.toBe('');

    palette = {
      revision: 2,
      colors: {},
      diagnostics: ['theme-source-mismatch:primary'],
    };
    nextFrame(75);
    expect(current).toHaveBeenCalledTimes(5);
    expect(surface.style.getPropertyValue('background-color')).toBe('');
    expect(sink.diagnostics?.()).toContain('theme-source-mismatch:primary');
    expect(sink.diagnostics?.()).toContain('background-color:unresolved-target-settled');
    expect(queueStyle.mock.calls.at(-1)![0].tokens).toEqual(['bg-primary']);
    expect(computed.mock.calls.filter(([node]) => node === document.documentElement)).toHaveLength(
      0
    );

    commit(1, ['background-color'], 'bg-input');
    expect(current).toHaveBeenCalledTimes(5);
    commit(3, ['translate'], 'translate-x-0');
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    const writesBeforeStaleNotification = queueStyle.mock.calls.length;
    invalidate();
    expect(queueStyle).toHaveBeenCalledTimes(writesBeforeStaleNotification);
    expect(current).toHaveBeenCalledTimes(5);
    palette = { revision: 3, colors: { primary: [0, 1, 0, 1] } };
    commit(4, ['background-color'], 'bg-primary');
    expect(current).toHaveBeenCalledTimes(6);
    expect(callbacks).toHaveLength(2);
    expect(sink.diagnostics?.()).not.toContain('theme-source-mismatch:primary');
    palette = {
      revision: 4,
      colors: {},
      diagnostics: ['theme-source-mismatch:primary'],
    };
    callbacks[1]!();
    expect(current).toHaveBeenCalledTimes(7);
    expect(sink.diagnostics?.()).toContain('theme-source-mismatch:primary');
  } finally {
    sink.release(1);
  }
  expect(cleanups.map((off) => off.mock.calls.length)).toEqual([1, 1]);
  const readsAfterRelease = current.mock.calls.length;
  for (const callback of callbacks) callback();
  expect(current).toHaveBeenCalledTimes(readsAfterRelease);
});

it.each(['release', 'geometry'] as const)(
  'cleans a palette subscription synchronously superseded by %s while binding',
  (replacement) => {
    motionClock();
    const surface = document.createElement('div');
    document.body.append(surface);
    const current = vi.fn(() => ({
      revision: 1,
      colors: { input: [0, 0, 0, 1] as const },
    }));
    const off = vi.fn();
    const queueStyle = vi.fn();
    let notify = () => {};
    const subscribe = vi.fn((callback: () => void) => {
      notify = callback;
      if (replacement === 'release') sink.release(1);
      else commit(2, ['translate'], 'translate-x-0');
      return off;
    });
    const sink = createWebResidentMotionSink(
      surface,
      { queueStyle, requestFlush() {} },
      { palette: { current, subscribe } }
    );
    const commit = (
      revision: number,
      properties: readonly ResidentMotionProperty[],
      token: string
    ) =>
      sink.commit({
        view: 1,
        revision,
        style: { kind: 'tw', tokens: [token] },
        declarations: [{ properties, durationMs: 100, easing: [0, 0, 1, 1] }],
      });
    try {
      commit(1, ['background-color'], 'bg-input');
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(off).toHaveBeenCalledTimes(1);
      expect(current).not.toHaveBeenCalled();
      if (replacement === 'release') expect(queueStyle).not.toHaveBeenCalled();
      else expect(queueStyle.mock.calls.at(-1)![0].tokens).not.toContain('bg-input');
      const writes = queueStyle.mock.calls.length;
      notify();
      expect(queueStyle).toHaveBeenCalledTimes(writes);
    } finally {
      sink.release(1);
    }
    expect(off).toHaveBeenCalledTimes(1);
  }
);

it('keeps the newer color subscription when geometry cleanup synchronously requests color again', () => {
  motionClock();
  const surface = document.createElement('div');
  document.body.append(surface);
  const current = vi.fn(() => ({
    revision: 1,
    colors: { input: [0, 0, 0, 1] as const },
  }));
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const callbacks: (() => void)[] = [];
  let reenter = true;
  const queueStyle = vi.fn();
  const sink = createWebResidentMotionSink(
    surface,
    { queueStyle, requestFlush() {} },
    {
      palette: {
        current,
        subscribe(callback) {
          callbacks.push(callback);
          const off = vi.fn(() => {
            if (reenter) {
              reenter = false;
              commit(3, ['background-color'], 'bg-input');
            }
          });
          cleanups.push(off);
          return off;
        },
      },
    }
  );
  const commit = (revision: number, properties: readonly ResidentMotionProperty[], token: string) =>
    sink.commit({
      view: 1,
      revision,
      style: { kind: 'tw', tokens: [token] },
      declarations: [{ properties, durationMs: 100, easing: [0, 0, 1, 1] }],
    });
  try {
    commit(1, ['background-color'], 'bg-input');
    commit(2, ['translate'], 'translate-x-0');
    expect(current).toHaveBeenCalledTimes(2);
    expect(callbacks).toHaveLength(2);
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(cleanups[1]).not.toHaveBeenCalled();
    expect(queueStyle.mock.calls.at(-1)![0].tokens).toEqual(['bg-input']);
    callbacks[0]!();
    expect(current).toHaveBeenCalledTimes(2);
    callbacks[1]!();
    expect(current).toHaveBeenCalledTimes(3);
  } finally {
    sink.release(1);
  }
  expect(cleanups.map((off) => off.mock.calls.length)).toEqual([1, 1]);
});

it.each(['w-auto', 'w-1/2'])(
  'tracks the new containing block without classifying an absent %s width sample',
  (token) => {
    const nextFrame = motionClock();
    const parent = document.createElement('div');
    const replacement = document.createElement('div');
    const surface = document.createElement('div');
    parent.style.display = 'block';
    replacement.style.display = 'block';
    surface.style.display = 'block';
    parent.append(surface);
    document.body.append(parent, replacement);
    const sheet = document.createElement('style');
    sheet.textContent = '[data-width-lifecycle-surface] { width: 200px; }';
    surface.setAttribute('data-width-lifecycle-surface', '');
    document.head.append(sheet);
    const observed = new Set<Element>();
    let resizeCallback: ResizeObserverCallback = () => {};
    class LifecycleResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
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
    }
    const originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = LifecycleResizeObserver;
    const observe = vi.spyOn(LifecycleResizeObserver.prototype, 'observe');
    const unobserve = vi.spyOn(LifecycleResizeObserver.prototype, 'unobserve');
    const deliver = (target: Element, width: number) => {
      resizeCallback(
        [
          {
            target,
            contentBoxSize: [{ inlineSize: width, blockSize: 20 }],
            borderBoxSize: [{ inlineSize: width, blockSize: 20 }],
            devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 20 }],
            contentRect: new DOMRectReadOnly(0, 0, width, 20),
          },
        ],
        {} as ResizeObserver
      );
    };
    let flushed = false;
    const readsBeforeFlush: Element[] = [];
    const readsAfterFlush: Element[] = [];
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      if (flushed) readsAfterFlush.push(element);
      else readsBeforeFlush.push(element);
      return getComputedStyle(element, pseudo);
    });
    const queueStyle = vi.fn();
    const sink = createWebResidentMotionSink(surface, {
      queueStyle,
      requestFlush() {
        flushed = true;
        replacement.append(surface);
      },
    });
    try {
      sink.commit({
        view: 1,
        revision: 1,
        style: { kind: 'tw', tokens: [token] },
        declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
      });
      expect(flushed).toBe(true);
      expect(sink.diagnostics?.()).toContain('width:unresolved-target-settled');
      expect(queueStyle.mock.calls.at(-1)![0].tokens).toEqual([token]);
      expect(surface.style.getPropertyValue('width')).toBe('');
      if (token === 'w-auto') {
        expect(readsBeforeFlush).toEqual([]);
        expect(readsAfterFlush).toEqual([]);
        expect(observe).not.toHaveBeenCalledWith(parent, {
          box: 'content-box',
        });
        expect(observe).not.toHaveBeenCalledWith(replacement, {
          box: 'content-box',
        });
      } else {
        // No percentage can produce a sample before its real containing-block
        // measurement. Reparenting during flush must still move the observation.
        expect(readsBeforeFlush).toEqual([]);
        expect(readsAfterFlush).toEqual([]);
        expect(unobserve).toHaveBeenCalledWith(parent);
        expect(observe).toHaveBeenCalledWith(replacement, {
          box: 'content-box',
        });
        expect(observed.has(parent)).toBe(false);
        expect(observed.has(replacement)).toBe(true);
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
        nextFrame(16);
        expect(queueStyle).toHaveBeenCalledTimes(2);
        expect(surface.style.getPropertyValue('width')).toBe('');
        expect(sink.diagnostics?.()).toContain('width:unresolved-target-settled');
        deliver(parent, 900);
        expect(sink.diagnostics?.()).toContain('width:unresolved-target-settled');
        expect(surface.style.getPropertyValue('width')).toBe('');
        expect(queueStyle.mock.calls.at(-1)![0].tokens).toEqual([token]);
        deliver(replacement, 400);
        expect(sink.diagnostics?.()).toEqual([]);
        expect(surface.style.getPropertyValue('width')).toBe('');
        expect(queueStyle.mock.calls.at(-1)![0].tokens).toEqual([token]);
      }
    } finally {
      sink.release(1);
      const afterRelease = queueStyle.mock.calls.length;
      deliver(replacement, 800);
      window.ResizeObserver = originalResizeObserver;
      sheet.remove();
      expect(observed.size).toBe(0);
      expect(queueStyle).toHaveBeenCalledTimes(afterRelease);
    }
  }
);
