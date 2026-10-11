import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxisInputConfig, AxisInputHostBinding, AxisInputSample } from '@proto.ui/core';
import { createWebAxisInputHost } from '../src/gestures/web-axis-input-host';

const config: AxisInputConfig = {
  axis: 'horizontal',
  direction: 'ltr',
  disabled: false,
  readOnly: false,
  reverse: false,
};
function target(left = 10, top = 20, width = 200, height = 100) {
  const el = document.createElement('div');
  document.body.append(el);
  el.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect;
  const captured = new Set<number>();
  Object.assign(el, {
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  });
  return el;
}
function pointer(
  el: HTMLElement,
  type: string,
  clientX = 60,
  clientY = 45,
  extra: PointerEventInit = {}
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
    clientX,
    clientY,
    ...extra,
  });
  el.dispatchEvent(event);
  return event;
}
afterEach(() => document.body.replaceChildren());

describe('Web normalized axis input', () => {
  it('maps descendant input into bounded position and unclamped dimensionless deltas', () => {
    const input = target();
    const thumb = document.createElement('span');
    input.append(thumb);
    const samples: AxisInputSample[] = [];
    const lease = createWebAxisInputHost().attach({
      inputTarget: input,
      geometryTarget: input,
      config,
      onSample: (sample) => samples.push(sample),
    });
    pointer(thumb, 'pointerdown');
    pointer(input, 'pointermove', 160);
    pointer(input, 'pointerup', 310);
    expect(samples).toEqual([
      { phase: 'start', position: 0.25, delta: 0, totalDelta: 0 },
      { phase: 'move', position: 0.75, delta: 0.5, totalDelta: 0.5 },
      { phase: 'end', position: 1, delta: 0.75, totalDelta: 1.25 },
    ]);
    expect(JSON.stringify(samples)).not.toMatch(
      /clientX|pointerId|timestamp|inputTarget|HTMLElement/
    );
    lease.dispose();
  });
  it.each([
    ['horizontal', 'rtl', false, 0.75, -0.5],
    ['vertical', 'ltr', true, 0.75, -0.5],
    ['horizontal', 'rtl', true, 0.25, 0.5],
  ] as const)('maps %s %s reverse=%s', (axis, direction, reverse, position, delta) => {
    const input = target();
    const samples: AxisInputSample[] = [];
    const lease = createWebAxisInputHost().attach({
      inputTarget: input,
      geometryTarget: input,
      config: { ...config, axis, direction, reverse },
      onSample: (s) => samples.push(s),
    });
    pointer(input, 'pointerdown');
    pointer(input, 'pointermove', 160, 95);
    expect(samples[0]).toMatchObject({ position });
    expect(samples[1]).toMatchObject({ delta });
    lease.dispose();
  });
  it('rejects nonprimary, readonly, disabled and invalid-geometry starts', () => {
    const input = target();
    const onSample = vi.fn();
    const binding = { inputTarget: input, geometryTarget: input, config, onSample };
    const lease = createWebAxisInputHost().attach(binding);
    pointer(input, 'pointerdown', 60, 45, { isPrimary: false });
    pointer(input, 'pointerdown', 60, 45, { button: 1 });
    input.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
    pointer(input, 'pointerdown');
    input.getBoundingClientRect = () => ({ left: NaN, width: 100 }) as DOMRect;
    pointer(input, 'pointerdown');
    lease.update({ ...binding, config: { ...config, disabled: true } });
    pointer(input, 'pointerdown');
    lease.update({ ...binding, config: { ...config, readOnly: true } });
    pointer(input, 'pointerdown');
    expect(onSample).not.toHaveBeenCalled();
    lease.dispose();
  });
  it('cancels on disable and restores defaults, without committing late input', () => {
    const input = target();
    input.style.touchAction = 'pan-y';
    const samples: AxisInputSample[] = [];
    const binding = {
      inputTarget: input,
      geometryTarget: input,
      config,
      onSample: (s: AxisInputSample) => samples.push(s),
    };
    const lease = createWebAxisInputHost().attach(binding);
    pointer(input, 'pointerdown');
    lease.update({ ...binding, config: { ...config, disabled: true } });
    pointer(input, 'pointerup', 210);
    expect(samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    expect(samples[1]).toEqual({ phase: 'cancel', reason: 'disabled' });
    expect(input.style.touchAction).toBe('pan-y');
    lease.dispose();
  });
  it('cancels replacing geometry or losing geometry independently of input', async () => {
    const input = target();
    const geometry = target();
    const replacement = target();
    const samples: AxisInputSample[] = [];
    const binding = {
      inputTarget: input,
      geometryTarget: geometry,
      config,
      onSample: (s: AxisInputSample) => samples.push(s),
    };
    const lease = createWebAxisInputHost().attach(binding);
    pointer(input, 'pointerdown');
    lease.update({ ...binding, geometryTarget: replacement });
    expect(samples[1]).toEqual({ phase: 'cancel', reason: 'target-replaced' });
    pointer(input, 'pointerdown');
    replacement.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(samples.at(-1)).toEqual({ phase: 'cancel', reason: 'target-detached' });
    pointer(input, 'pointerup');
    expect(samples).toHaveLength(4);
    lease.dispose();
  });
  it('uses start-time span through layout changes and cancels unusable geometry', () => {
    const input = target();
    const samples: AxisInputSample[] = [];
    const lease = createWebAxisInputHost().attach({
      inputTarget: input,
      geometryTarget: input,
      config,
      onSample: (s) => samples.push(s),
    });
    pointer(input, 'pointerdown');
    input.getBoundingClientRect = () => ({ left: 10, width: 400 }) as DOMRect;
    pointer(input, 'pointermove', 160);
    expect(samples[1]).toMatchObject({ delta: 0.5 });
    input.getBoundingClientRect = () => ({ left: 10, width: 0 }) as DOMRect;
    pointer(input, 'pointermove', 170);
    pointer(input, 'pointerup');
    expect(samples.at(-1)).toEqual({ phase: 'cancel', reason: 'invalid-geometry' });
    lease.dispose();
  });
  it('does not resurrect a lease disposed reentrantly from cancellation', () => {
    const input = target();
    const replacement = target();
    const samples: AxisInputSample[] = [];
    const binding: AxisInputHostBinding = {
      inputTarget: input,
      geometryTarget: input,
      config,
      onSample: (s) => {
        samples.push(s);
        if (s.phase === 'cancel') lease.dispose();
      },
    };
    const lease = createWebAxisInputHost().attach(binding);
    pointer(input, 'pointerdown');
    lease.update({ ...binding, inputTarget: replacement });
    pointer(replacement, 'pointerdown');
    expect(samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
    expect(input.style.touchAction).toBe('');
    expect(replacement.style.touchAction).toBe('');
  });
});

// T-AXIS-INPUT-CONTACT-BASIS-0001-CASE-EXTENT
// T-AXIS-INPUT-CONTACT-BASIS-0001-CASE-LIFETIME
describe('opt-in physical extent basis', () => {
  const leases: { dispose(): void }[] = [];
  afterEach(() => {
    leases.splice(0).forEach((lease) => lease.dispose());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function frames() {
    let id = 0;
    const pending = new Map<number, FrameRequestCallback>();
    const seen: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
      seen.push(fn);
      pending.set(++id, fn);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
      pending.delete(key);
    });
    return {
      pending,
      seen,
      tick() {
        const jobs = [...pending.values()];
        pending.clear();
        jobs.forEach((fn) => fn(0));
      },
    };
  }
  function fixture(extra: Partial<AxisInputConfig> = {}) {
    const input = target();
    const samples: AxisInputSample[] = [];
    let rect = { left: 10, top: 20, width: 200, height: 100 };
    input.getBoundingClientRect = () => rect as DOMRect;
    const binding: AxisInputHostBinding = {
      inputTarget: input,
      geometryTarget: input,
      config: { ...config, contactBasis: 'cancel-on-extent-change', ...extra },
      onSample: (s) => samples.push(s),
    };
    const lease = createWebAxisInputHost().attach(binding);
    leases.push(lease);
    return {
      input,
      samples,
      binding,
      lease,
      set: (patch: Partial<typeof rect>) => {
        rect = { ...rect, ...patch };
      },
    };
  }
  it.each([200.0001, 400])(
    'cancels an idle captured contact for strict span change to %s',
    (width) => {
      const f = frames();
      const h = fixture();
      expect(f.pending.size).toBe(0);
      pointer(h.input, 'pointerdown');
      expect(h.input.hasPointerCapture(1)).toBe(true);
      h.set({ width });
      f.tick();
      expect(h.samples).toHaveLength(2);
      expect(h.samples[1]).toEqual({ phase: 'cancel', reason: 'basis-changed' });
      expect(h.input.hasPointerCapture(1)).toBe(false);
      expect(f.pending.size).toBe(0);
      pointer(h.input, 'pointerup');
      expect(h.samples).toHaveLength(2);
      h.lease.dispose();
    }
  );
  it('keeps translation and same-span frames live, with fixed start normalization', () => {
    const f = frames();
    const h = fixture();
    pointer(h.input, 'pointerdown');
    h.set({ left: 90, top: 250 });
    f.tick();
    f.tick();
    expect(h.samples.map((s) => s.phase)).toEqual(['start']);
    pointer(h.input, 'pointermove', 160);
    expect(h.samples[1]).toMatchObject({ phase: 'move', delta: 0.5 });
    pointer(h.input, 'pointerup', 160);
    expect(f.pending.size).toBe(0);
    h.lease.dispose();
  });
  it.each(['pointermove', 'pointerup'])(
    'checks extent before %s even before the next frame',
    (type) => {
      const f = frames();
      const h = fixture();
      pointer(h.input, 'pointerdown');
      h.set({ width: 300 });
      pointer(h.input, type, 160);
      expect(h.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
      expect(h.samples[1]).toEqual({ phase: 'cancel', reason: 'basis-changed' });
      expect(f.pending.size).toBe(0);
      h.lease.dispose();
    }
  );
  it.each([{ axis: 'vertical', reverse: true }, { direction: 'rtl' }] as const)(
    'keeps direction policy independent (%s)',
    (extra) => {
      const f = frames();
      const h = fixture(extra);
      pointer(h.input, 'pointerdown');
      h.set('axis' in extra && extra.axis === 'vertical' ? { height: 100.1 } : { width: 200.1 });
      f.tick();
      expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'basis-changed' });
      h.lease.dispose();
    }
  );
  it('rejects unsupported sampling before accepting a contact', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    try {
      const h = fixture();
      pointer(h.input, 'pointerdown');
      pointer(h.input, 'pointerup');
      expect(h.samples).toEqual([]);
      expect(h.input.hasPointerCapture(1)).toBe(false);
      h.lease.dispose();
    } finally {
      if (descriptor) Object.defineProperty(window, 'requestAnimationFrame', descriptor);
      else Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  });
  it('does not let an old frame cancel a fresh contact and cleans up reentrant disposal', () => {
    const f = frames();
    const h = fixture();
    pointer(h.input, 'pointerdown');
    const stale = f.seen[0];
    pointer(h.input, 'pointerup');
    pointer(h.input, 'pointerdown');
    h.set({ width: 300 });
    stale?.(0);
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'end', 'start']);
    h.lease.update({
      ...h.binding,
      onSample(s) {
        h.samples.push(s);
        if (s.phase === 'cancel') h.lease.dispose();
      },
    });
    // The accepted contact keeps its start callback; use a fresh contact for the new callback.
    pointer(h.input, 'pointerup');
    pointer(h.input, 'pointerdown');
    h.set({ width: 400 });
    f.tick();
    expect(f.pending.size).toBe(0);
    expect(h.input.hasPointerCapture(1)).toBe(false);
    const count = h.samples.length;
    pointer(h.input, 'pointerdown');
    expect(h.samples).toHaveLength(count);
    h.lease.dispose();
  });
  it('ignores an equal policy, rejects invalid updates and cancels a changed policy once', () => {
    const f = frames();
    const h = fixture();
    pointer(h.input, 'pointerdown');
    h.lease.update({ ...h.binding, config: { ...h.binding.config } });
    expect(h.samples).toHaveLength(1);
    expect(f.pending.size).toBe(1);
    expect(() =>
      h.lease.update({ ...h.binding, config: { ...h.binding.config, contactBasis: 'bad' as any } })
    ).toThrow(/contactBasis/);
    expect(h.samples).toHaveLength(1);
    expect(f.pending.size).toBe(1);
    h.lease.update({
      ...h.binding,
      config: { ...h.binding.config, contactBasis: 'preserve-start' },
    });
    expect(h.samples[1]).toEqual({ phase: 'cancel', reason: 'configuration-changed' });
    expect(f.pending.size).toBe(0);
    pointer(h.input, 'pointerup');
    expect(h.samples).toHaveLength(2);
    h.lease.dispose();
  });
  it('cancels detached or invalid geometry on a held frame without a stale end', () => {
    const f = frames();
    const h = fixture();
    pointer(h.input, 'pointerdown');
    h.set({ width: 0 });
    f.tick();
    expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'invalid-geometry' });
    h.set({ width: 200 });
    pointer(h.input, 'pointerdown');
    h.input.remove();
    f.tick();
    expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'target-detached' });
    expect(f.pending.size).toBe(0);
    expect(h.input.hasPointerCapture(1)).toBe(false);
    h.lease.dispose();
  });
  it('ignores a queued detach observer from a previous contact', () => {
    const observers: { callback: MutationCallback; observer: MutationObserver }[] = [];
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(callback: MutationCallback) {
          observers.push({ callback, observer: this as unknown as MutationObserver });
        }
        observe() {}
        disconnect() {}
      }
    );
    frames();
    const h = fixture();
    pointer(h.input, 'pointerdown');
    // Move owns its own first observer; AxisInput installs the second observer at onStart.
    expect(observers).toHaveLength(2);
    const old = observers[1];
    pointer(h.input, 'pointerup');
    pointer(h.input, 'pointerdown');
    expect(observers).toHaveLength(4);
    h.input.remove();
    old.callback([], old.observer);
    expect(h.samples.map((s) => s.phase)).toEqual(['start', 'end', 'start']);
    const current = observers[3];
    current.callback([], current.observer);
    expect(h.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'target-detached' });
    h.lease.dispose();
  });
  it('preserves default resizing without allocating contact frames', () => {
    const f = frames();
    const h = fixture({ contactBasis: undefined });
    pointer(h.input, 'pointerdown');
    h.set({ width: 400 });
    pointer(h.input, 'pointermove', 160);
    expect(h.samples[1]).toMatchObject({ phase: 'move', delta: 0.5 });
    expect(f.pending.size).toBe(0);
    h.lease.dispose();
  });
});
