import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { createMountedVueAdapterWithOptions, flushVue } from './utils/vue';

describe('adapter-vue: scroll projection', () => {
  it('resolves the adapter profile preference on the host element', async () => {
    const proto = definePrototype<any, any>({
      name: 'vue-scroll-projection-contract',
      setup(def) {
        const scroll = asScrollSurface();
        scroll.configure({ axes: 'vertical', projection: 'auto' });
        def.expose.state('projection', scroll.projection);
        return (renderer) => renderer.slot();
      },
    });
    const mounted = createMountedVueAdapterWithOptions(proto, { scrollProjection: 'composed' }, {});
    await flushVue();

    expect(mounted.root?.dataset.puiScrollProjection).toBe('composed');
    expect(mounted.vm.getExposes().projection.get()).toBe('composed');
    mounted.unmount();
  });
});
