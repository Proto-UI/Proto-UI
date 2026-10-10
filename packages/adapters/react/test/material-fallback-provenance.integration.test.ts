import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype, tw, type EffectsPort } from '@proto.ui/core';
import type { RootStyleEffect } from '@proto.ui/core/internal';
import { createReactAdapter } from '../src';
import { createMountedVueAdapterWithOptions, flushVue } from '../../vue/test/utils/vue';
import { createVue2Adapter } from '../../vue2/src';
import { Vue2RuntimeAny, mountVue2Adapter, flushVue2 } from '../../vue2/test/utils/vue2';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('V2 null-provider Root provenance transport', () => {
  it.each(['react', 'vue', 'vue2'] as const)(
    '%s keeps Root origins through ordinary fallback and a replacement view',
    async (runtime) => {
      let setPresent!: (present: boolean) => void;
      const proto = definePrototype({
        name: `fallback-root-provenance-${runtime}`,
        setup(def) {
          def.feedback.style.use(tw('p-2'));
          const active = def.state.bool('active', false);
          def.event.on('host:click', () => active.set(true));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.use(tw('text-white')),
          });
          let ownerRun: any;
          def.lifecycle.onCreated((run) => {
            ownerRun = run;
          });
          def.expose('present', (present: boolean) => ownerRun.lifecycle.setPresent(present));
          return (r) => r.el('span', 'retained content');
        },
      });
      const outputs: RootStyleEffect[] = [];
      let target!: HTMLElement;
      const factory = vi.fn((host: HTMLElement, effects: EffectsPort) => {
        target = host;
        const queue = effects.queueStyle.bind(effects);
        vi.spyOn(effects, 'queueStyle').mockImplementation((style) => {
          outputs.push(style as RootStyleEffect);
          queue(style);
        });
        return null;
      });
      const options = { createVisualSink: factory };
      let update!: (action: () => void) => Promise<void>;
      let cleanup!: () => Promise<void>;
      if (runtime === 'react') {
        const host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const Component = createReactAdapter(React)(proto, options);
        const handle = React.createRef<any>();
        update = async (action) =>
          act(async () => {
            action();
            await flush();
          });
        cleanup = async () => {
          await update(() => root.unmount());
          host.remove();
        };
        await update(() => root.render(React.createElement(Component, { ref: handle })));
        setPresent = handle.current.getExposes().present;
      } else if (runtime === 'vue') {
        const mounted = createMountedVueAdapterWithOptions(proto, options);
        update = async (action) => {
          action();
          await flushVue();
          await flushVue();
        };
        cleanup = async () => {
          await update(() => mounted.unmount());
          await flush();
        };
        await update(() => undefined);
        setPresent = mounted.vm.getExposes().present;
      } else {
        const mounted = mountVue2Adapter(createVue2Adapter(Vue2RuntimeAny)(proto, options));
        update = async (action) => {
          action();
          await flushVue2();
          await flushVue2();
        };
        cleanup = async () => {
          await update(() => mounted.unmount());
          await flush();
        };
        await update(() => undefined);
        setPresent = mounted.vm.getExposes().present;
      }
      const assertStyle = (active: boolean) => {
        const style = outputs.at(-1)!;
        expect(style.tokens).toEqual(active ? ['p-2', 'text-white'] : ['p-2']);
        expect(style.entries).toEqual([
          expect.objectContaining({ token: 'p-2', authorToken: 'p-2', origin: 'setup' }),
          ...(active
            ? [
                expect.objectContaining({
                  token: 'text-white',
                  authorToken: 'text-white',
                  origin: 'rule',
                }),
              ]
            : []),
        ]);
        expect(Object.isFrozen(style.entries)).toBe(true);
      };
      try {
        expect(factory).toHaveBeenCalledTimes(1);
        assertStyle(false);
        await update(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        assertStyle(true);
        await update(() => setPresent(false));
        await update(() => setPresent(true));
        expect(factory).toHaveBeenCalledTimes(2);
        assertStyle(true);
      } finally {
        await cleanup();
        vi.restoreAllMocks();
      }
    }
  );
});
