// @vitest-environment happy-dom
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { resolveTargetProfile } from '../src/targets';
import type { PropsUpdatePolicy } from '../src/observable-semantics';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
type Profile = (typeof profiles)[number];
type Event = { type: 'next'; prev: number; next: number } | { type: 'disconnect' };
type Exposes = {
  count: { get(): number; subscribe(fn: (event: Event) => void): () => void };
  write(value: number): void;
};
type Handle = { update(): void; getExposes(): Exposes };
type Consumer = {
  handle: Handle;
  text(): string | null;
  setSeed(seed: number): Promise<void>;
  flush(): Promise<void>;
};
const directories: string[] = [];
const cleanups: (() => void | Promise<void>)[] = [];
let tagSequence = 0;

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'observable-owner',setup(def){
  def.props.define({seed:{type:'number',default:1}});
  const count=def.state.numberDiscrete('count',0);
  def.expose.state('count',count);
  def.expose.method('write',(next:number)=>{count.set(next);});
  def.lifecycle.onCreated(run=>{count.set(run.props.get().seed ?? 1);});
  def.props.watch(['seed'],(run,next)=>{count.set(next.seed ?? 1);});
  return r=>r.el('output',[count.get(),r.slot()]);
}});`;

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function consumer(profile: Profile, policy: PropsUpdatePolicy): Promise<Consumer> {
  const compiled = compilePrototype(source, { profile: { profile, propsUpdatePolicy: policy } });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const generatedRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules'
  );
  await mkdir(generatedRoot, { recursive: true });
  const temporary = await mkdtemp(path.join(generatedRoot, 'observable-'));
  directories.push(temporary);
  const directory = path.join(temporary, 'output');
  const written = await writeCompilation(compiled.value, directory);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const manifest = JSON.parse(await readFile(path.join(directory, 'provenance.json'), 'utf8'));
  expect(manifest.observableSemantics).toMatchObject({
    version: 'proto-ui-observables-v1',
    props: { update: policy },
  });
  const filename = path.join(directory, generatedSourcePath(profile));
  const generated = await import(/* @vite-ignore */ filename);
  const host = document.createElement('div');
  document.body.append(host);
  if (profile === 'react-dom-source-v1') {
    const root = createRoot(host),
      ref = React.createRef<Handle>();
    const render = (seed: number) =>
      React.createElement(
        generated.CompiledComponent,
        { seed, ref },
        React.createElement('b', null, 'native')
      );
    await React.act(async () => {
      root.render(render(1));
    });
    cleanups.push(async () => {
      await React.act(async () => {
        root.unmount();
      });
    });
    return {
      handle: ref.current!,
      text: () => host.querySelector('output')?.textContent ?? null,
      setSeed: async (seed) => {
        await React.act(async () => {
          root.render(render(seed));
        });
      },
      flush: async () => {
        await React.act(async () => {
          await Promise.resolve();
        });
      },
    };
  }
  if (profile === 'vue-source-v1') {
    const seed = Vue.ref(1),
      ref = Vue.ref<Handle>();
    const app = Vue.createApp({
      render: () =>
        Vue.h(
          generated.CompiledComponent,
          { seed: seed.value, ref },
          { default: () => Vue.h('b', 'native') }
        ),
    });
    app.mount(host);
    await Vue.nextTick();
    cleanups.push(() => app.unmount());
    return {
      handle: ref.value!,
      text: () => host.querySelector('output')?.textContent ?? null,
      setSeed: async (next) => {
        seed.value = next;
        await Vue.nextTick();
        await Vue.nextTick();
      },
      flush: async () => {
        await Vue.nextTick();
        await Vue.nextTick();
      },
    };
  }
  if (profile === 'vue2-source-v1') {
    const vm = new Vue2({
      data: () => ({ seed: 1 }),
      render(h) {
        return h(generated.CompiledComponent, { ref: 'compiled', props: { seed: this.seed } }, [
          h('b', 'native'),
        ]);
      },
    });
    vm.$mount();
    host.append(vm.$el);
    await Vue2.nextTick();
    cleanups.push(() => {
      vm.$destroy();
    });
    return {
      handle: vm.$refs.compiled as unknown as Handle,
      text: () => host.querySelector('output')?.textContent ?? null,
      setSeed: async (seed) => {
        vm.seed = seed;
        await Vue2.nextTick();
        await Vue2.nextTick();
      },
      flush: async () => {
        await Vue2.nextTick();
        await Vue2.nextTick();
      },
    };
  }
  const tag = `x-observable-${++tagSequence}`;
  generated.register(tag);
  const element = document.createElement(tag) as HTMLElement &
    Handle & { setProps(props: { seed: number }): void; dispose(): void };
  element.append(document.createElement('b'));
  element.firstElementChild!.textContent = 'native';
  element.setProps({ seed: 1 });
  host.append(element);
  await Promise.resolve();
  cleanups.push(() => element.dispose());
  // A native slot's light content is checked separately from the shadow output text.
  return {
    handle: element,
    text: () => {
      const output = (element.shadowRoot ?? element).querySelector('output');
      if (!output) return null;
      return (
        output.textContent +
        (element.shadowRoot ? (element.querySelector('b')?.textContent ?? '') : '')
      );
    },
    setSeed: async (seed) => {
      element.setProps({ seed });
      await Promise.resolve();
    },
    flush: async () => {
      await Promise.resolve();
    },
  };
}

describe.each(profiles)('ordinary %s artifact consumer', (profile) => {
  it.each(['explicit', 'host'] as const)(
    'honors %s props policy without implicit state-write rendering',
    async (policy) => {
      const view = await consumer(profile, policy);
      expect(view.text()).toBe('1native');
      await view.setSeed(3);
      expect(view.handle.getExposes().count.get()).toBe(3);
      expect(view.text()).toBe(policy === 'host' ? '3native' : '1native');
      view.handle.update();
      await view.flush();
      expect(view.text()).toBe('3native');
      view.handle.getExposes().write(8);
      await view.flush();
      expect(view.handle.getExposes().count.get()).toBe(8);
      expect(view.text()).toBe('3native');
      await view.setSeed(3);
      expect(view.text()).toBe('3native');
      view.handle.update();
      await view.flush();
      expect(view.text()).toBe('8native');
    }
  );

  it('uses recorded registrations and drains reentrant writes despite subscriber failure', async () => {
    const view = await consumer(profile, 'explicit');
    const exposes = view.handle.getExposes(),
      trace: string[] = [];
    const failure = new Error('subscriber failed');
    let offB = () => {};
    exposes.count.subscribe((event) => {
      if (event.type !== 'next') return;
      trace.push(`a${event.next}`);
      if (event.next === 2) {
        offB();
        exposes.count.subscribe((e) => {
          if (e.type === 'next') trace.push(`c${e.next}`);
        });
        exposes.write(3);
        throw failure;
      }
    });
    offB = exposes.count.subscribe((event) => {
      if (event.type === 'next') trace.push(`b${event.next}`);
    });
    expect(() => exposes.write(2)).toThrow(failure);
    expect(trace).toEqual(['a2', 'a3', 'c3']);
    expect(exposes.count.get()).toBe(3);
    exposes.write(4);
    expect(trace).toEqual(['a2', 'a3', 'c3', 'a4', 'c4']);
    expect(view.text()).toBe('1native');
  });
});

it('preserves declared defaults and rejects unadmitted policies', () => {
  for (const profile of profiles) {
    const result = resolveTargetProfile(profile);
    if (!result.ok) throw new Error('Profile missing');
    expect(result.value.observableSemantics.props.update).toBe(
      profile === 'vue2-source-v1' ? 'host' : 'explicit'
    );
  }
  expect(
    resolveTargetProfile({
      profile: 'react-dom-source-v1',
      propsUpdatePolicy: 'implicit' as PropsUpdatePolicy,
    })
  ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4008' }] });
});
