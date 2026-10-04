// @vitest-environment happy-dom
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';

const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');

interface Projection<T> { get(): T }
interface StyleElement extends HTMLElement {
  readonly logicalOwner: symbol | null;
  readonly viewEpoch: number;
  readonly present: boolean;
  update(): void;
  setProps(props: Record<string, unknown>): void;
  getExposes(): {
    active?: Projection<boolean>;
    updates?: Projection<number>;
    setActive?: (next: boolean) => void;
    withdraw?: () => void;
  };
  dispose(): void;
}
let nextTag = 0;
const elements: StyleElement[] = [];
afterEach(() => {
  for (const element of elements.splice(0)) { element.dispose(); element.remove(); }
});

function create(source: string): StyleElement {
  const parsed = parsePrototype(source, { fileName: 'native-style.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitWebComponentSource(parsed.value, { shadow: true });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const sources = new Map((emitted.value.supportingFiles ?? []).map((file) => [file.path, file.contents]));
  sources.set('component.ts', emitted.value.code);
  const modules = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const name = path.posix.normalize(file);
    const existing = modules.get(name);
    if (existing) return existing;
    const source = sources.get(name);
    if (source === undefined) throw new Error(`Missing generated module: ${name}`);
    const exports: Record<string, unknown> = {};
    modules.set(name, exports);
    const program = ts.transpileModule(source, {
      fileName: name,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', program)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected native dependency: ${specifier}`);
      const target = path.posix.join(path.posix.dirname(name), specifier);
      return load(target.endsWith('.ts') ? target : `${target}.ts`);
    });
    return exports;
  }
  const register = load('component.ts').register as (tag: string) => CustomElementConstructor;
  const tag = `x-native-style-${++nextTag}`;
  register(tag);
  const element = document.createElement(tag) as StyleElement;
  elements.push(element);
  return element;
}

const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'native-style-owner',setup(def){
  def.props.define({visible:{type:'boolean',default:true},command:{type:'string',default:''},accent:{type:'boolean',default:false}});
  const active=def.state.bool('style.active',false);
  const count=def.state.numberDiscrete('style.count',0);
  const updates=def.state.numberDiscrete('style.updates',0);
  const templateStyle=tw('text-black');
  def.feedback.style.use(tw('bg-white','opacity-100'));
  const withdrawn=def.feedback.style.use(tw('opacity-25'));
  withdrawn();
  const dimmed=def.state.bool('style.dimmed',true);
  def.rule({when:(w)=>w.state(dimmed).eq(true),intent:(i)=>i.feedback.style.use(tw('opacity-80'))});
  def.rule({when:(w)=>w.state(active).eq(true),intent:(i)=>i.feedback.style.use(tw('bg-black','opacity-40'))});
  def.rule({when:(w)=>w.prop('accent').eq(true),intent:(i)=>i.feedback.style.use(tw('text-white'))});
  const cancelled=def.rule({when:(w)=>w.t(),intent:(i)=>i.feedback.style.use(tw('bg-yellow-500'))});
  cancelled.dispose();
  def.expose.state('active',active);def.expose.state('updates',updates);
  def.expose.method('setActive',(next:boolean)=>{active.set(next);if(next){count.set(1);}else{count.set(0);}});
  def.expose.method('withdraw',()=>{dimmed.set(false);});
  def.props.watch(['command'],(run,next)=>{
    if(next.command==='patch'){run.feedback.style.patch(tw('bg-red-500','opacity-20'));}
    if(next.command==='suppress'){run.feedback.style.suppress(tw('bg-white'));}
    if(next.command==='clear'){run.feedback.style.clearPatch();}
  });
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  def.lifecycle.onUpdated(()=>{updates.set(updates.get()+1);});
  return (r)=>r.el('output',{style:templateStyle},count.get());
}});`;

function tokens(element: Element): string[] {
  return (element.getAttribute('data-pui-style') ?? '').split(' ').filter(Boolean).sort();
}

describe('generated Custom Element native styles', () => {
  it('projects on the actual host Root and changes Rule styles synchronously without semantic rendering', async () => {
    const element = create(source);
    element.className = 'consumer-layout';
    element.setAttribute('aria-label', 'Consumer label');
    document.body.append(element);
    const root = element;
    const owner = element.logicalOwner;
    const child = element.shadowRoot?.querySelector('output');
    expect(tokens(root)).toEqual(['bg-white', 'opacity-80']);
    expect(child && tokens(child)).toEqual(['text-black']);
    expect(child?.textContent).toBe('0');
    const exposes = element.getExposes();
    exposes.setActive?.(true);
    expect(tokens(root)).toEqual(['bg-black', 'opacity-40']);
    await Promise.resolve();
    expect(element).toBe(root);
    expect(element.logicalOwner).toBe(owner);
    expect(element.shadowRoot?.querySelector('output')).toBe(child);
    expect(child?.textContent).toBe('0');
    expect(exposes.updates?.get()).toBe(0);
    expect(element.className).toBe('consumer-layout');
    expect(element.getAttribute('aria-label')).toBe('Consumer label');
    element.update();
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('output')?.textContent).toBe('1');
    expect(exposes.updates?.get()).toBe(1);
    exposes.setActive?.(false);
    exposes.withdraw?.();
    expect(tokens(element)).toEqual(['bg-white', 'opacity-100']);
    await Promise.resolve();
    expect(exposes.updates?.get()).toBe(1);
  });

  it('gives patch and suppression precedence over Rules and reverses both on clearPatch', async () => {
    const element = create(source);
    document.body.append(element);
    element.getExposes().setActive?.(true);
    const child = element.shadowRoot?.querySelector('output');
    element.setProps({command: 'patch', accent: true});
    expect(tokens(element)).toEqual(['bg-red-500', 'opacity-20', 'text-white']);
    expect(element.shadowRoot?.querySelector('output')).toBe(child);
    await Promise.resolve();
    element.setProps({command: 'suppress', accent: true});
    expect(tokens(element)).toEqual(['opacity-20', 'text-white']);
    await Promise.resolve();
    element.setProps({command: 'clear', accent: true});
    expect(tokens(element)).toEqual(['bg-black', 'opacity-40', 'text-white']);
    element.getExposes().setActive?.(false);
    expect(tokens(element)).toEqual(['bg-white', 'opacity-80', 'text-white']);
    element.getExposes().withdraw?.();
    expect(tokens(element)).toEqual(['bg-white', 'opacity-100', 'text-white']);
    element.setProps({command: 'clear', accent: false});
    expect(tokens(element)).toEqual(['bg-white', 'opacity-100']);
  });

  it('does not turn mount-time state writes or feedback patches into an updated/template refresh', async () => {
    const element = create(`import {definePrototype,tw} from '@proto.ui/core';
      export default definePrototype({name:'mount-style-only',setup(def){
        const count=def.state.numberDiscrete('mount.count',0);
        const updates=def.state.numberDiscrete('mount.updates',0);
        def.expose.state('updates',updates);
        def.feedback.style.use(tw('bg-white','opacity-100'));
        def.lifecycle.onMounted((run)=>{count.set(7);run.feedback.style.patch(tw('bg-black'));run.feedback.style.suppress(tw('opacity-100'));});
        def.lifecycle.onUpdated(()=>{updates.set(updates.get()+1);});
        return (r)=>r.el('output',count.get());
      }});`);
    document.body.append(element);
    const child = element.shadowRoot?.querySelector('output');
    expect(tokens(element)).toEqual(['bg-black']);
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('output')).toBe(child);
    expect(child?.textContent).toBe('0');
    expect(element.getExposes().updates?.get()).toBe(0);
  });

  it('retains detached writes and patches for replay, preserves synchronous moves, and closes terminal resources', async () => {
    const element = create(source);
    element.className = 'consumer-layout';
    document.body.append(element);
    const owner = element.logicalOwner;
    const initialEpoch = element.viewEpoch;
    const exposes = element.getExposes();
    element.remove();
    document.body.append(element);
    await Promise.resolve();
    expect(element.logicalOwner).toBe(owner);
    expect(element.viewEpoch).toBe(initialEpoch);
    element.setProps({visible: false});
    await Promise.resolve();
    expect(element.present).toBe(false);
    expect(element.hasAttribute('data-pui-style')).toBe(false);
    exposes.setActive?.(true);
    element.setProps({visible: false, command: 'patch', accent: true});
    expect(element.hasAttribute('data-pui-style')).toBe(false);
    await Promise.resolve();
    element.setProps({visible: true, command: 'patch', accent: true});
    await Promise.resolve();
    expect(element.logicalOwner).toBe(owner);
    expect(element.viewEpoch).toBeGreaterThan(initialEpoch);
    expect(tokens(element)).toEqual(['bg-red-500', 'opacity-20', 'text-white']);
    expect(element.shadowRoot?.querySelector('output')?.textContent).toBe('1');
    element.setProps({command: 'clear', accent: true});
    expect(tokens(element)).toEqual(['bg-black', 'opacity-40', 'text-white']);
    element.dispose();
    expect(element.hasAttribute('data-pui-style')).toBe(false);
    expect(element.className).toBe('consumer-layout');
    expect(element.shadowRoot?.textContent).toBe('');
    expect(() => exposes.setActive?.(false)).toThrow(/disposed/);
    expect(() => exposes.withdraw?.()).toThrow(/disposed/);
    element.remove();
    document.body.append(element);
    await Promise.resolve();
    expect(element.logicalOwner).toBeNull();
    expect(element.hasAttribute('data-pui-style')).toBe(false);
  });
});
