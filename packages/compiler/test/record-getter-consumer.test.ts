// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import {
  mountNativeOwner,
  nativeOwnerProfiles,
  type NativeOwnerProfile,
} from './native-owner-consumer';
import { generatedSourcePath } from '../src/emitter-map';
import { recordGetterFixture } from './record-getter-fixture';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

/** Import the very same generated module so this observes shared module storage. */
async function sibling(output: string, profile: NativeOwnerProfile, existingTag?: string) {
  const generated = await import(
    /* @vite-ignore */ path.join(output, generatedSourcePath(profile))
  );
  const host = document.createElement('div');
  document.body.append(host);
  let handle: { getExposes(): Record<string, any> };
  let unmount: () => Promise<void>;
  if (profile === 'react-dom-source-v1') {
    const root = createRoot(host);
    const ref = React.createRef<typeof handle>();
    await React.act(async () =>
      root.render(React.createElement(generated.CompiledComponent, { ref }))
    );
    handle = ref.current!;
    unmount = async () => {
      await React.act(async () => root.unmount());
    };
  } else if (profile === 'vue-source-v1') {
    const ref = Vue.ref<typeof handle>();
    const app = Vue.createApp({ render: () => Vue.h(generated.CompiledComponent, { ref }) });
    app.mount(host);
    await Vue.nextTick();
    handle = ref.value!;
    unmount = async () => {
      app.unmount();
      await Vue.nextTick();
    };
  } else if (profile === 'vue2-source-v1') {
    const vm = new Vue2({ render: (h) => h(generated.CompiledComponent, { ref: 'owner' }) });
    vm.$mount();
    host.append(vm.$el);
    await Vue2.nextTick();
    handle = vm.$refs.owner as unknown as typeof handle;
    unmount = async () => {
      vm.$destroy();
      await Vue2.nextTick();
    };
  } else {
    if (!existingTag) throw new Error('Expected the registered first owner tag.');
    const element = document.createElement(existingTag) as HTMLElement &
      typeof handle & { dispose(): void };
    host.append(element);
    await Promise.resolve();
    handle = element;
    unmount = async () => {
      element.dispose();
    };
  }
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await unmount();
    host.remove();
  };
  cleanup.push(dispose);
  return { api: handle.getExposes(), dispose };
}

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('runs native accessors on reads and copies, with actual throws and owner cleanup', async () => {
      const owner = await mountNativeOwner(recordGetterFixture, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      // Neither constructing owner objects nor native render reads these accessors.
      expect(api.reads()).toBe(0);
      expect(api.moduleReads()).toBe(0);
      expect(owner.host.textContent).toContain('getter owner');
      expect(api.read()).toBe(1);
      expect(api.read()).toBe(2);
      expect(api.dynamic('value')).toBe(3);
      expect(api.copy()).toEqual({ first: 4, second: 4, changed: 91, reads: 4 });
      expect(api.spreadOverride()).toEqual({ value: 91, reads: 5 });
      expect(api.inlineGetter()).toEqual({ before: 5, first: 6, second: 7 });
      expect(api.assign()).toEqual({ first: 8, second: 8, reads: 8 });
      let thrown: unknown;
      try {
        api.broken();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(37);
      expect(api.reads()).toBe(9);
      expect(api.abruptSpread()).toBe(11);
      expect(api.optionalSpread(true)).toEqual({ value: 73, reads: 11 });
      expect(api.optionalSpread(false)).toEqual({ value: 12, reads: 12 });
      expect(api.ordered()).toBe('13ba');
      expect(api.moduleRead()).toBe(1);
      expect(api.moduleRead()).toBe(2);
      const other = await sibling(owner.output, profile, owner.host.firstElementChild?.localName);
      expect(other.api.reads()).toBe(0);
      expect(other.api.moduleReads()).toBe(2);
      expect(other.api.moduleRead()).toBe(3);
      expect(api.moduleReads()).toBe(3);
      const retained = api.read;
      await owner.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
      expect(other.api.read()).toBe(1);
    });
  });
