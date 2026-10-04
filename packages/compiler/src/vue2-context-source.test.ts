// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';

const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');

interface State { get(): number }
interface VM {
  seed: number; visible: boolean; show: boolean; write: number; optionalWrite: number;
  $el: Node; $children: VM[]; $refs: Record<string, VM>;
  $mount(): VM; $destroy(): void; getExposes(): { value: State };
}
interface VueRuntime {
  version: string;
  config: { errorHandler?: (error: Error) => void };
  extend(options: Record<string, unknown>): new () => VM;
  nextTick(): Promise<void>;
}
type H = (tag: unknown, data?: unknown, children?: unknown) => unknown;
const requireVue2 = createRequire(fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url)));
const Vue2 = requireVue2('vue') as VueRuntime;
const files = { 'keys.ts': `import {createContextKey} from '@proto.ui/core';
  export const KEY=createContextKey<{value:number}>('same-name');
  export const OTHER=createContextKey<{value:number}>('same-name');` };
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
  def.props.define({write:{type:'number',default:0}});def.context.trySubscribe(OTHER);
  def.expose.event('result',{payload:'json'});
  def.props.watch(['write'],(run,next)=>{run.expose.emit('result',run.context.tryUpdate(OTHER,{value:next.write}));});
  return (r)=>{const value=r.read.context.tryRead(OTHER);return r.el('aside',{},value?.value ?? 'disconnected');};
}});`;

function project(): (source: string, name: string) => unknown {
  const sources = new Map<string, string>(), cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const prior = cache.get(path);
    if (prior) return prior;
    const source = sources.get(path);
    if (!source) throw new Error(`Missing generated module ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  return (source, name) => {
    const parsed = parsePrototype(source, { fileName: `${name}.proto.ts`, files });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitVue2Source(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    for (const file of emitted.value.supportingFiles ?? []) sources.set(posix.normalize(file.path), file.contents);
    sources.set(`${name}.ts`, emitted.value.code);
    return load(`${name}.ts`).default;
  };
}
async function settle(): Promise<void> { await Vue2.nextTick(); await Vue2.nextTick(); await Vue2.nextTick(); }

describe('Vue2 generated Context composition', () => {
  it('uses native injections through wrappers, distinct keys, shadow providers and terminal cleanup', async () => {
    expect(Vue2.version).toBe('2.6.14');
    const build = project(), Provider = build(provider, 'provider'), Consumer = build(consumer, 'consumer'), Optional = build(optional, 'optional');
    const transitions: unknown[] = [], results: unknown[] = [];
    const Wrapper = { render(this: { $slots: { default?: unknown[] } }, h: H) { return h('div', {}, this.$slots.default); } };
    const Root = Vue2.extend({
      data() { return { seed: 2, visible: true, show: true, write: 0, optionalWrite: 0 }; },
      render(this: VM, h: H) { return h(Provider, { props: { seed: this.seed, visible: this.visible } }, [
        h(Wrapper, {}, this.show ? [h(Consumer, { ref: 'consumer', props: { write: this.write }, on: { changed: (value: unknown) => transitions.push(value) } })] : []),
        h(Provider, { props: { seed: 8 } }, [h(Consumer, { props: { prefix: 'nested:' } })]),
        h(Optional, { props: { write: this.optionalWrite }, on: { result: (value: unknown) => results.push(value) } }),
      ]); },
    });
    const vm = new Root(); vm.$mount();
    const host = document.createElement('div'); host.append(vm.$el); document.body.append(host);
    try {
      await settle();
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual(['value:2', 'nested:8']);
      expect(host.querySelector('aside')?.textContent).toBe('disconnected');
      vm.seed = 3; await settle();
      expect(transitions).toEqual([{ next: 3, prev: 2 }]);
      vm.write = 4; vm.optionalWrite = 4; await settle();
      expect(transitions).toEqual([{ next: 3, prev: 2 }, { next: 4, prev: 3 }]);
      expect(results).toEqual([false]);
      const old = vm.$refs.consumer.getExposes().value;
      vm.show = false; await settle();
      expect(() => old.get()).toThrow(/terminal/);
      vm.seed = 5; await settle();
      expect(transitions).toHaveLength(2);
      vm.show = true; await settle();
      expect(vm.$refs.consumer.getExposes().value.get()).toBe(5);
      vm.visible = false; await settle();
      expect(host.querySelector('section')).toBeNull();
      vm.seed = 6; await settle();
      vm.visible = true; await settle();
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual(['value:6', 'nested:8']);
      const retained = vm.$refs.consumer.getExposes().value;
      vm.$destroy();
      expect(() => retained.get()).toThrow(/terminal/);
    } finally { vm.$destroy(); host.remove(); }
  });

  it('retains subscriptions and owner identity through native keep-alive deactivation', async () => {
    const build = project(), Provider = build(provider, 'provider'), Consumer = build(consumer, 'consumer');
    const Root = Vue2.extend({
      data() { return { seed: 2, show: true }; },
      render(this: VM, h: H) { return h(Provider, { props: { seed: this.seed } }, [
        h('keep-alive', {}, [this.show ? h(Consumer, { key: 'consumer', ref: 'consumer' }) : h('div')]),
      ]); },
    });
    const vm = new Root(); vm.$mount();
    const host = document.createElement('div'); host.append(vm.$el); document.body.append(host);
    try {
      await settle();
      const state = vm.$refs.consumer.getExposes().value;
      vm.show = false; await settle();
      vm.seed = 7; await settle();
      expect(host.querySelector('output')).toBeNull();
      expect(state.get()).toBe(7);
      vm.show = true; await settle();
      expect(vm.$refs.consumer.getExposes().value).toBe(state);
      expect(host.querySelector('output')?.textContent).toBe('value:7');
      vm.$destroy();
      expect(() => state.get()).toThrow(/terminal/);
    } finally { vm.$destroy(); host.remove(); }
  });

  it('rejects a required consumer outside any provider', () => {
    const errors: Error[] = [], prior = Vue2.config.errorHandler;
    Vue2.config.errorHandler = (error) => errors.push(error);
    const Consumer = project()(consumer, 'missing');
    const Root = Vue2.extend({ render(_h: H) { return _h(Consumer); } });
    const vm = new Root();
    try {
      vm.$mount();
      expect(errors.some((error) => /provider|Context|context/.test(error.message))).toBe(true);
    } finally { vm.$destroy(); Vue2.config.errorHandler = prior; }
  });
});
