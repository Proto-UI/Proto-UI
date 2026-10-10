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
}
