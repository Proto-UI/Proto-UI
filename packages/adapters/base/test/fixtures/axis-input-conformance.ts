import { expect, it } from 'vitest';
import { createAnatomyFamily, definePrototype, type AxisInputSample } from '@proto.ui/core';
import { asAxisInput } from '@proto.ui/hooks';
import type { ScrollMount, ScrollTree } from './scroll-catalog-conformance';

/** Synthetic geometry only: exercises real Adapter/runtime/anatomy/host/callback routing. */
export function axisInputConformance(
  name: string,
  mount: (tree: ScrollTree[]) => Promise<ScrollMount>
) {
  it(`${name}: normalized host input reaches logical state, with shared keyboard intent and cleanup`, async () => {
    const family = createAnatomyFamily(`axis-fixture-${name}`, {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        track: { cardinality: { min: 1, max: 1 } },
      },
    });
    const samples: AxisInputSample[] = [];
    const values: number[] = [];
    let commits = 0;
    const root = definePrototype({
      name: `axis-root-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
      },
    });
    const track = definePrototype({
      name: `axis-track-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role: 'track' });
        const input = asAxisInput();
        input.configure({ anatomy: family, inputRole: 'track', geometryRole: 'root' });
        const value = def.state.numberRange('fixture-value', 0, { min: 0, max: 1, clamp: true });
        const requestValue = (next: number) => {
          value.set(next);
          values.push(value.get());
        };
        input.on((_run, sample) => {
          samples.push(sample);
          if (sample.phase !== 'cancel') requestValue(sample.position);
          if (sample.phase === 'end') commits++;
        });
        def.lifecycle.onMounted(() => input.sync({ disabled: false }));
        def.event.on('host:disable-axis', () => input.sync({ disabled: true }));
        def.event.on('key.down', (_run, event) => {
          if (event.key === 'ArrowRight') requestValue(0.9);
        });
      },
    });
    const m = await mount([{ proto: root, children: [{ proto: track }] }]);
    let unmounted = false;
    try {
      await m.flush();
      const roots = Array.from(m.host.querySelectorAll<HTMLElement>('[data-pui-root]'));
      expect(roots).toHaveLength(2);
      const [geometry, input] = roots;
      geometry.getBoundingClientRect = () =>
        ({ left: 10, top: 0, width: 200, height: 100 }) as DOMRect;
      input.getBoundingClientRect = () => ({ left: 70, top: 0, width: 20, height: 100 }) as DOMRect;
      const thumb = document.createElement('span');
      input.append(thumb);
      const pointer = (type: string, x: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 3,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          clientX: x,
        });
      await m.dispatch(thumb, pointer('pointerdown', 60));
      await m.dispatch(input, pointer('pointermove', 110));
      await m.dispatch(input, pointer('pointerup', 160));
      await m.flush();
      expect(values).toEqual([0.25, 0.5, 0.75]);
      expect(commits).toBe(1);
      expect(samples.map((s) => s.phase)).toEqual(['start', 'move', 'end']);
      await m.dispatch(input, new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
      expect(values.at(-1)).toBe(0.9);
      await m.dispatch(input, pointer('pointerdown', 60));
      await m.dispatch(input, new Event('disable-axis', { bubbles: true }));
      await m.dispatch(input, pointer('pointerup', 210));
      expect(samples.at(-1)).toEqual({ phase: 'cancel', reason: 'disabled' });
      expect(commits).toBe(1);
      await m.unmount();
      unmounted = true;
      expect(input.style.touchAction).toBe('');
      const before = values.length;
      input.dispatchEvent(pointer('pointerdown', 10));
      expect(values).toHaveLength(before);
    } finally {
      if (!unmounted) await m.unmount();
    }
  });
  it(`${name}: extent cancellation restores a consumer preview without committing and releases frames`, async () => {
    // T-AXIS-INPUT-CONTACT-BASIS-0001-CASE-LIFETIME: synthetic geometry, actual runtime routing.
    const frame = () =>
      new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const family = createAnatomyFamily(`axis-basis-${name}`, {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        track: { cardinality: { min: 1, max: 1 } },
      },
    });
    const samples: AxisInputSample[] = [];
    const accepted = 0.4;
    let preview = accepted;
    let requests = 0;
    const root = definePrototype({
      name: `basis-root-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
      },
    });
    const track = definePrototype({
      name: `basis-track-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role: 'track' });
        const value = def.state.numberRange('preview', accepted, { min: 0, max: 1, clamp: true });
        const input = asAxisInput();
        input.configure({ anatomy: family, inputRole: 'track', geometryRole: 'root' });
        input.on((_run, sample) => {
          samples.push(sample);
          if (sample.phase === 'cancel') value.set(accepted);
          else if (sample.phase === 'end') {
            requests++;
            value.set(accepted);
          } else value.set(sample.position);
          preview = value.get();
        });
        def.lifecycle.onMounted(() =>
          input.sync({ disabled: false, contactBasis: 'cancel-on-extent-change' })
        );
      },
    });
    let m: ScrollMount | undefined;
    let unmounted = false;
    try {
      m = await mount([{ proto: root, children: [{ proto: track }] }]);
      await m.flush();
      const [geometry, input] = Array.from(m.host.querySelectorAll<HTMLElement>('[data-pui-root]'));
      let width = 200;
      geometry.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 100 }) as DOMRect;
      const event = (type: string, x: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 9,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          clientX: x,
        });
      await m.dispatch(input, event('pointerdown', 100));
      expect(preview).toBe(0.5);
      width = 300;
      await frame();
      await frame();
      await m.flush();
      expect(samples.at(-1)).toEqual({ phase: 'cancel', reason: 'basis-changed' });
      expect(preview).toBe(accepted);
      expect(requests).toBe(0);
      await m.dispatch(input, event('pointerup', 250));
      expect(requests).toBe(0);
      await m.dispatch(input, event('pointerdown', 150));
      await m.dispatch(input, event('pointerup', 250));
      expect(requests).toBe(1);
      expect(preview).toBe(accepted);
      await m.dispatch(input, event('pointerdown', 150));
      await m.unmount();
      unmounted = true;
      const count = samples.length;
      width = 400;
      await frame();
      await frame();
      input.dispatchEvent(event('pointerup', 260));
      expect(samples).toHaveLength(count);
    } finally {
      if (m && !unmounted) await m.unmount();
    }
  });
}
