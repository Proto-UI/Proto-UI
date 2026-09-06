import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../../adapters/web-component/src';
import { createMountedReactAdapter } from '../../adapters/react/test/utils/fake-react';
import { createMountedVueAdapter, flushVue } from '../../adapters/vue/test/utils/vue';
import { createMountedVue2Adapter, flushVue2 } from '../../adapters/vue2/test/utils/vue2';

const WEB_ADAPTERS = ['wc', 'react', 'vue', 'vue2'] as const;
type Runtime = (typeof WEB_ADAPTERS)[number];

type Mounted = {
  root: HTMLElement;
  getExposes(): any;
  unmount(): void;
};

async function settle(runtime: Runtime): Promise<void> {
  await Promise.resolve();
  if (runtime === 'vue') await flushVue();
  if (runtime === 'vue2') await flushVue2();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

async function mount(runtime: Runtime, proto: any): Promise<Mounted> {
  if (runtime === 'wc') {
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: proto.name,
    });
    customElements.define(proto.name, Ctor);
    const root = document.createElement(proto.name) as InstanceType<typeof Ctor>;
    document.body.append(root);
    await settle(runtime);
    return {
      root,
      getExposes: () => root.getExposes(),
      unmount: () => root.remove(),
    };
  }
  if (runtime === 'react') {
    const mounted = createMountedReactAdapter(proto);
    await settle(runtime);
    return {
      root: mounted.root!,
      getExposes: () => mounted.ref.current.getExposes(),
      unmount: () => mounted.unmount(),
    };
  }
  if (runtime === 'vue') {
    const mounted = createMountedVueAdapter(proto);
    await settle(runtime);
    return {
      root: mounted.root!,
      getExposes: () => mounted.vm.getExposes(),
      unmount: () => mounted.unmount(),
    };
  }
  const mounted = createMountedVue2Adapter(proto);
  await settle(runtime);
  return {
    root: mounted.root!,
    getExposes: () => mounted.vm.getExposes(),
    unmount: () => mounted.unmount(),
  };
}

afterEach(() => document.body.replaceChildren());

describe('Web adapter conformance / Scroll end-follow', () => {
  it.each(WEB_ADAPTERS)(
    '%s exposes the same portable end-follow facts and request',
    async (runtime) => {
      let surface: any;
      const proto = definePrototype<any, any>({
        name: `x-scroll-end-follow-${runtime}`,
        setup(def) {
          surface = asScrollSurface();
          surface.configure({
            axes: 'vertical',
            projection: 'system',
            endFollow: { mode: 'while-at-end', axis: 'vertical' },
          });
          def.expose.state('atEnd', surface.vertical.atEnd);
          def.expose.state('followState', surface.endFollow.state);
          def.expose.state('followRequestStatus', surface.endFollow.requestStatus);
          def.expose.method('jumpToEnd', () =>
            surface.request({ kind: 'to-end', axis: 'vertical' })
          );
          return (renderer) => renderer.slot();
        },
      });

      const mounted = await mount(runtime, proto);
      try {
        Object.defineProperties(mounted.root, {
          clientWidth: { configurable: true, value: 100 },
          scrollWidth: { configurable: true, value: 100 },
          clientHeight: { configurable: true, value: 100 },
          scrollHeight: { configurable: true, value: 400 },
          scrollLeft: { configurable: true, value: 0, writable: true },
          scrollTop: { configurable: true, value: 0, writable: true },
        });
        window.dispatchEvent(new Event('resize'));
        await settle(runtime);
        expect(mounted.root.scrollTop).toBe(300);
        const exposes = mounted.getExposes();
        expect(exposes.atEnd.get()).toBe(true);
        expect(exposes.followState.get()).toBe('following');
        expect(exposes.followRequestStatus.get()).toBe('applied');

        exposes.jumpToEnd();
        await settle(runtime);

        expect(exposes.followState.get()).toBe('following');
        expect(exposes.followRequestStatus.get()).toBe('applied');
        expect(mounted.root.style.scrollBehavior).not.toBe('smooth');
        expect(Object.keys(surface)).not.toEqual(
          expect.arrayContaining(['target', 'controller', 'offset', 'extent'])
        );
      } finally {
        mounted.unmount();
      }
    }
  );
});
