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
