import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import {
  compilePrototype,
  writeCompilation,
  type Compilation,
  type CompileOptions,
} from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

export const nativeOwnerProfiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
export type NativeOwnerProfile = (typeof nativeOwnerProfiles)[number];
export type NativeOwnerHandle = { getExposes(): Record<string, any>; update(): void };
let sequence = 0;

/** The documented producer/writer API and ordinary native-framework imports form the test boundary. */
export async function mountNativeOwner(
  source: string | Compilation,
  profile: NativeOwnerProfile,
  options: {
    props?: Record<string, unknown>;
    compile?: Omit<CompileOptions, 'profile'>;
  } = {}
) {
  const compiled =
    typeof source === 'string'
      ? compilePrototype(source, { ...options.compile, profile })
      : { ok: true as const, value: source };
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  if (compiled.value.output.profile !== profile)
    throw new Error('Consumer profile does not match compiled output.');
  const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(directory, { recursive: true });
  const temporary = await mkdtemp(path.join(directory, 'ordinary-owner-'));
  const output = path.join(temporary, 'output');
  const written = await writeCompilation(compiled.value, output);
  if (!written.ok) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(JSON.stringify(written.diagnostics));
  }
  const generated = await import(
    /* @vite-ignore */ path.join(output, generatedSourcePath(profile))
  );
  const host = document.createElement('div');
  document.body.append(host);
  let handle: NativeOwnerHandle;
  let change: (props: Record<string, unknown>) => Promise<void>;
  let flush: () => Promise<void>;
  let unmount: () => Promise<void>;
  if (profile === 'react-dom-source-v1') {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(host),
      ref = React.createRef<NativeOwnerHandle>();
    change = async (props) => {
      await React.act(async () => {
        root.render(
          React.createElement(
            generated.CompiledComponent,
            { ...props, ref },
            React.createElement('b', null, 'native-child')
          )
        );
      });
    };
    flush = async () => {
      await React.act(async () => {
        await Promise.resolve();
      });
    };
    unmount = async () => {
      await React.act(async () => {
        root.unmount();
      });
    };
    await change(options.props ?? {});
    handle = ref.current!;
  } else if (profile === 'vue-source-v1') {
    const props = Vue.shallowRef(options.props ?? {}),
      ref = Vue.ref<NativeOwnerHandle>();
    const app = Vue.createApp({
      render: () =>
        Vue.h(
          generated.CompiledComponent,
          { ...props.value, ref },
          { default: () => Vue.h('b', 'native-child') }
        ),
    });
    app.mount(host);
    await Vue.nextTick();
    handle = ref.value!;
    flush = async () => {
      await Promise.resolve();
      await Vue.nextTick();
      await Vue.nextTick();
    };
    change = async (next) => {
      props.value = next;
      await flush();
    };
    unmount = async () => {
      app.unmount();
      await flush();
    };
  } else if (profile === 'vue2-source-v1') {
    const vm = new Vue2({
      data: () => ({ input: options.props ?? {} }),
      render(h) {
        return h(
          generated.CompiledComponent,
          { ref: 'compiled', props: this.input, attrs: this.input },
          [h('b', 'native-child')]
        );
      },
    });
    vm.$mount();
    host.append(vm.$el);
    await Vue2.nextTick();
    handle = vm.$refs.compiled as unknown as NativeOwnerHandle;
    flush = async () => {
      await Promise.resolve();
      await Vue2.nextTick();
      await Vue2.nextTick();
    };
    change = async (props) => {
      vm.input = props;
      await flush();
    };
    unmount = async () => {
      vm.$destroy();
      await flush();
    };
  } else {
    const tag = `x-ordinary-owner-${++sequence}`;
    generated.register(tag);
    const element = document.createElement(tag) as HTMLElement &
      NativeOwnerHandle & { setProps(props: Record<string, unknown>): void; dispose(): void };
    const child = document.createElement('b');
    child.textContent = 'native-child';
    element.append(child);
    element.setProps(options.props ?? {});
    host.append(element);
    await Promise.resolve();
    handle = element;
    flush = async () => {
      await Promise.resolve();
      await Promise.resolve();
    };
    change = async (props) => {
      element.setProps(props);
      await flush();
    };
    unmount = async () => {
      element.dispose();
      await flush();
    };
  }
  let disposed = false;
  return {
    compiled: compiled.value,
    output,
    host,
    handle,
    flush,
    setProps: change,
    async act<T>(callback: () => T): Promise<T> {
      let value!: T;
      if (profile === 'react-dom-source-v1')
        await React.act(async () => {
          value = callback();
        });
      else {
        value = callback();
        await flush();
      }
      return value;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try {
        await unmount();
      } finally {
        host.remove();
        await rm(temporary, { recursive: true, force: true });
      }
    },
  };
}
