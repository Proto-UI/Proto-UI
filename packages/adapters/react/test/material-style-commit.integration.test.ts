import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype, tw, type EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { createReactAdapter } from '../src';
import { createMountedVueAdapterWithOptions, flushVue } from '../../vue/test/utils/vue';
import { createVue2Adapter } from '../../vue2/src';
import { Vue2RuntimeAny, mountVue2Adapter, flushVue2 } from '../../vue2/test/utils/vue2';
import { createReactEffectsPort } from '../src/runtime/effects-port';
import { createVueEffectsPort } from '../../vue/src/runtime/effects-port';
import { createVue2EffectsPort } from '../../vue2/src/runtime/effects-port';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('framework visual-provider style commit (DOM evidence, not optical rendering)', () => {
  it.each([createReactEffectsPort, createVueEffectsPort, createVue2EffectsPort])(
    'does not lose a newer style flush from a synchronous host callback',
    (createEffectsPort) => {
      const values: string[][] = [];
      const effects = createEffectsPort((tokens) => {
        values.push(tokens);
        if (tokens.includes('shadow-sm')) {
          effects.queueStyle(tw('shadow-lg'));
          effects.requestFlush();
        }
      });
      effects.queueStyle(tw('shadow-sm'));
      effects.requestFlush();
      expect(values).toEqual([['shadow-sm'], ['shadow-lg']]);
    }
  );
  it.each(['react', 'react-strict', 'vue', 'vue2'] as const)(
    '%s realizes current tokens before the visual consumer samples and rejects a retired writer',
    async (runtime) => {
      const proto = definePrototype({
        name: `material-style-commit-${runtime}`,
        setup(def) {
          def.feedback.style.use(tw('bg-background text-foreground rounded-lg shadow-sm'));
          const active = def.state.bool('active', false);
          def.event.on('host:click', () => active.set(!active.get()));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.use(tw('shadow-md')),
          });
          let run: any;
          def.lifecycle.onCreated((value) => {
            run = value;
          });
          def.expose('present', (present: boolean) => run.lifecycle.setPresent(present));
          return (r) => r.el('span', 'content');
        },
      });
      const samples: Array<{ expected: string; actual: string | null }> = [];
      const hosts: HTMLElement[] = [];
      const ports: EffectsPort[] = [];
      const release = vi.fn();
      const factory = (host: HTMLElement, effects: EffectsPort) => {
        hosts.push(host);
        ports.push(effects);
        return {
          commit(frame: VisualFeedbackFrame) {
            effects.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
            effects.requestFlush();
            samples.push({
              expected: frame.style.tokens.join(' '),
              actual: host.getAttribute('data-pui-style'),
            });
          },
          release,
        };
      };
      const options = { createVisualSink: factory };
      let update!: (action: () => void) => Promise<void>;
      let cleanup!: () => Promise<void>;
      let setPresent!: (present: boolean) => void;
      let rerender!: () => void;
      if (runtime === 'react' || runtime === 'react-strict') {
        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);
        const Component = createReactAdapter(React)(proto, options);
        const handle = React.createRef<any>();
        update = async (action) =>
          act(async () => {
            action();
            await flush();
          });
        cleanup = async () => {
          await update(() => root.unmount());
          container.remove();
        };
        let renderCount = 0;
        rerender = () => {
          const component = React.createElement(Component, {
            ref: handle,
            hostClassName: `parent-render-${++renderCount}`,
          });
          root.render(
            runtime === 'react-strict'
              ? React.createElement(React.StrictMode, null, component)
              : component
          );
        };
        await update(rerender);
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
        rerender = () => mounted.vm.$forceUpdate();
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
        rerender = () => mounted.rootVm.$forceUpdate();
      }
      try {
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.every(({ expected, actual }) => actual === expected)).toBe(true);
        const initialViews = hosts.length;
        const initialReleases = release.mock.calls.length;
        const firstHost = hosts.at(-1)!,
          firstPort = ports.at(-1)!;
        await update(() => firstHost.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        expect(firstHost.getAttribute('data-pui-style')).toContain('shadow-md');
        expect(samples.every(({ expected, actual }) => actual === expected)).toBe(true);
        // Even same-token framework renders must leave the current physical projection intact.
        const style = firstHost.getAttribute('data-pui-style')!;
        await update(() => {
          firstPort.queueStyle(tw(style));
          firstPort.requestFlush();
        });
        expect(firstHost.getAttribute('data-pui-style')).toBe(style);
        await update(rerender);
        expect(firstHost.getAttribute('data-pui-style')).toBe(style);
        await update(() => setPresent(false));
        expect(release).toHaveBeenCalledTimes(initialReleases + 1);
        await update(() => setPresent(true));
        expect(hosts).toHaveLength(initialViews + 1);
        const currentHost = hosts.at(-1)!,
          currentStyle = currentHost.getAttribute('data-pui-style');
        await update(() => {
          firstPort.queueStyle(tw('bg-black'));
          firstPort.requestFlush();
        });
        expect(currentHost.getAttribute('data-pui-style')).toBe(currentStyle);
        expect(firstHost.getAttribute('data-pui-style')).toBeNull();
        expect(samples.every(({ expected, actual }) => actual === expected)).toBe(true);
        // Disposal releases its own tuple, never a replacement author value.
        currentHost.setAttribute('data-pui-style', 'author-replacement');
        await update(() => setPresent(false));
        expect(currentHost.getAttribute('data-pui-style')).toBe('author-replacement');
        const retiredPort = ports.at(-1)!;
        await update(() => {
          retiredPort.queueStyle(tw('bg-white'));
          retiredPort.requestFlush();
        });
        expect(currentHost.getAttribute('data-pui-style')).toBe('author-replacement');
      } finally {
        await cleanup();
      }
    }
  );
});
