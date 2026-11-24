import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveGestureHost, ScrollSurfaceSnapshot } from '@proto.ui/core';
import { createWebScrollSurfaceHost, type ScrollSurfaceHostAttachment } from '../src';

const INSET = '--proto-ui-scroll-track-end-inset';
const moveHost: MoveGestureHost = {
  attach: () => ({ update() {}, dispose() {} }),
};

function makeScrollableTarget(metrics?: {
  clientWidth?: number;
  scrollWidth?: number;
  clientHeight?: number;
  scrollHeight?: number;
}) {
  const el = document.createElement('div');
  const state = {
    clientWidth: metrics?.clientWidth ?? 200,
    scrollWidth: metrics?.scrollWidth ?? 200,
    clientHeight: metrics?.clientHeight ?? 200,
    scrollHeight: metrics?.scrollHeight ?? 1000,
    scrollLeft: 0,
    scrollTop: 0,
  };
  Object.defineProperties(el, {
    clientWidth: { configurable: true, get: () => state.clientWidth },
    scrollWidth: { configurable: true, get: () => state.scrollWidth },
    clientHeight: { configurable: true, get: () => state.clientHeight },
    scrollHeight: { configurable: true, get: () => state.scrollHeight },
    scrollLeft: {
      configurable: true,
      get: () => state.scrollLeft,
      set: (v: number) => {
        state.scrollLeft = v;
      },
    },
    scrollTop: {
      configurable: true,
      get: () => state.scrollTop,
      set: (v: number) => {
        state.scrollTop = v;
      },
    },
  });
  document.body.append(el);
  return { el, state };
}

function makeControl(axis: 'vertical' | 'horizontal', size = 200, thickness = 10) {
  const track = document.createElement('div');
  const thumb = document.createElement('div');
  track.style.boxSizing = 'border-box';
  track.style[axis === 'vertical' ? 'width' : 'height'] = `${thickness}px`;
  let offsetReads = 0;
  let clientReads = 0;
  Object.defineProperties(track, {
    offsetWidth: {
      configurable: true,
      get: () => {
        offsetReads += 1;
        return axis === 'vertical' ? thickness : size;
      },
    },
    offsetHeight: {
      configurable: true,
      get: () => {
        offsetReads += 1;
        return axis === 'horizontal' ? thickness : size;
      },
    },
    clientWidth: {
      configurable: true,
      get: () => {
        clientReads += 1;
        return axis === 'vertical' ? thickness : size;
      },
    },
    clientHeight: {
      configurable: true,
      get: () => {
        clientReads += 1;
        return axis === 'horizontal' ? thickness : size;
      },
    },
  });
  track.append(thumb);
  document.body.append(track);
  return {
    control: { getAxis: () => axis, trackTarget: track, thumbTarget: thumb },
    track,
    thumb,
    resetReads: () => {
      offsetReads = 0;
      clientReads = 0;
    },
    getReads: () => ({ offsetReads, clientReads }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('Web scroll surface host performance invariants', () => {
  it('reconciles ResizeObserver targets incrementally without reconnecting MutationObserver on childList updates', () => {
    let mutationCallback: MutationCallback | undefined;
    const resizeObserved: Element[] = [];
    const resizeUnobserved: Element[] = [];
    let resizeDisconnects = 0;
    let mutationDisconnects = 0;
    let mutationObserves = 0;

    class TrackingResizeObserver {
      constructor(_cb: ResizeObserverCallback) {}
      observe(el: Element) {
        resizeObserved.push(el);
      }
      unobserve(el: Element) {
        resizeUnobserved.push(el);
      }
      disconnect() {
        resizeDisconnects += 1;
      }
    }
    class TrackingMutationObserver {
      constructor(cb: MutationCallback) {
        mutationCallback = cb;
      }
      observe() {
        mutationObserves += 1;
      }
      disconnect() {
        mutationDisconnects += 1;
      }
    }
    vi.stubGlobal('ResizeObserver', TrackingResizeObserver);
    vi.stubGlobal('MutationObserver', TrackingMutationObserver);

    const { el } = makeScrollableTarget();
    for (let i = 0; i < 40; i += 1) {
      el.append(document.createElement('div'));
    }
    const v = makeControl('vertical');
    const lease = createWebScrollSurfaceHost(el, { moveGestureHost: moveHost }).attach({
      config: { axes: 'vertical', projection: 'composed', endFollow: { mode: 'off' } },
      projection: 'composed',
      composedChrome: { scope: {}, controls: [v.control] },
      onFacts() {},
    });

    try {
      // Initial attach observes target + 40 children + vertical track.
      expect(resizeObserved).toHaveLength(42);
      expect(resizeDisconnects).toBe(0);
      expect(mutationDisconnects).toBe(1);
      expect(mutationObserves).toBe(2);

      resizeObserved.length = 0;
      resizeUnobserved.length = 0;
      mutationDisconnects = 0;
      mutationObserves = 0;

      // Append 1 child: only the new child should be observed, 0 disconnects.
      const appended = document.createElement('div');
      el.append(appended);
      mutationCallback?.(
        [
          {
            type: 'childList',
            target: el,
            addedNodes: [appended] as unknown as NodeList,
            removedNodes: [] as unknown as NodeList,
          } as unknown as MutationRecord,
        ],
        {} as MutationObserver
      );

      expect(resizeObserved).toEqual([appended]);
      expect(resizeUnobserved).toEqual([]);
      expect(resizeDisconnects).toBe(0);
      expect(mutationDisconnects).toBe(0);
      expect(mutationObserves).toBe(0);

      // Remove 1 child: only that child should be unobserved, 0 disconnects.
      resizeObserved.length = 0;
      appended.remove();
      mutationCallback?.(
        [
          {
            type: 'childList',
            target: el,
            addedNodes: [] as unknown as NodeList,
            removedNodes: [appended] as unknown as NodeList,
          } as unknown as MutationRecord,
        ],
        {} as MutationObserver
      );

      expect(resizeObserved).toEqual([]);
      expect(resizeUnobserved).toEqual([appended]);
      expect(resizeDisconnects).toBe(0);
      expect(mutationDisconnects).toBe(0);
    } finally {
      lease.dispose();
    }
  });

  it('avoids forced layout reads and redundant style writes during steady-state scrolling and scroll-end', () => {
    vi.useFakeTimers();
    const { el } = makeScrollableTarget({
      clientWidth: 200,
      scrollWidth: 800,
      clientHeight: 200,
      scrollHeight: 1000,
    });
    const v = makeControl('vertical');
    const h = makeControl('horizontal');

    const lease = createWebScrollSurfaceHost(el, {
      moveGestureHost: moveHost,
      scrollEndDelay: 120,
    }).attach({
      config: { axes: 'both', projection: 'composed', endFollow: { mode: 'off' } },
      projection: 'composed',
      composedChrome: { scope: {}, controls: [v.control, h.control] },
      onFacts() {},
    });

    try {
      v.resetReads();
      h.resetReads();
      const computedStyleSpy = vi.spyOn(window, 'getComputedStyle');
      const vTrackRectSpy = vi.spyOn(v.track, 'getBoundingClientRect');
      const vThumbRectSpy = vi.spyOn(v.thumb, 'getBoundingClientRect');
      const hTrackRectSpy = vi.spyOn(h.track, 'getBoundingClientRect');
      const vTrackSetProp = vi.spyOn(v.track.style, 'setProperty');
      const vThumbSetProp = vi.spyOn(v.thumb.style, 'setProperty');
      const hThumbSetProp = vi.spyOn(h.thumb.style, 'setProperty');

      for (let i = 1; i <= 20; i += 1) {
        el.scrollTop = i * 20;
        el.dispatchEvent(new Event('scroll'));
      }

      expect(computedStyleSpy).not.toHaveBeenCalled();
      expect(vTrackRectSpy).not.toHaveBeenCalled();
      expect(vThumbRectSpy).not.toHaveBeenCalled();
      expect(hTrackRectSpy).not.toHaveBeenCalled();
      expect(v.getReads().offsetReads).toBe(0);
      expect(h.getReads().offsetReads).toBe(0);
      expect(v.getReads().clientReads).toBe(0);
      expect(h.getReads().clientReads).toBe(0);
      expect(vTrackSetProp.mock.calls.filter(([name]) => name === INSET)).toHaveLength(0);
      expect(
        vThumbSetProp.mock.calls.filter(([name]) => name === '--proto-ui-scroll-thumb-size')
      ).toHaveLength(0);
      expect(
        vThumbSetProp.mock.calls.filter(([name]) => name === '--proto-ui-scroll-thumb-offset')
      ).toHaveLength(20);
      // Horizontal thumb did not move during vertical scroll.
      expect(hThumbSetProp).not.toHaveBeenCalled();
      expect(v.thumb.style.top).toBe('80px');

      // Scroll-end timer clears scrolling without touching thumb styles or layout.
      vThumbSetProp.mockClear();
      hThumbSetProp.mockClear();
      vi.advanceTimersByTime(150);
      expect(computedStyleSpy).not.toHaveBeenCalled();
      expect(vThumbSetProp).not.toHaveBeenCalled();
      expect(hThumbSetProp).not.toHaveBeenCalled();
    } finally {
      lease.dispose();
    }
  });

  it('skips cross-axis thickness measurement on single-axis composed surfaces', () => {
    const { el } = makeScrollableTarget();
    const v = makeControl('vertical');

    const lease = createWebScrollSurfaceHost(el, { moveGestureHost: moveHost }).attach({
      config: { axes: 'vertical', projection: 'composed', endFollow: { mode: 'off' } },
      projection: 'composed',
      composedChrome: { scope: {}, controls: [v.control] },
      onFacts() {},
    });

    try {
      expect(v.getReads().offsetReads).toBe(0);
      expect(v.track.style.getPropertyValue(INSET)).toBe('0px');
      expect(v.thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('40px');
    } finally {
      lease.dispose();
    }
  });

  it('batches all track geometry reads before any thumb style writes on multi-axis layout passes', () => {
    const { el } = makeScrollableTarget({
      clientWidth: 200,
      scrollWidth: 800,
      clientHeight: 200,
      scrollHeight: 1000,
    });
    const v = makeControl('vertical');
    const h = makeControl('horizontal');
    const ops: string[] = [];

    const origVClientHeight = Object.getOwnPropertyDescriptor(v.track, 'clientHeight')!;
    const origHClientWidth = Object.getOwnPropertyDescriptor(h.track, 'clientWidth')!;
    Object.defineProperty(v.track, 'clientHeight', {
      configurable: true,
      get: () => {
        ops.push('read:v');
        return origVClientHeight.get!.call(v.track);
      },
    });
    Object.defineProperty(h.track, 'clientWidth', {
      configurable: true,
      get: () => {
        ops.push('read:h');
        return origHClientWidth.get!.call(h.track);
      },
    });
    const origVSet = v.thumb.style.setProperty.bind(v.thumb.style);
    const origHSet = h.thumb.style.setProperty.bind(h.thumb.style);
    vi.spyOn(v.thumb.style, 'setProperty').mockImplementation((name, value, priority) => {
      ops.push(`write:v:${name}`);
      origVSet(name, value, priority);
    });
    vi.spyOn(h.thumb.style, 'setProperty').mockImplementation((name, value, priority) => {
      ops.push(`write:h:${name}`);
      origHSet(name, value, priority);
    });

    const lease = createWebScrollSurfaceHost(el, { moveGestureHost: moveHost }).attach({
      config: { axes: 'both', projection: 'composed', endFollow: { mode: 'off' } },
      projection: 'composed',
      composedChrome: { scope: {}, controls: [v.control, h.control] },
      onFacts() {},
    });

    try {
      const firstWrite = ops.findIndex((op) => op.startsWith('write:'));
      const lastRead = ops.reduce((idx, op, i) => (op.startsWith('read:') ? i : idx), -1);
      expect(firstWrite).toBeGreaterThan(0);
      expect(lastRead).toBeLessThan(firstWrite);
    } finally {
      lease.dispose();
    }
  });

  it('deduplicates unchanged facts while delivering to a newly installed onFacts callback', () => {
    const { el } = makeScrollableTarget();
    const firstFacts: ScrollSurfaceSnapshot[] = [];
    const secondFacts: ScrollSurfaceSnapshot[] = [];
    const makeConnection = (
      onFacts: (facts: ScrollSurfaceSnapshot) => void
    ): ScrollSurfaceHostAttachment => ({
      config: { axes: 'vertical', projection: 'system', endFollow: { mode: 'off' } },
      projection: 'system',
      onFacts,
    });

    const lease = createWebScrollSurfaceHost(el, { moveGestureHost: moveHost }).attach(
      makeConnection((f) => firstFacts.push(f))
    );

    try {
      expect(firstFacts).toHaveLength(1);
      // Unchanged resize does not re-emit identical facts.
      window.dispatchEvent(new Event('resize'));
      expect(firstFacts).toHaveLength(1);

      // Duplicate scroll at unchanged offset while scrolling === true does not re-emit.
      el.scrollTop = 40;
      el.dispatchEvent(new Event('scroll'));
      expect(firstFacts).toHaveLength(2);
      el.dispatchEvent(new Event('scroll'));
      expect(firstFacts).toHaveLength(2);

      // Updating with a fresh callback delivers current facts to the new receiver.
      lease.update(makeConnection((f) => secondFacts.push(f)));
      expect(secondFacts).toHaveLength(1);
      expect(secondFacts[0]?.vertical.position).toBeCloseTo(40 / 800);
    } finally {
      lease.dispose();
    }
  });
});
