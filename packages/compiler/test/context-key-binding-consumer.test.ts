// @vitest-environment happy-dom
import { posix } from 'node:path';
import ts from 'typescript';
import * as Vue from 'vue';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const files = {
  'keys.ts': `import {createContextKey} from '@proto.ui/core';
    export const FIRST=createContextKey<{value:number}>('shared-name');
    export const OTHER=createContextKey<{value:number}>('shared-name');`,
  'bridge.ts': `export {FIRST as KEY,OTHER} from './keys';`,
};
const provider = `import {definePrototype} from '@proto.ui/core';import {KEY} from './bridge';
export default definePrototype({name:'provider',setup(def){
  def.props.define({value:{type:'number',default:1}});
  def.context.provide(KEY,{value:1});
  def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().value});});
  def.props.watch(['value'],(run,next)=>{run.context.update(KEY,{value:next.value});});
  return r=>r.el('section',{},r.slot());
}});`;

function consumer(operation: 'subscribe' | 'trySubscribe', key = 'KEY') {
  const values =
    operation === 'subscribe'
      ? 'next.value * 100 + prev.value'
      : '(next?.value ?? -1) * 100 + (prev?.value ?? -1)';
  return `import {definePrototype,defineAsHook} from '@proto.ui/core';
  import {${key} as LOCAL} from './bridge';
  const observe=defineAsHook({name:'observer',setup(def){
    const seen=def.state.numberDiscrete('seen',-1);
    def.context.${operation}(LOCAL,(run,next,prev)=>{seen.set(${values});});
  }});
  export default definePrototype({name:'consumer',setup(def){
    const facts=observe();
    def.expose.method('read',()=>facts.getState('seen')?.get() ?? -1);
  }});`;
}

// Evaluate only generated native modules, sharing the generated Context key
// modules between separately compiled components. No authored Runtime bridge.
function project() {
  const sources = new Map<string, string>();
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file);
    if (prior) return prior;
    const source = sources.get(file);
    if (!source) throw new Error(`Missing generated module ${file}`);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const javascript = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(file), specifier + '.ts')));
    }, exports);
    return exports;
  }
  return (source: string, name: string): Vue.Component => {
    const parsed = parsePrototype(source, { fileName: name + '.proto.ts', files });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitVueSource(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    for (const file of emitted.value.supportingFiles ?? [])
      sources.set(posix.normalize(file.path), file.contents);
    sources.set(name + '.ts', emitted.value.code);
    return load(name + '.ts').default as Vue.Component;
  };
}

async function settle() {
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

type Handle = { getExposes(): { read(): number } };
describe('generated Vue Context subscriptions captured by authored Hooks', () => {
  it.each(['subscribe', 'trySubscribe'] as const)(
    '%s preserves values, declaration identity and terminal replacement',
    async (operation) => {
      const build = project();
      const Provider = build(provider, 'provider');
      const Consumer = build(consumer(operation), 'consumer');
      const Other = build(consumer('trySubscribe', 'OTHER'), 'other');
      const value = Vue.ref(2);
      const shown = Vue.ref(true);
      const handle = Vue.shallowRef<Handle>();
      const other = Vue.shallowRef<Handle>();
      const errors: unknown[] = [];
      const host = document.createElement('div');
      document.body.append(host);
      const app = Vue.createApp({
        setup() {
          return () =>
            Vue.h(
              Provider,
              { value: value.value },
              {
                default: () => [
                  shown.value ? Vue.h(Consumer, { ref: handle }) : null,
                  Vue.h(Other, { ref: other }),
                ],
              }
            );
        },
      });
      app.config.errorHandler = (error) => errors.push(error);
      app.mount(host);
      let mounted = true;
      try {
        await settle();
        expect(errors).toEqual([]);
        const otherBefore = other.value!.getExposes().read();
        value.value = 3;
        await settle();
        const original = handle.value!;
        const readOriginal = original.getExposes().read;
        expect(readOriginal()).toBe(302);
        expect(other.value!.getExposes().read()).toBe(otherBefore);

        shown.value = false;
        await settle();
        expect(() => readOriginal()).toThrow(/disposed|alive|released/i);
        value.value = 4;
        await settle();
        shown.value = true;
        await settle();
        expect(handle.value).not.toBe(original);
        value.value = 5;
        await settle();
        expect(handle.value!.getExposes().read()).toBe(504);
        expect(other.value!.getExposes().read()).toBe(otherBefore);
        const latest = handle.value!.getExposes().read;
        app.unmount();
        mounted = false;
        await settle();
        expect(() => latest()).toThrow(/disposed|alive|released/i);
        expect(errors).toEqual([]);
      } finally {
        if (mounted) app.unmount();
        host.remove();
      }
    }
  );
});
