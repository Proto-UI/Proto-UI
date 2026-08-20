import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createMountedVueAdapter, flushVue } from './utils/vue';

describe('adapter-vue: expose event bridge', () => {
  it('maps run.expose.emit to Vue emit/onX listener props', async () => {
    const onCheckedChange = vi.fn();

    const proto = definePrototype({
      name: 'vue-expose-event-basic',
      setup(def) {
        def.expose.event('checkedChange', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          run.expose.emit('checkedChange', { checked: true });
        });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedVueAdapter(proto, {
      onCheckedChange,
    });

    await flushVue();

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: true }, undefined);
    expect(mounted.vm.getExposes()).not.toHaveProperty('checkedChange');

    mounted.unmount();
  });

  it('does not leak onX listener props into Proto raw props', async () => {
    let rawKeys: string[] = [];

    const proto = definePrototype({
      name: 'vue-expose-event-props-filter',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        def.expose.event('checkedChange', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          rawKeys = Object.keys(run.props.getRaw()).sort();
        });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedVueAdapter(proto, {
      label: 'Second',
      onCheckedChange: () => {},
    });

    await flushVue();

    expect(rawKeys).toContain('label');
    expect(rawKeys).not.toContain('onCheckedChange');

    mounted.unmount();
  });
});
