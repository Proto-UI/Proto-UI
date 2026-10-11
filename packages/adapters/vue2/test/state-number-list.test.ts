import { expect, it } from 'vitest';
import type { OwnedStateHandle, Prototype } from '@proto.ui/core';
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

it('vue2: exposes immutable number.list get/subscribe without scalar DOM mapping or automatic render', async () => {
  let state!: OwnedStateHandle<readonly number[]>;
  const proto: Prototype = {
    name: 'vue2-state-number-list',
    setup(def) {
      state = def.state.numberList('coordinates', [1, 9]);
      def.expose.state('coordinates', state);
      return (run) => run.el('div', state.get().join(','));
    },
  };
  const mounted = createMountedVue2Adapter(proto);
  await flushVue2();
  const api = mounted.vm;
  const external = api.getExposes().coordinates;
  expect(external.spec.kind).toBe('number.list');
  expect(external.get()).toEqual([1, 9]);
  expect(Object.isFrozen(external.get())).toBe(true);
  expect(external.set).toBeUndefined();
  const events: any[] = [];
  const off = external.subscribe((event: any) => events.push(event));
  const before = external.get();
  api.invokeInCallbackScope(() => state.set([1, 9]));
  expect(external.get()).toBe(before);
  expect(events).toHaveLength(0);
  const input = [2, 8];
  api.invokeInCallbackScope(() => state.set(input));
  input[0] = 99;
  await flushVue2();
  expect(external.get()).toEqual([2, 8]);
  expect(events).toHaveLength(1);
  expect(events[0].prev).toEqual([1, 9]);
  expect(Object.isFrozen(events[0].next)).toBe(true);
  expect(mounted.root?.textContent).toBe('1,9');
  api.update();
  await flushVue2();
  expect(mounted.root?.textContent).toBe('2,8');
  expect(mounted.root?.hasAttribute('data-coordinates')).toBe(false);
  expect(mounted.root?.style.getPropertyValue('--pui-coordinates')).toBe('');
  expect(api.getExposes().coordinates).toBe(external);
  off();
  mounted.unmount();
});
