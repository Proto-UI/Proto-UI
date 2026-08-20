import { describe, expect, it } from 'vitest';
import type { OwnedStateHandle, Prototype } from '@proto.ui/core';

import { createMountedVueAdapter, flushVue } from '../utils/vue';

describe('contract: adapter-vue / required State runtime (v0)', () => {
  it('retains State mutation without rendering until the Adapter update entry is used', async () => {
    let count!: OwnedStateHandle<number>;
    const proto: Prototype = {
      name: 'vue-state-runtime',
      setup(def) {
        count = def.state.numberDiscrete('count', 0);
        return (run) => run.el('div', String(count.get()));
      },
    };

    const mounted = createMountedVueAdapter(proto);
    await flushVue();

    expect(mounted.root?.textContent).toBe('0');
    mounted.vm.invokeInCallbackScope(() => count.set(1));
    await flushVue();
    expect(mounted.root?.textContent).toBe('0');
    mounted.vm.update();
    await flushVue();
    expect(mounted.root?.textContent).toBe('1');

    mounted.unmount();
  });
});
