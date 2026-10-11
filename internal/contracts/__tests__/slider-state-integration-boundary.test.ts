import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import { sliderValuesRoot, asSliderValuesRoot } from '../../../packages/prototypes/base/src/slider';
AdaptToWebComponent(sliderValuesRoot);
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('actual Root exposes one stable read-only list identity and immutable replaced snapshots', async () => {
  const el = document.createElement(sliderValuesRoot.name) as any;
  setElementProps(el, { defaultValue: [80, 20] });
  document.body.append(el);
  await flush();
  const x = el.getExposes(),
    list = x.values,
    before = list.get();
  expect(list.spec.kind).toBe('number.list');
  expect(Object.isFrozen(before)).toBe(true);
  expect(list.set).toBeUndefined();
  x.requestValues([70, 30]);
  expect(x.values).toBe(list);
  expect(before).toEqual([80, 20]);
  expect(list.get()).toEqual([70, 30]);
  expect(x.getDisplayValue()).toEqual([30, 70]);
});
it('real authored hook exposes its actual list State rather than a synthesized array handle', async () => {
  let h: any;
  const p = definePrototype({
    name: 'test-slider-values-hook-list',
    setup(def) {
      h = asSliderValuesRoot();
      def.props.setDefaults({ defaultValue: [20, 80] });
      return (r) => r.slot();
    },
  });
  AdaptToWebComponent(p);
  const el = document.createElement(p.name) as any;
  document.body.append(el);
  await flush();
  expect(h.stateHandles.values.get()).toEqual([20, 80]);
  el.getExposes().requestValues([30, 70]);
  expect(h.stateHandles.values.get()).toEqual([30, 70]);
});
it('portable prototype source has no raw Props, oracle import or host event escape', () => {
  const root = fs.readFileSync('packages/prototypes/base/src/slider/values-root.proto.ts', 'utf8'),
    parts = fs.readFileSync('packages/prototypes/base/src/slider/values-part-setup.ts', 'utf8');
  expect(root).not.toMatch(/getRaw|watchRaw|isProvided|slider-value-model/);
  expect(root + parts).not.toMatch(
    /document\.|window\.|addEventListener|setTimeout|getBoundingClientRect/
  );
  expect(root).toContain("numberList('values'");
});
