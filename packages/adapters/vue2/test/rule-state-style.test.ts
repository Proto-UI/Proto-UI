import { describe, expect, it } from 'vitest';
import { tw, type DefHandle, type Prototype } from '@proto.ui/core';

import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

describe('adapter-vue2: rule state -> style', () => {
  it('applies rule style on state change and removes it on deactivate', async () => {
    const proto: Prototype = {
      name: 'vue2-rule-state-style',
      setup(def: DefHandle<any>) {
        const pressed = def.state.bool('pressed', false);

        def.rule({
          when: (w) => w.state(pressed).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });

        def.lifecycle.onUpdated(() => {
          pressed.set(!pressed.get());
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();
    await flushVue2();

    mounted.vm.update();
    await flushVue2();
    await flushVue2();
    expect(mounted.root?.classList.contains('opacity-50')).toBe(false);
    expect(mounted.root?.getAttribute('data-pui-style')).toBe('opacity-50');

    mounted.vm.update();
    await flushVue2();
    await flushVue2();
    expect(mounted.root?.classList.contains('opacity-50')).toBe(false);
    expect(mounted.root?.hasAttribute('data-pui-style')).toBe(false);

    mounted.unmount();
  });
});
