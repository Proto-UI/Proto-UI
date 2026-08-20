import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MoveGestureHost,
  MoveGestureHostBinding,
  MoveGestureSample,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import { createWebScrollSurfaceHost } from '../src';

function createMoveHarness(): {
  host: MoveGestureHost;
  getBinding(): MoveGestureHostBinding | null;
  getDisposeCount(): number;
} {
  let binding: MoveGestureHostBinding | null = null;
  let disposeCount = 0;
  return {
    host: {
      attach(initialBinding) {
        binding = initialBinding;
        return {
          update(nextBinding) {
            binding = nextBinding;
          },
          dispose() {
            disposeCount++;
            binding = null;
          },
        };
      },
    },
    getBinding: () => binding,
    getDisposeCount: () => disposeCount,
  };
}

function moveSample(x: number, y: number): MoveGestureSample {
  return Object.freeze({
    input: 'mouse',
    position: Object.freeze({ x, y }),
    delta: Object.freeze({ x: 0, y: 0 }),
    totalDelta: Object.freeze({ x: 0, y: 0 }),
    timestamp: 0,
  });
}

function setMetrics(
  target: HTMLElement,
  metrics: {
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
  }
): void {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: metrics.clientWidth },
    scrollWidth: { configurable: true, value: metrics.scrollWidth },
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('module-scroll: Web scroll surface host', () => {
  it('reports normalized facts and applies requests without exposing the target', () => {
    const target = document.createElement('div');
    setMetrics(target, {
      clientWidth: 200,
      scrollWidth: 600,
      clientHeight: 160,
      scrollHeight: 960,
    });
    document.body.append(target);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const move = createMoveHarness();

    const lease = createWebScrollSurfaceHost(target, { moveGestureHost: move.host }).attach({
      config: { axes: 'both', projection: 'system' },
      projection: 'system',
      onFacts: (snapshot) => snapshots.push(snapshot),
    });

    expect(snapshots.at(-1)).toMatchObject({
      axes: 'both',
      horizontal: { position: 0, visibleRatio: 1 / 3, canScrollAfter: true },
      vertical: { position: 0, visibleRatio: 1 / 6, canScrollAfter: true },
      projection: 'system',
    });
    expect(target.getAttribute('role')).toBeNull();
    expect(target.getAttributeNames().some((name) => name.startsWith('aria-'))).toBe(false);

    lease.request({ kind: 'to', axis: 'horizontal', position: 0.5 });
    lease.request({ kind: 'control-drag', axis: 'vertical', position: 0.25 });

    expect(target.scrollLeft).toBe(200);
    expect(target.scrollTop).toBe(200);
    expect(snapshots.at(-1)).toMatchObject({
      horizontal: { position: 0.5, canScrollBefore: true, canScrollAfter: true },
      vertical: { position: 0.25, canScrollBefore: true, canScrollAfter: true },
    });
    lease.dispose();
  });

  it('projects composed chrome policy and restores host styles on disposal', () => {
    const target = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    target.style.overflowY = 'scroll';
    target.style.scrollbarWidth = 'thin';
    document.body.append(target);
    const move = createMoveHarness();

    let reports = 0;
    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost: move.host,
      preference: 'composed',
    }).attach({
      config: { axes: 'vertical', projection: 'auto' },
      projection: 'composed',
      onFacts: () => reports++,
    });

    expect(target.dataset.puiScrollProjection).toBe('composed');
    expect(target.style.overflowX).toBe('hidden');
    expect(target.style.overflowY).toBe('auto');
    expect(target.style.scrollbarWidth).toBe('none');
    const beforeDispose = reports;

    lease.dispose();
    target.dispatchEvent(new Event('scroll'));
    expect(reports).toBe(beforeDispose);
    expect(target.hasAttribute('data-pui-scroll-projection')).toBe(false);
    expect(target.style.overflowY).toBe('scroll');
    expect(target.style.scrollbarWidth).toBe('thin');
  });

  it('projects passive Thumb size and position from the host-owned snapshot', () => {
    const target = document.createElement('div');
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    Object.defineProperty(track, 'clientHeight', { configurable: true, value: 100 });
    track.style.paddingTop = '2px';
    track.style.paddingBottom = '2px';
    thumb.style.height = '7px';
    thumb.style.transform = 'scale(1)';
    track.append(thumb);
    document.body.append(target, track);
    const move = createMoveHarness();

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost: move.host,
      preference: 'composed',
      minThumbSize: 18,
    }).attach({
      config: { axes: 'vertical', projection: 'composed' },
      projection: 'composed',
      composedChrome: {
        scope: {},
        controls: [{ getAxis: () => 'vertical', trackTarget: track, thumbTarget: thumb }],
      },
      onFacts: () => {},
    });

    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('24px');
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('0px');
    expect(thumb.style.height).toBe('var(--proto-ui-scroll-thumb-size)');
    expect(thumb.getAttribute('role')).toBeNull();
    expect(thumb.tabIndex).toBe(-1);

    lease.request({ kind: 'to', axis: 'vertical', position: 0.5 });
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('36px');
    expect(thumb.style.transform).toContain('var(--proto-ui-scroll-thumb-offset)');

    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 100,
    });
    target.ownerDocument.defaultView?.dispatchEvent(new Event('resize'));
    expect(thumb.style.display).toBe('none');

    lease.dispose();
    expect(thumb.style.height).toBe('7px');
    expect(thumb.style.transform).toBe('scale(1)');
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('');
  });

  it('reconciles every direct content resize target across insertion and replacement', async () => {
    const observed = new Set<Element>();
    let resizeCallback: ResizeObserverCallback | undefined;
    let observerInstance: RecordingResizeObserver | undefined;
    class RecordingResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
        observerInstance = this;
      }

      observe(element: Element) {
        observed.add(element);
      }

      unobserve(element: Element) {
        observed.delete(element);
      }

      disconnect() {
        observed.clear();
      }
    }
    const emitResize = (element: Element) => {
      resizeCallback?.(
        [{ target: element } as ResizeObserverEntry],
        observerInstance as unknown as ResizeObserver
      );
    };
    const flushMutations = async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    };
    vi.stubGlobal('ResizeObserver', RecordingResizeObserver);

    const target = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    target.append(first, second);
    track.append(thumb);
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    Object.defineProperty(track, 'clientHeight', { configurable: true, value: 100 });
    track.style.paddingTop = '2px';
    track.style.paddingBottom = '2px';
    document.body.append(target, track);
    const snapshots: ScrollSurfaceSnapshot[] = [];
    const move = createMoveHarness();

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost: move.host,
      preference: 'composed',
    }).attach({
      config: { axes: 'vertical', projection: 'composed' },
      projection: 'composed',
      composedChrome: {
        scope: {},
        controls: [{ getAxis: () => 'vertical', trackTarget: track, thumbTarget: thumb }],
      },
      onFacts: (snapshot) => snapshots.push(snapshot),
    });

    expect(observed).toEqual(new Set([target, first, second, track]));

    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 800,
    });
    emitResize(second);
    expect(snapshots.at(-1)?.vertical.visibleRatio).toBe(1 / 8);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('18px');

    const late = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 200,
    });
    target.append(late);
    await flushMutations();
    expect(observed.has(late)).toBe(true);
    expect(snapshots.at(-1)?.vertical.visibleRatio).toBe(1 / 2);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('48px');

    const replacement = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    first.replaceWith(replacement);
    await flushMutations();
    expect(observed.has(first)).toBe(false);
    expect(observed.has(replacement)).toBe(true);
    expect(observed.has(second)).toBe(true);
    expect(observed.has(late)).toBe(true);
    expect(snapshots.at(-1)?.vertical.visibleRatio).toBe(1 / 4);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('24px');

    lease.dispose();
    expect(observed.size).toBe(0);
  });

  it('maps a host Move Gesture session on Thumb to normalized drag requests', () => {
    const target = document.createElement('div');
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    Object.defineProperty(track, 'clientHeight', { configurable: true, value: 100 });
    track.style.paddingTop = '2px';
    track.style.paddingBottom = '2px';
    track.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;
    thumb.getBoundingClientRect = () => ({ top: 2, left: 0, width: 10, height: 24 }) as DOMRect;
    track.append(thumb);
    document.body.append(target, track);
    const move = createMoveHarness();

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost: move.host,
      preference: 'composed',
    }).attach({
      config: { axes: 'vertical', projection: 'composed' },
      projection: 'composed',
      composedChrome: {
        scope: {},
        controls: [{ getAxis: () => 'vertical', trackTarget: track, thumbTarget: thumb }],
      },
      onFacts: () => {},
    });

    const binding = move.getBinding();
    expect(binding?.target).toBe(thumb);
    expect(binding?.axis).toBe('vertical');
    expect(binding?.shouldStart?.(moveSample(0, 4))).toBe(true);

    binding?.onStart(moveSample(0, 4));
    expect(target.scrollTop).toBe(0);
    binding?.onMove(moveSample(0, 40));
    expect(target.scrollTop).toBe(150);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('36px');

    binding?.onEnd(moveSample(0, 40));
    lease.update({
      config: { axes: 'vertical', projection: 'composed' },
      projection: 'composed',
      onFacts: () => {},
    });
    expect(move.getDisposeCount()).toBe(1);

    lease.dispose();
    expect(move.getDisposeCount()).toBe(1);
  });

  it('rejects Thumb movement when the surface has no overflow', () => {
    const target = document.createElement('div');
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    setMetrics(target, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 100,
    });
    Object.defineProperty(track, 'clientHeight', { configurable: true, value: 100 });
    track.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;
    thumb.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;
    track.append(thumb);
    document.body.append(target, track);
    const move = createMoveHarness();

    const lease = createWebScrollSurfaceHost(target, {
      moveGestureHost: move.host,
      preference: 'composed',
    }).attach({
      config: { axes: 'vertical', projection: 'composed' },
      projection: 'composed',
      composedChrome: {
        scope: {},
        controls: [{ getAxis: () => 'vertical', trackTarget: track, thumbTarget: thumb }],
      },
      onFacts: () => {},
    });

    expect(thumb.style.display).toBe('none');
    expect(move.getBinding()?.shouldStart?.(moveSample(0, 10))).toBe(false);
    expect(target.scrollTop).toBe(0);
    lease.dispose();
  });
});
