import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/slider';
import * as shadcn from '../../shadcn/src/slider';
import * as brutalist from '../../brutalist/src/slider';
import * as bootstrap from '../../bootstrap-2-3-2/src/slider';
import * as glass from '../../liquid-glass/src/slider';
import { fieldRoot } from '../src/field';
const families = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': glass };
for (const group of Object.values(families))
  for (const p of Object.values(group))
    if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
AdaptToWebComponent(fieldRoot);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const pointer = (type: string, props: PointerEventInit = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 60,
    clientY: 6,
    ...props,
  });
async function fixture(family: string, field: boolean, props: Record<string, unknown> = {}) {
  const root = document.createElement(`${family}-slider-root`) as any;
  const track = document.createElement(`${family}-slider-track`) as any;
  const thumb = document.createElement(
    `${family}-slider-${field ? 'field-thumb' : 'thumb'}`
  ) as any;
  setElementProps(root, { defaultValue: 25, ...props });
  track.append(thumb);
  root.append(track);
  if (field) {
    const owner = document.createElement('base-field-root');
    owner.append(root);
    document.body.append(owner);
  } else document.body.append(root);
  await flush();
  track.getBoundingClientRect = () => new DOMRect(10, 0, 200, 12);
  thumb.getBoundingClientRect = () => new DOMRect(46, -8, 28, 28);
  return { root, track, thumb, facts: thumb.getExposes() };
}
for (const family of Object.keys(families))
  for (const field of [false, true]) {
    it(`${family} thumb facts follow the accepted Track session, field=${field}`, async () => {
      const f = await fixture(family, field);
      expect(f.facts.hovered.get()).toBe(false);
      expect(f.facts.pressed.get()).toBe(false);
      f.thumb.dispatchEvent(pointer('pointerenter'));
      await flush();
      expect(f.facts.hovered.get()).toBe(true);
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.root.getExposes().dragging.get()).toBe(true);
      expect(f.facts.pressed.get()).toBe(true);
      f.thumb.dispatchEvent(pointer('pointerleave', { clientX: 100 }));
      await flush();
      expect(f.facts.hovered.get()).toBe(false);
      expect(f.facts.pressed.get()).toBe(true); // captured drag survives leaving the thumb
      f.track.dispatchEvent(pointer('pointerup', { clientX: 160 }));
      await flush();
      expect(f.root.getExposes().dragging.get()).toBe(false);
      expect(f.facts.pressed.get()).toBe(false);
      expect(f.root.getExposes().value.get()).toBe(75);
      f.thumb.dispatchEvent(pointer('pointerenter'));
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.facts.pressed.get()).toBe(true);
      f.track.dispatchEvent(pointer('lostpointercapture'));
      await flush();
      expect(f.root.getExposes().dragging.get()).toBe(false);
      expect(f.facts.pressed.get()).toBe(false);
      expect(f.facts.hovered.get()).toBe(false);
      expect(f.root.getExposes().value.get()).toBe(75); // cancel restores accepted start
      f.thumb.getExposes().focusSelf();
      await flush();
      f.thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(100);
      expect(f.facts.pressed.get()).toBe(false);
    });
    it(`${family} clears facts on policy, blur and unmount without changing controlled ownership, field=${field}`, async () => {
      const f = await fixture(family, field, { value: 25 });
      f.thumb.dispatchEvent(pointer('pointerenter'));
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.facts.pressed.get()).toBe(true);
      setElementProps(f.root, { value: 25, disabled: true });
      await flush();
      expect(f.facts.pressed.get()).toBe(false);
      expect(f.facts.hovered.get()).toBe(false);
      f.thumb.dispatchEvent(pointer('pointerenter'));
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.facts.hovered.get()).toBe(false);
      expect(f.facts.pressed.get()).toBe(false);
      setElementProps(f.root, { value: 25, readOnly: true });
      await flush();
      f.thumb.dispatchEvent(pointer('pointerenter'));
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.facts.hovered.get()).toBe(true);
      expect(f.facts.pressed.get()).toBe(false);
      setElementProps(f.root, { value: 25 });
      await flush();
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(f.facts.pressed.get()).toBe(true);
      window.dispatchEvent(new Event('blur'));
      await flush();
      expect(f.facts.pressed.get()).toBe(false);
      expect(f.facts.hovered.get()).toBe(false);
      expect(f.root.getExposes().value.get()).toBe(25);
      f.thumb.dispatchEvent(pointer('pointerenter'));
      f.thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      const parent = f.root.parentElement!;
      f.root.remove();
      await flush();
      expect(() => f.facts.pressed.get()).toThrow(/terminal disposal/);
      parent.append(f.root);
      await flush();
      expect(f.thumb.getExposes().pressed.get()).toBe(false);
    });
  }

it('ordinary Slider method lookup preserves invalid live-domain errors', async () => {
  const { sliderMethod } = await import('../src/slider/shared');
  const error = Object.assign(new Error('invalid live claim'), { code: 'ANATOMY_CLAIM_INVALID' });
  expect(() =>
    sliderMethod(
      {
        anatomy: {
          partsOf() {
            throw error;
          },
        },
      } as any,
      'requestValue',
      20
    )
  ).toThrow(error);
});
for (const field of [false, true])
  it(`retiring the Track cancels the existing Root session, field=${field}`, async () => {
    const f = await fixture('base', field);
    f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    await flush();
    expect(f.root.getExposes().dragging.get()).toBe(true);
    expect(f.root.getExposes().value.get()).toBe(45);
    f.track.remove();
    await flush();
    expect(f.root.getExposes().dragging.get()).toBe(false);
    expect(f.root.getExposes().value.get()).toBe(25);
  });

for (const family of Object.keys(families))
  for (const field of [false, true]) {
    it(`${family} retiring and restoring Thumb revokes the old pointer lease, field=${field}`, async () => {
      const f = await fixture(family, field);
      const commits: unknown[] = [];
      f.root.addEventListener('valueCommit', (e: Event) => commits.push(e));
      f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(45);
      f.thumb.remove();
      await flush();
      expect(f.root.getExposes().beginInteraction()).toBe(false);
      expect(f.root.getExposes().dragging.get()).toBe(false);
      expect(f.root.getExposes().value.get()).toBe(25);
      for (const type of ['pointermove', 'pointerup', 'pointerdown', 'pointermove', 'pointerup'])
        f.track.dispatchEvent(pointer(type, { clientX: 180 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(25);
      expect(f.root.getExposes().dragging.get()).toBe(false);
      expect(commits).toHaveLength(0);
      f.track.append(f.thumb);
      await flush();
      f.track.dispatchEvent(pointer('pointermove', { clientX: 180 }));
      f.track.dispatchEvent(pointer('pointerup', { clientX: 180 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(25);
      expect(commits).toHaveLength(0);
      f.thumb.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 100 }));
      f.track.dispatchEvent(pointer('pointerup', { pointerId: 8, clientX: 160 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(75);
      expect(f.root.getExposes().dragging.get()).toBe(false);
      expect(commits).toHaveLength(1);
    });
    it(`${family} reset revokes capture before the next fresh gesture, field=${field}`, async () => {
      const f = await fixture(family, field);
      f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
      await flush();
      f.root.getExposes().resetValue();
      await flush();
      f.track.dispatchEvent(pointer('pointermove', { clientX: 180 }));
      f.track.dispatchEvent(pointer('pointerup', { clientX: 180 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(25);
      expect(f.root.getExposes().dragging.get()).toBe(false);
      f.thumb.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 100 }));
      f.track.dispatchEvent(pointer('pointerup', { pointerId: 8, clientX: 160 }));
      await flush();
      expect(f.root.getExposes().value.get()).toBe(75);
    });
    for (const part of ['track', 'root'])
      it(`${family} ${part} retirement and reentry rejects old samples, field=${field}`, async () => {
        const f = await fixture(family, field);
        f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
        await flush();
        const node = f[part as 'track' | 'root'];
        const parent = node.parentElement!;
        node.remove();
        await flush();
        parent.append(node);
        await flush();
        f.track.dispatchEvent(pointer('pointermove', { clientX: 180 }));
        f.track.dispatchEvent(pointer('pointerup', { clientX: 180 }));
        await flush();
        expect(f.root.getExposes().value.get()).toBe(25);
        expect(f.root.getExposes().dragging.get()).toBe(false);
        f.thumb.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 100 }));
        f.track.dispatchEvent(pointer('pointerup', { pointerId: 8, clientX: 160 }));
        await flush();
        expect(f.root.getExposes().value.get()).toBe(75);
      });
  }
for (const policy of ['disabled', 'readOnly'])
  it(`Field policy ${policy} toggle cancels rather than resumes the old pointer lease`, async () => {
    const f = await fixture('base', true);
    f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    await flush();
    setElementProps(f.root.parentElement, { [policy]: true });
    await flush();
    expect(f.root.getExposes().dragging.get()).toBe(false);
    setElementProps(f.root.parentElement, { [policy]: false });
    await flush();
    f.track.dispatchEvent(pointer('pointermove', { clientX: 180 }));
    f.track.dispatchEvent(pointer('pointerup', { clientX: 180 }));
    await flush();
    expect(f.root.getExposes().value.get()).toBe(25);
    f.thumb.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 100 }));
    f.track.dispatchEvent(pointer('pointerup', { pointerId: 8, clientX: 160 }));
    await flush();
    expect(f.root.getExposes().value.get()).toBe(75);
  });

for (const field of [false, true])
  for (const cause of ['thumb-retired', 'reset', 'root-cancel'])
    it(`releases the actual Track capture lease on ${cause}, field=${field}`, async () => {
      const f = await fixture('base', field);
      const held = new Set<number>();
      const released: number[] = [];
      f.track.setPointerCapture = (id: number) => held.add(id);
      f.track.hasPointerCapture = (id: number) => held.has(id);
      f.track.releasePointerCapture = (id: number) => {
        held.delete(id);
        released.push(id);
      };
      f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
      await flush();
      expect(held.has(7)).toBe(true);
      if (cause === 'thumb-retired') f.thumb.remove();
      else if (cause === 'reset') f.root.getExposes().resetValue();
      else f.root.getExposes().cancelInteraction();
      await flush();
      expect(held.size).toBe(0);
      expect(released).toEqual([7]);
      expect(f.root.getExposes().value.get()).toBe(25);
    });

for (const field of [false, true])
  it(`keyboard-focused Shadcn captured drag retires with all root providers, field=${field}`, async () => {
    const f = await fixture('shadcn', field);
    f.thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.thumb.getExposes().focusSelf();
    await flush();
    const external = document.createElement('button');
    document.body.append(external);
    external.focus();
    await flush();
    f.thumb.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    await flush();
    expect(f.facts.pressed.get()).toBe(true);
    expect(f.facts.focusVisible.get()).toBe(true);
    document.body.replaceChildren();
    await flush();
  });
