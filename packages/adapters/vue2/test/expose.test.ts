import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';

import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

describe('adapter-vue2: expose', () => {
  it('renders Proto template children into the Vue 2 host root', async () => {
    const proto: Prototype = {
      name: 'vue2-render-basic',
      setup() {
        return (r) => [r.el('div', 'rendered')];
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();
    await flushVue2();

    expect(mounted.root?.textContent).toContain('rendered');

    mounted.unmount();
  });

  it('exposes update and getExposes on the Vue 2 component instance', async () => {
    const proto: Prototype = {
      name: 'vue2-expose-basic',
      setup(def) {
        def.expose('api', { version: 1 });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    expect(typeof mounted.vm.update).toBe('function');
    expect(mounted.vm.getExposes()).toEqual({ api: { version: 1 } });

    mounted.unmount();
  });

  it('consumes undeclared Vue 2 attrs as Proto props instead of falling through to DOM', async () => {
    let seenLabel: string | null = null;

    const proto = definePrototype({
      name: 'vue2-attrs-props-basic',
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

    const mounted = createMountedVue2Adapter(proto, {
      label: 'Second',
    });

    await flushVue2();

    expect(seenLabel).toBe('Second');
    expect(mounted.root?.getAttribute('label')).toBe(null);

    mounted.unmount();
  });

  it('invokes exposed control methods in callback scope', async () => {
    let renders = 0;
    const proto: Prototype = {
      name: 'vue2-expose-controls',
      setup(def) {
        const phase = def.state.enum('phase', 'idle', { options: ['idle', 'running'] });
        def.expose.state('phase', phase);
        def.expose.value('controls', {
          run: () => phase.set('running', 'reason: test.controls.run'),
        });
        return (r) => {
          renders += 1;
          return [r.el('div', String(renders))];
        };
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    expect(typeof mounted.vm.invokeInCallbackScope).toBe('function');
    const phase = mounted.vm.getExposes().phase;
    expect(phase.get()).toBe('idle');
    expect(phase.spec).toMatchObject({ kind: 'enum' });
    expect(typeof phase.subscribe).toBe('function');
    expect(phase.set).toBeUndefined();

    mounted.vm.getExposes().controls.run();
    await flushVue2();

    expect(mounted.vm.getExposes().phase.get()).toBe('running');
    expect(renders).toBe(1);

    mounted.vm.update();
    await flushVue2();
    expect(renders).toBe(2);
    expect(mounted.vm.getExposes().phase).toBe(phase);

    mounted.unmount();
  });

  it('keeps exposed callables stable and invalidates held callables after destroy', async () => {
    const proto: Prototype = {
      name: 'vue2-expose-terminal-disposal',
      setup(def) {
        def.expose.value('controls', {
          ping: () => 'pong',
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    const first = mounted.vm.getExposes().controls as { ping(): string };
    const second = mounted.vm.getExposes().controls as { ping(): string };
    const ping = first.ping;

    expect(second.ping).toBe(ping);
    expect(ping()).toBe('pong');

    mounted.unmount();

    expect(() => ping()).toThrow(/terminal disposal/);
  });
});
