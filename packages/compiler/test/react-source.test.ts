// @vitest-environment happy-dom
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface ExternalState<T> {
  get(): T;
  subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void): () => void;
}
interface NativeHandle {
  update(): void;
  getExposes(): {
    count: ExternalState<number>;
    add(amount: number): void;
    read(): number;
  };
}
interface NativeModule {
  CompiledComponent: React.ForwardRefExoticComponent<Record<string, unknown> & React.RefAttributes<NativeHandle>>;
}
const directories: string[] = [];
const roots: Root[] = [];
let moduleIdentity = 0;
afterEach(async () => {
  await React.act(async () => { for (const root of roots.splice(0)) root.unmount(); });
  document.body.replaceChildren();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function loadNative(source: string, files?: Readonly<Record<string, string>>): Promise<NativeModule> {
  const parsed = parsePrototype(source, { fileName: 'native.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules', `native-${process.pid}-${moduleIdentity++}`);
  await mkdir(directory, { recursive: true });
  directories.push(directory);
  const file = path.join(directory, 'Component.tsx');
  await writeFile(file, emitted.value.code, 'utf8');
  // The emitted program and its temporary module path are selected at runtime; no static import can name them.
  return await import(/* @vite-ignore */ file) as NativeModule;
}

const numericSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'numeric-owner',setup(def){
  def.props.define({seed:{type:'number',default:1},present:{type:'boolean',default:true}});
  def.props.setDefaults({seed:2});
  const count = def.state.numberDiscrete('count',0,{min:0,max:100,step:1});
  const add = (amount:number) => { if(amount > 0) { count.set(count.get()+amount,'increment'); } };
  def.expose.state('count',count);
  def.expose.method('add',(amount:number)=>{ add(amount); });
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
  def.lifecycle.onMounted((run)=>{ count.set(4); run.expose.emit('mounted'); });
  def.lifecycle.onUpdated((run)=>{ run.expose.emit('updated'); });
  def.lifecycle.onUnmounted((run)=>{ run.expose.emit('unmounted'); });
  def.lifecycle.onBeforeDispose((run)=>{ run.expose.emit('beforeDispose'); });
  def.props.watch(['present'],(run,next)=>{ run.lifecycle.setPresent(next.present ?? false); });
  return (r)=>r.el('output',[count.get(),r.slot()]);
}});`;

function mountHost() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root };
}

describe('checked semantics to native React DOM source', () => {
  it('retains a numeric owner across view epochs, commits only explicit updates and invalidates held handles', async () => {
    const { CompiledComponent } = await loadNative(numericSource);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const lifecycle: string[] = [];
    const props = {
      ref, onCreated: () => lifecycle.push('created'), onMounted: () => lifecycle.push('mounted'),
      onUpdated: () => lifecycle.push('updated'), onUnmounted: () => lifecycle.push('unmounted'),
      onBeforeDispose: () => lifecycle.push('beforeDispose'), children: React.createElement('b', null, 'slot'),
    };
    await React.act(async () => { root.render(React.createElement(CompiledComponent, props)); });
    const handle = ref.current!;
    const exposes = handle.getExposes();
    const heldState = exposes.count;
    const heldMethod = exposes.add;
    expect(host.querySelector('output')?.textContent).toBe('2slot');
    expect(heldState.get()).toBe(4);
    expect(lifecycle).toEqual(['created', 'mounted']);

    const transitions: number[] = [];
    const off = heldState.subscribe((event) => transitions.push(event.next));
    await React.act(async () => { heldMethod(3); });
    expect(heldState.get()).toBe(7);
    expect(exposes.read()).toBe(7);
    expect(host.querySelector('output')?.textContent).toBe('2slot');
    expect(transitions).toEqual([7]);
    await React.act(async () => { handle.update(); handle.update(); handle.update(); });
    expect(host.querySelector('output')?.textContent).toBe('7slot');
    expect(lifecycle).toEqual(['created', 'mounted', 'updated']);

    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ...props, present: false })); });
    expect(host.querySelector('output')).toBeNull();
    expect(handle.getExposes().count).toBe(heldState);
    await React.act(async () => { heldMethod(2); handle.update(); });
    expect(heldState.get()).toBe(9);
    expect(host.querySelector('output')).toBeNull();
    expect(lifecycle).toEqual(['created', 'mounted', 'updated', 'unmounted']);
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ...props, present: true })); });
    expect(host.querySelector('output')?.textContent).toBe('9slot');
    expect(handle.getExposes().add).toBe(heldMethod);
    expect(lifecycle).toEqual(['created', 'mounted', 'updated', 'unmounted', 'mounted']);
    off();
    await React.act(async () => { heldMethod(1); });
    expect(transitions).toEqual([7, 9, 4]);

    await React.act(async () => { root.unmount(); });
    roots.splice(roots.indexOf(root), 1);
    expect(lifecycle).toEqual(['created', 'mounted', 'updated', 'unmounted', 'mounted', 'unmounted', 'beforeDispose']);
    expect(() => heldMethod(1)).toThrow(/terminal disposal/);
    expect(() => heldState.get()).toThrow(/terminal disposal/);
    expect(() => heldState.subscribe(() => undefined)).toThrow(/terminal disposal/);
    expect(() => handle.update()).toThrow(/terminal disposal/);
  });

  it('runs setup/created exactly once through StrictMode replay and never starts an abandoned shell', async () => {
    const { CompiledComponent } = await loadNative(numericSource);
    const { root } = mountHost();
    const callbacks: string[] = [];
    await React.act(async () => { root.render(React.createElement(React.StrictMode, null,
      React.createElement(CompiledComponent, { onCreated: () => callbacks.push('created'), onMounted: () => callbacks.push('mounted') })));
    });
    expect(callbacks).toEqual(['created', 'mounted']);
    await React.act(async () => { root.unmount(); });
    roots.splice(roots.indexOf(root), 1);
    const abandoned = mountHost();
    const pending = new Promise<never>(() => {});
    function Suspender(): React.ReactNode { throw pending; }
    await React.act(async () => { abandoned.root.render(React.createElement(React.Suspense, { fallback: 'pending' },
      React.createElement(CompiledComponent, { onCreated: () => callbacks.push('abandoned') }), React.createElement(Suspender)));
    });
    expect(abandoned.host.textContent).toBe('pending');
    expect(callbacks).toEqual(['created', 'mounted']);
  });

  it('withdraws missing props to defaults without reusing previous host values or implicitly rendering watcher writes', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'props-owner',setup(def){
      def.props.define({seed:{type:'number',default:1,empty:'fallback'}});
      def.props.setDefaults({seed:2});
      const count = def.state.numberRange('count',0,{min:0,max:100});
      def.expose.state('count',count);
      def.lifecycle.onCreated((run)=>{ count.set(run.props.get().seed ?? 0); });
      def.props.watch(['seed'],(_run,next)=>{ count.set(next.seed ?? 0); });
      return (r)=>r.el('span',count.get());
    }});`;
    const { CompiledComponent } = await loadNative(source);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref, seed: 10 })); });
    const state = ref.current!.getExposes().count;
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref, seed: null })); });
    expect(state.get()).toBe(10);
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref })); });
    expect(state.get()).toBe(2);
    expect(host.textContent).toBe('10');
    await React.act(async () => { ref.current!.update(); });
    expect(host.textContent).toBe('2');
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref, seed: 'invalid' })); });
    expect(state.get()).toBe(10);
    expect(host.textContent).toBe('2');
  });

  it('expands supported authored hooks once and enforces typed method/event boundaries', async () => {
    const hook = `import {defineAsHook} from '@proto.ui/core'; export const asCounter=defineAsHook({name:'asCounter',setup(def){
      const enabled = def.state.bool('enabled',true);
      const label = def.state.string('label','ready',{options:['ready','done']});
      def.expose.state('enabled',enabled);
      def.expose.state('label',label);
      def.expose.method('finish',()=>{ enabled.set(false); label.set('done'); });
    }});`;
    const source = `import {definePrototype} from '@proto.ui/core'; import {asCounter} from './counter';
      export default definePrototype({name:'typed-owner',setup(def){
        asCounter(); asCounter();
        const count=def.state.numberDiscrete('count',0);
        def.expose.state('count',count);
        def.expose.method('add',(amount:number)=>{count.set(count.get()+amount);});
        def.expose.method('read',()=>count.get());
        def.expose.event('changed',{payload:'json'});
        def.props.define({seed:{type:'number',default:0}});
        def.props.watch(['seed'],(run,next)=>{run.expose.emit('changed',next.seed ?? 0); count.set(run.props.get().seed ?? 0); run.update();});
        return (r)=>r.el('p',count.get());
      }});`;
    const { CompiledComponent } = await loadNative(source, { 'counter.ts': hook });
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const events: unknown[] = [];
    const onChanged = (value: unknown) => events.push(value);
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref, onChanged })); });
    const exposes = ref.current!.getExposes();
    const hookExposes = exposes as unknown as { enabled: ExternalState<boolean>; label: ExternalState<string>; finish(): void };
    await React.act(async () => { hookExposes.finish(); });
    expect(hookExposes.enabled.get()).toBe(false);
    expect(hookExposes.label.get()).toBe('done');
    expect(() => (exposes.add as unknown as (value: unknown) => void)('wrong')).toThrow(/invalid method arguments/);
    expect(exposes.read()).toBe(0);
    await React.act(async () => { root.render(React.createElement(CompiledComponent, { ref, seed: 12, onChanged })); });
    expect(events).toEqual([12]);
    expect(exposes.read()).toBe(12);
    expect(host.textContent).toBe('12');
  });

  it('rejects reached host capabilities before output instead of silently bridging native source', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core'; import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'unsupported-native',setup(def){asFocusable();return r=>r.el('div','value');}});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(emitReactSource(parsed.value)).toMatchObject({ ok: false, diagnostics: [{ category: 'unsupported-input' }] });
  });

  it('rejects component names that would shadow globals used by native lowering', () => {
    const parsed = parsePrototype(numericSource);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(emitReactSource(parsed.value, { componentName: 'Object' })).toMatchObject({
      ok: false, diagnostics: [{ category: 'invalid-input' }],
    });
  });
});
