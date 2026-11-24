// @vitest-environment happy-dom
import path from 'node:path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { afterEach, expect, it } from 'vitest';
import {
  nativeOwnerProfiles,
  type NativeOwnerHandle,
  type NativeOwnerProfile,
} from './native-owner-consumer';
import { buildLocalTabsArtifact, tabsContentEntry, tabsProviderEntry } from './local-tabs-artifact';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
let sequence = 0;

async function mount(profile: NativeOwnerProfile) {
  const artifact = await buildLocalTabsArtifact(profile);
  cleanup.push(artifact.dispose);
  const provider = await import(
    /* @vite-ignore */ path.join(artifact.output, artifact.paths[tabsProviderEntry])
  );
  const content = await import(
    /* @vite-ignore */ path.join(artifact.output, artifact.paths[tabsContentEntry])
  );
  const host = document.createElement('div');
  document.body.append(host);
  let selected = 'a',
    value = 'a',
    keepMounted = false,
    include = true;
  let update: () => Promise<void>;
  let read: () => NativeOwnerHandle;
  if (profile === 'react-dom-source-v1') {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(host),
      ref = React.createRef<NativeOwnerHandle>();
    update = async () => {
      await React.act(async () => {
        root.render(
          React.createElement(
            provider.CompiledComponent,
            { selected },
            include
              ? React.createElement(
                  content.CompiledComponent,
                  { value, keepMounted, ref },
                  React.createElement('b', null, 'authored child')
                )
              : null
          )
        );
      });
    };
    read = () => ref.current!;
    cleanup.push(async () => {
      await React.act(async () => root.unmount());
    });
  } else if (profile === 'vue-source-v1') {
    const revision = Vue.ref(0),
      ref = Vue.shallowRef<NativeOwnerHandle>();
    const app = Vue.createApp({
      render() {
        revision.value;
        return Vue.h(
          provider.CompiledComponent,
          { selected },
          {
            default: () =>
              include
                ? Vue.h(
                    content.CompiledComponent,
                    { value, keepMounted, ref },
                    { default: () => Vue.h('b', 'authored child') }
                  )
                : null,
          }
        );
      },
    });
    app.mount(host);
    update = async () => {
      revision.value++;
      await Vue.nextTick();
      await Vue.nextTick();
    };
    read = () => ref.value!;
    cleanup.push(async () => {
      app.unmount();
      await Vue.nextTick();
    });
  } else if (profile === 'vue2-source-v1') {
    const vm = new Vue2({
      data: () => ({ revision: 0 }),
      render(h) {
        this.revision;
        return h(
          provider.CompiledComponent,
          { props: { selected } },
          include
            ? [
                h(content.CompiledComponent, { ref: 'content', props: { value, keepMounted } }, [
                  h('b', 'authored child'),
                ]),
              ]
            : []
        );
      },
    });
    vm.$mount();
    host.append(vm.$el);
    update = async () => {
      vm.revision++;
      await Vue2.nextTick();
      await Vue2.nextTick();
    };
    read = () => vm.$refs.content as unknown as NativeOwnerHandle;
    cleanup.push(async () => {
      vm.$destroy();
      await Vue2.nextTick();
    });
  } else {
    const suffix = ++sequence;
    const providerTag = `x-local-tabs-provider-${suffix}`,
      contentTag = `x-local-tabs-content-${suffix}`;
    provider.register(providerTag);
    content.register(contentTag);
    const parent = document.createElement(providerTag) as HTMLElement & {
      setProps(props: unknown): void;
      dispose(): void;
    };
    let child: HTMLElement &
      NativeOwnerHandle & { setProps(props: unknown): void; dispose(): void };
    let active = false;
    update = async () => {
      parent.setProps({ selected });
      if (include && !active) {
        child = document.createElement(contentTag) as typeof child;
        child.innerHTML = '<b>authored child</b>';
        child.setProps({ value, keepMounted });
        parent.append(child);
        active = true;
      } else if (!include && active) {
        child.dispose();
        child.remove();
        active = false;
      } else if (active) child.setProps({ value, keepMounted });
      if (!parent.isConnected) host.append(parent);
      await Promise.resolve();
      await Promise.resolve();
    };
    read = () => child;
    cleanup.push(async () => {
      if (active) child.dispose();
      parent.dispose();
    });
  }
  await update();
  return {
    host,
    read,
    async change(next: {
      selected?: string;
      value?: string;
      keepMounted?: boolean;
      include?: boolean;
    }) {
      selected = next.selected ?? selected;
      value = next.value ?? value;
      keepMounted = next.keepMounted ?? keepMounted;
      include = next.include ?? include;
      await update();
    },
  };
}

for (const profile of nativeOwnerProfiles)
  it(`runs unchanged Tabs Content with an independent Context provider in ${profile}`, async () => {
    const owner = await mount(profile),
      handle = owner.read();
    const { current, hidden } = handle.getExposes();
    expect(current.get()).toBe(true);
    expect(hidden.get()).toBe(false);
    expect(owner.host.querySelector('[role="tabpanel"]')?.textContent).toContain('authored child');
    await owner.change({ selected: 'b' });
    expect(current.get()).toBe(false);
    expect(hidden.get()).toBe(true);
    expect(owner.host.querySelector('[role="tabpanel"]')).toBeNull();
    await owner.change({ selected: 'a' });
    expect(current.get()).toBe(true);
    expect(owner.read().getExposes().current).toBe(current);
    expect(owner.host.querySelector('[role="tabpanel"]')?.textContent).toContain('authored child');
    await owner.change({ value: 'b', keepMounted: true });
    expect(current.get()).toBe(false);
    expect(hidden.get()).toBe(true);
    expect(owner.host.querySelector('[role="tabpanel"]')).not.toBeNull();
    await owner.change({ selected: 'b' });
    expect(current.get()).toBe(true);
    expect(hidden.get()).toBe(false);
    await owner.change({ include: false });
    await owner.change({ selected: 'a', include: true, keepMounted: false });
    const replacement = owner.read().getExposes();
    expect(replacement.current).not.toBe(current);
    expect(replacement.current.get()).toBe(false);
    expect(() => current.get()).toThrow(/dispos|terminal/i);
  }, 60_000);
