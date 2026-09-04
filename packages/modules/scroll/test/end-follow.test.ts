import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveGestureHost, ScrollSurfaceSnapshot } from '@proto.ui/core';
import { createWebScrollSurfaceHost } from '../src';

const moveGestureHost: MoveGestureHost = {
  attach() {
    return { update() {}, dispose() {} };
  },
};

type Metrics = {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
};

function installMetrics(target: HTMLElement, initial: Metrics) {
  const current = { ...initial };
  Object.defineProperties(target, {
    clientWidth: { configurable: true, get: () => current.clientWidth },
    scrollWidth: { configurable: true, get: () => current.scrollWidth },
    clientHeight: { configurable: true, get: () => current.clientHeight },
    scrollHeight: { configurable: true, get: () => current.scrollHeight },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  return (patch: Partial<Metrics>) => Object.assign(current, patch);
}

function installFrameHarness() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  return {
    pending: () => callbacks.size,
    peek: () => callbacks.values().next().value as FrameRequestCallback | undefined,
    runAll() {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(performance.now());
    },
  };
}

function attachEndFollow(target: HTMLElement, snapshots: ScrollSurfaceSnapshot[]) {
  return createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
    config: {
      axes: 'vertical',
      projection: 'system',
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
    },
    projection: 'system',
    onFacts: (snapshot) => snapshots.push(snapshot),
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('module-scroll: end-follow host contract', () => {
  it('keeps disabled initial materialization in place with off and idle facts', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];

    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });

    expect(frames.pending()).toBe(0);
    expect(target.scrollTop).toBe(0);
    expect(snapshots.at(-1)?.endFollow).toEqual({ state: 'off', requestStatus: 'idle' });
    lease.dispose();
  });

  it('reports host-bounded atEnd before exact overflow ends', () => {
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.scrollTop = 299.5;
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost,
      endThreshold: 1,
    }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });

    expect(snapshots.at(-1)?.vertical).toMatchObject({ atEnd: true, canScrollAfter: true });
    lease.dispose();
  });

  it('falls back to the bounded default when a host threshold is not finite', () => {
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.scrollTop = 299.5;
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost,
      endThreshold: Number.NaN,
    }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });

    expect(snapshots.at(-1)?.vertical.atEnd).toBe(true);
    lease.dispose();
  });

  it('applies enabled initial materialization after layout without moving focus or forcing smooth motion', () => {
    const frames = installFrameHarness();
    const focusOwner = document.createElement('button');
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.style.scrollBehavior = 'auto';
    document.body.append(focusOwner, target);
    focusOwner.focus();
    const snapshots: ScrollSurfaceSnapshot[] = [];

    const lease = attachEndFollow(target, snapshots);

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'pending',
      requestStatus: 'pending',
    });

    frames.runAll();

    expect(target.scrollTop).toBe(300);
    expect(snapshots.at(-1)?.vertical.atEnd).toBe(true);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    expect(document.activeElement).toBe(focusOwner);
    expect(target.style.scrollBehavior).toBe('auto');
    lease.dispose();
  });

  it('coalesces rapid extent growth into one layout application while following', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();
    expect(target.scrollTop).toBe(300);

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    updateMetrics({ scrollHeight: 600 });
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow.state).toBe('pending');
    frames.runAll();

    expect(target.scrollTop).toBe(500);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    lease.dispose();
  });

  it('cancels pending follow and leaves later growth alone after evidenced reader departure', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);

    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(frames.pending()).toBe(0);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'paused',
      requestStatus: 'rejected',
    });

    updateMetrics({ scrollHeight: 600 });
    window.dispatchEvent(new Event('resize'));
    frames.runAll();
    expect(target.scrollTop).toBe(200);
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    lease.dispose();
  });

  it('does not treat a completed pointer gesture as later reader departure', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    target.scrollTop = 220;
    target.dispatchEvent(new Event('scroll'));

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow.state).toBe('pending');
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it('reports an explicit to-end request pending then applied and resumes following', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    target.scrollTop = 120;
    target.dispatchEvent(new Event('scroll'));

    lease.request({ kind: 'to-end', axis: 'vertical' });
    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'pending',
      requestStatus: 'pending',
    });

    frames.runAll();
    expect(target.scrollTop).toBe(300);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    lease.dispose();
  });

  it('resumes when the reader reaches end naturally and rejects a disabled-axis request', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    target.scrollTop = 150;
    target.dispatchEvent(new Event('scroll'));
    expect(snapshots.at(-1)?.endFollow?.state).toBe('paused');

    target.scrollTop = 300;
    target.dispatchEvent(new Event('scroll'));
    expect(snapshots.at(-1)?.endFollow?.state).toBe('following');

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    frames.runAll();
    expect(target.scrollTop).toBe(400);

    lease.request({ kind: 'to-end', axis: 'horizontal' });
    expect(frames.pending()).toBe(0);
    expect(snapshots.at(-1)?.endFollow?.requestStatus).toBe('rejected');
    lease.dispose();
  });

  it('cancels scheduled work and suppresses late callbacks after disposal', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    const lateFrame = frames.peek();
    expect(lateFrame).toBeTypeOf('function');
    const reportCount = snapshots.length;

    lease.dispose();
    expect(frames.pending()).toBe(0);
    lateFrame?.(performance.now());
    window.dispatchEvent(new Event('resize'));
    target.dispatchEvent(new Event('scroll'));

    expect(target.scrollTop).toBe(0);
    expect(snapshots).toHaveLength(reportCount);
  });
});
