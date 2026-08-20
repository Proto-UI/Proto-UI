import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';

import { createMountedReactAdapter } from './utils/fake-react';

describe('adapter-react: expose', () => {
  it('exposes update and getExposes on forwarded ref handle', () => {
    const proto: Prototype = {
      name: 'react-expose-basic',
      setup(def) {
        def.expose('api', { version: 1 });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedReactAdapter(proto);

    expect(typeof mounted.ref.current.update).toBe('function');
    expect(mounted.ref.current.getExposes()).toEqual({ api: { version: 1 } });

    mounted.unmount();
  });

  it('consumes undeclared React props as adapter raw props instead of host attrs', () => {
    let seenLabel: string | null = null;

    const proto = definePrototype({
      name: 'react-attrs-props-basic',
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

    const mounted = createMountedReactAdapter(proto, {
      label: 'Second',
    });

    expect(seenLabel).toBe('Second');
    expect(mounted.root?.getAttribute('label')).toBe(null);

    mounted.unmount();
  });

  it('automatically invokes exposed control methods within callback scope', () => {
    const proto: Prototype = {
      name: 'react-expose-controls',
      setup(def) {
        const phase = def.state.enum('phase', 'idle', { options: ['idle', 'running'] });
        def.expose.state('phase', phase);
        def.expose.value('controls', {
          run: () => phase.set('running', 'reason: test.controls.run'),
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedReactAdapter(proto);
    const handle = mounted.ref.current;
    const phase = handle.getExposes().phase;
    const events: Array<{ type: string; next?: string }> = [];

    expect(typeof handle.invokeInCallbackScope).toBe('function');
    expect(phase.get()).toBe('idle');
    expect(phase.spec).toMatchObject({ kind: 'enum' });
    expect(typeof phase.subscribe).toBe('function');
    expect(phase.set).toBeUndefined();
    const off = phase.subscribe((event: { type: string; next?: string }) => events.push(event));

    handle.getExposes().controls.run();

    expect(phase.get()).toBe('running');
    expect(events.at(-1)).toMatchObject({ type: 'next', next: 'running' });

    mounted.update();
    expect(handle.getExposes().phase).toBe(phase);

    off();
    mounted.unmount();
  });

  it('invalidates an App Maker-held expose method after terminal unmount', async () => {
    let calls = 0;
    const proto: Prototype = {
      name: 'react-expose-terminal-invalidation',
      setup(def) {
        def.expose.method('ping', () => ++calls);
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedReactAdapter(proto);
    const ping = mounted.ref.current.getExposes().ping as () => number;

    expect(ping()).toBe(1);
    mounted.unmount();
    await Promise.resolve();

    expect(() => ping()).toThrow(/terminal disposal/);
    expect(calls).toBe(1);
  });
});
