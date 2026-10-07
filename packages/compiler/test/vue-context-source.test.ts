// @vitest-environment happy-dom
import { posix } from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Vue from 'vue';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');

interface State {
  get(): number;
}
interface Handle {
  getExposes(): { value: State };
  update(): void;
}
const files = {
  'keys.ts': `import {createContextKey} from '@proto.ui/core';
  export const KEY=createContextKey<{value:number}>('same-name');
  export const OTHER=createContextKey<{value:number}>('same-name');`,
};
const provider = `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'provider',setup(def){
  def.props.define({seed:{type:'number',default:1},visible:{type:'boolean',default:true}});
  def.context.provide(KEY,{value:1});
  def.lifecycle.onCreated((run)=>{run.context.update(KEY,{value:run.props.get().seed});});
  def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed});});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  return (r)=>r.el('section',{},r.slot());
}});`;
const consumer = `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'consumer',setup(def){
  def.props.define({prefix:{type:'string',default:'value:'},write:{type:'number',default:0}});
  const value=def.state.numberDiscrete('value',0);
  def.expose.state('value',value);def.expose.event('changed',{payload:'json'});
  def.context.subscribe(KEY,(run,next,prev)=>{value.set(next.value);run.expose.emit('changed',{next:next.value,prev:prev.value});run.update();});
  def.lifecycle.onCreated((run)=>{value.set(run.context.read(KEY).value);});
  def.props.watch(['write'],(run,next)=>{run.context.update(KEY,{value:next.write});});
  return (r)=>r.el('output',{},[r.read.props.get().prefix,r.read.context.read(KEY).value]);
}});`;
const optional = `import {definePrototype} from '@proto.ui/core';import {OTHER} from './keys';
export default definePrototype({name:'optional',setup(def){
  def.props.define({write:{type:'number',default:0}});
  def.context.trySubscribe(OTHER);
  def.expose.event('result',{payload:'json'});
  def.props.watch(['write'],(run,next)=>{run.expose.emit('result',run.context.tryUpdate(OTHER,{value:next.write}));});
  return (r)=>{const value=r.read.context.tryRead(OTHER);return r.el('aside',{},value?.value ?? 'disconnected');};
}});`;

// Every emitted source module in this project is evaluated once, including shared key modules.
function project(): (source: string, name: string) => Vue.Component {
  const sources = new Map<string, string>();
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const prior = cache.get(path);
    if (prior) return prior;
    const source = sources.get(path);
    if (!source) throw new Error(`Missing generated module ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  return (source, name) => {
    const parsed = parsePrototype(source, { fileName: `${name}.proto.ts`, files });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitVueSource(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    for (const file of emitted.value.supportingFiles ?? [])
      sources.set(posix.normalize(file.path), file.contents);
    sources.set(`${name}.ts`, emitted.value.code);
    // The module's default is generated defineComponent output, never authored input.
    return load(`${name}.ts`).default as Vue.Component;
  };
}
async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

describe('Vue3 generated Context composition', () => {
  it('resolves real wrapper/slot ancestry, shadows by key identity and disposes subscriptions', async () => {
    expect(Vue.version).toBe('3.5.31');
    const build = project(),
      Provider = build(provider, 'provider'),
      Consumer = build(consumer, 'consumer'),
      Optional = build(optional, 'optional');
    const seed = Vue.ref(2),
      visible = Vue.ref(true),
      show = Vue.ref(true),
      write = Vue.ref(0),
      optionalWrite = Vue.ref(0);
    const handle = Vue.shallowRef<Handle>();
    const transitions: unknown[] = [],
      results: unknown[] = [];
    const Wrapper = Vue.defineComponent({
      setup(_props, ctx) {
        return () => Vue.h('div', ctx.slots.default?.());
      },
    });
    const host = document.createElement('div');
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(
            Provider,
            { seed: seed.value, visible: visible.value },
            {
              default: () => [
                Vue.h(Wrapper, null, {
                  default: () =>
                    show.value
                      ? Vue.h(Consumer, {
                          ref: handle,
                          write: write.value,
                          onChanged: (value: unknown) => transitions.push(value),
                        })
                      : null,
                }),
                Vue.h(
                  Provider,
                  { seed: 8 },
                  { default: () => Vue.h(Consumer, { prefix: 'nested:' }) }
                ),
                Vue.h(Optional, {
                  write: optionalWrite.value,
                  onResult: (value: unknown) => results.push(value),
                }),
              ],
            }
          );
      },
    });
    app.mount(host);
    try {
      await settle();
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
        'value:2',
        'nested:8',
      ]);
      expect(host.querySelector('aside')?.textContent).toBe('disconnected');
      seed.value = 3;
      await settle();
      expect(transitions).toEqual([{ next: 3, prev: 2 }]);
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
        'value:3',
        'nested:8',
      ]);
      write.value = 4;
      optionalWrite.value = 4;
      await settle();
      expect(transitions).toEqual([
        { next: 3, prev: 2 },
        { next: 4, prev: 3 },
      ]);
      expect(results).toEqual([false]);
      const old = handle.value!.getExposes().value;
      show.value = false;
      await settle();
      expect(() => old.get()).toThrow(/disposed/);
      seed.value = 5;
      await settle();
      expect(transitions).toHaveLength(2);
      show.value = true;
      await settle();
      expect(handle.value!.getExposes().value.get()).toBe(5);
      visible.value = false;
      await settle();
      expect(host.querySelector('section')).toBeNull();
      seed.value = 6;
      await settle();
      visible.value = true;
      await settle();
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
        'value:6',
        'nested:8',
      ]);
      const retained = handle.value!.getExposes().value;
      app.unmount();
      await settle();
      expect(() => retained.get()).toThrow(/disposed/);
    } finally {
      app.unmount();
    }
  });

  it('retains subscription ownership through native KeepAlive deactivation', async () => {
    const build = project(),
      Provider = build(provider, 'provider'),
      Consumer = build(consumer, 'consumer');
    const active = Vue.ref(true),
      seed = Vue.ref(2),
      handle = Vue.shallowRef<Handle>();
    const host = document.createElement('div');
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(
            Provider,
            { seed: seed.value },
            {
              default: () =>
                Vue.h(Vue.KeepAlive, null, {
                  default: () =>
                    active.value ? Vue.h(Consumer, { key: 'consumer', ref: handle }) : Vue.h('div'),
                }),
            }
          );
      },
    });
    app.mount(host);
    try {
      await settle();
      const state = handle.value!.getExposes().value;
      active.value = false;
      await settle();
      seed.value = 7;
      await settle();
      expect(host.querySelector('output')).toBeNull();
      expect(state.get()).toBe(7);
      active.value = true;
      await settle();
      expect(handle.value!.getExposes().value).toBe(state);
      expect(host.querySelector('output')?.textContent).toBe('value:7');
      app.unmount();
      expect(() => state.get()).toThrow(/disposed/);
    } finally {
      app.unmount();
    }
  });

  it('fails required subscriptions without a real ancestor rather than matching a debug name', () => {
    const build = project(),
      Consumer = build(consumer, 'missing');
    const errors: unknown[] = [];
    const app = Vue.createApp(Consumer);
    app.config.errorHandler = (error) => errors.push(error);
    app.mount(document.createElement('div'));
    try {
      expect(
        errors.some(
          (error) => error instanceof Error && /provider|Context|context/.test(error.message)
        )
      ).toBe(true);
    } finally {
      app.unmount();
    }
  });
});
