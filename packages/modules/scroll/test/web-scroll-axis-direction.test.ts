import { afterEach, expect, it, vi } from 'vitest';
import type {
  MoveGestureHost,
  MoveGestureHostBinding,
  MoveGestureSample,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import {
  createBoundWebScrollSurfaceHost,
  createWebScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
} from '../src';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
const moveHost: MoveGestureHost = {
  attach() {
    return { update() {}, dispose() {} };
  },
};
function target(direction = 'rtl') {
  const element = document.createElement('div');
  element.style.direction = direction;
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 600 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 400 },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  document.body.append(element);
  return element;
}
function connection(
  onFacts: (snapshot: ScrollSurfaceSnapshot) => void,
  axes: 'horizontal' | 'vertical' | 'both' = 'both'
): ScrollSurfaceHostAttachment {
  return {
    config: { axes, projection: 'system', endFollow: { mode: 'off' } },
    projection: 'system',
    onFacts,
  };
}
const sample = (x: number): MoveGestureSample => ({
  input: 'mouse',
  position: { x, y: 0 },
  delta: { x: 0, y: 0 },
  totalDelta: { x: 0, y: 0 },
  timestamp: 0,
});

it.each(['ltr', 'rtl'])(
  'normalizes %s horizontal facts and all immediate request forms without changing vertical offsets',
  (direction) => {
    const element = target(direction),
      sign = direction === 'rtl' ? -1 : 1;
    let facts: ScrollSurfaceSnapshot;
    const lease = createWebScrollSurfaceHost(element, { moveGestureHost: moveHost }).attach(
      connection((next) => {
        facts = next;
      })
    );
    try {
      lease.request({ kind: 'to', axis: 'horizontal', position: 0.5 });
      expect(element.scrollLeft).toBe(sign * 200);
      expect(facts!.horizontal.position).toBe(0.5);
      lease.request({ kind: 'by', axis: 'horizontal', delta: 50 });
      expect(element.scrollLeft).toBe(sign * 250);
      lease.request({ kind: 'page', axis: 'horizontal', direction: 'before' });
      expect(element.scrollLeft).toBe(sign * 50);
      lease.request({ kind: 'control-drag', axis: 'horizontal', position: 1 });
      expect(element.scrollLeft).toBe(sign * 400);
      expect(facts!.horizontal).toMatchObject({
        atEnd: true,
        canScrollAfter: false,
        canScrollBefore: true,
      });
      lease.request({ kind: 'to', axis: 'vertical', position: 0.5 });
      expect(element.scrollTop).toBe(150);
      element.scrollLeft = sign * 100;
      element.dispatchEvent(new Event('scroll'));
      expect(facts!.horizontal.position).toBe(0.25);
    } finally {
      lease.dispose();
    }
  }
);

it('follows the RTL logical end and recognizes the opposite physical key as reader departure', async () => {
  vi.useFakeTimers();
  const element = target();
  let facts: ScrollSurfaceSnapshot;
  const initial = connection((next) => {
    facts = next;
  }, 'horizontal');
  const lease = createWebScrollSurfaceHost(element, { moveGestureHost: moveHost }).attach({
    ...initial,
    config: { ...initial.config, endFollow: { mode: 'while-at-end', axis: 'horizontal' } },
  });
  try {
    await vi.advanceTimersByTimeAsync(32);
    expect(element.scrollLeft).toBe(-400);
    expect(facts!.endFollow.state).toBe('following');
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    element.scrollLeft = -350;
    element.dispatchEvent(new Event('scroll'));
    expect(facts!.endFollow.state).toBe('paused');
    lease.request({ kind: 'to-end', axis: 'horizontal' });
    await vi.advanceTimersByTimeAsync(32);
    expect(element.scrollLeft).toBe(-400);
    expect(facts!.endFollow.requestStatus).toBe('applied');
  } finally {
    lease.dispose();
  }
});

it('projects RTL composed thumbs from the physical right and maps physical drag back to logical position', () => {
  const element = target(),
    track = document.createElement('div'),
    thumb = document.createElement('div');
  track.append(thumb);
  document.body.append(track);
  Object.defineProperty(track, 'clientWidth', { value: 300 });
  track.getBoundingClientRect = () => new DOMRect(0, 0, 300, 10);
  thumb.getBoundingClientRect = () => new DOMRect(200, 0, 100, 10);
  let binding: MoveGestureHostBinding;
  const host: MoveGestureHost = {
    attach(next) {
      binding = next;
      return {
        update(next) {
          binding = next;
        },
        dispose() {},
      };
    },
  };
  const lease = createWebScrollSurfaceHost(element, { moveGestureHost: host }).attach({
    ...connection(() => {}, 'horizontal'),
    projection: 'composed',
    composedChrome: {
      scope: {},
      controls: [{ getAxis: () => 'horizontal', trackTarget: track, thumbTarget: thumb }],
    },
  });
  try {
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('200px');
    binding!.onStart(sample(250));
    binding!.onMove(sample(150));
    binding!.onEnd(sample(150));
    expect(element.scrollLeft).toBe(-200);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('100px');
  } finally {
    lease.dispose();
  }
});

it('admits horizontal system scrolling on a split surface, updates axes and retires the old physical target', () => {
  const boundary = document.createElement('div'),
    element = target();
  boundary.append(element);
  document.body.append(boundary);
  let current: HTMLElement | null = element,
    reports = 0;
  const host = createBoundWebScrollSurfaceHost({
    boundary,
    getTarget: () => current,
    isReady: () => true,
    subscribeTarget: () => () => {},
    moveGestureHost: moveHost,
  });
  const available = host.availability!.get();
  if (available.kind !== 'available') throw new Error('expected split surface');
  const lease = host.attach(
    connection(() => reports++, 'horizontal'),
    available.binding
  );
  expect(element.style.overflowX).toBe('auto');
  expect(element.style.overflowY).toBe('hidden');
  lease.request({ kind: 'to', axis: 'horizontal', position: 1 });
  expect(element.scrollLeft).toBe(-400);
  lease.update(connection(() => reports++, 'vertical'));
  expect(element.style.overflowX).toBe('hidden');
  expect(element.style.overflowY).toBe('auto');
  const before = reports;
  current = null;
  lease.request({ kind: 'to', axis: 'horizontal', position: 0 });
  element.dispatchEvent(new Event('scroll'));
  expect(element.scrollLeft).toBe(-400);
  expect(reports).toBe(before);
  lease.dispose();
  expect(element.style.overflowX).toBe('');
  expect(element.style.overflowY).toBe('');
});
