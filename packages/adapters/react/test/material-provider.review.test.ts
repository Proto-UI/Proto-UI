import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype, tw, type EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { createReactAdapter } from '../../react/src';
import { createMountedVueAdapterWithOptions, flushVue } from '../../vue/test/utils/vue';
import { createVue2Adapter } from '../../vue2/src';
import { Vue2RuntimeAny, mountVue2Adapter, flushVue2 } from '../../vue2/test/utils/vue2';
import { AdaptToWebComponent } from '../../web-component/src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let sequence = 0;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('independent provider view-epoch review', () => {
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s forwards state-derived intent and retires and reacquires each physical-view sink',
    async (runtime) => {
      let change!: () => void;
      let present!: (value: boolean) => void;
      const proto = definePrototype({
        name: `material-provider-${runtime}-${++sequence}`,
        setup(def) {
          let ownerRun: any;
          def.lifecycle.onCreated(run => { ownerRun = run; });
          def.expose('present', (value: boolean) => ownerRun.lifecycle.setPresent(value));
          def.feedback.style.use(tw('bg-background text-foreground rounded-lg'));
          def.feedback.material.declare({
            version: 2,
            shape: { kind: 'rounded-rect', geometry: 'style' },
            source: { kind: 'in-app-backdrop' },
            fallback: { fill: 'style', foreground: 'style' },
          });
          const pressed = def.state.bool('owned-press', false);
          def.event.on('host:click', () => pressed.set(true));
          for (const value of [false, true])
            def.rule({
              when: (w) => w.state(pressed).eq(value),
              intent: (i) =>
                i.feedback.material.use({
                  intent: 'liquid-glass',
                  deformation: { kind: 'press', phase: value ? 'pressed' : 'rest' },
                }),
            });
          return (r) => r.el('span', 'visible semantic content');
        },
      });
      const frames: VisualFeedbackFrame[] = [];
      const release = vi.fn();
      const factory = vi.fn((host: HTMLElement, effects: EffectsPort) => {
        expect(host.nodeType).toBe(1);
        change = () => {
          host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        };
        return {
          commit(frame: VisualFeedbackFrame) {
            frames.push(frame);
            effects.queueStyle(tw(frame.style.tokens.join(' ')));
            effects.requestFlush();
          },
          release,
        };
      });
      const options = { createVisualSink: factory };
      let cleanup!: () => Promise<void>;
      let update!: () => Promise<void>;
      let host!: HTMLElement;
      if (runtime === 'wc') {
        const Component = AdaptToWebComponent(proto, options);
        host = new Component();
        document.body.append(host);
        await flush();
        present = (host as any).getExposes().present;
        update = async () => {
          change();
          await flush();
        };
        cleanup = async () => {
          host.remove();
          await flush();
        };
      } else if (runtime === 'react') {
        host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const Component = createReactAdapter(React)(proto, options);
        const handle = React.createRef<any>();
        await act(async () => {
          root.render(React.createElement(Component, { ref: handle }));
          await flush();
        });
        present = handle.current.getExposes().present;
        update = async () => {
          await act(async () => {
            change();
            await flush();
          });
        };
        cleanup = async () => {
          await act(async () => {
            root.unmount();
            await flush();
          });
          host.remove();
        };
      } else if (runtime === 'vue') {
        const mounted = createMountedVueAdapterWithOptions(proto, options);
        host = mounted.host;
        await flushVue();
        await flushVue();
        present = mounted.vm.getExposes().present;
        update = async () => {
          change();
          await flushVue();
          await flushVue();
        };
        cleanup = async () => {
          mounted.unmount();
          await flushVue();
          await flush();
        };
      } else {
        const mounted = mountVue2Adapter(createVue2Adapter(Vue2RuntimeAny)(proto, options));
        host = mounted.host;
        await flushVue2();
        await flushVue2();
        present = mounted.vm.getExposes().present;
        update = async () => {
          change();
          await flushVue2();
        };
        cleanup = async () => {
          mounted.unmount();
          await flushVue2();
          await flush();
        };
      }
      try {
        expect(factory).toHaveBeenCalledTimes(1);
        expect(host.textContent).toContain('visible semantic content');
        expect(frames.at(-1)?.material.candidates).toEqual([
          { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'rest' } },
        ]);
        await update();
        expect(frames.at(-1)?.material.candidates).toEqual([
          { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } },
        ]);
        expect(frames.at(-1)?.style.tokens).toContain('bg-background');
        expect(release).not.toHaveBeenCalled();
        const firstView = frames.at(-1)!.view;
        change = () => present(false);
        await update();
        expect(release).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenLastCalledWith(firstView);
        change = () => present(true);
        await update();
        expect(factory).toHaveBeenCalledTimes(2);
        expect(frames.at(-1)!.view).toBeGreaterThan(firstView);
        expect(frames.at(-1)?.material.candidates).toEqual([
          { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } },
        ]);
      } finally {
        await cleanup();
      }
      expect(release).toHaveBeenCalledTimes(2);
      expect(release).toHaveBeenCalledWith(frames.at(-1)!.view);
      const count = frames.length;
      await flush();
      expect(frames.length).toBe(count);
    }
  );
});
