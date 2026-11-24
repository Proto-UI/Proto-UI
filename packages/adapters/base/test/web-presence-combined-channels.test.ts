import { afterEach, expect, it, vi } from 'vitest';
import { tw, type PresentationOwnerRef } from '@proto.ui/core';
import { PUI_PORTAL_PREPARING_ATTR } from '../src/host/view-visibility';
import { createWebPresencePresentationSink } from '../src/motion/web-presence-presentation';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** One CSSOM surface with independent top, opacity and natural-size baselines. */
function fixture() {
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes(': no-preference)'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
  const wrapper = document.createElement('div');
  const el = document.createElement('div');
  wrapper.append(el);
  document.body.append(wrapper);
  Object.assign(el.style, {
    position: 'fixed',
    top: '10%',
    width: '560px',
    height: '120px',
    boxSizing: 'border-box',
    opacity: '0.8',
    overflow: 'auto',
  });
  const measurements: string[] = [];
  let targetReads = 0;
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
    const computed = getStyle(target);
    if (target !== el) return computed;
    targetReads++;
    return new Proxy(computed, {
      get(object, key) {
        if (key === 'blockSize') {
          const constrained = el.style.getPropertyValue('block-size');
          measurements.push(constrained);
          return constrained || '120px';
        }
        return Reflect.get(object, key, object);
      },
    });
  });
  let now = 0,
    ticket = 0,
    revision = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++ticket, callback);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  const outcomes: string[] = [];
  const sink = createWebPresencePresentationSink(el, { queueStyle() {}, requestFlush() {} });
  cleanups.push(() => sink.release(1));
  const owner = {} as PresentationOwnerRef;
  return {
    el,
    wrapper,
    sink,
    frames,
    outcomes,
    measurements,
    reads: () => targetReads,
    commit() {
      sink.commit({
        view: 1,
        revision: ++revision,
        targetRevision: 1,
        style: tw('fixed top-[10%] opacity-80 block'),
        owner: {
          owner,
          revision: 1,
          phase: 'entering',
          attempt: { ownerEpoch: 1, phaseAttempt: 1 },
          completion: 'presentation',
          durationMs: 300,
          timeoutMs: 1000,
        },
        closed: {
          top: { px: 0, rootText: 0, containingBlock: -0.25 },
          opacity: 0,
          blockSize: 0,
        },
        entered: {
          top: { px: 0, rootText: 0, containingBlock: 0.1 },
          opacity: 0.8,
          blockSize: 'intrinsic',
        },
        easing: [0, 0, 1, 1],
        channelEasing: { top: [0, 0, 0.58, 1] },
        bind() {},
        complete: (_, outcome) => outcomes.push(outcome),
      });
    },
    step(time: number) {
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
  };
}

it('keeps top, opacity and intrinsic size leases distinct through one semantic settlement', () => {
  const f = fixture();
  f.commit();
  expect(f.el.style.top).toBe('-250px');
  expect(f.el.style.opacity).toBe('0');
  expect(f.el.style.getPropertyValue('block-size')).toBe('0px');
  expect(f.el.style.overflow).toBe('hidden');
  f.step(16);
  f.step(166);
  expect(Number.parseFloat(f.el.style.top)).toBeCloseTo(-250 + 350 * 0.684643187, 5);
  expect(Number(f.el.style.opacity)).toBeCloseTo(0.4, 8);
  expect(Number.parseFloat(f.el.style.getPropertyValue('block-size'))).toBeCloseTo(60, 8);
  expect(f.measurements.length).toBeGreaterThan(0);
  expect(f.measurements.every((size) => size === '')).toBe(true);
  f.step(316);
  expect(f.outcomes).toEqual(['finished']);
  expect(f.el.style.top).toBe('10%');
  expect(f.el.style.opacity).toBe('0.8');
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.frames.size).toBe(0);
});

it.each([
  { property: 'top', value: '19px' },
  { property: 'opacity', value: '0.3' },
  { property: 'block-size', value: '17px' },
])(
  'preserves a foreign $property owner while releasing the other presentation leases',
  (foreign) => {
    const f = fixture();
    f.commit();
    f.step(16);
    f.step(166);
    f.el.style.setProperty(foreign.property, foreign.value, 'important');
    f.step(200);
    expect(f.outcomes).toEqual(['missing-capability']);
    for (const [property, baseline] of [
      ['top', '10%'],
      ['opacity', '0.8'],
      ['block-size', ''],
      ['overflow', 'auto'],
    ]) {
      expect(f.el.style.getPropertyValue(property)).toBe(
        property === foreign.property ? foreign.value : baseline
      );
      expect(f.el.style.getPropertyPriority(property)).toBe(
        property === foreign.property ? 'important' : ''
      );
    }
    expect(f.frames.size).toBe(0);
  }
);

it('retires all combined leases before stale frame callbacks can repaint the surface', () => {
  const f = fixture();
  f.commit();
  f.step(16);
  const stale = [...f.frames.values()];
  f.sink.release(1);
  const reads = f.reads();
  stale.forEach((callback) => callback(166));
  expect(f.reads()).toBe(reads);
  expect(f.el.style.top).toBe('10%');
  expect(f.el.style.opacity).toBe('0.8');
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  expect(f.outcomes).toEqual([]);
  expect(f.frames.size).toBe(0);
});

it('defers combined geometry and capability classification until the portal is ready', () => {
  const f = fixture();
  f.wrapper.setAttribute(PUI_PORTAL_PREPARING_ATTR, '');
  f.commit();
  expect(f.reads()).toBe(0);
  expect(f.measurements).toEqual([]);
  expect(f.outcomes).toEqual([]);
  expect(f.frames.size).toBe(0);
  expect(f.el.style.top).toBe('10%');
  expect(f.el.style.opacity).toBe('0.8');
  expect(f.el.style.getPropertyValue('block-size')).toBe('');
  expect(f.el.style.overflow).toBe('auto');
  f.wrapper.removeAttribute(PUI_PORTAL_PREPARING_ATTR);
  f.commit();
  expect(f.reads()).toBeGreaterThan(0);
  expect(f.outcomes).toEqual([]);
  expect(f.el.style.top).toBe('-250px');
  expect(f.el.style.opacity).toBe('0');
  expect(f.el.style.getPropertyValue('block-size')).toBe('0px');
  expect(f.el.style.overflow).toBe('hidden');
  expect(f.frames.size).toBe(1);
});
