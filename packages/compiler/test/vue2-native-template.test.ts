// @vitest-environment happy-dom
import path from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import Vue2, { type ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVue2Source } from '../src/vue2-source';
import type { ExpressionIR, FunctionIR, GeneratedModule, PrototypeIR } from '../src/ir';

// The original 12 commit/slot cases remain separate and unchanged. These are
// additional call-context/representation controls, not substitutes for them or
// for complete generated strict/SSR/browser/build acceptance.
function prototype(body: string, declarations = ''): PrototypeIR {
  const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
${declarations}
export default definePrototype({name:'native-shapes',setup(def){${body}}});`,
  { fileName: 'native-shapes.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

const evidenceRoot = process.env.PUI_VUE2_NATIVE_EVIDENCE_DIR;
let evidenceBytes = 0;
let compilations = 0;
function capture(directory: string | undefined, relative: string, contents: string) {
  if (!directory) return;
  if (path.posix.isAbsolute(relative) || relative.includes('\\') ||
      relative.split('/').some((part) => !part || part === '.' || part === '..'))
    throw new Error('Unsafe native evidence path');
  const bytes = Buffer.byteLength(contents);
  evidenceBytes += bytes;
  if (bytes > 8 * 1024 * 1024 || evidenceBytes > 64 * 1024 * 1024)
    throw new Error('Native evidence byte budget');
  const target = path.join(directory, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, { flag: 'wx' });
}
function compile(input: PrototypeIR): GeneratedModule {
  let directory: string | undefined;
  if (evidenceRoot) {
    if (!path.isAbsolute(evidenceRoot) || ++compilations > 32)
      throw new Error('Unexpected native evidence root or compilation count');
    mkdirSync(evidenceRoot, { recursive: true });
    directory = mkdtempSync(path.join(evidenceRoot, 'compile-'));
    // Checked-IR controls are explicitly retained as such; the parsed authored
    // graph alone must not be presented as their mutated actual emitter input.
    capture(directory, 'input.json', JSON.stringify({ test: expect.getState().currentTestName,
      checkedIR: input, authoredGraph: input.sourceFiles,
      note: 'Actual checked-IR emitter input; runtime transpilation is not strict validation.' }, null, 2));
  }
  const result = emitVue2Source(input);
  capture(directory, 'result.json', JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  for (const file of [{ path: 'Component.js', contents: result.value.code },
    ...(result.value.supportingFiles ?? [])]) {
    capture(directory, `emitted/${file.path}`, file.contents);
  }
  return result.value;
}

function options(module: GeneratedModule): ComponentOptions<Vue2> {
  const sources = new Map([['Component.js', module.code],
    ...(module.supportingFiles ?? []).map((file) => [file.path, file.contents] as [string, string])]);
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file);
    if (prior) return prior;
    const source = sources.get(file);
    if (source === undefined) throw new Error(`Missing actual generated source ${file}`);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const javascript = ts.transpileModule(source, { fileName: file, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue2;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency ${specifier}`);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const resolved = [base, `${base}.ts`, `${base}.js`].find((candidate) => sources.has(candidate));
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
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
async function mount(input: PrototypeIR, components?: ComponentOptions<Vue2>['components']) {
  const module = compile(input);
  const native = options(module);
  if (components) native.components = components;
  const slot = Vue2.observable({ text: 'S0' });
  const app = new Vue2({ render(h) { return h(native, {
    scopedSlots: { default: () => [h('em', { attrs: { 'data-live-slot': '' } }, slot.text)] },
  }); } });
  const host = document.createElement('div'); document.body.append(host);
  const close = () => { app.$destroy(); host.remove(); };
  cleanup.push(close);
  app.$mount(); host.append(app.$el); await Vue2.nextTick(); await Vue2.nextTick();
  return { host, slot, module, child: app.$children[0], close };
}

function renderFunction(ir: PrototypeIR): FunctionIR {
  const returned = ir.setup.body.find((statement) => statement.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function')
    throw new Error('Expected fixture render function');
  return returned.value.function;
}

describe('Vue2 compiler-native child construction', () => {
  it('preserves owned state family validation, defaults and committed native publication', async () => {
    const view = await mount(prototype(`
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
    `));
    const exposed = nativeMethod(view.child, 'getExposes')();
    expect(view.host.querySelector('output')?.textContent).toBe('TBone00S0');
    const text = nativeField(exposed, 'text'), range = nativeField(exposed, 'range');
    expect(nativeMethod(text, 'get')()).toBe('B');
    expect(nativeMethod(range, 'get')()).toBe(0);
    expect(Object.isFrozen(nativeField(range, 'spec'))).toBe(true);
    expect(nativeField(range, 'spec')).toMatchObject({ kind: 'number.range', min: 0, max: 10, clamp: true });
    expect(() => nativeMethod(exposed, 'writeText')('C')).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeChoice')('three')).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeCount')(3)).toThrow('violates step');
    expect(() => nativeMethod(exposed, 'writeRange')(11)).toThrow('out of range');
    expect(nativeMethod(range, 'get')()).toBe(0); // set does not use initialization clamp.
    nativeMethod(exposed, 'writeText')('A');
    nativeMethod(exposed, 'writeChoice')('two');
    nativeMethod(exposed, 'writeCount')(4);
    nativeMethod(exposed, 'writeRange')(7);
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('TBone00S1');
    nativeMethod(view.child, 'update')(); await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('TAtwo47S1');
  });

  it('keeps owned state subscriber snapshots, reentry and queued work after a thrown callback', async () => {
    const view = await mount(prototype(`
      const count=def.state.numberDiscrete('count',0);
      def.expose.state('count',count);
      def.expose.method('write',(next:number)=>count.set(next));
      return r=>r.el('output',[count.get(),r.slot()]);
    `));
    const exposed = nativeMethod(view.child, 'getExposes')();
    const state = nativeField(exposed, 'count');
    const write = nativeMethod(exposed, 'write');
    const events: string[] = [];
    let offSecond: unknown;
    nativeMethod(state, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') !== 'next') return;
      const next = nativeField(event, 'next'); events.push(`A${String(next)}`);
      if (next === 1) {
        if (typeof offSecond !== 'function') throw new Error('Missing second unsubscribe');
        offSecond(); write(2);
      }
    });
    offSecond = nativeMethod(state, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') === 'next') events.push(`B${String(nativeField(event, 'next'))}`);
    });
    nativeMethod(state, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') === 'next') events.push(`C${String(nativeField(event, 'next'))}`);
    });
    write(1);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2']);
    expect(nativeMethod(state, 'get')()).toBe(2);
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('0S1');
    nativeMethod(view.child, 'update')(); await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('2S1');
    const failure = new Error('state subscriber failure');
    const offThrower = nativeMethod(state, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') === 'next' && nativeField(event, 'next') === 3) {
        events.push('D3'); write(4); throw failure;
      }
    });
    expect(() => write(3)).toThrow(failure);
    expect(nativeMethod(state, 'get')()).toBe(4);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'D3']);
    expect(view.host.querySelector('output')?.textContent).toBe('2S1');
    if (typeof offThrower !== 'function') throw new Error('Missing throwing unsubscribe');
    offThrower(); write(5);
    expect(events).toEqual(['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'D3', 'A4', 'C4', 'A5', 'C5']);
    expect(nativeMethod(state, 'get')()).toBe(5);
    nativeMethod(view.child, 'update')(); await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('5S1');
  });

  it('preserves structurally admitted extra state fields instead of assuming closed schemas', async () => {
    const view = await mount(prototype(`
      const text=def.state.string('text','B',{min:'A'});
      const range=def.state.numberRange('range',5,{min:0,max:10,clamp:true,options:[0,5,10]});
      def.expose.state('text',text);def.expose.state('range',range);
      def.expose.method('writeText',(next:string)=>text.set(next));
      def.expose.method('writeRange',(next:number)=>range.set(next));
      return r=>r.el('output',[text.get(),range.get(),r.slot()]);
    `));
    const exposed = nativeMethod(view.child, 'getExposes')();
    expect(view.host.querySelector('output')?.textContent).toBe('B5S0');
    // The checked operation schemas are structural. These fields are retained
    // compatibility behavior, not a newly promoted State specification guarantee.
    expect(() => nativeMethod(exposed, 'writeText')('0')).toThrow('out of range');
    expect(() => nativeMethod(exposed, 'writeRange')(8)).toThrow('not in options');
    expect(() => nativeMethod(exposed, 'writeRange')(-1)).toThrow('not in options');
    expect(nativeMethod(nativeField(exposed, 'text'), 'get')()).toBe('B');
    expect(nativeMethod(nativeField(exposed, 'range'), 'get')()).toBe(5);
    nativeMethod(exposed, 'writeText')('C');nativeMethod(exposed, 'writeRange')(10);
    nativeMethod(view.child, 'update')();await Vue2.nextTick();await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('C10S0');
  });

  it('continues other owned state cleanup after a disconnect throw and retires old handles', async () => {
    const view = await mount(prototype(`
      const first=def.state.string('first','A');const second=def.state.numberDiscrete('second',0);
      def.expose.state('first',first);def.expose.state('second',second);
      def.expose.method('write',(next:string)=>first.set(next));
      return r=>r.el('output',[first.get(),second.get(),r.slot()]);
    `));
    const exposed = nativeMethod(view.child, 'getExposes')();
    const first = nativeField(exposed, 'first'), second = nativeField(exposed, 'second');
    const write = nativeMethod(exposed, 'write'), readFirst = nativeMethod(first, 'get');
    const disconnects: string[] = [], errors: unknown[] = [];
    const failure = new Error('first disconnect failure');
    nativeMethod(first, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') { disconnects.push('first'); throw failure; }
    });
    nativeMethod(second, 'subscribe')((event: unknown) => {
      if (nativeField(event, 'type') === 'disconnect') disconnects.push('second');
    });
    const previousHandler = Vue2.config.errorHandler;
    Vue2.config.errorHandler = error => { errors.push(error); };
    try { view.close(); } finally { Vue2.config.errorHandler = previousHandler; }
    expect(disconnects).toEqual(['first', 'second']);
    expect(errors).toContain(failure);
    expect(() => readFirst()).toThrow('terminally invalidated');
    expect(() => write('B')).toThrow('terminally invalidated');
    expect(() => nativeMethod(first, 'subscribe')(() => {})).toThrow('terminally invalidated');
    expect(() => nativeMethod(second, 'get')()).toThrow('terminally invalidated');
    view.close(); expect(disconnects).toEqual(['first', 'second']);
    expect(view.host.isConnected).toBe(false);
  });

  it('uses native paint closures, nested finite arrays and live native slots', async () => {
    const view = await mount(prototype(`return r=>{
      const child=r.el('b','captured');
      return r.el('section',[child,['text',null,3],r.slot()]);
    };`));
    expect(view.host.querySelector('section')?.textContent).toBe('capturedtext3S0');
    expect(view.module.code).not.toContain('function __puiChildren');
    expect(view.module.code).not.toContain('Object.freeze({ tag, children');
    expect(view.module.code).not.toContain('Object.freeze({ slot: true })');
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('section')?.textContent).toBe('capturedtext3S1');
  });

  it('matches native Vue2 numeric normalization through nested children and live slots', async () => {
    const view = await mount(prototype(`return r=>r.el('output',[
      0,-0,'|',1.25,0/0,1/0,-1/0,['nested:',0,-0],r.slot()
    ]);`));
    // Vue2 2.6.14 accepts numeric children at runtime, but its VNodeChildren
    // declaration omits them. Reflect.apply exercises the real native h with
    // raw numbers as a runtime differential, not as a strict consumer or a
    // replacement for the actual generated module above.
    const reference = new Vue2({ render(h) {
      const raw = [0, -0, '|', 1.25, 0 / 0, 1 / 0, -1 / 0, ['nested:', 0, -0],
        h('em', { attrs: { 'data-live-slot': '' } }, view.slot.text)];
      return Reflect.apply(h, undefined, ['output', {}, raw]);
    } });
    const referenceHost = document.createElement('div'); document.body.append(referenceHost);
    cleanup.push(() => { reference.$destroy(); referenceHost.remove(); });
    reference.$mount(); referenceHost.append(reference.$el);
    const snapshot = (host: HTMLElement) => {
      const output = host.querySelector('output');
      if (!output) throw new Error('Expected actual native output');
      return [...output.childNodes].map((node) => [node.nodeType, node.nodeName, node.textContent]);
    };
    expect(view.host.querySelector('output')?.textContent).toBe('00|1.25NaNInfinity-Infinitynested:00S0');
    expect(snapshot(view.host)).toEqual(snapshot(referenceHost));
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('00|1.25NaNInfinity-Infinitynested:00S1');
    expect(snapshot(view.host)).toEqual(snapshot(referenceHost));
  });

  it('does not resolve an authored String binding when normalizing captured numeric children', async () => {
    const view = await mount(prototype(`return r=>{
      const String=(value:number)=>'shadow';const alias=String;
      if(String!==alias)return null;
      return r.el('output',[0,-0,0/0,1/0,-1/0]);
    };`));
    expect(view.host.querySelector('output')?.textContent).toBe('00NaNInfinity-Infinity');
  });

  it('retains native custom-tag identity despite a registered component with the same name', async () => {
    const shadow: ComponentOptions<Vue2> = { render(h) { return h('strong', 'component-shadow'); } };
    const view = await mount(prototype("return r=>r.el('pui-native-tag','native');"),
      { 'pui-native-tag': shadow });
    expect(view.host.querySelector('pui-native-tag')?.textContent).toBe('native');
    expect(view.host.querySelector('strong')).toBeNull();
  });

  it('retains native custom-tag style attributes with the exact pre flag', async () => {
    const shadow: ComponentOptions<Vue2> = { render(h) { return h('strong', 'component-shadow'); } };
    const view = await mount(prototype("return r=>r.el('pui-styled-tag',{style:tw('font-bold')},'native');",
      "import {tw} from '@proto.ui/core';"), { 'pui-styled-tag': shadow });
    expect(view.host.querySelector('pui-styled-tag')?.textContent).toBe('native');
    expect(view.host.querySelector('pui-styled-tag')?.getAttribute('data-pui-style')).toBe('font-bold');
    expect(view.host.querySelector('strong')).toBeNull();
  });

  it('preserves the real native renderer props/context reads and live slot capability', async () => {
    const view = await mount(prototype(`def.props.define({value:{type:'string',default:'prop'}});
      def.context.provide(KEY,{value:7});def.context.subscribe(KEY,()=>{});
      return r=>r.el('output',[r.read.props.get().value,r.read.context.read(KEY).value,r.slot()]);`,
      `import {createContextKey} from '@proto.ui/core';
       const KEY=createContextKey<{value:number}>('native-renderer-read');`));
    expect(view.host.querySelector('output')?.textContent).toBe('prop7S0');
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('output')?.textContent).toBe('prop7S1');
  });

  it('retains default-slot behavior when setup returns no renderer', async () => {
    const view = await mount(prototype(''));
    expect(view.host.querySelector('[data-live-slot]')?.textContent).toBe('S0');
    view.slot.text = 'S1'; await Vue2.nextTick(); await Vue2.nextTick();
    expect(view.host.querySelector('[data-live-slot]')?.textContent).toBe('S1');
  });

  it.each(['const alias=draw;return alias;', 'const factory=()=>draw;return factory();'])(
    'adapts only the private setup-result boundary: %s', async (tail) => {
      const view = await mount(prototype(`const text='captured';
        const draw=()=>text;${tail}`));
      expect(view.host.textContent).toBe('captured');
    }
  );

  it('retains declaration captures across a caller parameter with the same name', async () => {
    const view = await mount(prototype(`return r=>{
      const child=r.el('b','captured');const f=()=>child;
      const g=(child:string)=>f();return g('shadow');
    };`));
    expect(view.host.querySelector('b')?.textContent).toBe('captured');
  });

  it('does not turn a render-context checked-IR scalar helper into a renderer ABI', async () => {
    const ir = prototype("return r=>{const text=()=> 'scalar';return r.el('b',text());};");
    const helper = renderFunction(ir).body.find((statement) => statement.kind === 'const');
    if (helper?.kind !== 'const' || helper.value.kind !== 'function') throw new Error('Expected helper');
    helper.value.function.context = 'render'; helper.value.function.phase = 'render';
    const view = await mount(ir);
    expect(view.host.querySelector('b')?.textContent).toBe('scalar');
  });

  it('uses actual checked-IR template formal contexts without a legacy node guess', async () => {
    const ir = prototype(`return r=>{
      const node=r.el('i','node');const wrap=(value:string)=>r.el('b',value);
      return r.el('section',[wrap('first'),wrap('second')]);
    };`);
    const body = renderFunction(ir).body;
    const helper = body.find((statement) => statement.kind === 'const' && statement.name === 'wrap');
    const returned = body.find((statement) => statement.kind === 'return');
    if (helper?.kind !== 'const' || helper.value.kind !== 'function' ||
        returned?.kind !== 'return' || returned.value?.kind !== 'operation') throw new Error('Expected fixture');
    helper.value.function.parameters[0].type = 'template';
    const inside = helper.value.function.body[0];
    if (inside.kind !== 'return' || inside.value?.kind !== 'operation') throw new Error('Expected wrapper');
    inside.value.arguments[1].type = 'template';
    const children = returned.value.arguments[1];
    if (children.kind !== 'array' || children.elements[0].kind !== 'helper-call') throw new Error('Expected calls');
    const span = children.span;
    const array: ExpressionIR = { kind: 'array', type: 'array', span, elements: [
      { kind: 'literal', type: 'string', value: 'text', span },
      { kind: 'literal', type: 'null', value: null, span },
      { kind: 'reference', type: 'template', name: 'node', span },
    ] };
    children.elements[0].arguments[0] = array;
    const view = await mount(ir);
    expect([...view.host.querySelectorAll('b')].map((node) => node.textContent)).toEqual(['textnode', 'second']);
    expect(view.host.querySelector('b i')?.textContent).toBe('node');
  });

  it.each([false, true])('retains an identity-observed callable with invoked=%s', async (invoke) => {
    const view = await mount(prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const alias=make;
      if(make!==alias)return null;
      return ${invoke ? "alias('called')" : "r.el('i','not-called')"};
    };`));
    expect(view.host.textContent).toBe(invoke ? 'called' : 'not-called');
    expect(view.host.querySelector(invoke ? 'b' : 'i')).not.toBeNull();
  });

  it('retains an uncalled identity-observed callable with a legacy template formal', async () => {
    const ir = prototype(`return r=>{
      const make=(text:string)=>r.el('b',text);const alias=make;
      if(make!==alias)return null;
      return r.el('i','not-called');
    };`);
    const helper = renderFunction(ir).body.find((statement) => statement.kind === 'const');
    if (helper?.kind !== 'const' || helper.value.kind !== 'function') throw new Error('Expected helper');
    helper.value.function.parameters[0].type = 'template';
    const returned = helper.value.function.body[0];
    if (returned.kind !== 'return' || returned.value?.kind !== 'operation') throw new Error('Expected element');
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
  it.each(supportedDisposers.flatMap(([operation, setup, call]) =>
    transports.map((transport) => ({ operation, setup, call, transport }))))(
    'retains admitted native disposer $operation through $transport', async ({ setup, call, transport }) => {
      const result = transport === 'direct' ? `return ${call};`
        : transport === 'alias' ? `const stop=${call};const alias=stop;return alias;`
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
