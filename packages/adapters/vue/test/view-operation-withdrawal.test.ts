import { expect, it } from 'vitest';
import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { createMountedVueAdapter, flushVue } from './utils/vue';

it('uses actual Vue view replacement and teardown rather than a synthetic readiness flag', async () => {
  let run!: RunHandle<any>;
  let setups = 0;
  const proto = definePrototype({
    name: 'vue-view-operation-source',
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
  const mounted = createMountedVueAdapter(proto);
  let unmounted = false;
  try {
    await flushVue();
    const view = mounted.vm.getExposes().view;
    const first = view.capture() as ViewOperation;
    expect(first.isCurrent()).toBe(true);
    view.present(false);
    await flushVue();
    expect(view.capture()).toBeNull();
    view.present(true);
    await flushVue();
    expect(setups).toBe(1);
    expect(first.isCurrent()).toBe(false);
    const second = view.capture() as ViewOperation;
    expect(second.isCurrent()).toBe(true);
    mounted.unmount();
    unmounted = true;
    await flushVue();
    expect(second.isCurrent()).toBe(false);
  } finally {
    try {
      if (!unmounted) mounted.unmount();
      await flushVue();
    } finally {
      mounted.host.remove();
    }
  }
});
