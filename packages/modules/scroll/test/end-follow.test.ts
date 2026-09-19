import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveGestureHost, ScrollSurfaceRequest, ScrollSurfaceSnapshot } from '@proto.ui/core';
import { createWebScrollSurfaceHost, type ScrollSurfaceHostLease } from '../src';

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

function touchContact(target: EventTarget, identifier: number, clientX = 0, clientY = 0): Touch {
  return { target, identifier, clientX, clientY } as Touch;
}

function dispatchTouch(
  receiver: EventTarget,
  type: string,
  changedTouches: Touch[],
  touches: Touch[]
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    changedTouches: { value: changedTouches },
    touches: { value: touches },
  });
  receiver.dispatchEvent(event);
}

function installTouchFollowFixture() {
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
  return {
    frames,
    target,
    updateMetrics,
    snapshots,
    lease,
    scrollTo(top: number) {
      target.scrollTop = top;
      target.dispatchEvent(new Event('scroll'));
    },
  };
}

function installFontHarness(): {
  dispatch(type: string): void;
  listeners(): ReadonlySet<EventListener>;
} {
  const byType = new Map<string, Set<EventListener>>();
  const addEventListener = (type: string, listener: EventListener) => {
    const set = byType.get(type) ?? byType.set(type, new Set()).get(type)!;
    set.add(listener);
  };
  const removeEventListener = (type: string, listener: EventListener) => {
    byType.get(type)?.delete(listener);
  };
  const dispatch = (type: string) => {
    for (const listener of Array.from(byType.get(type) ?? [])) {
      listener(new Event(type));
    }
  };
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { addEventListener, removeEventListener },
  });
  return {
    dispatch,
    listeners: () => new Set(byType.get('loadingdone') ?? []),
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'fonts');
});

describe('module-scroll: end-follow host contract', () => {
  it('cancels a pending follow frame when departure input cannot scroll (key)', () => {
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
    // Initial follow frame is pending while the surface is away from the end.
    expect(frames.pending()).toBe(1);
    // ArrowUp at scrollTop 0 is boundary-clamped: no scroll event will arrive.
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    expect(frames.pending()).toBe(0);
    frames.runAll();
    expect(target.scrollTop).toBe(0);
    lease.dispose();
  });

  it('cancels a pending follow frame when departure input cannot scroll (wheel)', () => {
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
    expect(frames.pending()).toBe(1);
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    expect(frames.pending()).toBe(0);
    frames.runAll();
    expect(target.scrollTop).toBe(0);
    lease.dispose();
  });

  it('ignores departure wheel input already canceled by a descendant', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    const child = document.createElement('div');
    target.append(child);
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    expect(frames.pending()).toBe(1);
    child.addEventListener('wheel', (event) => event.preventDefault());
    child.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -40 }));
    // A canceled event cannot scroll this surface: no intent is armed and the
    // pending follow frame keeps its deadline.
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(300);
    lease.dispose();
  });

  it('ignores departure key input already canceled by a descendant', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    const input = document.createElement('input');
    target.append(input);
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    expect(frames.pending()).toBe(1);
    input.addEventListener('keydown', (event) => event.preventDefault());
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowUp' })
    );
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(300);
    lease.dispose();
  });

  it('attributes bubbled wheel input to an intervening scrollable that can consume it', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    const nested = document.createElement('div');
    nested.style.overflowY = 'auto';
    installMetrics(nested, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    nested.scrollTop = 120;
    const content = document.createElement('div');
    nested.append(content);
    target.append(nested);
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    expect(frames.pending()).toBe(1);
    content.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    // The nested scroller still has room toward the departure boundary, so the
    // gesture belongs to it: no synchronous cancellation for the outer surface.
    expect(frames.pending()).toBe(1);
    // Outer-surface control: the same input on the viewport itself is
    // attributable to this surface and cancels the pending frame.
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    expect(frames.pending()).toBe(0);
    lease.dispose();
  });

  it('treats wheel input past a boundary-clamped nested scroller as outer input', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    const nested = document.createElement('div');
    nested.style.overflowY = 'auto';
    installMetrics(nested, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    // The nested scroller sits at its own departure boundary, so scroll
    // chaining hands the gesture to the outer surface.
    nested.scrollTop = 0;
    const content = document.createElement('div');
    nested.append(content);
    target.append(nested);
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    expect(frames.pending()).toBe(1);
    content.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    expect(frames.pending()).toBe(0);
    lease.dispose();
  });

  it('keeps a pending follow frame for boundary-clamped input directed toward the end', () => {
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
    expect(frames.pending()).toBe(1);
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(300);
    lease.dispose();
  });

  it('installs reader-input listeners only while a follow axis is configured', () => {
    installFrameHarness();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const host = createWebScrollSurfaceHost(target, { moveGestureHost });
    const lease = host.attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    const addedTypes = () => added.mock.calls.map(([type]) => type);
    expect(addedTypes()).not.toContain('pointermove');
    expect(addedTypes()).not.toContain('touchmove');
    expect(addedTypes()).not.toContain('keyup');
    lease.update({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    expect(addedTypes()).toContain('pointermove');
    expect(addedTypes()).toContain('touchmove');
    lease.update({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    const removedTypes = removed.mock.calls.map(([type]) => type);
    expect(removedTypes).toContain('pointermove');
    expect(removedTypes).toContain('touchmove');
    lease.dispose();
  });

  it('classifies reversal away after a toward-end movement was clamped', () => {
    const fixture = installTouchFollowFixture();
    const start = touchContact(fixture.target, 11, 0, 100);
    dispatchTouch(fixture.target, 'touchstart', [start], [start]);
    const toward = touchContact(fixture.target, 11, 0, 50);
    dispatchTouch(window, 'touchmove', [toward], [toward]);
    expect(fixture.target.scrollTop).toBe(300);
    const reversed = touchContact(fixture.target, 11, 0, 80);
    dispatchTouch(window, 'touchmove', [reversed], [reversed]);
    fixture.scrollTo(270);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    fixture.frames.runAll();
    expect(fixture.target.scrollTop).toBe(270);
    fixture.lease.dispose();
  });

  it('samples departure after a small direction reversal before terminal scroll delivery', () => {
    const fixture = installTouchFollowFixture();
    const start = touchContact(fixture.target, 11, 0, 100);
    dispatchTouch(fixture.target, 'touchstart', [start], [start]);
    const away = touchContact(fixture.target, 11, 0, 200);
    dispatchTouch(window, 'touchmove', [away], [away]);
    fixture.target.scrollTop = 200;
    const reversed = touchContact(fixture.target, 11, 0, 190);
    dispatchTouch(window, 'touchmove', [reversed], [reversed]);
    fixture.target.scrollTop = 210;
    dispatchTouch(window, 'touchend', [reversed], []);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    fixture.frames.runAll();
    expect(fixture.target.scrollTop).toBe(210);
    fixture.lease.dispose();
  });

  it('retains followed-axis direction through an unrelated-axis scroll before departure delivery', () => {
    const fixture = installTouchFollowFixture();
    const start = touchContact(fixture.target, 11);
    dispatchTouch(fixture.target, 'touchstart', [start], [start]);
    const moved = touchContact(fixture.target, 11, 0, 50);
    dispatchTouch(window, 'touchmove', [moved], [moved]);
    fixture.target.scrollLeft = 20;
    fixture.target.dispatchEvent(new Event('scroll'));
    fixture.scrollTo(200);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.lease.dispose();
  });

  it.each(['scroll', 'pointerup', 'pointercancel', 'touchend', 'touchcancel'])(
    'does not attribute stationary-contact offset reflow at %s to reader departure',
    (completion) => {
      // C-SCROLL-END-FOLLOW-0001-INTERRUPT/REFLOW: contact is not movement.
      const fixture = installTouchFollowFixture();
      const touch = touchContact(fixture.target, 11);
      fixture.target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 31 }));
      dispatchTouch(fixture.target, 'touchstart', [touch], [touch]);
      fixture.target.scrollTop = 200;
      if (completion.startsWith('touch')) dispatchTouch(window, completion, [touch], []);
      else if (completion.startsWith('pointer')) {
        window.dispatchEvent(new PointerEvent(completion, { pointerId: 31 }));
      } else fixture.target.dispatchEvent(new Event('scroll'));
      expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('following');
      window.dispatchEvent(new Event('resize'));
      fixture.frames.runAll();
      expect(fixture.target.scrollTop).toBe(300);
      fixture.lease.dispose();
    }
  );

  it('settles the latest request when pending and applied watchers schedule reentrantly', () => {
    // C-SCROLL-END-FOLLOW-0001-RESUME/FACTS: old movement cannot consume a newer request.
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
    let armed = false;
    let pendingRequested = false;
    let appliedRequested = false;
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts(snapshot) {
        snapshots.push(snapshot);
        if (!armed) return;
        if (!pendingRequested && snapshot.endFollow.state === 'pending') {
          pendingRequested = true;
          lease.request({ kind: 'to-end', axis: 'vertical' });
        } else if (!appliedRequested && snapshot.endFollow.requestStatus === 'applied') {
          appliedRequested = true;
          lease.request({ kind: 'to-end', axis: 'vertical' });
        }
      },
    });
    frames.runAll();
    armed = true;
    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    const queuedAfterPendingWatcher = frames.pending();
    frames.runAll();
    frames.runAll();
    expect(snapshots.at(-1)?.endFollow).toEqual({ state: 'following', requestStatus: 'applied' });
    expect(queuedAfterPendingWatcher).toBe(1);
    expect(frames.pending()).toBe(0);
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

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

  it('publishes unclassified scroll geometry without pausing the follow lease', () => {
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

    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));
    expect(snapshots.at(-1)?.vertical.atEnd).toBe(false);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it('does not classify control-wheel zoom as reader departure', () => {
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
    const zoom = new WheelEvent('wheel', { bubbles: true, deltaY: -40 });
    Object.defineProperty(zoom, 'ctrlKey', { configurable: true, value: true });
    expect(zoom.ctrlKey).toBe(true);
    target.dispatchEvent(zoom);

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow.state).toBe('pending');
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it('does not pause a pending follow until the configured surface actually moves', () => {
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
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -40 }));

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow.state).toBe('pending');
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('classifies Shift+Space as vertical reader departure', () => {
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

    const pageUp = new KeyboardEvent('keydown', { bubbles: true, key: ' ' });
    Object.defineProperty(pageUp, 'shiftKey', { configurable: true, value: true });
    target.dispatchEvent(pageUp);
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    lease.dispose();
  });

  it('keeps deep mutation observation disabled for default-off surfaces', () => {
    const observations: Array<{ target: Node; options: MutationObserverInit }> = [];
    class RecordingMutationObserver {
      constructor(_callback: MutationCallback) {}
      observe(target: Node, options: MutationObserverInit) {
        observations.push({ target, options });
      }
      disconnect() {}
    }
    vi.stubGlobal('MutationObserver', RecordingMutationObserver);
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);

    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: () => {},
    });

    expect(observations.find((entry) => entry.target === target)?.options).toEqual({
      childList: true,
    });
    lease.dispose();
  });

  it('retains pointer intent across other-axis scrolling until the followed axis departs', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    target.scrollLeft = 50;
    target.dispatchEvent(new Event('scroll'));
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');

    window.dispatchEvent(new PointerEvent('pointermove', { clientY: -50 }));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    lease.dispose();
  });

  it('keeps touch intent through native pointer cancellation until the surface departs', () => {
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

    const touch = touchContact(target, 1);
    dispatchTouch(target, 'touchstart', [touch], [touch]);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientY: 50 }));
    dispatchTouch(window, 'touchmove', [touchContact(target, 1, 0, 50)], [touch]);
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    frames.runAll();
    expect(target.scrollTop).toBe(200);
    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    dispatchTouch(window, 'touchend', [touch], []);
    lease.dispose();
  });

  it('ends native-cancellation touch intent when the touch completes', () => {
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

    const touch = touchContact(target, 1);
    dispatchTouch(target, 'touchstart', [touch], [touch]);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
    dispatchTouch(window, 'touchend', [touch], []);
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('clears canceled touch contacts so later unclassified scroll stays following', () => {
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

    const touch = touchContact(target, 1);
    dispatchTouch(target, 'touchstart', [touch], [touch]);
    dispatchTouch(window, 'touchcancel', [touch], []);
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('samples an already-applied departure before ending a canceled contact session', () => {
    // Actual host movement precedes cancellation, even if scroll dispatch is pending.
    const fixture = installTouchFollowFixture();
    const touch = touchContact(fixture.target, 11);
    dispatchTouch(fixture.target, 'touchstart', [touch], [touch]);
    dispatchTouch(window, 'touchmove', [touchContact(fixture.target, 11, 0, 50)], [touch]);
    fixture.target.scrollTop = 200;
    dispatchTouch(window, 'touchcancel', [touch], []);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.scrollTo(200);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    fixture.frames.runAll();
    expect(fixture.target.scrollTop).toBe(200);
    fixture.lease.dispose();
  });

  it.each(['touchend', 'touchcancel'])(
    'does not borrow another target contact after an owned %s',
    (completion) => {
      // HC-SCROLL-SURFACE-0001-I: global touches are not this lease's reader evidence.
      const fixture = installTouchFollowFixture();
      const own = touchContact(fixture.target, 11);
      const foreign = touchContact(document.body, 22);
      dispatchTouch(fixture.target, 'touchstart', [own], [own, foreign]);
      dispatchTouch(window, completion, [own], [foreign]);
      fixture.scrollTo(200);
      expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('following');
      fixture.lease.dispose();
    }
  );

  it('retains only the remaining owned contact after partial touch cancellation', () => {
    const fixture = installTouchFollowFixture();
    const first = touchContact(fixture.target, 11);
    const second = touchContact(fixture.target, 12);
    const foreign = touchContact(document.body, 22);
    dispatchTouch(fixture.target, 'touchstart', [first, second], [first, second, foreign]);
    dispatchTouch(window, 'touchcancel', [first], [second, foreign]);
    dispatchTouch(
      window,
      'touchmove',
      [touchContact(fixture.target, 12, 0, 50)],
      [second, foreign]
    );
    fixture.scrollTo(200);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.scrollTo(300);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('following');
    dispatchTouch(window, 'touchend', [second], [foreign]);
    fixture.scrollTo(200);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('following');
    fixture.lease.dispose();
  });

  it('does not let an unrelated touch end terminate the owned native session', () => {
    const fixture = installTouchFollowFixture();
    const own = touchContact(fixture.target, 11);
    const foreign = touchContact(document.body, 22);
    dispatchTouch(fixture.target, 'touchstart', [own], [own]);
    fixture.target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 31 })
    );
    window.dispatchEvent(
      new PointerEvent('pointercancel', { pointerType: 'touch', pointerId: 31 })
    );
    dispatchTouch(window, 'touchend', [foreign], [own]);
    dispatchTouch(window, 'touchmove', [touchContact(fixture.target, 11, 0, 50)], [own]);
    fixture.scrollTo(200);
    expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('paused');
    fixture.lease.dispose();
  });

  it.each(['touchcancel', 'pointercancel'])(
    'does not arm reader intent from another target %s',
    (cancellation) => {
      const fixture = installTouchFollowFixture();
      if (cancellation === 'touchcancel') {
        dispatchTouch(window, cancellation, [touchContact(document.body, 22)], []);
      } else {
        window.dispatchEvent(
          new PointerEvent(cancellation, { pointerType: 'touch', pointerId: 22 })
        );
      }
      fixture.scrollTo(200);
      expect(fixture.snapshots.at(-1)?.endFollow.state).toBe('following');
      fixture.lease.dispose();
    }
  );

  it('does not preserve non-touch pointer cancellation as panning intent', () => {
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

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' }));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('clears pointer intent when the gesture ends outside the surface', () => {
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

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup'));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('classifies Shift+wheel as horizontal reader departure', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 100,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'horizontal' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    const shiftWheel = new WheelEvent('wheel', { bubbles: true, deltaY: -40 });
    Object.defineProperty(shiftWheel, 'shiftKey', { configurable: true, value: true });
    target.dispatchEvent(shiftWheel);
    target.scrollLeft = 100;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    lease.dispose();
  });

  it('keeps a follow lease rejected while its configured axis is disabled', () => {
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
        endFollow: { mode: 'while-at-end', axis: 'horizontal' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'paused',
      requestStatus: 'rejected',
    });

    window.dispatchEvent(new Event('resize'));

    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'paused',
      requestStatus: 'rejected',
    });
    lease.dispose();
  });

  it('applies end-follow directly and preserves authored important scrolling priority', () => {
    const frames = installFrameHarness();
    const focusOwner = document.createElement('button');
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.style.setProperty('scroll-behavior', 'smooth', 'important');
    let scrollTop = 0;
    let deferredScrollTop = 0;
    let immediatePriority = '';
    Object.defineProperty(target, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        if (target.style.getPropertyValue('scroll-behavior') === 'auto') {
          immediatePriority = target.style.getPropertyPriority('scroll-behavior');
          if (immediatePriority === 'important') scrollTop = value;
        } else {
          deferredScrollTop = value;
        }
      },
    });
    document.body.append(focusOwner, target);
    focusOwner.focus();
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);

    frames.runAll();

    expect(target.scrollTop).toBe(300);
    expect(deferredScrollTop).toBe(0);
    expect(immediatePriority).toBe('important');
    expect(target.style.getPropertyValue('scroll-behavior')).toBe('smooth');
    expect(target.style.getPropertyPriority('scroll-behavior')).toBe('important');
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    expect(document.activeElement).toBe(focusOwner);
    lease.dispose();
  });

  it.each<{
    request: ScrollSurfaceRequest;
    expectedOffset: number;
  }>([
    { request: { kind: 'by', axis: 'vertical', delta: -50 }, expectedOffset: 250 },
    { request: { kind: 'to', axis: 'vertical', position: 0.5 }, expectedOffset: 150 },
    {
      request: { kind: 'page', axis: 'vertical', direction: 'before' },
      expectedOffset: 200,
    },
    { request: { kind: 'control-drag', axis: 'vertical', position: 0.25 }, expectedOffset: 75 },
  ])(
    'pauses a smooth $request.kind away request before asynchronous movement',
    ({ request, expectedOffset }) => {
      const frames = installFrameHarness();
      const target = document.createElement('div');
      const updateMetrics = installMetrics(target, {
        clientWidth: 100,
        scrollWidth: 100,
        clientHeight: 100,
        scrollHeight: 400,
      });
      target.style.scrollBehavior = 'smooth';
      let scrollTop = 0;
      let deferredScrollTop: number | null = null;
      Object.defineProperty(target, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          if (target.style.getPropertyValue('scroll-behavior') === 'smooth') {
            deferredScrollTop = value;
          } else {
            scrollTop = value;
          }
        },
      });
      document.body.append(target);
      const snapshots: ScrollSurfaceSnapshot[] = [];
      const lease = attachEndFollow(target, snapshots);
      frames.runAll();
      expect(target.scrollTop).toBe(300);

      lease.request(request);

      expect(target.scrollTop).toBe(300);
      expect(deferredScrollTop).toBe(expectedOffset);
      expect(snapshots.at(-1)?.endFollow.state).toBe('paused');

      target.dispatchEvent(new Event('scroll'));
      expect(snapshots.at(-1)?.endFollow.state).toBe('paused');

      scrollTop = deferredScrollTop!;
      target.dispatchEvent(new Event('scroll'));
      expect(snapshots.at(-1)?.vertical.atEnd).toBe(false);
      expect(snapshots.at(-1)?.endFollow.state).toBe('paused');

      updateMetrics({ scrollHeight: 500 });
      window.dispatchEvent(new Event('resize'));
      frames.runAll();
      expect(frames.pending()).toBe(0);
      expect(target.scrollTop).toBe(expectedOffset);
      expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
      lease.dispose();
    }
  );

  it('keeps following when a smooth request resolves to the current end', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.style.scrollBehavior = 'smooth';
    let scrollTop = 0;
    let deferredScrollTop: number | null = null;
    Object.defineProperty(target, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        if (target.style.getPropertyValue('scroll-behavior') === 'smooth') {
          deferredScrollTop = value;
        } else {
          scrollTop = value;
        }
      },
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();

    lease.request({ kind: 'page', axis: 'vertical', direction: 'after' });

    expect(deferredScrollTop).toBe(300);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('reconciles descendant reflow when a nested transition completes', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const wrapper = document.createElement('div');
    target.append(wrapper);
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
    wrapper.dispatchEvent(new Event('transitionend'));

    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });
  it.each(['transitioncancel', 'animationcancel'] as const)(
    'reconciles descendant reflow when a nested %s is canceled',
    (eventType) => {
      const frames = installFrameHarness();
      const target = document.createElement('div');
      const wrapper = document.createElement('div');
      target.append(wrapper);
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
      wrapper.dispatchEvent(new Event(eventType));

      expect(frames.pending()).toBe(1);
      frames.runAll();
      expect(target.scrollTop).toBe(400);
      expect(snapshots.at(-1)?.endFollow).toEqual({
        state: 'following',
        requestStatus: 'applied',
      });
      lease.dispose();
    }
  );

  it.each(['transitioncancel', 'animationcancel'] as const)(
    'filters canceled descendant %s when end-follow is off',
    (eventType) => {
      const frames = installFrameHarness();
      const target = document.createElement('div');
      const wrapper = document.createElement('div');
      target.append(wrapper);
      installMetrics(target, {
        clientWidth: 100,
        scrollWidth: 100,
        clientHeight: 100,
        scrollHeight: 400,
      });
      document.body.append(target);
      const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
        config: {
          axes: 'vertical',
          projection: 'system',
          endFollow: { mode: 'off' },
        },
        projection: 'system',
        onFacts: () => {},
      });

      wrapper.dispatchEvent(new Event(eventType));

      expect(frames.pending()).toBe(0);
      lease.dispose();
    }
  );

  it('cleans canceled descendant reflow listeners on disposal', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const wrapper = document.createElement('div');
    target.append(wrapper);
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const lease = attachEndFollow(target, []);
    frames.runAll();

    lease.dispose();
    wrapper.dispatchEvent(new Event('animationcancel'));

    expect(frames.pending()).toBe(0);
  });

  it('rejects an end application that host clamping leaves away from end', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    let scrollTop = 0;
    Object.defineProperty(target, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = Math.min(200, value);
      },
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);

    frames.runAll();

    expect(target.scrollTop).toBe(200);
    expect(snapshots.at(-1)?.vertical.atEnd).toBe(false);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'paused',
      requestStatus: 'rejected',
    });
    lease.dispose();
  });

  it('observes descendant resource loads beneath a fixed direct wrapper', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const wrapper = document.createElement('div');
    const image = document.createElement('img');
    wrapper.append(image);
    target.append(wrapper);
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
    image.dispatchEvent(new Event('load'));

    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it('observes web-font reflow beneath a fixed direct wrapper', () => {
    const frames = installFrameHarness();
    const fonts = installFontHarness();
    const target = document.createElement('div');
    const wrapper = document.createElement('div');
    const text = document.createTextNode('measure me');
    wrapper.append(text);
    target.append(wrapper);
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
    fonts.dispatch('loadingdone');

    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it('does not observe font loading when end-follow is off', () => {
    const fonts = installFontHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);

    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'off' },
      },
      projection: 'system',
      onFacts: () => {},
    });

    expect(fonts.listeners().size).toBe(0);
    lease.dispose();
  });

  it('makes a pending follow cancellable before publishing it to watchers', () => {
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
    let interruptPending = false;
    let lease!: ScrollSurfaceHostLease;
    lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => {
        snapshots.push(snapshot);
        if (interruptPending && snapshot.endFollow.state === 'pending') {
          interruptPending = false;
          lease.request({ kind: 'by', axis: 'vertical', delta: -50 });
        }
      },
    });
    frames.runAll();

    interruptPending = true;
    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));

    expect(frames.pending()).toBe(0);
    expect(target.scrollTop).toBe(250);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'paused',
      requestStatus: 'rejected',
    });
    lease.dispose();
  });

  it('keeps vertical pending follow while applying an unrelated horizontal request', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    lease.request({ kind: 'by', axis: 'horizontal', delta: 20 });

    expect(target.scrollLeft).toBe(20);
    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow.state).toBe('pending');
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });
  it('preserves a newer rejected nonmatching to-end outcome over pending automatic work', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);

    lease.request({ kind: 'to-end', axis: 'horizontal' });
    expect(snapshots.at(-1)?.endFollow.requestStatus).toBe('rejected');

    frames.runAll();

    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'rejected',
    });
    lease.dispose();
  });

  it('keeps automatic follow progressing after a disabled-axis to-end rejection', () => {
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
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
    lease.request({ kind: 'to-end', axis: 'horizontal' });
    expect(snapshots.at(-1)?.endFollow.requestStatus).toBe('rejected');
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow).toEqual({ state: 'following', requestStatus: 'rejected' });
    updateMetrics({ scrollHeight: 600 });
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(500);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('realigns a following lease when reflow only changes the offset', () => {
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
    expect(target.scrollTop).toBe(300);

    target.scrollTop = 250;
    window.dispatchEvent(new Event('resize'));

    expect(frames.pending()).toBe(1);
    frames.runAll();

    expect(target.scrollTop).toBe(300);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    lease.dispose();
  });

  it('rejects nonmatching to-end without disabling the configured follow axis', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    lease.request({ kind: 'to-end', axis: 'horizontal' });
    expect(frames.pending()).toBe(0);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'rejected',
    });

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow.state).toBe('following');
    lease.dispose();
  });

  it('observes nested append growth beneath a fixed direct wrapper', async () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const wrapper = document.createElement('div');
    target.append(wrapper);
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
    wrapper.append(document.createElement('div'));
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(frames.pending()).toBe(1);
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    lease.dispose();
  });

  it.each(['characterData', 'attribute'] as const)(
    'observes nested %s growth beneath a fixed direct wrapper',
    async (mutationKind) => {
      const frames = installFrameHarness();
      const target = document.createElement('div');
      const wrapper = document.createElement('div');
      const text = document.createTextNode('stream');
      wrapper.append(text);
      target.append(wrapper);
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
      if (mutationKind === 'characterData') text.data = 'stream update';
      else wrapper.setAttribute('data-expanded', 'true');
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(frames.pending()).toBe(1);
      frames.runAll();
      expect(target.scrollTop).toBe(400);
      lease.dispose();
    }
  );

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

  it('does not revive observers timers or requests from a disposed lease', () => {
    vi.useFakeTimers();
    const frames = installFrameHarness();
    let resizeCallback: ResizeObserverCallback | undefined;
    let mutationCallback: MutationCallback | undefined;
    let resizeObserveCount = 0;
    let mutationObserveCount = 0;
    class RecordingResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {
        resizeObserveCount += 1;
      }
      disconnect() {}
    }
    class RecordingMutationObserver {
      constructor(callback: MutationCallback) {
        mutationCallback = callback;
      }
      observe() {
        mutationObserveCount += 1;
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RecordingResizeObserver);
    vi.stubGlobal('MutationObserver', RecordingMutationObserver);
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
    target.dispatchEvent(new Event('scroll'));
    const reportCount = snapshots.length;

    lease.dispose();
    const resizeObserveAfterDispose = resizeObserveCount;
    const mutationObserveAfterDispose = mutationObserveCount;
    resizeCallback?.([], {} as ResizeObserver);
    const emptyNodes = document.createDocumentFragment().childNodes;
    const mutationRecord: MutationRecord = {
      type: 'childList',
      target,
      addedNodes: emptyNodes,
      removedNodes: emptyNodes,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
    };
    mutationCallback?.([mutationRecord], {} as MutationObserver);
    vi.runAllTimers();
    lateFrame?.(performance.now());

    expect(resizeObserveCount).toBe(resizeObserveAfterDispose);
    expect(mutationObserveCount).toBe(mutationObserveAfterDispose);
    expect(snapshots).toHaveLength(reportCount);
    expect(target.scrollTop).toBe(0);
  });
  it('keeps following when a non-end request is clamped at the end', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    installMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    let scrollTop = 300;
    Object.defineProperty(target, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: () => {
        scrollTop = 300;
      },
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = attachEndFollow(target, snapshots);
    frames.runAll();

    lease.request({ kind: 'by', axis: 'vertical', delta: -50 });

    expect(target.scrollTop).toBe(300);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    lease.dispose();
  });

  it('rebinds a coalesced frame after a newer matching to-end request', () => {
    const frames = installFrameHarness();
    const target = document.createElement('div');
    const updateMetrics = installMetrics(target, {
      clientWidth: 300,
      scrollWidth: 300,
      clientHeight: 100,
      scrollHeight: 400,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const lease = createWebScrollSurfaceHost(target, { moveGestureHost }).attach({
      config: {
        axes: 'both',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });
    frames.runAll();

    updateMetrics({ scrollHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    lease.request({ kind: 'to-end', axis: 'horizontal' });
    lease.request({ kind: 'to-end', axis: 'vertical' });

    expect(frames.pending()).toBe(1);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'pending',
      requestStatus: 'pending',
    });
    frames.runAll();
    expect(target.scrollTop).toBe(400);
    expect(snapshots.at(-1)?.endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
    lease.dispose();
  });

  it('retains reader intent until the final pointer contact ends', () => {
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
    const first = new PointerEvent('pointerdown', { bubbles: true });
    const second = new PointerEvent('pointerdown', { bubbles: true });
    const firstUp = new PointerEvent('pointerup');
    Object.defineProperties(first, { pointerId: { value: 1 } });
    Object.defineProperties(second, { pointerId: { value: 2 } });
    Object.defineProperties(firstUp, { pointerId: { value: 1 } });

    target.dispatchEvent(first);
    target.dispatchEvent(second);
    window.dispatchEvent(firstUp);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientY: -50 }));
    target.scrollTop = 200;
    target.dispatchEvent(new Event('scroll'));

    expect(snapshots.at(-1)?.endFollow.state).toBe('paused');
    lease.dispose();
  });
});
