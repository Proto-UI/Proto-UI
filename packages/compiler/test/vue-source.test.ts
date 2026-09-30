// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import * as Vue from 'vue';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

interface PublicState<T> {
  get(): T;
  subscribe(callback: (event: { type: 'next'; prev: T; next: T }) => void): () => void;
  unsubscribe(off: () => void): void;
  readonly spec: { kind: string; min?: number; max?: number };
}
interface CounterExposes {
  counter: PublicState<number>;
  write(next: number): void;
  bump(delta: number): number;
}
interface CounterHandle { update(): void; getExposes(): CounterExposes }

const counterSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'numeric-panel',setup(def){
  def.props.define({seed:{type:'number'},visible:{type:'boolean'}});
  def.props.setDefaults({seed:2,visible:true});
  const counter=def.state.numberRange('counter',2,{min:0,max:20,clamp:true});
  def.expose.state('counter',counter);
  def.expose.method('write',(next:number)=>{counter.set(next);});
  def.expose.method('bump',(delta:number)=>{counter.set(counter.get()+delta);return counter.get();});
  def.expose.event('phase',{payload:'json'});
  def.props.watch(['seed'],(run,next)=>{counter.set(next.seed);run.update();});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  def.lifecycle.onCreated((run)=>{
    counter.set(run.props.get().seed);
    run.lifecycle.setPresent(run.props.get().visible);
    run.expose.emit('phase','created');
  });
  def.lifecycle.onMounted((run)=>{run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('phase','updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('phase','unmounted');});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('phase','disposed');});
  return (render)=>render.el('section',{},[counter.get(),render.slot()]);
}});`;

function component(source: string, files?: Record<string, string>): Vue.Component {
  const parsed = parsePrototype(source, { fileName: 'fixture.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVueSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const javascript = ts.transpileModule(emitted.value.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  // Execute the generated artifact, never the authored Proto source. Any hidden bridge fails here.
  new Function('require', 'exports', javascript)((specifier: string) => {
    if (specifier !== 'vue') throw new Error(`Unexpected generated dependency: ${specifier}`);
    return Vue;
  }, exports);
  if (!exports.default || typeof exports.default !== 'object') throw new Error('No generated Vue component');
  // The object came from the generated defineComponent call, not an external input.
  const generated = exports.default as Vue.Component;
  return generated;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

describe('Vue 3 native source', () => {
  it('retains a numeric owner across presence epochs and commits lifecycle after the DOM', async () => {
    const Generated = component(counterSource);
    const input = Vue.shallowRef({ seed: 4, visible: false });
    const handle = Vue.shallowRef<CounterHandle>();
    const phase: Array<{ kind: string; text: string }> = [];
    const host = document.createElement('div');
    const app = Vue.createApp(Vue.defineComponent({
      setup() {
        return () => Vue.h(Generated, {
          ...input.value, ref: handle,
          onPhase: (kind: string) => phase.push({ kind, text: host.textContent ?? '' }),
        });
      },
    }));
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!;
      const exposed = owner.getExposes();
      const state = exposed.counter;
      expect(state.get()).toBe(4);
      expect(host.querySelector('section')).toBeNull();
      expect(phase).toEqual([{ kind: 'created', text: '' }]);

      input.value = { seed: 4, visible: true };
      await settle();
      expect(host.textContent).toBe('4');
      expect(phase.at(-1)).toEqual({ kind: 'mounted', text: '4' });
      expect(owner.getExposes().counter).toBe(state);

      exposed.write(7);
      await settle();
      expect(state.get()).toBe(7);
      expect(host.textContent).toBe('4');
      owner.update();
      await settle();
      expect(host.textContent).toBe('7');
      expect(phase.at(-1)).toEqual({ kind: 'updated', text: '7' });

      input.value = { seed: 4, visible: false };
      await settle();
      expect(host.querySelector('section')).toBeNull();
      expect(phase.at(-1)).toEqual({ kind: 'unmounted', text: '' });
      expect(exposed.bump(2)).toBe(9);
      owner.update();
      await settle();
      input.value = { seed: 4, visible: true };
      await settle();
      expect(host.textContent).toBe('9');
      expect(owner.getExposes().counter).toBe(state);
      expect(phase.filter((entry) => entry.kind === 'created')).toEqual([{ kind: 'created', text: '' }]);
      expect(phase.at(-1)).toEqual({ kind: 'mounted', text: '9' });

      // Queue a redraw and terminate before Vue can commit it.
      exposed.write(10);
      owner.update();
      app.unmount();
      await settle();
      expect(phase.slice(-2)).toEqual([{ kind: 'unmounted', text: '' }, { kind: 'disposed', text: '' }]);
      expect(() => exposed.bump(1)).toThrow(/disposed/);
      expect(() => state.get()).toThrow(/disposed/);
      expect(() => owner.update()).toThrow(/disposed/);
    } finally {
      app.unmount();
    }
  });

  it('keeps slots under Vue composition without rendering plain state writes', async () => {
    const Generated = component(counterSource);
    const handle = Vue.shallowRef<CounterHandle>();
    const label = Vue.ref('first');
    const host = document.createElement('div');
    const app = Vue.createApp(Vue.defineComponent({
      setup() {
        return () => Vue.h(Generated, { ref: handle }, { default: () => Vue.h('em', label.value) });
      },
    }));
    app.mount(host);
    try {
      await settle();
      const exposed = handle.value!.getExposes();
      exposed.write(8);
      label.value = 'second';
      await settle();
      expect(host.querySelector('em')?.textContent).toBe('second');
      expect(host.textContent).toBe('2second');
      handle.value!.update();
      await settle();
      expect(host.textContent).toBe('8second');
    } finally {
      app.unmount();
    }
  });

  it('normalizes host props without Boolean casting and distinguishes missing from invalid values', async () => {
    const Generated = component(counterSource);
    const input = Vue.shallowRef<Record<string, unknown>>({ seed: 6, visible: true });
    const handle = Vue.shallowRef<CounterHandle>();
    const host = document.createElement('div');
    const app = Vue.createApp(Vue.defineComponent({
      setup() { return () => Vue.h(Generated, { ...input.value, ref: handle }); },
    }));
    app.mount(host);
    try {
      await settle();
      expect(host.textContent).toBe('6');
      input.value = { seed: 'invalid', visible: '' };
      await settle();
      expect(host.textContent).toBe('6');
      input.value = {};
      await settle();
      expect(host.textContent).toBe('2');
      expect(handle.value!.getExposes().counter.get()).toBe(2);
    } finally {
      app.unmount();
    }
  });

  it('delivers reentrant state transitions in order and rejects invalid numeric writes', async () => {
    const Generated = component(counterSource);
    const host = document.createElement('div');
    const app = Vue.createApp(Generated);
    // Vue's exposed public handle is intentionally distinct from the component's internal instance.
    const mounted = app.mount(host) as unknown as CounterHandle;
    try {
      const exposed = mounted.getExposes();
      const values: number[] = [];
      const offA = exposed.counter.subscribe((event) => {
        if (event.next === 3) exposed.write(4);
      });
      const offB = exposed.counter.subscribe((event) => values.push(event.next));
      exposed.write(3);
      expect(values).toEqual([3, 4]);
      expect(exposed.counter.get()).toBe(4);
      expect(() => exposed.write(21)).toThrow(/range/);
      expect(exposed.counter.get()).toBe(4);
      exposed.counter.unsubscribe(offA);
      offB();
      exposed.write(5);
      expect(values).toEqual([3, 4]);
      await settle();
      expect(host.textContent).toBe('2');
    } finally {
      app.unmount();
    }
  });

  it('expands static authored hook control flow and diagnoses unsupported reached hook operations', async () => {
    const Generated = component(`import {definePrototype} from '@proto.ui/core';import {install} from './hook';
      export default definePrototype({name:'hook-owner',setup(def){install();return (render)=>render.el('output','hook');}});`, {
      'hook.ts': `import {defineAsHook} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';
      export const install=defineAsHook({name:'install',setup(def){
        const unused=()=>{asFocusable();};const alias=unused;
        const value=def.state.numberDiscrete('hook.count',2,{options:[2,4]});
        def.expose.state('fromHook',value);
      }});`,
    });
    const host = document.createElement('div');
    const app = Vue.createApp(Generated);
    // The static hook declares the same public state shape as direct declarations.
    const mounted = app.mount(host) as unknown as { getExposes(): { fromHook: PublicState<number> } };
    try {
      expect(host.textContent).toBe('hook');
      expect(mounted.getExposes().fromHook.get()).toBe(2);
    } finally {
      app.unmount();
    }
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';import {install} from './hook';
      export default definePrototype({name:'unsupported',setup(){install();}});`, {
      fileName: 'fixture.proto.ts',
      files: { 'hook.ts': `import {defineAsHook} from '@proto.ui/core';import {asAccessible} from '@proto.ui/hooks';
        export const install=defineAsHook({name:'install',setup(){asAccessible();}});` },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const rejected = emitVueSource(parsed.value);
    expect(rejected).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4003', span: { file: 'hook.ts', line: 2 } }] });
  });

  it('clamps range defaults only and preserves string/discrete option constraints', async () => {
    const Generated = component(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'constraint-panel',setup(def){
        const range=def.state.numberRange('range',12,{min:0,max:10,clamp:true});
        const choice=def.state.numberDiscrete('choice',2,{options:[2,4]});
        const label=def.state.string('label','red',{options:['red','blue']});
        const enabled=def.state.bool('enabled',false);
        def.expose.state('range',range);def.expose.state('choice',choice);def.expose.state('label',label);
        def.expose.method('setRange',(next:number)=>{range.set(next);});
        def.expose.method('setChoice',(next:number)=>{choice.set(next);});
        def.expose.method('setLabel',(next:string)=>{label.set(next);});
        def.expose.method('toggle',()=>{enabled.set(!enabled.get());return enabled.get();});
        return (render)=>{
          if(enabled.get()){return render.el('output',{},[range.get(),label.get(),choice.get(),'on']);}
          return render.el('output',{},[range.get(),label.get(),choice.get(),'off']);
        };
      }});`);
    interface ConstraintExposes {
      range: PublicState<number>; choice: PublicState<number>; label: PublicState<string>;
      setRange(next: number): void; setChoice(next: number): void; setLabel(next: string): void; toggle(): boolean;
    }
    const host = document.createElement('div');
    const app = Vue.createApp(Generated);
    // The exposed API shape is supplied by the generated declaration for this fixture.
    const mounted = app.mount(host) as unknown as { update(): void; getExposes(): ConstraintExposes };
    try {
      const exposed = mounted.getExposes();
      expect(host.textContent).toBe('10red2off');
      expect(() => exposed.setRange(11)).toThrow(/range/);
      expect(exposed.range.get()).toBe(10);
      expect(() => exposed.setChoice(3)).toThrow(/options/);
      expect(exposed.choice.get()).toBe(2);
      expect(() => exposed.setLabel('green')).toThrow(/options/);
      expect(exposed.label.get()).toBe('red');
      exposed.setRange(5); exposed.setChoice(4); exposed.setLabel('blue');
      expect(exposed.toggle()).toBe(true);
      mounted.update();
      await settle();
      expect(host.textContent).toBe('5blue4on');
    } finally {
      app.unmount();
    }
  });
});
