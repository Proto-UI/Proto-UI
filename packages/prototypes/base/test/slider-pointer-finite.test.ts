import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as slider from '../src/slider';
import { fieldRoot } from '../src/field';
AdaptToWebComponent(fieldRoot);
for (const proto of Object.values(slider))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const limit = Number.MAX_VALUE;
async function fixture(props: Record<string, unknown>, field = false) {
  const root = document.createElement('base-slider-root') as any;
  const track = document.createElement('base-slider-track') as any;
  const thumb = document.createElement(
    field ? 'base-slider-field-thumb' : 'base-slider-thumb'
  ) as any;
  setElementProps(root, props);
  track.append(thumb);
  root.append(track);
  if (field) {
    const owner = document.createElement('base-field-root');
    owner.append(root);
    document.body.append(owner);
  } else document.body.append(root);
  await flush();
  // Synthetic PointerEvents and fixed fixture geometry exercise the actual AxisInput -> Track -> Root path.
  track.getBoundingClientRect = () => ({ left: 10, top: 0, width: 200, height: 100 }) as DOMRect;
  const pointer = (type: string, position: number) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 10 + 200 * position,
    });
  const move = async (position: number) => {
    thumb.dispatchEvent(pointer('pointerdown', position));
    track.dispatchEvent(pointer('pointerup', position));
    await flush();
  };
  return { root, thumb, move };
}
for (const field of [false, true]) {
  it.each([
    [0, -limit, limit / 2],
    [0.25, -limit / 2, 0],
    [0.5, 0, limit / 2],
    [0.75, limit / 2, 0],
    [1, limit, 0],
  ])(
    `finite extreme pointer interpolation, field=${field}, position=%s`,
    async (position, expected, initial) => {
      const f = await fixture({ min: -limit, max: limit, step: 1, defaultValue: initial }, field);
      const proposals: number[] = [];
      f.root.addEventListener('valueChange', (event: CustomEvent) =>
        proposals.push(event.detail.value)
      );
      await f.move(position);
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals.every(Number.isFinite)).toBe(true);
      const actual = f.root.getExposes().value.get();
      if (expected === 0) expect(actual).toBe(0);
      else expect(actual / expected).toBeCloseTo(1, 12);
      expect(f.thumb.getExposes().value.get()).toBe(actual);
      expect(f.root.getExposes().dragging.get()).toBe(false);
    }
  );
}
for (const field of [false, true])
  it(`controlled pointer proposes finite midpoint and waits for owner acceptance, field=${field}`, async () => {
    const props = { min: -limit, max: limit, step: 1, value: limit / 2 };
    const f = await fixture(props, field);
    const proposals: number[] = [];
    f.root.addEventListener('valueChange', (event: CustomEvent) =>
      proposals.push(event.detail.value)
    );
    await f.move(0.5);
    expect(proposals).toContain(0);
    expect(f.root.getExposes().value.get()).toBe(limit / 2);
    setElementProps(f.root, { ...props, value: 0 });
    await flush();
    expect(f.thumb.getExposes().value.get()).toBe(0);
  });
it.each([
  [-3, 3, 0.5, 0.125, -2],
  [0, 10, 0.5, 0.624, 6],
  [0, 11, 3, 1, 11],
  [5, 5, 1, 0.5, 5],
  [0, 2e-323, Number.MIN_VALUE, 0.5, 1e-323],
])(
  'preserves ordinary, equal, and subnormal ranges [%s,%s]',
  async (min, max, step, position, expected) => {
    const f = await fixture({ min, max, step });
    await f.move(position);
    expect(f.root.getExposes().value.get()).toBe(expected);
  }
);

it.each([
  [-limit, limit / 2, 0, -limit],
  [-limit, limit / 2, 0.5, -limit / 4],
  [-limit, limit / 2, 1, limit / 2],
  [-limit / 2, limit, 0, -limit / 2],
  [-limit / 2, limit, 0.5, limit / 4],
  [-limit / 2, limit, 1, limit],
])(
  'interpolates asymmetric overflowing range [%s,%s] at %s',
  async (min, max, position, expected) => {
    const f = await fixture({ min, max, step: 1 });
    await f.move(position);
    expect(Number.isFinite(f.root.getExposes().value.get())).toBe(true);
    expect(f.root.getExposes().value.get() / expected).toBeCloseTo(1, 12);
  }
);
it('retains ordinary negative-zero normalization', async () => {
  const f = await fixture({ min: -0, max: 1, step: 0.5, defaultValue: 1 });
  await f.move(0);
  expect(Object.is(f.root.getExposes().value.get(), 0)).toBe(true);
});
