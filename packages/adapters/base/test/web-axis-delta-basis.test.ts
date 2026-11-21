import { afterEach, expect, it, vi } from 'vitest';
import type { AxisInputConfig, AxisInputSample } from '@proto.ui/core';
import { createWebAxisInputHost } from '../src/gestures/web-axis-input-host';
const config: AxisInputConfig = {
  axis: 'horizontal',
  direction: 'ltr',
  disabled: false,
  readOnly: false,
  reverse: false,
  contactBasis: 'cancel-on-extent-change',
};
const nodes: HTMLElement[] = [];
const leases: { dispose(): void }[] = [];
function target(width: number, height = 100) {
  const el = document.createElement('div');
  document.body.append(el);
  nodes.push(el);
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect;
  return el;
}
function pointer(el: HTMLElement, type: string, x: number, y = 10) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: x,
      clientY: y,
    })
  );
}
function fixture(parts = [100, 200, 180], override: Partial<AxisInputConfig> = {}) {
  const input = target(10),
    geometry = target(500),
    basis = parts.map((width) => target(width));
  const samples: AxisInputSample[] = [];
  const binding = {
    inputTarget: input,
    geometryTarget: geometry,
    deltaBasisTargets: basis,
    config: { ...config, ...override },
    onSample: (sample: AxisInputSample) => samples.push(sample),
  };
  const lease = createWebAxisInputHost().attach(binding);
  leases.push(lease);
  return { input, geometry, basis, samples, binding, lease };
}
afterEach(() => {
  leases.splice(0).forEach((lease) => lease.dispose());
  nodes.splice(0).forEach((node) => node.remove());
  vi.restoreAllMocks();
});
it('normalizes displacement to panel extent while position retains the root interval', () => {
  const f = fixture();
  pointer(f.input, 'pointerdown', 100);
  pointer(f.input, 'pointermove', 148);
  pointer(f.input, 'pointerup', 196);
  expect(f.samples).toEqual([
    { phase: 'start', position: 0.2, delta: 0, totalDelta: 0 },
    { phase: 'move', position: 0.296, delta: 0.1, totalDelta: 0.1 },
    { phase: 'end', position: 0.392, delta: 0.1, totalDelta: 0.2 },
  ]);
});
it('allows collapsed zero-sized parts and reverses logical RTL displacement', () => {
  const f = fixture([0, 480], { direction: 'rtl' });
  pointer(f.input, 'pointerdown', 100);
  pointer(f.input, 'pointerup', 52);
  expect(f.samples.at(-1)).toMatchObject({ phase: 'end', delta: 0.1, totalDelta: 0.1 });
});
it.each([[], [0, 0], [100, NaN], [100, -1]].map((parts) => [parts]))(
  'refuses missing or invalid total extent %j',
  (parts) => {
    const f = fixture(parts);
    pointer(f.input, 'pointerdown', 100);
    expect(f.samples).toEqual([]);
  }
);
it('a redistribution retaining summed extent continues, but a different sum cancels before commit', () => {
  const f = fixture();
  pointer(f.input, 'pointerdown', 100);
  f.basis[0].getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 148, height: 100 }) as DOMRect;
  f.basis[1].getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 152, height: 100 }) as DOMRect;
  pointer(f.input, 'pointermove', 148);
  expect(f.samples.at(-1)).toMatchObject({ phase: 'move', totalDelta: 0.1 });
  f.basis[1].getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 150, height: 100 }) as DOMRect;
  pointer(f.input, 'pointerup', 148);
  expect(f.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'basis-changed' });
  expect(f.samples.filter((s) => s.phase === 'end')).toEqual([]);
});
it('ignores transformed extent summation noise while still cancelling a real subpixel change', () => {
  const f = fixture([126.01406250000001, 180, 205.1859375]);
  f.basis.forEach((part) => {
    part.style.transform = 'matrix(0.9, 0, 0, 0.9, 0, 0)';
  });
  pointer(f.input, 'pointerdown', 100);
  // Both layouts total 568 CSS pixels before the same positive scale. Their
  // floating point sums differ by one ULP after independent part measurement.
  [126.028125, 180, 205.171875].forEach((width, index) => {
    f.basis[index].getBoundingClientRect = () =>
      ({ left: 0, top: 0, width, height: 100 }) as DOMRect;
  });
  pointer(f.input, 'pointermove', 110);
  expect(f.samples.at(-1)).toMatchObject({ phase: 'move' });
  f.basis[0].getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 126.029125, height: 100 }) as DOMRect;
  pointer(f.input, 'pointerup', 110);
  expect(f.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'basis-changed' });
});
it('replacing a basis target retires the old contact without accepting its late end', () => {
  const f = fixture();
  pointer(f.input, 'pointerdown', 100);
  const replacement = target(180);
  f.lease.update({ ...f.binding, deltaBasisTargets: [f.basis[0], f.basis[1], replacement] });
  pointer(f.input, 'pointerup', 148);
  expect(f.samples.map((s) => s.phase)).toEqual(['start', 'cancel']);
  expect(f.samples[1]).toEqual({ phase: 'cancel', reason: 'target-replaced' });
});
it('a detached basis part cancels even while pointer stays still and releases frames', async () => {
  const f = fixture();
  const win = f.geometry.ownerDocument.defaultView!;
  const pending = new Set<number>();
  vi.spyOn(win, 'requestAnimationFrame').mockImplementation(() => {
    pending.add(1);
    return 1;
  });
  vi.spyOn(win, 'cancelAnimationFrame').mockImplementation((id) => {
    pending.delete(id);
  });
  pointer(f.input, 'pointerdown', 100);
  expect(pending.size).toBe(1);
  f.basis[1].remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.samples.at(-1)).toEqual({ phase: 'cancel', reason: 'target-detached' });
  expect(pending.size).toBe(0);
  const count = f.samples.length;
  f.lease.dispose();
  pointer(f.input, 'pointerup', 150);
  expect(f.samples).toHaveLength(count);
});
it('unsupported rotation refuses a misleading summed basis', () => {
  const f = fixture();
  f.basis[0].style.transform = 'rotate(10deg)';
  pointer(f.input, 'pointerdown', 100);
  expect(f.samples).toEqual([]);
});
