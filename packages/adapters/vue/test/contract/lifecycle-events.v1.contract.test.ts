import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';

import { createVueAdapter, type VueAdapterHandle } from '../../src/adapt';
import { flushVue, mountVueAdapter, VueAny } from '../utils/vue';

describe('contract: adapter-vue / lifecycle events (v1)', () => {
  it('exposes the structured instance, mount, update, and disposal event trace', async () => {
    const trace: RuntimeLifecycleEvent[] = [];
    const proto: Prototype = {
      name: 'vue-lifecycle-events',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };

    const adapter = createVueAdapter(VueAny);
    const Component = adapter(proto, {
      schedule: (task) => task(),
      diagnostics: {
        onLifecycleEvent: (event) => trace.push(event),
      },
    });

    const mounted = mountVueAdapter(Component);
    await flushVue();

    expect(trace).toEqual([
      { type: 'instance.setup.exit' },
      { type: 'instance.phase', phase: 'alive' },
      { type: 'instance.created' },
      { type: 'mount.phase', phase: 'mounting', epoch: 1 },
      { type: 'mount.render', epoch: 1 },
      { type: 'mount.commit.start', epoch: 1 },
      { type: 'mount.commit.done', epoch: 1 },
      { type: 'mount.phase', phase: 'mounted', epoch: 1 },
      { type: 'mount.mounted', epoch: 1 },
    ]);

    trace.length = 0;
    (mounted.vm as VueAdapterHandle).update();
    expect(trace).toEqual([{ type: 'update.render', epoch: 1, revision: 1 }]);

    await flushVue();
    expect(trace).toEqual([
      { type: 'update.render', epoch: 1, revision: 1 },
      { type: 'update.commit.done', epoch: 1, revision: 1 },
      { type: 'update.updated', epoch: 1, revision: 1 },
    ]);

    trace.length = 0;
    mounted.unmount();
    await flushVue();

    expect(trace).toEqual([
      { type: 'instance.phase', phase: 'disposing' },
      { type: 'instance.dispose.begin' },
      { type: 'mount.phase', phase: 'unmounting', epoch: 1 },
      { type: 'unmount.begin', epoch: 1 },
      { type: 'mount.phase', phase: 'detached', epoch: 1 },
      { type: 'unmount.done', epoch: 1 },
      { type: 'instance.phase', phase: 'disposed' },
      { type: 'instance.dispose.done' },
    ]);
  });
});
