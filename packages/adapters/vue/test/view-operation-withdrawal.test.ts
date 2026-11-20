import { expect, it } from 'vitest';
import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { createMountedVueAdapter, flushVue } from './utils/vue';

it('uses actual Vue view replacement and teardown rather than a synthetic readiness flag', async () => {
  let run!: RunHandle<any>;
  let setups = 0;
  let captured: ViewOperation | null = null;
  const proto = definePrototype({
    name: 'vue-view-operation-source',
    setup(def) {
      setups += 1;
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        capture: () => (captured = run.lifecycle.captureViewOperation()),
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
    const exposedSecond = view.capture() as ViewOperation;
    // Expose return values are callback-scoped; retain the producer's identity
    // separately to query lifecycle invalidation after the owner is disposed.
    const second = captured!;
    expect(second.isCurrent()).toBe(true);
    mounted.unmount();
    unmounted = true;
    await flushVue();
    expect(second.isCurrent()).toBe(false);
    expect(() => exposedSecond.isCurrent()).toThrow(
      '[AdapterHost] cannot invoke an exposed callable after terminal disposal'
    );
  } finally {
    try {
      if (!unmounted) mounted.unmount();
      await flushVue();
    } finally {
      mounted.host.remove();
    }
  }
});
