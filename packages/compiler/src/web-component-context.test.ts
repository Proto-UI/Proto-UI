// @vitest-environment happy-dom
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';

const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');

interface Projection<T> {
  get(): T;
  subscribe(callback: (event: { prev: T; next: T; reason?: unknown }) => void): () => void;
}
interface ContextElement extends HTMLElement {
  readonly logicalOwner: symbol | null;
  readonly present: boolean;
  update(): void;
  setProps(props: Record<string, unknown>): void;
  getExposes(): {
    current?: Projection<number>;
    previous?: Projection<number>;
    calls?: Projection<number>;
    accepted?: Projection<boolean>;
  };
  dispose(): void;
}
let nextTag = 0;
const elements: ContextElement[] = [];
const containers: HTMLElement[] = [];
afterEach(() => {
  for (const element of elements.splice(0)) {
    element.dispose();
    element.remove();
  }
  for (const container of containers.splice(0)) container.remove();
});

const keys = `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('same-debug-name');
export const OTHER=createContextKey<{value:number}>('same-debug-name');`;

/** Execute one real generated module graph, sharing emitted key references between components. */
function project() {
  const sources = new Map<string, string>();
  const modules = new Map<string, Record<string, unknown>>();
  let nextModule = 0;
  function load(file: string): Record<string, unknown> {
    const name = path.posix.normalize(file);
    const cached = modules.get(name);
    if (cached) return cached;
    const source = sources.get(name);
    if (source === undefined) throw new Error(`Missing generated module: ${name}`);
    const exports: Record<string, unknown> = {};
    modules.set(name, exports);
    const code = ts.transpileModule(source, {
      fileName: name,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', code)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected native dependency: ${specifier}`);
      const target = path.posix.join(path.posix.dirname(name), specifier);
      return load(target.endsWith('.ts') ? target : `${target}.ts`);
    });
    return exports;
  }
  return {
    create(source: string): ContextElement {
      const file = `component-${++nextModule}.ts`;
      const parsed = parsePrototype(source, { fileName: file, files: { 'keys.ts': keys } });
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const emitted = emitWebComponentSource(parsed.value, { shadow: true });
      if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
      for (const artifact of emitted.value.supportingFiles ?? []) {
        const existing = sources.get(artifact.path);
        if (existing !== undefined && existing !== artifact.contents)
          throw new Error(`Shared artifact conflict: ${artifact.path}`);
        sources.set(artifact.path, artifact.contents);
      }
      sources.set(file, emitted.value.code);
      const register = load(file).register as (name: string) => CustomElementConstructor;
      const tag = `x-native-context-${++nextTag}`;
      register(tag);
      const element = document.createElement(tag) as ContextElement;
      elements.push(element);
      return element;
    },
  };
}

function provider(value: number, key = 'KEY'): string {
  return `import {definePrototype} from '@proto.ui/core'; import {${key}} from './keys';
  export default definePrototype({name:'native-provider',setup(def){
    def.props.define({value:{type:'number',default:${value}},visible:{type:'boolean',default:true}});
    def.context.provide(${key},{value:${value}});
    def.context.subscribe(${key});
    def.props.watch(['value'],(run,next)=>{run.context.update(${key},{value:next.value});run.update();});
    def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
    return (renderer)=>renderer.el('section',[renderer.el('span',renderer.read.context.read(${key}).value),renderer.slot()]);
  }});`;
}
function consumer({ optional = false, key = 'KEY', cascade = false } = {}): string {
  const subscribe = optional ? 'trySubscribe' : 'subscribe';
  const read = optional
    ? `run.context.tryRead(${key})?.value ?? -1`
    : `run.context.read(${key}).value`;
  const render = optional
    ? `renderer.read.context.tryRead(${key})?.value ?? -1`
    : `renderer.read.context.read(${key}).value`;
  const next = optional ? 'next?.value ?? -1' : 'next.value';
  const prev = optional ? 'prev?.value ?? -1' : 'prev.value';
  return `import {definePrototype} from '@proto.ui/core'; import {${key}} from './keys';
  export default definePrototype({name:'native-consumer',setup(def){
    def.props.define({write:{type:'number',default:0},probe:{type:'number',default:0},visible:{type:'boolean',default:true}});
    const current=def.state.numberDiscrete('context.current',-1);
    const previous=def.state.numberDiscrete('context.previous',-1);
    const calls=def.state.numberDiscrete('context.calls',0);
    const accepted=def.state.bool('context.accepted',false);
    def.expose.state('current',current);def.expose.state('previous',previous);def.expose.state('calls',calls);def.expose.state('accepted',accepted);
    def.context.${subscribe}(${key},(run,next,prev)=>{
      current.set(${next},${prev});previous.set(${prev});calls.set(calls.get()+1);run.update();
      ${cascade ? `if(next.value===2){run.context.update(${key},{value:3});}` : ''}
    });
    def.lifecycle.onCreated((run)=>{current.set(${read});});
    def.props.watch(['probe'],(run)=>{current.set(${read});run.update();});
    def.props.watch(['write'],(run,next)=>{${optional ? `accepted.set(run.context.tryUpdate(${key},{value:next.write}));` : `run.context.update(${key},(prev)=>({value:next.write+prev.value}));`}});
    def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
    return (renderer)=>renderer.el('output',${render});
  }});`;
}
function container(): HTMLElement {
  const element = document.createElement('div');
  containers.push(element);
  document.body.append(element);
  return element;
}
function displayedProvider(element: ContextElement): string | undefined {
  return element.shadowRoot?.querySelector('span')?.textContent ?? undefined;
}

// These guard real owner ancestry, reference identity, semantic transitions and terminal boundaries.
describe('native Web Component Context', () => {
  it('does not claim a Root when required Context initialization fails', () => {
    const generated = project();
    const element = generated.create(consumer());
    expect(() => document.body.append(element)).toThrow();
    expect(element.logicalOwner).toBeNull();
    expect(element.present).toBe(false);
    expect(element.hasAttribute('data-pui-root')).toBe(false);
  });

  it('allows self-provider updates without a subscription and publishes every update with its own previous value', () => {
    const generated = project();
    const parent =
      generated.create(`import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
      export default definePrototype({name:'unsubscribed-self-provider',setup(def){
        def.props.define({value:{type:'number',default:1}});
        def.context.provide(KEY,{value:1});
        def.props.watch(['value'],(run,next)=>{
          run.context.update(KEY,{value:next.value});
          run.context.update(KEY,(prev)=>({value:prev.value+1}));
        });
        return (renderer)=>renderer.slot();
      }});`);
    const child = generated.create(consumer());
    parent.append(child);
    container().append(parent);
    const seen: string[] = [];
    const exposes = child.getExposes();
    exposes.current?.subscribe(({ next, reason }) => seen.push(`${reason}->${next}`));
    parent.setProps({ value: 5 });
    expect(seen).toEqual(['1->5', '5->6']);
    expect(exposes.current?.get()).toBe(6);
    expect(exposes.previous?.get()).toBe(5);
    expect(exposes.calls?.get()).toBe(2);
  });

  it('does not grant optional update authority to a required subscriber', () => {
    const generated = project();
    const parent = generated.create(provider(3));
    const child =
      generated.create(`import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
      export default definePrototype({name:'required-not-optional',setup(def){
        def.props.define({attempt:{type:'number',default:0}});
        def.context.subscribe(KEY);
        def.props.watch(['attempt'],(run,next)=>{run.context.tryUpdate(KEY,{value:next.attempt});});
        return (renderer)=>renderer.el('output',renderer.read.context.read(KEY).value);
      }});`);
    parent.append(child);
    container().append(parent);
    expect(() => child.setProps({ attempt: 8 })).toThrow(/optional.*subscription/i);
    expect(displayedProvider(parent)).toBe('3');
    expect(child.shadowRoot?.textContent).toBe('3');
  });

  it('resolves nearest/self providers through light-DOM wrappers, slots and shadow-root wrappers', async () => {
    const generated = project();
    const outer = generated.create(provider(1));
    const inner = generated.create(provider(10));
    const child = generated.create(consumer());
    const lightWrapper = document.createElement('article');
    lightWrapper.append(inner);
    outer.append(lightWrapper);
    container().append(outer);
    // A shadow child crosses a genuine generated-owner boundary, not a CSS marker.
    const shadowWrapper = document.createElement('aside');
    inner.shadowRoot!.querySelector('section')!.append(shadowWrapper);
    shadowWrapper.append(child);
    expect(child.getExposes().current?.get()).toBe(10);
    expect(child.shadowRoot?.textContent).toBe('10');
    expect(displayedProvider(outer)).toBe('1');
    expect(displayedProvider(inner)).toBe('10');
    // Move into slotted light DOM: the same consumer still resolves the same nearest owner.
    inner.append(child);
    child.setProps({ probe: 1 });
    expect(child.getExposes().current?.get()).toBe(10);
    child.setProps({ probe: 1, write: 2 });
    expect(child.getExposes().current?.get()).toBe(12);
    expect(child.getExposes().previous?.get()).toBe(10);
    expect(child.getExposes().calls?.get()).toBe(1);
    await Promise.resolve();
    inner.update();
    await Promise.resolve();
    expect(child.shadowRoot?.textContent).toBe('12');
    expect(displayedProvider(outer)).toBe('1');
    // The inner owner's read starts at self, not at the outer provider.
    expect(displayedProvider(inner)).toBe('12');
  });

  it('never treats equal debug names or CSS/attribute markers as provider identity', async () => {
    const generated = project();
    const first = generated.create(provider(4));
    const second = generated.create(provider(8, 'OTHER'));
    const child = generated.create(consumer({ optional: true, key: 'OTHER' }));
    const fakeOwner = document.createElement('div');
    fakeOwner.setAttribute('data-pui-root', 'same-debug-name');
    fakeOwner.className = 'native-provider';
    fakeOwner.append(child);
    first.append(fakeOwner);
    const root = container();
    root.append(first, second);
    expect(child.getExposes().current?.get()).toBe(-1);
    expect(child.shadowRoot?.textContent).toBe('-1');
    child.setProps({ write: 7 });
    expect(child.getExposes().accepted?.get()).toBe(false);
    second.append(child);
    child.setProps({ probe: 1, write: 7 });
    expect(child.getExposes().current?.get()).toBe(8);
    child.setProps({ probe: 1, write: 9 });
    expect(child.getExposes().accepted?.get()).toBe(true);
    expect(child.getExposes().current?.get()).toBe(9);
    await Promise.resolve();
    expect(displayedProvider(first)).toBe('4');
  });

  it('rebinds reads, updates and subscription notifications synchronously after an owner move', () => {
    const generated = project();
    const first = generated.create(provider(1));
    const second = generated.create(provider(20));
    const child = generated.create(consumer());
    first.append(child);
    container().append(first, second);
    const owner = child.logicalOwner;
    const exposes = child.getExposes();
    second.append(child);
    child.setProps({ probe: 1 });
    expect(exposes.current?.get()).toBe(20);
    expect(child.logicalOwner).toBe(owner);
    first.setProps({ value: 5 });
    expect(exposes.calls?.get()).toBe(0);
    second.setProps({ value: 21 });
    expect(exposes.current?.get()).toBe(21);
    expect(exposes.previous?.get()).toBe(20);
    child.setProps({ probe: 1, write: 3 });
    expect(exposes.current?.get()).toBe(24);
    expect(exposes.previous?.get()).toBe(21);
    expect(exposes.calls?.get()).toBe(2);
  });

  it('does not update an old provider while detached and invalidates retained handles at settled/explicit disposal', async () => {
    const generated = project();
    const parent = generated.create(provider(2));
    const required = generated.create(consumer());
    const optional = generated.create(consumer({ optional: true }));
    parent.append(required, optional);
    container().append(parent);
    const owner = required.logicalOwner;
    const retained = required.getExposes();
    required.remove();
    expect(() => required.setProps({ write: 3 })).toThrow(/provider.*missing|disconnected/i);
    parent.append(required);
    expect(required.logicalOwner).toBe(owner);
    expect(retained.current?.get()).toBe(2);
    const optionalExposes = optional.getExposes();
    optional.remove();
    optional.setProps({ write: 7, probe: 1 });
    expect(optionalExposes.accepted?.get()).toBe(false);
    expect(optionalExposes.current?.get()).toBe(-1);
    required.remove();
    await Promise.resolve();
    expect(required.logicalOwner).toBeNull();
    expect(() => retained.current?.get()).toThrow(/disposed/i);
    expect(() => optionalExposes.current?.get()).toThrow(/disposed/i);
    parent.append(required);
    expect(required.logicalOwner).not.toBe(owner);
    const renewed = required.getExposes();
    const events: number[] = [];
    renewed.current?.subscribe(({ next }) => events.push(next));
    required.dispose();
    parent.setProps({ value: 9 });
    expect(events).toEqual([]);
    expect(() => renewed.current?.get()).toThrow(/disposed/i);
    expect(() => required.setProps({ probe: 2 })).toThrow(/disposed/i);
  });

  it('retains Context providers and subscriptions across ViewIntent epochs', async () => {
    const generated = project();
    const parent = generated.create(provider(1));
    const child = generated.create(consumer());
    parent.append(child);
    container().append(parent);
    const parentOwner = parent.logicalOwner;
    const childOwner = child.logicalOwner;
    const exposes = child.getExposes();
    child.setProps({ visible: false });
    await Promise.resolve();
    expect(child.present).toBe(false);
    parent.setProps({ value: 4 });
    expect(exposes.current?.get()).toBe(4);
    expect(exposes.previous?.get()).toBe(1);
    expect(exposes.calls?.get()).toBe(1);
    expect(child.logicalOwner).toBe(childOwner);
    parent.setProps({ visible: false, value: 4 });
    await Promise.resolve();
    expect(parent.present).toBe(false);
    child.setProps({ visible: false, write: 2 });
    expect(exposes.current?.get()).toBe(6);
    expect(parent.logicalOwner).toBe(parentOwner);
    parent.setProps({ visible: true, value: 4 });
    child.setProps({ visible: true, write: 2 });
    await Promise.resolve();
    expect(child.logicalOwner).toBe(childOwner);
    expect(child.shadowRoot?.textContent).toBe('6');
    expect(displayedProvider(parent)).toBe('6');
  });

  it('preserves each reentrant semantic transition and deterministic observer ordering', () => {
    const generated = project();
    const parent = generated.create(provider(1));
    const first = generated.create(consumer({ cascade: true }));
    const second = generated.create(consumer());
    parent.append(first, second);
    container().append(parent);
    const seen: string[] = [];
    first
      .getExposes()
      .current?.subscribe(({ next, reason }) => seen.push(`first:${reason}->${next}`));
    second
      .getExposes()
      .current?.subscribe(({ next, reason }) => seen.push(`second:${reason}->${next}`));
    parent.setProps({ value: 2 });
    expect(seen).toEqual(['first:1->2', 'second:1->2', 'first:2->3', 'second:2->3']);
    expect(first.getExposes().calls?.get()).toBe(2);
    expect(second.getExposes().calls?.get()).toBe(2);
  });

  it('keeps strict unsupported diagnostics when Context is combined with unimplemented element props', () => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
      export default definePrototype({name:'unsupported-context-surface',setup(def){
        def.context.trySubscribe(KEY);
        return (renderer)=>renderer.el('div',{class:'surface'},renderer.read.context.tryRead(KEY)?.value??-1);
      }});`,
      { fileName: 'unsupported.ts', files: { 'keys.ts': keys } }
    );
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input', code: 'PUI1006' }],
    });
  });

  it('rejects authored custom-element children at their source tag rather than pretending to preserve child owners', () => {
    const source = `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
      export default definePrototype({name:'unsupported-custom-child',setup(def){
        def.context.provide(KEY,{value:1});
        return (renderer)=>renderer.el('section',renderer.el('x-child-consumer'));
      }});`;
    const parsed = parsePrototype(source, {
      fileName: 'custom-child.ts',
      files: { 'keys.ts': keys },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(emitWebComponentSource(parsed.value)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          category: 'unsupported-input',
          code: 'PUI3302',
          span: { file: 'custom-child.ts', start: source.indexOf("'x-child-consumer'") },
        },
      ],
    });
  });
});
