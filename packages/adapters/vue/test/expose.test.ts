import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';

import { createMountedVueAdapter, flushVue } from './utils/vue';

describe('adapter-vue: expose', () => {
  it('exposes update and getExposes on component public instance', async () => {
    const proto: Prototype = {
      name: 'vue-expose-basic',
      setup(def) {
        def.expose('api', { version: 1 });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto);
    await flushVue();

    expect(typeof mounted.vm.update).toBe('function');
    expect(mounted.vm.getExposes()).toEqual({ api: { version: 1 } });

    mounted.unmount();
  });

  it('consumes undeclared Vue attrs as adapter raw props instead of falling through to DOM', async () => {
    let seenLabel: string | null = null;

    const proto = definePrototype({
      name: 'vue-attrs-props-basic',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        def.lifecycle.onMounted((run) => {
          seenLabel = String(run.props.get().label ?? 'missing');
        });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedVueAdapter(proto, {
      label: 'Second',
    });

    await flushVue();

    expect(seenLabel).toBe('Second');
    expect(mounted.root?.getAttribute('label')).toBe(null);

    mounted.unmount();
  });

  it('automatically invokes exposed control methods within callback scope', async () => {
    const proto: Prototype = {
      name: 'vue-expose-controls',
      setup(def) {
        const phase = def.state.enum('phase', 'idle', { options: ['idle', 'running'] });
        def.expose.state('phase', phase);
        def.expose.value('controls', {
          run: () => phase.set('running', 'reason: test.controls.run'),
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto);
    await flushVue();
    const phase = mounted.vm.getExposes().phase;
    const events: Array<{ type: string; next?: string }> = [];

    expect(typeof mounted.vm.invokeInCallbackScope).toBe('function');
    expect(phase.get()).toBe('idle');
    expect(phase.spec).toMatchObject({ kind: 'enum' });
    expect(typeof phase.subscribe).toBe('function');
    expect(phase.set).toBeUndefined();
    const off = phase.subscribe((event: { type: string; next?: string }) => events.push(event));

    mounted.vm.getExposes().controls.run();
    await flushVue();

    expect(phase.get()).toBe('running');
    expect(events.at(-1)).toMatchObject({ type: 'next', next: 'running' });

    mounted.vm.update();
    await flushVue();
    expect(mounted.vm.getExposes().phase).toBe(phase);

    off();
    mounted.unmount();
  });

  it('invalidates an App Maker-held expose method after terminal unmount', async () => {
    let calls = 0;
    const proto: Prototype = {
      name: 'vue-expose-terminal-invalidation',
      setup(def) {
        def.expose.method('ping', () => ++calls);
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto);
    await flushVue();
    const ping = mounted.vm.getExposes().ping as () => number;

    expect(ping()).toBe(1);
    mounted.unmount();
    await flushVue();

    expect(() => ping()).toThrow(/terminal disposal/);
    expect(calls).toBe(1);
  });
});
