import { expect, it } from 'vitest';
import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

it('uses actual Vue2 retained view replacement and owner destruction', async () => {
  let run!: RunHandle<any>;
  let setups = 0;
  const proto = definePrototype({
    name: 'vue2-view-operation-source',
    setup(def) {
      setups += 1;
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        capture: () => run.lifecycle.captureViewOperation(),
        present: (value: boolean) => run.lifecycle.setPresent(value),
      });
      return (r) => r.el('span', 'Source');
    },
  });
  const mounted = createMountedVue2Adapter(proto);
  let unmounted = false;
  try {
    await flushVue2();
    const view = mounted.vm.getExposes().view;
    const first = view.capture() as ViewOperation;
    expect(first.isCurrent()).toBe(true);
    view.present(false);
    await flushVue2();
    expect(view.capture()).toBeNull();
    view.present(true);
    await flushVue2();
    expect(setups).toBe(1);
    expect(first.isCurrent()).toBe(false);
    const second = view.capture() as ViewOperation;
    expect(second.isCurrent()).toBe(true);
    mounted.unmount();
    unmounted = true;
    await flushVue2();
    expect(second.isCurrent()).toBe(false);
  } finally {
    try {
      if (!unmounted) mounted.unmount();
      await flushVue2();
    } finally {
      mounted.host.remove();
    }
  }
});
