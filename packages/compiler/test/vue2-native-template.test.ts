// @vitest-environment happy-dom
import path from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import Vue2, { type ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVue2Source } from '../src/vue2-source';
import { validateIR } from '../src/ir-validation';
import { collectVue2IdentityOnlyFunctions } from '../src/vue2-native-template';
import { editingInput, physicalRootInput as physical } from './vue2-native-editor-fixtures';
import type { ExpressionIR, FunctionIR, GeneratedModule, PrototypeIR } from '../src/ir';

// The original 12 commit/slot cases remain separate and unchanged. These are
// additional call-context/representation controls, not substitutes for them or
// for complete generated strict/SSR/browser/build acceptance.
function prototype(body: string, declarations = ''): PrototypeIR {
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
${declarations}
export default definePrototype({name:'native-shapes',setup(def){${body}}});`,
    { fileName: 'native-shapes.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

const evidenceRoot = process.env.PUI_VUE2_NATIVE_EVIDENCE_DIR;
let evidenceBytes = 0;
let compilations = 0;
function capture(directory: string | undefined, relative: string, contents: string) {
  if (!directory) return;
  if (
    path.posix.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Unsafe native evidence path');
  const bytes = Buffer.byteLength(contents);
  evidenceBytes += bytes;
  if (bytes > 8 * 1024 * 1024 || evidenceBytes > 64 * 1024 * 1024)
    throw new Error('Native evidence byte budget');
  const target = path.join(directory, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, { flag: 'wx' });
}
function compile(
  input: PrototypeIR,
  emitterOptions?: Parameters<typeof emitVue2Source>[1]
): GeneratedModule {
  let directory: string | undefined;
  if (evidenceRoot) {
    if (!path.isAbsolute(evidenceRoot) || ++compilations > 50)
      throw new Error('Unexpected native evidence root or compilation count');
    mkdirSync(evidenceRoot, { recursive: true });
    directory = mkdtempSync(path.join(evidenceRoot, 'compile-'));
    // Checked-IR controls are explicitly retained as such; the parsed authored
    // graph alone must not be presented as their mutated actual emitter input.
    capture(
      directory,
      'input.json',
      JSON.stringify(
        {
          test: expect.getState().currentTestName,
          checkedIR: input,
          ...(emitterOptions === undefined ? {} : { emitterOptions }),
          authoredGraph: input.sourceFiles,
          note: 'Actual checked-IR emitter input; runtime transpilation is not strict validation.',
        },
        null,
        2
      )
    );
  }
  const result = emitVue2Source(input, emitterOptions);
  capture(directory, 'result.json', JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  for (const file of [
    { path: 'Component.js', contents: result.value.code },
    ...(result.value.supportingFiles ?? []),
  ]) {
    capture(directory, `emitted/${file.path}`, file.contents);
  }
  return result.value;
}

function options(module: GeneratedModule, allowPositioning = false): ComponentOptions<Vue2> {
  const sources = new Map([
    ['Component.js', module.code],
    ...(module.supportingFiles ?? []).map((file) => [file.path, file.contents] as [string, string]),
  ]);
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file);
    if (prior) return prior;
    const source = sources.get(file);
    if (source === undefined) throw new Error(`Missing actual generated source ${file}`);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const javascript = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue2;
      if (allowPositioning && specifier === '@floating-ui/dom') {
        return createRequire(
          fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
        )(specifier);
      }
      if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency ${specifier}`);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const resolved = [base, `${base}.ts`, `${base}.js`].find((candidate) =>
        sources.has(candidate)
      );
      if (!resolved) throw new Error(`Unclosed actual generated import ${specifier}`);
      return load(resolved);
    }, exports);
    return exports;
  }
  return load('Component.js').default as ComponentOptions<Vue2>;
}

function nativeField(object: unknown, name: string): unknown {
  if (!object || (typeof object !== 'object' && typeof object !== 'function'))
    throw new Error(`Missing receiver for ${name}`);
  return Reflect.get(object, name);
}
function nativeMethod(object: unknown, name: string): (...args: unknown[]) => unknown {
  const fn = nativeField(object, name);
  if (typeof fn !== 'function') throw new Error(`Missing method ${name}`);
  return (...args) => Reflect.apply(fn, object, args);
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});
async function mount(
  input: PrototypeIR,
  components?: ComponentOptions<Vue2>['components'],
  allowPositioning = false
) {
  const module = compile(input);
  const native = options(module, allowPositioning);
  if (components) native.components = components;
  const slot = Vue2.observable({ text: 'S0' });
  const app = new Vue2({
    render(h) {
      return h(native, {
        scopedSlots: { default: () => [h('em', { attrs: { 'data-live-slot': '' } }, slot.text)] },
      });
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const close = () => {
    app.$destroy();
    host.remove();
  };
  cleanup.push(close);
  app.$mount();
  host.append(app.$el);
  await Vue2.nextTick();
  await Vue2.nextTick();
  return { host, slot, module, child: app.$children[0], close };
}

function renderFunction(ir: PrototypeIR): FunctionIR {
  const returned = ir.setup.body.find((statement) => statement.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
    throw new Error('Expected fixture render function');
  return returned.value.function;
}

describe('Vue2 compiler-native child construction', () => {
  it('preserves lifecycle registration order and run binding across native view epochs', async () => {
    const module = compile(
      prototype(`
      def.props.define({present:{type:'boolean',default:true},marker:{type:'string',default:'P'}});
      def.expose.event('trace',{payload:'json'});
      def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
      def.lifecycle.onCreated(run=>{run.expose.emit('trace','created-1:'+run.props.get().marker);});
      def.lifecycle.onCreated(run=>{run.expose.emit('trace','created-2:'+run.props.get().marker);});
      def.lifecycle.onMounted(run=>{run.expose.emit('trace','mounted-1:'+run.props.get().marker);});
      def.lifecycle.onMounted(run=>{run.expose.emit('trace','mounted-2:'+run.props.get().marker);});
      def.lifecycle.onUpdated(run=>{run.expose.emit('trace','updated-1:'+run.props.get().marker);});
      def.lifecycle.onUpdated(run=>{run.expose.emit('trace','updated-2:'+run.props.get().marker);});
      def.lifecycle.onUnmounted(run=>{run.expose.emit('trace','unmounted-1:'+run.props.get().marker);});
      def.lifecycle.onUnmounted(run=>{run.expose.emit('trace','unmounted-2:'+run.props.get().marker);});
      def.lifecycle.onBeforeDispose(run=>{run.expose.emit('trace','dispose-1:'+run.props.get().marker);});
      def.lifecycle.onBeforeDispose(run=>{run.expose.emit('trace','dispose-2:'+run.props.get().marker);});
      return r=>r.el('output',['view',r.slot()]);
    `)
    );
    const native = options(module),
      input = Vue2.observable({ present: true, slot: 'S0' });
    const events: unknown[] = [];
    const app = new Vue2({
      render(h) {
        return h(native, {
          props: { present: input.present },
          on: {
            trace: (payload: unknown) => {
              events.push(payload);
            },
          },
          scopedSlots: { default: () => [h('em', input.slot)] },
        });
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    const flush = async () => {
      for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    };
    app.$mount();
    host.append(app.$el);
    await flush();
    const child = app.$children[0];
    const initial = ['created-1:P', 'created-2:P', 'mounted-1:P', 'mounted-2:P'];
    expect(events).toEqual(initial);
    expect(host.querySelector('output')?.textContent).toBe('viewS0');
    input.slot = 'S1';
    await flush();
    expect(events).toEqual(initial); // Slot paint is not an authored lifecycle commit.
    expect(host.querySelector('output')?.textContent).toBe('viewS1');
    nativeMethod(child, 'update')();
    await flush();
    const updated = [...initial, 'updated-1:P', 'updated-2:P'];
    expect(events).toEqual(updated);
    input.present = false;
    await flush();
    const detached = [...updated, 'unmounted-1:P', 'unmounted-2:P'];
    expect(events).toEqual(detached);
    expect(host.querySelector('output')).toBeNull();
    input.slot = 'S2';
    await flush();
    expect(events).toEqual(detached);
    input.present = true;
    await flush();
    const reopened = [...detached, 'mounted-1:P', 'mounted-2:P'];
    expect(events).toEqual(reopened);
    expect(host.querySelector('output')?.textContent).toBe('viewS2');
    app.$destroy();
    const disposed = [...reopened, 'unmounted-1:P', 'unmounted-2:P', 'dispose-1:P', 'dispose-2:P'];
    expect(events).toEqual(disposed);
    app.$destroy();
    input.present = false;
    input.slot = 'S3';
    await flush();
    expect(events).toEqual(disposed);
    expect(nativeMethod(child, 'getExposes')()).toEqual({});
  });

  it('keeps lifecycle throw order while finishing terminal state cleanup and invalidation', async () => {
    const view = await mount(
      prototype(`
      const first=def.state.numberRange('first',0,{min:0,max:1});
      const second=def.state.numberRange('second',0,{min:0,max:1});
      def.expose.state('first',first);def.expose.state('second',second);
      def.expose.method('write',(next:number)=>first.set(next));
      def.expose.event('trace',{payload:'json'});
      def.lifecycle.onUnmounted(run=>{run.expose.emit('trace','unmounted-1');first.set(2);});
      def.lifecycle.onUnmounted(run=>{run.expose.emit('trace','unmounted-2');});
      def.lifecycle.onBeforeDispose(run=>{run.expose.emit('trace','dispose-1');second.set(2);});
      def.lifecycle.onBeforeDispose(run=>{run.expose.emit('trace','dispose-2');});
      return r=>r.el('output',[first.get(),second.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    const first = nativeField(exposed, 'first'),
      second = nativeField(exposed, 'second');
    const write = nativeMethod(exposed, 'write'),
      readFirst = nativeMethod(first, 'get');
    const events: unknown[] = [],
      errors: unknown[] = [];
    view.child.$on('trace', (payload: unknown) => {
      events.push(payload);
    });
    nativeMethod(
      first,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') events.push('disconnect-first');
    });
    nativeMethod(
      second,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') events.push('disconnect-second');
    });
    const previousHandler = Vue2.config.errorHandler;
    Vue2.config.errorHandler = (error) => {
      errors.push(error);
    };
    try {
      view.close();
    } finally {
      Vue2.config.errorHandler = previousHandler;
    }
    expect(events).toEqual(['unmounted-1', 'dispose-1', 'disconnect-first', 'disconnect-second']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(nativeField(errors[0], 'message')).toBe('[Vue2 native] state value out of range: first');
    expect(() => readFirst()).toThrow('terminally invalidated');
    expect(() => write(1)).toThrow('terminally invalidated');
    expect(() => nativeMethod(second, 'get')()).toThrow('terminally invalidated');
    expect(nativeMethod(view.child, 'getExposes')()).toEqual({});
    view.close();
    expect(events).toEqual(['unmounted-1', 'dispose-1', 'disconnect-first', 'disconnect-second']);
    expect(view.host.isConnected).toBe(false);
  });

  it('preserves resolved watcher hydration, coalesced snapshots, registration order and run binding', async () => {
    const module = compile(
      prototype(`
      def.props.define({value:{type:'number',default:0},other:{type:'number',default:10}});
      def.expose.event('observed',{payload:'json'});
      def.props.watch(['value'],(run,next,previous)=>{
        run.expose.emit('observed',{name:'first',next:next.value,previous:previous.value,
          bound:run.props.get().value,provided:run.props.isProvided('value')});
      });
      def.props.watch(['value','other'],(run,next,previous)=>{
        run.expose.emit('observed',{name:'second',next:next.value,previous:previous.value,
          bound:run.props.get().value,provided:run.props.isProvided('value')});
      });
      return r=>r.el('output',[r.read.props.get().value,r.slot()]);
    `)
    );
    const native = options(module);
    const input = Vue2.observable({ props: {} as Record<string, unknown>, slot: 'S0' });
    const events: unknown[] = [];
    const app = new Vue2({
      render(h) {
        return h(native, {
          props: input.props,
          on: {
            observed: (payload: unknown) => {
              events.push(payload);
            },
          },
          scopedSlots: { default: () => [h('em', input.slot)] },
        });
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    app.$mount();
    host.append(app.$el);
    const flush = async () => {
      for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    };
    await flush();
    expect(events).toEqual([]);
    expect(host.querySelector('output')?.textContent).toBe('0S0');
    input.props = { value: 1 };
    input.props = { value: 2 };
    await flush();
    expect(events).toEqual([
      { name: 'first', next: 2, previous: 0, bound: 2, provided: true },
      { name: 'second', next: 2, previous: 0, bound: 2, provided: true },
    ]);
    expect(host.querySelector('output')?.textContent).toBe('2S0');
    events.length = 0;
    input.props = { value: 'invalid raw number' };
    input.slot = 'S1';
    await flush();
    expect(events).toEqual([]);
    expect(host.querySelector('output')?.textContent).toBe('2S1');
    input.props = { value: 2, other: 11 };
    await flush();
    expect(events).toEqual([{ name: 'second', next: 2, previous: 2, bound: 2, provided: true }]);
    events.length = 0;
    input.props = { value: -0, other: 11 };
    await flush();
    expect(events).toEqual([
      { name: 'first', next: -0, previous: 2, bound: -0, provided: true },
      { name: 'second', next: -0, previous: 2, bound: -0, provided: true },
    ]);
    events.length = 0;
    input.props = { value: 0, other: 11 };
    await flush();
    expect(events).toEqual([
      { name: 'first', next: 0, previous: -0, bound: 0, provided: true },
      { name: 'second', next: 0, previous: -0, bound: 0, provided: true },
    ]);
    expect(host.querySelector('output')?.textContent).toBe('0S1');
  });

  it('keeps a setup-returned props watcher disposer inactive through repeated native invocation and cleanup', async () => {
    const module = compile(
      prototype(`
      def.props.define({value:{type:'number',default:0}});
      def.expose.event('observed',{payload:'json'});
      const stop=def.props.watch(['value'],(run,next)=>{run.expose.emit('observed',next.value);});
      return stop;
    `)
    );
    const native = options(module);
    const input = Vue2.observable({ value: 0 });
    const events: unknown[] = [];
    const app = new Vue2({
      render(h) {
        return h(native, {
          props: { value: input.value },
          on: {
            observed: (payload: unknown) => {
              events.push(payload);
            },
          },
          scopedSlots: { default: () => [h('em', 'not-an-authored-renderer')] },
        });
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    app.$mount();
    host.append(app.$el);
    const flush = async () => {
      for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    };
    await flush();
    expect(events).toEqual([]);
    expect(host.textContent).toBe('');
    const child = app.$children[0];
    nativeMethod(child, 'update')();
    nativeMethod(child, 'update')();
    input.value = 1;
    await flush();
    input.value = 2;
    await flush();
    expect(events).toEqual([]);
    expect(host.textContent).toBe('');
    app.$destroy();
    input.value = 3;
    await flush();
    expect(events).toEqual([]);
  });

  it('preserves queued native update commits without treating live-slot paint as an authored commit', async () => {
    const view = await mount(
      prototype(`
      const value=def.state.numberDiscrete('value',0);
      const updates=def.state.numberDiscrete('updates',0);
      def.lifecycle.onUpdated(()=>{updates.set(updates.get()+1);});
      def.expose.state('value',value);def.expose.state('updates',updates);
      def.expose.method('write',(next:number)=>value.set(next));
      return r=>r.el('output',[value.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    const write = nativeMethod(exposed, 'write');
    const updates = nativeField(exposed, 'updates');
    const committed: Array<string | null | undefined> = [];
    // Actual Vue hook observation after its DOM patch, not an emitter mock or
    // a replacement commit callback.
    view.child.$on('hook:updated', () => {
      committed.push(view.host.querySelector('output')?.textContent);
    });
    write(1);
    nativeMethod(view.child, 'update')();
    write(2);
    nativeMethod(view.child, 'update')();
    expect(view.host.querySelector('output')?.textContent).toBe('0S0');
    expect(nativeMethod(updates, 'get')()).toBe(0);
    // Two native patches and their two owner post-patch callbacks.
    for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    expect(committed).toEqual(['1S0', '2S0']);
    expect(nativeMethod(updates, 'get')()).toBe(2);
    expect(view.host.querySelector('output')?.textContent).toBe('2S0');
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(committed).toEqual(['1S0', '2S0', '2S1']);
    expect(nativeMethod(updates, 'get')()).toBe(2);
    expect(view.host.querySelector('output')?.textContent).toBe('2S1');
  });

  it('retires the old queued commit when an updated callback detaches and a later prop reopens', async () => {
    const module = compile(
      prototype(`
      def.props.define({present:{type:'boolean',default:true}});
      def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
      const value=def.state.numberDiscrete('value',0);
      const mounts=def.state.numberDiscrete('mounts',0);
      const updates=def.state.numberDiscrete('updates',0);
      const unmounts=def.state.numberDiscrete('unmounts',0);
      def.lifecycle.onMounted(()=>{mounts.set(mounts.get()+1);});
      def.lifecycle.onUnmounted(()=>{unmounts.set(unmounts.get()+1);});
      def.lifecycle.onUpdated(run=>{
        updates.set(updates.get()+1);
        if(updates.get()===1)run.lifecycle.setPresent(false);
      });
      def.expose.state('mounts',mounts);def.expose.state('updates',updates);
      def.expose.state('unmounts',unmounts);
      def.expose.method('write',(next:number)=>value.set(next));
      return r=>r.el('output',[value.get(),r.slot()]);
    `)
    );
    const native = options(module),
      input = Vue2.observable({ present: true, slot: 'S0' });
    const app = new Vue2({
      render(h) {
        return h(native, {
          props: { present: input.present },
          scopedSlots: { default: () => [h('em', input.slot)] },
        });
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    app.$mount();
    host.append(app.$el);
    await Vue2.nextTick();
    await Vue2.nextTick();
    const child = app.$children[0],
      exposed = nativeMethod(child, 'getExposes')();
    const count = (name: string) => nativeMethod(nativeField(exposed, name), 'get')();
    expect(host.querySelector('output')?.textContent).toBe('0S0');
    expect([count('mounts'), count('updates'), count('unmounts')]).toEqual([1, 0, 0]);
    nativeMethod(exposed, 'write')(1);
    nativeMethod(child, 'update')();
    nativeMethod(child, 'update')();
    for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    expect(host.querySelector('output')).toBeNull();
    expect([count('mounts'), count('updates'), count('unmounts')]).toEqual([1, 1, 1]);
    input.present = false;
    await Vue2.nextTick();
    await Vue2.nextTick();
    input.slot = 'S1';
    input.present = true;
    for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    expect(host.querySelector('output')?.textContent).toBe('1S1');
    expect([count('mounts'), count('updates'), count('unmounts')]).toEqual([2, 1, 1]);
    nativeMethod(exposed, 'write')(2);
    nativeMethod(child, 'update')();
    for (let tick = 0; tick < 4; tick += 1) await Vue2.nextTick();
    expect(host.querySelector('output')?.textContent).toBe('2S1');
    expect([count('mounts'), count('updates'), count('unmounts')]).toEqual([2, 2, 1]);
  });

  it('preserves owned state family validation, defaults and committed native publication', async () => {
    const view = await mount(
      prototype(`
      const flag=def.state.bool('flag',false);
      const text=def.state.string('text','A',{options:['A','B']});
      const choice=def.state.enum('choice','one',{options:['one','two']});
      const count=def.state.numberDiscrete('count',0,{min:0,max:10,step:2});
      const range=def.state.numberRange('range',20,{min:0,max:10,clamp:true});
      flag.setDefault(true);text.setDefault('B');range.setDefault(-5);
      def.expose.state('flag',flag);def.expose.state('text',text);
      def.expose.state('choice',choice);def.expose.state('count',count);def.expose.state('range',range);
      def.expose.method('writeText',(next:string)=>text.set(next));
      def.expose.method('writeChoice',(next:string)=>choice.set(next));
      def.expose.method('writeCount',(next:number)=>count.set(next));
      def.expose.method('writeRange',(next:number)=>range.set(next));
      const marker=()=>{if(flag.get())return 'T';return 'F';};
      return r=>r.el('output',[marker(),text.get(),choice.get(),count.get(),range.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    expect(view.host.querySelector('output')?.textContent).toBe('TBone00S0');
    const text = nativeField(exposed, 'text'),
      range = nativeField(exposed, 'range');
    expect(nativeMethod(text, 'get')()).toBe('B');
    expect(nativeMethod(range, 'get')()).toBe(0);
    expect(Object.isFrozen(nativeField(range, 'spec'))).toBe(true);
    expect(nativeField(range, 'spec')).toMatchObject({
      kind: 'number.range',
      min: 0,
      max: 10,
      clamp: true,
    });
    expect(() => nativeMethod(exposed, 'writeText')('C')).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeChoice')('three')).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeCount')(3)).toThrow('violates step');
    expect(() => nativeMethod(exposed, 'writeRange')(11)).toThrow('out of range');
    expect(nativeMethod(range, 'get')()).toBe(0); // set does not use initialization clamp.
    nativeMethod(exposed, 'writeText')('A');
    nativeMethod(exposed, 'writeChoice')('two');
    nativeMethod(exposed, 'writeCount')(4);
    nativeMethod(exposed, 'writeRange')(7);
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('TBone00S1');
    nativeMethod(view.child, 'update')();
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('TAtwo47S1');
  });

  it('keeps owned state subscriber snapshots, reentry and queued work after a thrown callback', async () => {
    const view = await mount(
      prototype(`
      const count=def.state.numberDiscrete('count',0);
      def.expose.state('count',count);
      def.expose.method('write',(next:number)=>count.set(next));
      return r=>r.el('output',[count.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    const state = nativeField(exposed, 'count');
    const write = nativeMethod(exposed, 'write');
    const events: string[] = [];
    let offSecond: unknown;
    nativeMethod(
      state,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') !== 'next') return;
      const next = nativeField(event, 'next');
      events.push(`A${String(next)}`);
      if (next === 1) {
        if (typeof offSecond !== 'function') throw new Error('Missing second unsubscribe');
        offSecond();
        write(2);
      }
    });
    offSecond = nativeMethod(
      state,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'next')
        events.push(`B${String(nativeField(event, 'next'))}`);
    });
    nativeMethod(
      state,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'next')
        events.push(`C${String(nativeField(event, 'next'))}`);
    });
    write(1);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2']);
    expect(nativeMethod(state, 'get')()).toBe(2);
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('0S1');
    nativeMethod(view.child, 'update')();
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('2S1');
    const failure = new Error('state subscriber failure');
    const offThrower = nativeMethod(
      state,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'next' && nativeField(event, 'next') === 3) {
        events.push('D3');
        write(4);
        throw failure;
      }
    });
    expect(() => write(3)).toThrow(failure);
    expect(nativeMethod(state, 'get')()).toBe(4);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'D3']);
    expect(view.host.querySelector('output')?.textContent).toBe('2S1');
    if (typeof offThrower !== 'function') throw new Error('Missing throwing unsubscribe');
    offThrower();
    write(5);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'D3', 'A4', 'C4', 'A5', 'C5']);
    expect(nativeMethod(state, 'get')()).toBe(5);
    nativeMethod(view.child, 'update')();
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('5S1');
  });

  it('preserves structurally admitted extra state fields instead of assuming closed schemas', async () => {
    const view = await mount(
      prototype(`
      const text=def.state.string('text','B',{min:'A'});
      const range=def.state.numberRange('range',5,{min:0,max:10,clamp:true,options:[0,5,10]});
      def.expose.state('text',text);def.expose.state('range',range);
      def.expose.method('writeText',(next:string)=>text.set(next));
      def.expose.method('writeRange',(next:number)=>range.set(next));
      return r=>r.el('output',[text.get(),range.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    expect(view.host.querySelector('output')?.textContent).toBe('B5S0');
    // The checked operation schemas are structural. These fields are retained
    // compatibility behavior, not a newly promoted State specification guarantee.
    expect(() => nativeMethod(exposed, 'writeText')('0')).toThrow('out of range');
    expect(() => nativeMethod(exposed, 'writeRange')(8)).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeRange')(-1)).toThrow('not in options');
    expect(nativeMethod(nativeField(exposed, 'text'), 'get')()).toBe('B');
    expect(nativeMethod(nativeField(exposed, 'range'), 'get')()).toBe(5);
    nativeMethod(exposed, 'writeText')('C');
    nativeMethod(exposed, 'writeRange')(10);
    nativeMethod(view.child, 'update')();
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('C10S0');
  });

  it('continues other owned state cleanup after a disconnect throw and retires old handles', async () => {
    const view = await mount(
      prototype(`
      const first=def.state.string('first','A');const second=def.state.numberDiscrete('second',0);
      def.expose.state('first',first);def.expose.state('second',second);
      def.expose.method('write',(next:string)=>first.set(next));
      return r=>r.el('output',[first.get(),second.get(),r.slot()]);
    `)
    );
    const exposed = nativeMethod(view.child, 'getExposes')();
    const first = nativeField(exposed, 'first'),
      second = nativeField(exposed, 'second');
    const write = nativeMethod(exposed, 'write'),
      readFirst = nativeMethod(first, 'get');
    const disconnects: string[] = [],
      errors: unknown[] = [];
    const failure = new Error('first disconnect failure');
    nativeMethod(
      first,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') {
        disconnects.push('first');
        throw failure;
      }
    });
    nativeMethod(
      second,
      'subscribe'
    )((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') disconnects.push('second');
    });
    const previousHandler = Vue2.config.errorHandler;
    Vue2.config.errorHandler = (error) => {
      errors.push(error);
    };
    try {
      view.close();
    } finally {
      Vue2.config.errorHandler = previousHandler;
    }
    expect(disconnects).toEqual(['first', 'second']);
    expect(errors).toContain(failure);
    expect(() => readFirst()).toThrow('terminally invalidated');
    expect(() => write('B')).toThrow('terminally invalidated');
    expect(() => nativeMethod(first, 'subscribe')(() => {})).toThrow('terminally invalidated');
    expect(() => nativeMethod(second, 'get')()).toThrow('terminally invalidated');
    view.close();
    expect(disconnects).toEqual(['first', 'second']);
    expect(view.host.isConnected).toBe(false);
  });

  it('uses native paint closures, nested finite arrays and live native slots', async () => {
    const view = await mount(
      prototype(`return r=>{
      const child=r.el('b','captured');
      return r.el('section',[child,['text',null,3],r.slot()]);
    };`)
    );
    expect(view.host.querySelector('section')?.textContent).toBe('capturedtext3S0');
    expect(view.module.code).not.toContain('function __puiChildren');
    expect(view.module.code).not.toContain('Object.freeze({ tag, children');
    expect(view.module.code).not.toContain('Object.freeze({ slot: true })');
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('section')?.textContent).toBe('capturedtext3S1');
  });

  it('matches native Vue2 numeric normalization through nested children and live slots', async () => {
    const view = await mount(
      prototype(`return r=>r.el('output',[
      0,-0,'|',1.25,0/0,1/0,-1/0,['nested:',0,-0],r.slot()
    ]);`)
    );
    // Vue2 2.6.14 accepts numeric children at runtime, but its VNodeChildren
    // declaration omits them. Reflect.apply exercises the real native h with
    // raw numbers as a runtime differential, not as a strict consumer or a
    // replacement for the actual generated module above.
    const reference = new Vue2({
      render(h) {
        const raw = [
          0,
          -0,
          '|',
          1.25,
          0 / 0,
          1 / 0,
          -1 / 0,
          ['nested:', 0, -0],
          h('em', { attrs: { 'data-live-slot': '' } }, view.slot.text),
        ];
        return Reflect.apply(h, undefined, ['output', {}, raw]);
      },
    });
    const referenceHost = document.createElement('div');
    document.body.append(referenceHost);
    cleanup.push(() => {
      reference.$destroy();
      referenceHost.remove();
    });
    reference.$mount();
    referenceHost.append(reference.$el);
    const snapshot = (host: HTMLElement) => {
      const output = host.querySelector('output');
      if (!output) throw new Error('Expected actual native output');
      return [...output.childNodes].map((node) => [node.nodeType, node.nodeName, node.textContent]);
    };
    expect(view.host.querySelector('output')?.textContent).toBe(
      '00|1.25NaNInfinity-Infinitynested:00S0'
    );
    expect(snapshot(view.host)).toEqual(snapshot(referenceHost));
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe(
      '00|1.25NaNInfinity-Infinitynested:00S1'
    );
    expect(snapshot(view.host)).toEqual(snapshot(referenceHost));
  });

  it('does not resolve an authored String binding when normalizing captured numeric children', async () => {
    const view = await mount(
      prototype(`return r=>{
      const String=(value:number)=>'shadow';const alias=String;
      if(String!==alias)return null;
      return r.el('output',[0,-0,0/0,1/0,-1/0]);
    };`)
    );
    expect(view.host.querySelector('output')?.textContent).toBe('00NaNInfinity-Infinity');
  });

  it('retains native custom-tag identity despite a registered component with the same name', async () => {
    const shadow: ComponentOptions<Vue2> = {
      render(h) {
        return h('strong', 'component-shadow');
      },
    };
    const view = await mount(prototype("return r=>r.el('pui-native-tag','native');"), {
      'pui-native-tag': shadow,
    });
    expect(view.host.querySelector('pui-native-tag')?.textContent).toBe('native');
    expect(view.host.querySelector('strong')).toBeNull();
  });

  it('retains native custom-tag style attributes with the exact pre flag', async () => {
    const shadow: ComponentOptions<Vue2> = {
      render(h) {
        return h('strong', 'component-shadow');
      },
    };
    const view = await mount(
      prototype(
        "return r=>r.el('pui-styled-tag',{style:tw('font-bold')},'native');",
        "import {tw} from '@proto.ui/core';"
      ),
      { 'pui-styled-tag': shadow }
    );
    expect(view.host.querySelector('pui-styled-tag')?.textContent).toBe('native');
    expect(view.host.querySelector('pui-styled-tag')?.getAttribute('data-pui-style')).toBe(
      'font-bold'
    );
    expect(view.host.querySelector('strong')).toBeNull();
  });

  it('preserves the real native renderer props/context reads and live slot capability', async () => {
    const view = await mount(
      prototype(
        `def.props.define({value:{type:'string',default:'prop'}});
      def.context.provide(KEY,{value:7});def.context.subscribe(KEY,()=>{});
      return r=>r.el('output',[r.read.props.get().value,r.read.context.read(KEY).value,r.slot()]);`,
        `import {createContextKey} from '@proto.ui/core';
       const KEY=createContextKey<{value:number}>('native-renderer-read');`
      )
    );
    expect(view.host.querySelector('output')?.textContent).toBe('prop7S0');
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('prop7S1');
  });

  it('retains default-slot behavior when setup returns no renderer', async () => {
    const view = await mount(prototype(''));
    expect(view.host.querySelector('[data-live-slot]')?.textContent).toBe('S0');
    view.slot.text = 'S1';
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.querySelector('[data-live-slot]')?.textContent).toBe('S1');
  });

  it.each(['const alias=draw;return alias;', 'const factory=()=>draw;return factory();'])(
    'adapts only the private setup-result boundary: %s',
    async (tail) => {
      const view = await mount(
        prototype(`const text='captured';
        const draw=()=>text;${tail}`)
      );
      expect(view.host.textContent).toBe('captured');
    }
  );

  it('retains declaration captures across a caller parameter with the same name', async () => {
    const view = await mount(
      prototype(`return r=>{
      const child=r.el('b','captured');const f=()=>child;
      const g=(child:string)=>f();return g('shadow');
    };`)
    );
    expect(view.host.querySelector('b')?.textContent).toBe('captured');
  });

  it('does not turn a render-context checked-IR scalar helper into a renderer ABI', async () => {
    const ir = prototype("return r=>{const text=()=> 'scalar';return r.el('b',text());};");
    const helper = renderFunction(ir).body.find((statement) => statement.kind === 'const');
    if (helper?.kind !== 'const' || helper.value.kind !== 'function')
      throw new Error('Expected helper');
    helper.value.function.context = 'render';
    helper.value.function.phase = 'render';
    const view = await mount(ir);
    expect(view.host.querySelector('b')?.textContent).toBe('scalar');
  });

  it('uses actual checked-IR template formal contexts without a legacy node guess', async () => {
    const ir = prototype(`return r=>{
      const node=r.el('i','node');const wrap=(value:string)=>r.el('b',value);
      return r.el('section',[wrap('first'),wrap('second')]);
    };`);
    const body = renderFunction(ir).body;
    const helper = body.find(
      (statement) => statement.kind === 'const' && statement.name === 'wrap'
    );
    const returned = body.find((statement) => statement.kind === 'return');
    if (
      helper?.kind !== 'const' ||
      helper.value.kind !== 'function' ||
      returned?.kind !== 'return' ||
      returned.value?.kind !== 'operation'
    )
      throw new Error('Expected fixture');
    helper.value.function.parameters[0].type = 'template';
    const inside = helper.value.function.body[0];
    if (inside.kind !== 'return' || inside.value?.kind !== 'operation')
      throw new Error('Expected wrapper');
    inside.value.arguments[1].type = 'template';
    const children = returned.value.arguments[1];
    if (children.kind !== 'array' || children.elements[0].kind !== 'helper-call')
      throw new Error('Expected calls');
    const span = children.span;
    const array: ExpressionIR = {
      kind: 'array',
      type: 'array',
      span,
      elements: [
        { kind: 'literal', type: 'string', value: 'text', span },
        { kind: 'literal', type: 'null', value: null, span },
        { kind: 'reference', type: 'template', name: 'node', span },
      ],
    };
    children.elements[0].arguments[0] = array;
    const view = await mount(ir);
    expect([...view.host.querySelectorAll('b')].map((node) => node.textContent)).toEqual([
      'textnode',
      'second',
    ]);
    expect(view.host.querySelector('b i')?.textContent).toBe('node');
  });

  it.each([false, true])(
    'retains an identity-observed callable with invoked=%s',
    async (invoke) => {
      const view = await mount(
        prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const alias=make;
      if(make!==alias)return null;
      return ${invoke ? "alias('called')" : "r.el('i','not-called')"};
    };`)
      );
      expect(view.host.textContent).toBe(invoke ? 'called' : 'not-called');
      expect(view.host.querySelector(invoke ? 'b' : 'i')).not.toBeNull();
    }
  );

  it('retains an uncalled identity-observed callable with a legacy template formal', async () => {
    const ir = prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const alias=make;
      if(make!==alias)return null;
      return r.el('i','not-called');
    };`);
    const helper = renderFunction(ir).body.find((statement) => statement.kind === 'const');
    if (helper?.kind !== 'const' || helper.value.kind !== 'function')
      throw new Error('Expected helper');
    helper.value.function.parameters[0].type = 'template';
    const returned = helper.value.function.body[0];
    if (returned.kind !== 'return' || returned.value?.kind !== 'operation')
      throw new Error('Expected element');
    returned.value.arguments[1].type = 'template';
    // This legal checked-IR signature may not be downgraded merely because its
    // identity is observed without invoking it. It must not require body DCE.
    const view = await mount(ir);
    expect(view.host.textContent).toBe('not-called');
    expect(view.host.querySelector('i')).not.toBeNull();
  });

  // The current Vue2 profile admits only three of the six globally defined
  // function-producing operations. Isolate every supported transport so an
  // unsupported operation cannot stop the remaining behavioral evidence.
  const declarations = `import {createContextKey} from '@proto.ui/core';
    const KEY=createContextKey<{value:number}>('native-disposer');`;
  const props = "def.props.define({value:{type:'number',default:0}});";
  const context = 'def.context.provide(KEY,{value:1});';
  const supportedDisposers = [
    ['props.watch', props, "def.props.watch(['value'],()=>{})"],
    ['context.subscribe', context, 'def.context.subscribe(KEY,()=>{})'],
    ['context.trySubscribe', context, 'def.context.trySubscribe(KEY,()=>{})'],
  ] as const;
  const transports = ['direct', 'alias', 'factory'] as const;
  it.each(
    supportedDisposers.flatMap(([operation, setup, call]) =>
      transports.map((transport) => ({ operation, setup, call, transport }))
    )
  )(
    'retains admitted native disposer $operation through $transport',
    async ({ setup, call, transport }) => {
      const result =
        transport === 'direct'
          ? `return ${call};`
          : transport === 'alias'
            ? `const stop=${call};const alias=stop;return alias;`
            : `const stop=${call};const factory=()=>stop;return factory();`;
      const view = await mount(prototype(setup + result, setup === context ? declarations : ''));
      expect(view.host.textContent).toBe('');
      expect(view.host.querySelector('[data-live-slot]')).toBeNull();
    }
  );

  it.each([
    ['props.watchAll', 'def.props.watchAll(()=>{})'],
    ['props.watchRaw', "def.props.watchRaw(['value'],()=>{})"],
    ['props.watchRawAll', 'def.props.watchRawAll(()=>{})'],
  ])('retains the existing Vue2 target rejection for %s', (operation, call) => {
    const input = prototype(`${props}return ${call};`);
    // Actual emit result and all diagnostics are captured before compile throws.
    // This is a rejection control, not native implementation of this operation.
    expect(() => compile(input)).toThrow(
      `"code":"PUI4003","category":"unsupported-input","message":"Operation ${operation} is not implemented by vue2-source-v1.`
    );
  });
});

// R11 strategy: the earlier body's no-DCE comment remains verbatim above as
// history. Complete non-escape/use proof now permits only an unobservable-body
// optimization. This does not implement general legacy-template callables.
describe('Vue2 closed identity-only body proof', () => {
  let proofCaptures = 0;
  const strictCaptures = { identity: 0, ssr: 0, 'ssr-annotation-mutant': 0 };
  function helper(ir: PrototypeIR, name = 'make'): FunctionIR {
    const statement = renderFunction(ir).body.find(
      (item) => item.kind === 'const' && item.name === name
    );
    if (statement?.kind !== 'const' || statement.value.kind !== 'function')
      throw new Error(`Missing helper ${name}`);
    return statement.value.function;
  }
  function validated(ir: PrototypeIR, invoked = new Set<FunctionIR>()) {
    let directory: string | undefined;
    if (evidenceRoot) {
      if (!path.isAbsolute(evidenceRoot) || ++proofCaptures > 20)
        throw new Error('Unexpected proof evidence root or capture count');
      mkdirSync(evidenceRoot, { recursive: true });
      directory = mkdtempSync(path.join(evidenceRoot, 'proof-'));
      const identities = new Map<object, { id: number; paths: string[] }>();
      function identify(value: object, pointer: string) {
        let entry = identities.get(value);
        if (!entry) {
          entry = { id: identities.size, paths: [] };
          identities.set(value, entry);
        }
        entry.paths.push(pointer);
      }
      identify(ir.setup, '/setup');
      ir.hooks.forEach((hook, index) => identify(hook.setup, `/hooks/${index}/setup`));
      const active = new Set<object>();
      function recordIdentities(value: unknown, pointer: string) {
        if (value === null || typeof value !== 'object') return;
        if (active.has(value)) throw new Error('Cyclic proof evidence graph');
        active.add(value);
        for (const [key, item] of Object.entries(value)) {
          const child = `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
          if (
            key === 'function' &&
            'kind' in value &&
            value.kind === 'function' &&
            item !== null &&
            typeof item === 'object'
          )
            identify(item, child);
          recordIdentities(item, child);
        }
        active.delete(value);
      }
      recordIdentities(ir, '');
      const knownInvokedIds = [...invoked].map((fn) => {
        const entry = identities.get(fn);
        if (!entry) throw new Error('Invoked proof identity is not in the captured IR');
        return entry.id;
      });
      capture(
        directory,
        'input.json',
        JSON.stringify(
          {
            test: expect.getState().currentTestName,
            checkedIR: ir,
            knownInvoked: [...invoked].map((fn) => fn.span),
            identityGraph: {
              functions: [...identities.values()],
              knownInvokedIds,
              note: 'Actual FunctionIR object identity. To replay, coalesce JSON-pointer paths with the same id before validation/proof. Plain JSON alone does not preserve shared objects.',
            },
            note: 'Actual proof/admission input; not an emitted component or native implementation.',
          },
          null,
          2
        )
      );
    }
    const result = validateIR(ir);
    capture(directory, 'admission.json', JSON.stringify(result, null, 2));
    return { result, directory };
  }
  function checked(ir: PrototypeIR, invoked = new Set<FunctionIR>()) {
    const { result, directory } = validated(ir, invoked);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const proof = collectVue2IdentityOnlyFunctions(result.value, invoked);
    capture(
      directory,
      'proof.json',
      JSON.stringify(
        {
          incomplete: [...proof.incomplete],
          eligible: [...proof.eligible].map((fn) => fn.span),
          entries: [...proof.entries.values()].map((entry) => ({
            function: entry.fn.span,
            creations: entry.creations,
            blocked: [...entry.blocked],
            uses: entry.uses.map((use) => ({ use: use.use, expression: use.expression.span })),
          })),
        },
        null,
        2
      )
    );
    return proof;
  }
  function strictGraph(
    module: GeneratedModule,
    captureKind: keyof typeof strictCaptures = 'identity'
  ) {
    let evidence: string | undefined;
    if (evidenceRoot) {
      if (!path.isAbsolute(evidenceRoot) || ++strictCaptures[captureKind] > 2)
        throw new Error(`Unexpected ${captureKind} strict capture count`);
      evidence = mkdtempSync(path.join(evidenceRoot, `strict-${captureKind}-`));
    }
    const files = new Map<string, string>();
    for (const file of [
      { path: 'Component.js', kind: 'source', contents: module.code },
      ...(module.supportingFiles ?? []),
    ]) {
      if (
        file.kind !== 'source' ||
        path.posix.isAbsolute(file.path) ||
        file.path.includes('\\') ||
        file.path.split('/').some((part) => !part || part === '.' || part === '..') ||
        files.has(file.path)
      )
        throw new Error('Unexpected actual identity output graph');
      files.set(file.path, file.contents);
    }
    files.set(
      'Consumer.ts',
      `import Vue from 'vue';
import Component from './Component.js';
export const consumer = new Vue({render(h){return h(Component, {scopedSlots:{default:()=>[h('em','native')]}});}});`
    );
    const parent = fileURLToPath(new NodeURL('./generated-modules/', import.meta.url));
    mkdirSync(parent, { recursive: true });
    const directory = mkdtempSync(path.join(parent, 'vue2-identity-strict-'));
    cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
    for (const [file, contents] of files) {
      capture(evidence, `files/${file}`, contents);
      const destination = path.join(directory, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, contents, { flag: 'wx' });
    }
    function diagnosticRecord(diagnostic: ts.Diagnostic): unknown {
      return {
        category: diagnostic.category,
        code: diagnostic.code,
        file: diagnostic.file?.fileName,
        start: diagnostic.start,
        length: diagnostic.length,
        messageText: diagnostic.messageText,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        relatedInformation: diagnostic.relatedInformation?.map(diagnosticRecord),
      };
    }
    const repository = fileURLToPath(new NodeURL('../../../', import.meta.url));
    const config = ts.readConfigFile(path.join(repository, 'tsconfig.json'), ts.sys.readFile);
    if (config.error) {
      capture(
        evidence,
        'diagnostics.json',
        JSON.stringify([diagnosticRecord(config.error)], null, 2)
      );
      throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repository);
    const vue2 = createRequire(new NodeURL('../../adapters/vue2/package.json', import.meta.url));
    const rootNames = [...files.keys()].map((file) => path.join(directory, file));
    const options: ts.CompilerOptions = {
      ...parsed.options,
      paths: { ...parsed.options.paths, vue: [path.dirname(vue2.resolve('vue/package.json'))] },
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      allowJs: true,
      checkJs: true,
    };
    capture(
      evidence,
      'request.json',
      JSON.stringify(
        {
          test: expect.getState().currentTestName,
          rootNames,
          options,
          typescript: ts.version,
          vueDeclarationRoot: path.dirname(vue2.resolve('vue/package.json')),
          captureKind,
          note: 'Complete actual graph diagnostics. Client success and the bounded SSR annotation comparison are separate assertions, not full SSR/hydration acceptance.',
        },
        null,
        2
      )
    );
    const program = ts.createProgram(rootNames, options);
    const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].map(
      diagnosticRecord
    );
    capture(evidence, 'diagnostics.json', JSON.stringify(diagnostics, null, 2));
    capture(
      evidence,
      'program.json',
      JSON.stringify(
        program.getSourceFiles().map((file) => ({
          file: file.fileName,
          sha256: createHash('sha256').update(file.text).digest('hex'),
          isDeclarationFile: file.isDeclarationFile,
        })),
        null,
        2
      )
    );
    const source = program.getSourceFile(path.join(directory, 'Component.js'));
    if (!source) throw new Error('Missing actual generated Component.js in strict program');
    // All diagnostics remain evidence. The opaque-formal assertions and the
    // complete graph assertion are independent; neither filters the other.
    return { program, source, evidence, diagnostics };
  }
  function legacy(fn: FunctionIR) {
    fn.parameters[0].type = 'template';
    const returned = fn.body[0];
    if (returned.kind !== 'return' || returned.value?.kind !== 'operation')
      throw new Error('Expected direct native child');
    returned.value.arguments[1].type = 'template';
  }
  function identity(tail = "return r.el('i','not-called');") {
    return prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const alias=make;
      if(make!==alias)return null;${tail}
    };`);
  }

  it('requires complete identity uses, preserves checked types, and honors an independent invocation veto', () => {
    const ir = identity();
    const make = helper(ir);
    legacy(make);
    const before = JSON.stringify(ir);
    const proof = checked(ir);
    expect(proof.incomplete.size).toBe(0);
    expect([...proof.eligible]).toEqual([make]);
    expect(proof.entries.get(make)?.uses.map((use) => use.use)).toEqual([
      'declaration',
      'alias',
      'identity',
      'identity',
    ]);
    expect(checked(ir, new Set([make])).eligible.size).toBe(0);
    expect(proof.eligible.has(ir.setup)).toBe(false);
    expect(proof.eligible.has(renderFunction(ir))).toBe(false);
    expect(JSON.stringify(ir)).toBe(before);
  });

  it.each([
    ['direct', "return make('called');"],
    ['alias', "return alias('called');"],
    ['after-return', "return r.el('i','not-called');alias('unreachable');"],
    ['nested-unused-body', "const later=()=>alias('nested');return r.el('i','not-called');"],
    ['dead-branch', "if(false)return alias('dead');return r.el('i','not-called');"],
  ])('does not infer non-invocation from an empty collector set: %s', (_name, tail) => {
    const ir = identity(tail);
    const make = helper(ir);
    const proof = checked(ir); // deliberately empty invocation set
    expect(proof.eligible.has(make)).toBe(false);
    expect(proof.entries.get(make)?.blocked.has('invoke')).toBe(true);
  });

  it('does not discard calls in a checked inline callback', () => {
    const ir = prototype(`const make=(text:string)=>text;const alias=make;
      const same=make===alias;
      def.props.define({value:{type:'number',default:0}});
      def.props.watch(['value'],()=>{const value=alias('callback');});
      return r=>r.el('i','native');`);
    const declaration = ir.setup.body[0];
    if (declaration.kind !== 'const' || declaration.value.kind !== 'function')
      throw new Error('Expected setup helper');
    const make = declaration.value.function;
    const proof = checked(ir);
    expect(proof.eligible.has(make)).toBe(false);
    expect(proof.entries.get(make)?.blocked.has('invoke')).toBe(true);
  });

  it.each(['return alias;', 'const factory=()=>draw;return factory();'])(
    'retains returned/factory callable bodies: %s',
    (tail) => {
      const ir = prototype(`const text='captured';const draw=()=>text;const alias=draw;
        const same=draw===alias;${tail}`);
      const declaration = ir.setup.body[1];
      if (declaration.kind !== 'const' || declaration.value.kind !== 'function')
        throw new Error('Expected returned helper');
      const draw = declaration.value.function;
      const proof = checked(ir);
      expect(proof.eligible.has(draw)).toBe(false);
      expect(proof.entries.get(draw)?.blocked.has('other')).toBe(true);
    }
  );

  it('resolves a captured alias separately from a caller parameter with the same name', () => {
    const ir = identity(`const later=(make:string)=>alias('captured');
      return r.el('i','not-called');`);
    const make = helper(ir);
    const proof = checked(ir);
    expect(proof.eligible.has(make)).toBe(false);
    expect(proof.entries.get(make)?.blocked.has('invoke')).toBe(true);
  });

  it('closes a direct alias chain using each declaration environment', () => {
    const ir = prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const middle=make;const alias=middle;
      if(make!==alias)return null;return r.el('i','not-called');
    };`);
    const make = helper(ir);
    legacy(make);
    const proof = checked(ir);
    expect(proof.incomplete.size).toBe(0);
    expect([...proof.eligible]).toEqual([make]);
    expect(proof.entries.get(make)?.uses.filter((use) => use.use === 'alias').length).toBe(2);
  });

  it('does not collapse multiple valid creations sharing one FunctionIR and the same captures', () => {
    const ir = prototype(`return r=>{
      const first=(text:string)=>r.el('b',text);const second=(text:string)=>r.el('b',text);
      if(first===second)return null;return r.el('i','distinct');
    };`);
    const first = helper(ir, 'first');
    const second = renderFunction(ir).body[1];
    if (second.kind !== 'const' || second.value.kind !== 'function')
      throw new Error('Expected second creation');
    second.value.function = first;
    // Same capture origin is deliberate. Inconsistent captured bindings are a
    // different upstream-invalid case, not evidence for this creation guard.
    const proof = checked(ir);
    expect(proof.entries.get(first)?.creations).toBe(2);
    expect(proof.eligible.has(first)).toBe(false);
    expect(proof.entries.get(first)?.blocked.has('non-unique-creation-syntax')).toBe(true);
  });

  it.each(['name', 'length', 'toString'])(
    'retains upstream rejection of callable reflection: %s',
    (property) => {
      const ir = identity();
      const fn = renderFunction(ir);
      const span = fn.span;
      fn.body.splice(2, 0, {
        kind: 'effect',
        span,
        expression: {
          kind: 'member',
          type: 'unknown',
          optional: false,
          property,
          span,
          object: { kind: 'reference', type: 'function', name: 'alias', span },
        },
      });
      const { result } = validated(ir);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(
          result.diagnostics.some((item) => item.message.includes('Unsupported IR property access'))
        ).toBe(true);
      // Invalid input is not evidence of supported reflection or safe escape.
    }
  );

  it.each(['array', 'record'] as const)(
    'retains upstream rejection of callable container escape: %s',
    (kind) => {
      const ir = identity();
      const fn = renderFunction(ir);
      const span = fn.span;
      const reference: ExpressionIR = { kind: 'reference', type: 'function', name: 'alias', span };
      const value: ExpressionIR =
        kind === 'array'
          ? { kind, type: 'array', elements: [reference], span }
          : { kind, type: 'record', entries: [{ key: 'callback', value: reference }], span };
      fn.body.splice(2, 0, { kind: 'const', name: 'escaped', value, span });
      const { result } = validated(ir);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(
          result.diagnostics.some((item) =>
            item.message.includes(
              kind === 'array'
                ? 'Data arrays cannot contain semantic handles'
                : 'Configuration records cannot contain execution-scope handles or escaping callbacks'
            )
          )
        ).toBe(true);
    }
  );

  it('retains upstream rejection of recursive aliases', () => {
    const ir = identity();
    const make = helper(ir);
    make.body.unshift({
      kind: 'effect',
      span: make.span,
      expression: {
        kind: 'helper-call',
        type: 'template',
        name: 'make',
        arguments: [],
        span: make.span,
      },
    });
    const { result } = validated(ir);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.diagnostics.some((item) => item.message.includes('Unknown or recursive helper call'))
      ).toBe(true);
  });

  it('preserves separate function identities and original arity with no runtime projector', async () => {
    const ir = prototype(`return r=>{
      const first=(text:string,extra?:string)=>r.el('b',text);
      const second=(text:string,extra?:string)=>r.el('b',text);
      const alias=first;const secondAlias=second;
      if(first!==alias)return null;if(second!==secondAlias)return null;
      if(first===second)return r.el('i','wrong-shared-identity');
      return r.el('i','distinct');
    };`);
    legacy(helper(ir, 'first'));
    legacy(helper(ir, 'second'));
    const view = await mount(ir);
    expect(view.host.textContent).toBe('distinct');
    const { program, source, evidence, diagnostics } = strictGraph(view.module);
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
    const checker = program.getTypeChecker();
    const declarations: ts.VariableDeclaration[] = [];
    const formalTypes: Array<{ name: string; flags: number; type: string }> = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ['first', 'second'].includes(node.name.text)
      )
        declarations.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(declarations.length).toBe(2);
    for (const declaration of declarations) {
      const fn = declaration.initializer;
      expect(fn && ts.isArrowFunction(fn)).toBe(true);
      if (!fn || !ts.isArrowFunction(fn)) throw new Error('Expected original arrow creation');
      expect(fn.parameters.map((parameter) => parameter.name.getText(source))).toEqual([
        'text',
        'extra',
      ]);
      for (const parameter of fn.parameters) {
        const type = checker.getTypeAtLocation(parameter);
        formalTypes.push({
          name: parameter.name.getText(source),
          flags: type.flags,
          type: checker.typeToString(type),
        });
      }
      expect(ts.isBlock(fn.body) && fn.body.statements.length).toBe(0);
      // No hoisting: the original creation is still nested in the authored renderer.
      let parent: ts.Node | undefined = declaration.parent;
      while (parent && !ts.isArrowFunction(parent)) parent = parent.parent;
      expect(
        parent &&
          ts.isArrowFunction(parent) &&
          parent.parameters.map((parameter) => parameter.name.getText(source))
      ).toEqual(['r']);
    }
    capture(evidence, 'formal-types.json', JSON.stringify(formalTypes, null, 2));
    expect(formalTypes.length).toBe(4);
    expect(formalTypes.every((type) => type.flags === ts.TypeFlags.Unknown)).toBe(true);
    expect(view.module.code).not.toContain('unreachable authored callable');
  });

  it('keeps the full body when an identity-observed alias is actually invoked', async () => {
    const ir = identity("return alias('called');");
    legacy(helper(ir));
    const proof = checked(ir);
    expect(proof.eligible.has(helper(ir))).toBe(false);
    const view = await mount(ir);
    expect(view.host.querySelector('b')?.textContent).toBe('called');
    expect(view.host.querySelector('i')).toBeNull();
    const { diagnostics } = strictGraph(view.module);
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
  });

  it.each([false, true])(
    'checks complete SSR output without client renderer type references (interaction=%s)',
    (interaction) => {
      const input = prototype(
        `${interaction ? "def.event.on('host:sample',()=>{});" : ''}return r=>r.el('b','ssr-root');`
      );
      const result = emitVue2Source(input, { ssr: true });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const module = result.value;
      expect(module.code).not.toContain('RenderFunction');
      const actual = strictGraph(module, 'ssr');
      capture(
        actual.evidence,
        'input.json',
        JSON.stringify({ test: expect.getState().currentTestName, input, options: { ssr: true } })
      );
      capture(actual.evidence, 'result.json', JSON.stringify(result, null, 2));
      // Restore only the erroneous variable annotation. Its error type masks
      // two untyped-variable diagnostics; account for that exact full delta.
      const marker = '  let renderFunction;';
      expect(module.code.split(marker)).toHaveLength(2);
      const mutant = strictGraph(
        {
          ...module,
          code: module.code.replace(
            marker,
            `  /** @type {__puiRenderFunction | null | void} */\n${marker}`
          ),
        },
        'ssr-annotation-mutant'
      );
      // Retain every diagnostic and duplicate. Only temporary directory names
      // and text offsets introduced by the annotation differ between Programs.
      const normalized = (graph: ReturnType<typeof strictGraph>) =>
        graph.diagnostics
          .map((diagnostic) =>
            JSON.stringify(diagnostic, (key, value: unknown) => {
              if (key === 'start' || key === 'length') return undefined;
              return typeof value === 'string'
                ? value.replaceAll(path.dirname(graph.source.fileName), '<generated>')
                : value;
            })
          )
          .sort();
      const record = (
        code: number,
        message: string,
        category: ts.DiagnosticCategory = ts.DiagnosticCategory.Error
      ) => ({
        category,
        code,
        file: '<generated>/Component.js',
        messageText: message,
        message,
      });
      const implicitVariable = [
        record(
          7034,
          "Variable 'renderFunction' implicitly has type 'any' in some locations where its type cannot be determined."
        ),
        record(7005, "Variable 'renderFunction' implicitly has an 'any' type."),
      ];
      expect(
        [...normalized(mutant), ...implicitVariable.map((item) => JSON.stringify(item))].sort()
      ).toEqual(
        [
          ...normalized(actual),
          JSON.stringify({
            ...record(
              2552,
              "Cannot find name '__puiRenderFunction'. Did you mean 'renderFunction'?"
            ),
            relatedInformation: [
              record(2728, "'renderFunction' is declared here.", ts.DiagnosticCategory.Message),
            ],
          }),
        ].sort()
      );
      // Remaining SSR diagnostics stay in the unfiltered capture; this does not
      // claim strict-zero SSR output or a real SSR server/hydration journey.
    }
  );
});

describe('Vue2 compile-time root-data demand', () => {
  it('constructs fresh native root data directly when no root-property producer is reached', async () => {
    const view = await mount(prototype("return r=>r.el('b','direct-root');"));
    expect(view.host.textContent).toBe('direct-root');
    expect(view.child.$el.getAttribute('data-pui-root')).toBe('');
    const first = nativeField(nativeField(view.child, '_vnode'), 'data');
    const firstAttrs = nativeField(first, 'attrs');
    expect(nativeField(first, 'pre')).toBe(true);
    expect(firstAttrs).toEqual({ 'data-pui-root': '' });
    view.child.$forceUpdate();
    await Vue2.nextTick();
    const next = nativeField(nativeField(view.child, '_vnode'), 'data');
    expect(next).not.toBe(first);
    expect(nativeField(next, 'attrs')).not.toBe(firstAttrs);
    expect(nativeField(next, 'pre')).toBe(true);
    expect(nativeField(next, 'attrs')).toEqual({ 'data-pui-root': '' });
    expect(view.host.textContent).toBe('direct-root');
    expect(view.module.code).not.toContain('function __puiRootData(');
    expect(view.module.code).not.toContain('__puiRootData(');
    expect(view.module.code).toContain(
      "const rootData = { pre: true, attrs: { 'data-pui-root': '' } };"
    );
    expect(view.module.code).toContain('h(tag, rootData, children)');
  });

  it('retains root-property lowering for a reached native interaction', async () => {
    const view = await mount(
      prototype(`
      const count=def.state.numberDiscrete('count',0);
      def.event.on('host:sample',run=>{count.set(count.get()+1);run.update();});
      return r=>r.el('b',count.get());
    `),
      undefined,
      true
    );
    expect(view.module.code).toContain('function __puiRootData(');
    expect(view.module.code).toContain(
      "__puiRootData(interaction.rootProperties(), { 'data-pui-root': '' }, !viewActive)"
    );
    expect(view.host.textContent).toBe('0');
    view.child.$el.dispatchEvent(new Event('sample', { bubbles: true }));
    await Vue2.nextTick();
    await Vue2.nextTick();
    expect(view.host.textContent).toBe('1');
    expect(view.child.$el.getAttribute('data-pui-root')).toBe('');
  });

  // The original Text case, including seed and rows === 3, now runs against
  // Chrome in vue2-native-editor.browser.test.ts. Locked Happy DOM 15 declares
  // textarea.rows as string; its original failure remains in the R12 carrier.
  it('preserves legal physical root attributes and style: image', async () => {
    const view = await mount(physical('image'), undefined, true);
    const root = view.child.$el;
    const data = nativeField(nativeField(view.child, '_vnode'), 'data');
    expect(view.module.code).toContain('function __puiRootData(');
    expect(root.getAttribute('data-pui-root')).toBe('');
    expect(root.tagName).toBe('IMG');
    expect(nativeField(data, 'style')).toBe('object-fit:contain');
    expect(nativeField(data, 'attrs')).toMatchObject({ src: null, alt: '' });
    expect(nativeField(nativeField(root, 'style'), 'objectFit')).toBe('contain');
    expect(root.getAttribute('src')).toBeNull();
    expect(root.getAttribute('alt')).toBe('');
  });

  async function editingConsumer(
    lineMode: 'single' | 'multiline',
    controlled: boolean,
    removeHandoff = false
  ) {
    const emitted = compile(editingInput(lineMode, controlled));
    const handoff = 'if (commit.vnode.data?.domProps) delete commit.vnode.data.domProps.value;';
    if (removeHandoff && !emitted.code.includes(handoff))
      throw new Error('Native value handoff mutation did not match');
    const module = removeHandoff
      ? { ...emitted, code: emitted.code.replace(handoff, '') }
      : emitted;
    const native = options(module, true);
    const props = Vue2.observable({ value: 'seed', seed: 'seed', hint: 'before', present: true });
    const app = new Vue2({ render: (h) => h(native, { props: { ...props } }) });
    const host = document.createElement('div');
    document.body.append(host);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    app.$mount();
    host.append(app.$el);
    const settle = async () => {
      await Vue2.nextTick();
      await Vue2.nextTick();
      await Promise.resolve();
    };
    await settle();
    const child = app.$children[0];
    const editor = () => {
      const target = host.querySelector(lineMode === 'single' ? 'input' : 'textarea');
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement))
        throw new Error('Native editor was not materialized');
      return target;
    };
    return { props, child, host, editor, settle };
  }

  it.each(['single', 'multiline'] as const)(
    'retains uncontrolled native editing through repaint, props and a new view lease: %s',
    async (lineMode) => {
      const view = await editingConsumer(lineMode, false);
      const editor = view.editor();
      expect(editor.value).toBe('seed');
      editor.value = 'edited';
      editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'edited', inputType: 'insertText' })
      );
      editor.setSelectionRange(1, 4);
      view.child.$forceUpdate();
      await view.settle();
      expect(view.editor()).toBe(editor);
      expect(editor.value).toBe('edited');
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 4]);
      view.props.seed = 'later-default';
      view.props.hint = 'after';
      await view.settle();
      expect(editor.value).toBe('edited');
      expect(editor.defaultValue).toBe('later-default');
      expect(editor.placeholder).toBe('after');
      view.props.present = false;
      await view.settle();
      expect(editor.isConnected).toBe(false);
      editor.value = 'stale';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      view.props.present = true;
      await view.settle();
      expect(view.editor()).not.toBe(editor);
      expect(view.editor().value).toBe('edited');
    }
  );

  it.each(['single', 'multiline'] as const)(
    'preserves controlled sync and composition across host repaint and remount: %s',
    async (lineMode) => {
      const view = await editingConsumer(lineMode, true);
      const editor = view.editor();
      expect(editor.value).toBe('seed');
      editor.value = 'proposal';
      editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'proposal', inputType: 'insertText' })
      );
      await view.settle();
      expect(editor.value).toBe('seed');
      editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      editor.value = 'composing';
      editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'composing', isComposing: true })
      );
      view.props.hint = 'during-ime';
      view.child.$forceUpdate();
      await view.settle();
      expect(editor.value).toBe('composing');
      expect(editor.placeholder).toBe('during-ime');
      view.props.value = 'accepted';
      await view.settle();
      expect(editor.value).toBe('composing');
      editor.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: 'composing' })
      );
      await view.settle();
      expect(editor.value).toBe('accepted');
      view.props.present = false;
      await view.settle();
      expect(editor.isConnected).toBe(false);
      view.props.present = true;
      await view.settle();
      expect(view.editor()).not.toBe(editor);
      expect(view.editor().value).toBe('accepted');
    }
  );

  it('detects removal of only the native value handoff using the real Vue2 patcher', async () => {
    const view = await editingConsumer('multiline', false, true);
    view.child.$forceUpdate();
    await view.settle();
    expect(view.editor().value).toBe('');
  });

  it.each([false, true])(
    'retains the full SSR transport root-data path (interaction=%s)',
    (interaction) => {
      const input = prototype(
        `${interaction ? "def.event.on('host:sample',()=>{});" : ''}return r=>r.el('b','ssr-root');`
      );
      const module = compile(input, { ssr: true });
      expect(module.code).toContain('function __puiRootData(');
      expect(module.code).toContain(
        '__puiRootData(initialProjection.properties, initialProjection.attrs, true)'
      );
      expect(module.code).toContain('__puiRootData(properties, attrs, true)');
      expect(module.code).toContain(
        '__puiRootData(' +
          (interaction ? 'interaction.rootProperties()' : '{}') +
          ", { 'data-pui-root': '' }, !viewActive)"
      );
      // This is emitter-boundary evidence, not a real SSR server/hydration pass.
    }
  );
});
