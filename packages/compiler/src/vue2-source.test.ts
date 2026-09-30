// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';
import type { Vue2SourceOptions } from './vue2-source';

interface StateEvent<T> {
  type: 'next' | 'disconnect';
  prev?: T;
  next?: T;
  reason?: unknown;
}
interface ExternalState<T> {
  get(): T;
  subscribe(callback: (event: StateEvent<T>) => void): () => void;
  unsubscribe(off: () => void): void;
  readonly spec: Readonly<Record<string, unknown>>;
}
interface CounterExposes {
  count: ExternalState<number>;
  add(amount: number): void;
  read(): number;
}
interface Vue2Instance {
  $el: Node;
  $children: NativeInstance[];
  $mount(): Vue2Instance;
  $destroy(): void;
  $forceUpdate(): void;
}
interface NativeInstance extends Vue2Instance {
  update(): void;
  getExposes(): CounterExposes;
  invokeInCallbackScope<T>(callback: () => T): T;
}
interface HostInstance extends Vue2Instance {
  input: Record<string, unknown>;
  slotText: string;
}
interface Vue2Runtime {
  version: string;
  extend<T extends Vue2Instance>(options: Record<string, unknown>): new () => T;
  nextTick(): Promise<void>;
}
type CreateElement = (tag: unknown, dataOrChildren?: unknown, children?: unknown) => unknown;

const requireVue2 = createRequire(fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url)));
// Resolve the concrete consumer through its existing package, not the root Vue3 dependency.
const Vue2 = requireVue2('vue') as Vue2Runtime;
const hosts: { vm: HostInstance; host: HTMLElement }[] = [];
afterEach(() => {
  for (const mounted of hosts.splice(0)) {
    mounted.vm.$destroy();
    mounted.host.remove();
  }
});

function loadNative(source: string, options?: Vue2SourceOptions, files?: Readonly<Record<string, string>>): unknown {
  const parsed = parsePrototype(source, { fileName: 'native-vue2.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVue2Source(parsed.value, options);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const program = ts.transpileModule(emitted.value.code, {
    fileName: 'generated-vue2.js',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
  }).outputText;
  const exports: Record<string, unknown> = {};
  // Only checked compiler output executes here; authored source is parsed, never imported/evaluated.
  new Function('exports', program)(exports);
  return exports.CompiledComponent;
}

function mountNative(component: unknown, raw: Record<string, unknown> = {}, scopedSlot = false) {
  const events: string[] = [];
  const listeners = Object.fromEntries(['created', 'mounted', 'updated', 'unmounted', 'beforeDispose'].map((key) => [key, () => events.push(key)]));
  const Root = Vue2.extend<HostInstance>({
    data() { return { input: { ...raw }, slotText: 'slot' }; },
    render(this: HostInstance, h: CreateElement) {
      const data: Record<string, unknown> = { props: this.input, on: listeners };
      if (scopedSlot) data.scopedSlots = { default: () => [h('b', this.slotText)] };
      return h(component, data, scopedSlot ? undefined : [h('b', this.slotText)]);
    },
  });
  const vm = new Root();
  vm.$mount();
  const host = document.createElement('div');
  host.append(vm.$el);
  document.body.append(host);
  hosts.push({ vm, host });
  const instance = vm.$children[0];
  if (!instance) throw new Error('Vue2 did not mount the emitted component.');
  return { vm, host, instance, events };
}

async function flushVue2(): Promise<void> {
  await Vue2.nextTick();
  await Vue2.nextTick();
  await Vue2.nextTick();
}

const counterSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'vue2-native-owner',setup(def){
  def.props.define({seed:{type:'number',default:1},present:{type:'boolean',default:true}});
  def.props.setDefaults({seed:2});
  const count=def.state.numberDiscrete('count',0,{min:0,max:100});
  def.expose.state('count',count);
  def.expose.method('add',(amount:number)=>{count.set(count.get()+amount,'increment');});
  def.expose.method('read',()=>count.get());
  def.expose.event('created',{payload:'void'});
  def.expose.event('mounted',{payload:'void'});
  def.expose.event('updated',{payload:'void'});
  def.expose.event('unmounted',{payload:'void'});
  def.expose.event('beforeDispose',{payload:'void'});
  def.lifecycle.onCreated((run)=>{
    count.set(run.props.get().seed ?? 0);
    run.lifecycle.setPresent(run.props.get().present ?? false);
    run.expose.emit('created');
  });
  def.lifecycle.onMounted((run)=>{count.set(4);run.expose.emit('mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('unmounted');});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('beforeDispose');});
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? false);});
  return (r)=>r.el('output',[count.get(),r.slot()]);
}});`;

describe('Vue2 native source consumer', () => {
  it('retains logical state across view epochs while separating mutation from explicit update', async () => {
    expect(Vue2.version).toBe('2.6.14');
    const mounted = mountNative(loadNative(counterSource));
    await flushVue2();
    const api = mounted.instance.getExposes();
    const count = api.count;
    const add = api.add;
    const transitions: StateEvent<number>[] = [];
    const off = count.subscribe((event) => transitions.push(event));
    expect(mounted.host.querySelector('output')?.textContent).toBe('2slot');
    expect(count.get()).toBe(4);
    expect(mounted.events).toEqual(['created', 'mounted']);

    add(3);
    await flushVue2();
    expect(api.read()).toBe(7);
    expect(mounted.host.querySelector('output')?.textContent).toBe('2slot');
    expect(transitions).toEqual([{ type: 'next', prev: 4, next: 7, reason: 'increment' }]);
    mounted.instance.update();
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('7slot');
    expect(mounted.events).toEqual(['created', 'mounted', 'updated']);

    mounted.vm.input = { present: false };
    await flushVue2();
    expect(mounted.host.querySelector('output')).toBeNull();
    expect(mounted.instance.getExposes().count).toBe(count);
    add(2);
    mounted.instance.update();
    await flushVue2();
    expect(count.get()).toBe(9);
    expect(mounted.host.querySelector('output')).toBeNull();
    expect(mounted.events).toEqual(['created', 'mounted', 'updated', 'unmounted']);
    mounted.vm.input = { present: true };
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('9slot');
    expect(count.get()).toBe(4);
    expect(mounted.instance.getExposes().add).toBe(add);
    expect(mounted.events).toEqual(['created', 'mounted', 'updated', 'unmounted', 'mounted']);

    off();
    mounted.vm.$destroy();
    expect(mounted.events).toEqual(['created', 'mounted', 'updated', 'unmounted', 'mounted', 'unmounted', 'beforeDispose']);
    expect(() => add(1)).toThrow(/terminal/);
    expect(() => count.get()).toThrow(/terminal/);
    expect(() => count.subscribe(() => {})).toThrow(/terminal/);
    expect(mounted.instance.getExposes()).toEqual({});
  });

  it('uses full raw snapshots, releases omitted controlled values and avoids Vue Boolean coercion', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'vue2-raw-props',setup(def){
        def.props.define({label:{type:'string',default:'declared'},enabled:{type:'boolean',default:true}});
        def.props.setDefaults({label:'layered'});
        return (r)=>{const props=r.read.props.get();
          if(props.enabled){return r.el('output',[props.label ?? 'null','/true']);}
          return r.el('output',[props.label ?? 'null','/false']);
        };
      }});`;
    const mounted = mountNative(loadNative(source), { label: 'controlled', enabled: false });
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('controlled/false');
    mounted.vm.input = { label: undefined, enabled: '' };
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('controlled/false');
    mounted.vm.input = {};
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('layered/true');
    expect(mounted.host.firstElementChild?.hasAttribute('label')).toBe(false);
  });

  it('refreshes native scoped slots without implicitly committing retained state', async () => {
    const mounted = mountNative(loadNative(counterSource), {}, true);
    await flushVue2();
    mounted.instance.getExposes().add(3);
    mounted.vm.slotText = 'replacement';
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('2replacement');
    expect(mounted.instance.getExposes().count.get()).toBe(7);
    expect(mounted.events).toEqual(['created', 'mounted']);
    mounted.instance.update();
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('7replacement');
  });

  it('captures render state at run.update before later writes in the same callback', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'vue2-update-order',setup(def){
        def.props.define({tick:{type:'number',default:0}});
        const count=def.state.numberDiscrete('count',0);
        def.expose.state('count',count);
        def.props.watch(['tick'],(run,next)=>{
          count.set(next.tick ?? 0);
          run.update();
          count.set(count.get()+1);
        });
        return (r)=>r.el('output',count.get());
      }});`;
    const mounted = mountNative(loadNative(source, { autoUpdateOnPropsChange: false }));
    await flushVue2();
    mounted.vm.input = { tick: 7 };
    await flushVue2();
    expect(mounted.instance.getExposes().count.get()).toBe(8);
    expect(mounted.host.querySelector('output')?.textContent).toBe('7');
    mounted.instance.update();
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('8');
  });

  it('clamps only range defaults and rejects out-of-range callback writes', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'vue2-state-boundary',setup(def){
        const count=def.state.numberRange('count',8,{min:0,max:5,clamp:true});
        def.expose.state('count',count);
        def.expose.method('add',(amount:number)=>{count.set(count.get()+amount);});
        return (r)=>r.el('output',count.get());
      }});`;
    const mounted = mountNative(loadNative(source));
    await flushVue2();
    expect(mounted.instance.getExposes().count.get()).toBe(5);
    expect(() => mounted.instance.getExposes().add(1)).toThrow(/range/);
    expect(mounted.instance.getExposes().count.get()).toBe(5);
    mounted.instance.getExposes().add(-2);
    expect(mounted.instance.getExposes().count.get()).toBe(3);
    expect(mounted.host.querySelector('output')?.textContent).toBe('5');
    mounted.instance.update();
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('3');
  });

  it('invalidates an in-flight update when the view disappears or the logical instance is destroyed', async () => {
    const mounted = mountNative(loadNative(counterSource));
    await flushVue2();
    mounted.instance.getExposes().add(2);
    mounted.instance.update();
    mounted.vm.input = { present: false };
    await flushVue2();
    expect(mounted.events).toEqual(['created', 'mounted', 'unmounted']);
    mounted.vm.input = { present: true };
    await flushVue2();
    const events: StateEvent<number>[] = [];
    mounted.instance.getExposes().count.subscribe((event) => events.push(event));
    mounted.instance.update();
    mounted.vm.$destroy();
    await flushVue2();
    expect(mounted.events).toEqual(['created', 'mounted', 'unmounted', 'mounted', 'unmounted', 'beforeDispose']);
    expect(events).toEqual([{ type: 'disconnect', reason: 'unmount' }]);
  });

  it('observes controlled props while absent so they can request the first materialized view', async () => {
    const mounted = mountNative(loadNative(counterSource), { present: false, seed: 12 });
    await flushVue2();
    expect(mounted.host.querySelector('output')).toBeNull();
    expect(mounted.instance.getExposes().count.get()).toBe(12);
    expect(mounted.events).toEqual(['created']);
    mounted.vm.input = { present: true, seed: 20 };
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('12slot');
    expect(mounted.events).toEqual(['created', 'mounted']);
  });

  it('expands supported authored hooks and rejects capabilities with no native lowering', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';import {asCounter} from './counter';
      export default definePrototype({name:'vue2-static-hook',setup(def){asCounter();return (r)=>r.slot();}});`;
    const hook = `import {defineAsHook} from '@proto.ui/core';export const asCounter=defineAsHook({name:'counter',setup(def){
      const count=def.state.numberDiscrete('count',5);
      def.expose.state('count',count);def.expose.method('read',()=>count.get());
    }});`;
    const mounted = mountNative(loadNative(source, undefined, { 'counter.ts': hook }));
    await flushVue2();
    expect(mounted.instance.getExposes().read()).toBe(5);
    expect(mounted.host.textContent).toBe('slot');
    const unsupported = parsePrototype(`import {definePrototype} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'unsupported',setup(){asFocusable();}});`);
    if (!unsupported.ok) throw new Error(JSON.stringify(unsupported.diagnostics));
    const result = emitVue2Source(unsupported.value);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'unsupported-input' }] });
  });

  it('treats checked-IR property names as data in source and public JSDoc', async () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'vue2-safe-key',setup(def){
        def.props.define({label:{type:'string',default:'fallback'}});
        return (r)=>r.el('output',r.read.props.get().label ?? 'missing');
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const hostileKey = 'label*/+notExecutable+/*';
    const rename = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(rename);
      else if (value !== null && typeof value === 'object') {
        // In-process IR contains ordinary data records; preserve every typed use of the key.
        const record = value as Record<string, unknown>;
        for (const [key, child] of Object.entries(record)) {
          if (['name', 'key', 'property'].includes(key) && child === 'label') record[key] = hostileKey;
          else rename(child);
        }
      }
    };
    rename(parsed.value);
    const emitted = emitVue2Source(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const exports: Record<string, unknown> = {};
    const program = ts.transpileModule(emitted.value.code, {
      fileName: 'safe-key.js',
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
    }).outputText;
    new Function('exports', program)(exports);
    const mounted = mountNative(exports.CompiledComponent, { [hostileKey]: 'provided' });
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('provided');
    mounted.vm.input = {};
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('fallback');
  });
});
