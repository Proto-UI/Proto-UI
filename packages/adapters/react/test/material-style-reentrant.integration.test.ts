import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype, tw, type EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { createReactAdapter } from '../src';
import { createMountedVueAdapterWithOptions, flushVue } from '../../vue/test/utils/vue';
import { createVue2Adapter } from '../../vue2/src';
import { Vue2RuntimeAny, mountVue2Adapter, flushVue2 } from '../../vue2/test/utils/vue2';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('synchronous visual style projection with actual custom-element callbacks', () => {
  it.each(['react', 'vue', 'vue2'] as const)(
    '%s finishes a reentrant replacement and cannot revive a callback-retired view',
    async (runtime) => {
      let callback: (() => void) | undefined;
      const tag = `material-style-callback-${runtime}`;
      customElements.define(
        tag,
        class extends HTMLElement {
          static observedAttributes = ['data-pui-style'];
          attributeChangedCallback() {
            const action = callback;
            callback = undefined;
            action?.();
          }
        }
      );
      let host!: HTMLElement;
      let effects!: EffectsPort;
      const proto = definePrototype({
        name: tag,
        setup(def) {
          def.feedback.style.use(tw('shadow-sm'));
          return (r) => r.el('span', 'content');
        },
      });
      const options = {
        rootTag: tag,
        createVisualSink(target: HTMLElement, port: EffectsPort) {
          host = target;
          effects = port;
          return {
            commit(frame: VisualFeedbackFrame) {
              port.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
              port.requestFlush();
            },
            release() {},
          };
        },
      };
      let update!: (action: () => void) => Promise<void>;
      let retire!: () => void;
      let cleanup!: () => Promise<void>;
      let retired = false;
      if (runtime === 'react') {
        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);
        const Component = createReactAdapter(React)(proto, options);
        update = async (action) =>
          act(async () => {
            action();
            await flush();
          });
        retire = () => {
          if (!retired) {
            retired = true;
            root.unmount();
          }
        };
        cleanup = async () => {
          await update(retire);
          container.remove();
        };
        await update(() => root.render(React.createElement(Component)));
      } else if (runtime === 'vue') {
        const mounted = createMountedVueAdapterWithOptions(proto, options);
        update = async (action) => {
          action();
          await flushVue();
          await flushVue();
        };
        retire = () => {
          if (!retired) {
            retired = true;
            mounted.unmount();
          }
        };
        cleanup = async () => {
          await update(retire);
          await flush();
        };
        await update(() => undefined);
      } else {
        const mounted = mountVue2Adapter(createVue2Adapter(Vue2RuntimeAny)(proto, options));
        update = async (action) => {
          action();
          await flushVue2();
          await flushVue2();
        };
        retire = () => {
          if (!retired) {
            retired = true;
            mounted.unmount();
          }
        };
        cleanup = async () => {
          await update(retire);
          await flush();
        };
        await update(() => undefined);
      }
      try {
        expect(host.getAttribute('data-pui-style')).toBe('shadow-sm');
        callback = () => {
          effects.queueStyle(tw('shadow-lg'));
          effects.requestFlush();
        };
        await update(() => {
          effects.queueStyle(tw('shadow-md'));
          effects.requestFlush();
        });
        expect(host.getAttribute('data-pui-style')).toBe('shadow-lg');
        callback = retire;
        await update(() => {
          effects.queueStyle(tw('shadow-xl'));
          effects.requestFlush();
        });
        expect(retired).toBe(true);
        expect(host.isConnected).toBe(false);
        expect(host.getAttribute('data-pui-style')).toBeNull();
        await update(() => {
          effects.queueStyle(tw('shadow-2xl'));
          effects.requestFlush();
        });
        expect(host.getAttribute('data-pui-style')).toBeNull();
      } finally {
        callback = undefined;
        await cleanup();
      }
    }
  );
});
