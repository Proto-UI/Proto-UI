import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef } from '@proto.ui/core';
import { createWebPresencePresentationSink } from '../src/motion/web-presence-presentation';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function fixture() {
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('no-preference'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  const el = document.createElement('div');
  document.body.append(el);
  el.style.overflow = 'auto';
  let natural = 120,
    now = 0,
    ticket = 0;
  const measurements: string[] = [],
    outcomes: string[] = [];
  let duringMeasurement: (() => void) | null = null;
  const frames = new Map<number, FrameRequestCallback>();
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
    const computed = original(target);
    if (target !== el) return computed;
    return new Proxy(computed, {
      get(object, key) {
        if (key === 'blockSize') {
          measurements.push(el.style.getPropertyValue('block-size'));
          const callback = duringMeasurement;
          duringMeasurement = null;
          callback?.();
          return el.style.getPropertyValue('block-size') || `${natural}px`;
        }
        if (key === 'height') return el.style.getPropertyValue('block-size') || `${natural}px`;
        if (key === 'width') return '200px';
        if (key === 'boxSizing') return 'border-box';
        return Reflect.get(object, key, object);
      },
    });
  });
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++ticket, callback);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const sink = createWebPresencePresentationSink(el, { queueStyle() {}, requestFlush() {} });
  cleanups.push(() => sink.release(1));
  sink.commit({
    view: 1,
    revision: 1,
    targetRevision: 1,
    style: tw('block'),
    owner: {
      owner: {} as PresentationOwnerRef,
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 350,
      timeoutMs: 1000,
    },
    closed: { blockSize: 0 },
    entered: { blockSize: 'intrinsic' },
    easing: [0.25, 0.1, 0.25, 1],
    bind() {},
    complete: (_, outcome) => outcomes.push(outcome),
  });
  return {
    el,
    frames,
    measurements,
    outcomes,
    sink,
    natural: (value: number) => {
      natural = value;
    },
    duringMeasurement: (callback: () => void) => {
      duringMeasurement = callback;
    },
    at(time: number) {
      now = time;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(time));
    },
  };
}

it('measures both growth and shrinkage without retaining the constrained block-size or clipping', () => {
  const f = fixture();
  expect(f.el.style.getPropertyValue('block-size')).toBe('0px');
  expect(f.el.style.overflow).toBe('hidden');
  f.at(16);
  f.at(100);
  const displayed = parseFloat(f.el.style.getPropertyValue('block-size'));
  expect(displayed).toBeGreaterThan(0);
  f.natural(260);
  f.at(140);
  f.natural(40);
  f.at(180);
  expect(f.measurements.every((size) => size === '')).toBe(true);
  f.at(600);
  expect(f.outcomes).toEqual(['finished']);
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.frames.size).toBe(0);
});
it('preserves an external size takeover and releases only its own overflow lease', () => {
  const f = fixture();
  f.el.style.setProperty('block-size', '17px');
  f.at(16);
  expect(f.el.style.getPropertyValue('block-size')).toBe('17px');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.outcomes).toEqual(['projection-failed']);
  expect(f.frames.size).toBe(0);
});
it('view retirement restores both leases before stale callbacks can run', () => {
  const f = fixture();
  const stale = [...f.frames.values()];
  f.sink.release(1);
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  const calls = f.measurements.length;
  stale.forEach((callback) => callback(400));
  expect(f.measurements).toHaveLength(calls);
  expect(f.outcomes).toEqual([]);
  expect(f.frames.size).toBe(0);
});
it('cannot reacquire a size lease after retirement reenters the semantic layout read', () => {
  const f = fixture();
  f.duringMeasurement(() => f.sink.release(1));
  f.at(16);
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.frames.size).toBe(0);
  expect(f.outcomes).toEqual([]);
});
it('preserves an external takeover occurring inside the semantic layout read', () => {
  const f = fixture();
  f.duringMeasurement(() => f.el.style.setProperty('block-size', '17px', 'important'));
  f.at(16);
  expect(f.el.style.getPropertyValue('block-size')).toBe('17px');
  expect(f.el.style.getPropertyPriority('block-size')).toBe('important');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.frames.size).toBe(0);
  expect(f.outcomes).toEqual(['projection-failed']);
});
