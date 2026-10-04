// @vitest-environment happy-dom
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';

const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');

interface StateProjection<T> {
  get(): T;
  subscribe(callback: (event: { prev: T; next: T; reason?: unknown }) => void): () => void;
  unsubscribe(off: () => void): void;
}
interface NativeElement extends HTMLElement {
  logicalOwner: symbol | null;
  viewEpoch: number;
  present: boolean;
  update(): void;
  setProps(props: Record<string, unknown>): void;
  getExposes(): {
    count?: StateProjection<number>;
    mounts?: StateProjection<number>;
    unmounts?: StateProjection<number>;
    inputs?: StateProjection<number>;
    focused?: StateProjection<boolean>;
    focusable?: StateProjection<boolean>;
    bump?: (next: number) => void;
    disable?: (next: boolean) => void;
  };
  dispose(): void;
}
let nextTag = 0;
const mounted: NativeElement[] = [];
afterEach(() => {
  for (const element of mounted.splice(0)) { element.dispose(); element.remove(); }
});

function create(source: string): NativeElement {
  const parsed = parsePrototype(source, { fileName: 'independent.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitWebComponentSource(parsed.value, { shadow: true });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  // Execute the generated consumer, not authored input and not an IR interpreter.
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
  const register = load('component.ts').register as (name: string) => CustomElementConstructor;
  const tag = `x-native-compiler-${++nextTag}`;
  if (!register) throw new Error('Registration API missing');
  register(tag);
  const element = document.createElement(tag) as NativeElement;
  mounted.push(element);
  return element;
}
const stateSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'independent-counter', setup(def){
  const count = def.state.numberDiscrete('counter.value', 0);
  def.expose.state('count', count);
  def.expose.method('bump', (next: number) => {count.set(next);});
  def.lifecycle.onCreated(() => {count.set(1);});
  def.lifecycle.onMounted(() => {count.set(2);});
  return (renderer) => renderer.el('p', count.get());
}});`;
const presenceSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'independent-view', setup(def){
  def.props.define({visible:{type:'boolean',default:true}, count:{type:'number',default:0}});
  const count = def.state.numberDiscrete('view.count', 0);
  const mounts = def.state.numberDiscrete('view.mounts', 0);
  const unmounts = def.state.numberDiscrete('view.unmounts', 0);
  def.expose.state('count', count);
  def.expose.state('mounts', mounts);
  def.expose.state('unmounts', unmounts);
  def.expose.method('bump', (next: number) => {count.set(next);});
  def.props.watch(['visible'], (run, next) => {run.lifecycle.setPresent(next.visible);});
  def.props.watch(['count'], (run, next) => {count.set(next.count);run.update();});
  def.lifecycle.onMounted(() => {mounts.set(mounts.get()+1);});
  def.lifecycle.onUnmounted(() => {unmounts.set(unmounts.get()+1);});
  return (renderer) => renderer.el('section', [renderer.el('p', count.get()), renderer.slot()]);
}});`;

// These regressions exercise externally observable ownership, update, disposal and slot contracts.
describe('native Web Component semantic source', () => {
  it('does not render state writes until an explicit update, and invalidates exposed handles on disposal', async () => {
    const element = create(stateSource);
    document.body.appendChild(element);
    const exposes = element.getExposes();
    expect(element.shadowRoot?.textContent).toBe('1');
    expect(exposes.count?.get()).toBe(2);
    exposes.bump?.(5);
    expect(element.shadowRoot?.textContent).toBe('1');
    element.update();
    await Promise.resolve();
    expect(element.shadowRoot?.textContent).toBe('5');
    element.dispose();
    expect(element.shadowRoot?.textContent).toBe('');
    expect(() => exposes.bump?.(6)).toThrow(/disposed/);
    expect(() => exposes.count?.get()).toThrow(/disposed/);
  });

  it('serializes reentrant exposed state notifications and stops subscriptions at terminal disposal', () => {
    const element = create(stateSource);
    document.body.appendChild(element);
    const exposes = element.getExposes();
    const observed: string[] = [];
    exposes.count?.subscribe(({ next }) => {
      observed.push(`a:${next}`);
      if (next === 5) exposes.bump?.(6);
    });
    exposes.count?.subscribe(({ next }) => observed.push(`b:${next}`));
    exposes.bump?.(5);
    expect(observed).toEqual(['a:5', 'b:5', 'a:6', 'b:6']);
    element.dispose();
    expect(() => exposes.count?.subscribe(() => {})).toThrow(/disposed/);
  });

  it('clamps range defaults but rejects out-of-range writes without mutating the published value', () => {
    const element = create(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'range-boundary',setup(def){
        const count=def.state.numberRange('range.value',-2,{min:0,max:10,clamp:true});
        def.expose.state('count',count);
        def.expose.method('bump',(next:number)=>{count.set(next);});
        return (renderer)=>renderer.el('p',count.get());
      }});`);
    document.body.appendChild(element);
    const exposes = element.getExposes();
    expect(exposes.count?.get()).toBe(0);
    expect(() => exposes.bump?.(11)).toThrow(/range/);
    expect(exposes.count?.get()).toBe(0);
    exposes.bump?.(5);
    expect(exposes.count?.get()).toBe(5);
  });

  it('preserves the logical owner and external subscriptions across view epochs, with native slot projection', async () => {
    const element = create(presenceSource);
    element.style.display = 'inline-flex';
    const content = document.createElement('strong');
    content.textContent = 'projected';
    element.append(content);
    document.body.appendChild(element);
    const identity = element.logicalOwner;
    const epoch = element.viewEpoch;
    const exposes = element.getExposes();
    const events: number[] = [];
    exposes.count?.subscribe(({ next }) => events.push(next));
    expect(element.shadowRoot?.querySelector('slot')?.assignedNodes()).toEqual([content]);
    element.setProps({visible: false, count: 4});
    await Promise.resolve();
    expect(element.present).toBe(false);
    expect(getComputedStyle(element).display).toBe('none');
    expect(element.shadowRoot?.childNodes.length).toBe(0);
    expect(element.logicalOwner).toBe(identity);
    expect(exposes.unmounts?.get()).toBe(1);
    exposes.bump?.(7);
    element.setProps({visible: true, count: 4});
    await Promise.resolve();
    expect(element.logicalOwner).toBe(identity);
    expect(element.viewEpoch).toBeGreaterThan(epoch);
    expect(getComputedStyle(element).display).toBe('inline-flex');
    expect(element.shadowRoot?.querySelector('p')?.textContent).toBe('7');
    expect(element.shadowRoot?.querySelector('slot')?.assignedNodes()).toEqual([content]);
    expect(exposes.mounts?.get()).toBe(2);
    expect(events).toEqual([4, 7]);
    element.update();
    await Promise.resolve();
    expect(element.childNodes).toHaveLength(1);
    expect(element.firstChild).toBe(content);
  });

  it('uses full raw snapshots: invalid input retains a previous valid candidate, omission returns to defaults', async () => {
    const element = create(presenceSource);
    document.body.appendChild(element);
    element.setProps({visible: true, count: 4});
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('p')?.textContent).toBe('4');
    element.setProps({visible: true, count: 'invalid'});
    await Promise.resolve();
    expect(element.getExposes().count?.get()).toBe(4);
    element.setProps({visible: true});
    await Promise.resolve();
    expect(element.getExposes().count?.get()).toBe(0);
    expect(element.shadowRoot?.querySelector('p')?.textContent).toBe('0');
  });

  it('requests callback-time updates after state writes and emits declared native events', async () => {
    const element = create(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'callback-update',setup(def){
        def.props.define({value:{type:'number',default:0}});
        const count = def.state.numberDiscrete('callback.count',0);
        def.expose.state('count',count);
        def.expose.event('changed');
        def.props.watch(['value'],(run,next)=>{
          count.set(next.value);run.expose.emit('changed');run.update();
        });
        return (renderer)=>renderer.el('output',count.get());
      }});`);
    document.body.appendChild(element);
    const observed: number[] = [];
    element.addEventListener('changed', () => {
      observed.push(element.getExposes().count?.get() ?? -1);
      expect(element.shadowRoot?.textContent).toBe('0');
    });
    element.setProps({value:9});
    expect(observed).toEqual([9]);
    await Promise.resolve();
    expect(element.shadowRoot?.textContent).toBe('9');
  });

  it('keeps synchronous DOM moves alive, disposes settled disconnections, and does not revive explicitly disposed elements', async () => {
    const element = create(stateSource);
    document.body.appendChild(element);
    const firstOwner = element.logicalOwner;
    const stale = element.getExposes();
    stale.bump?.(5);
    element.remove();
    document.body.appendChild(element);
    await Promise.resolve();
    expect(element.logicalOwner).toBe(firstOwner);
    expect(stale.count?.get()).toBe(5);
    element.remove();
    await Promise.resolve();
    expect(element.logicalOwner).toBeNull();
    expect(() => stale.bump?.(8)).toThrow(/disposed/);
    document.body.appendChild(element);
    expect(element.logicalOwner).not.toBe(firstOwner);
    expect(element.getExposes().count?.get()).toBe(2);
    element.dispose();
    element.remove();
    document.body.appendChild(element);
    await Promise.resolve();
    expect(element.logicalOwner).toBeNull();
    expect(element.getExposes()).toEqual({});
  });

  it('does not route outward click/input signals back into raw or semantic input handlers', () => {
    const element = create(`import {definePrototype} from '@proto.ui/core';
      import {asTrigger} from '@proto.ui/hooks';
      export default definePrototype({name:'input-loopback',setup(def){
        asTrigger();
        const count=def.state.numberDiscrete('input.count',0);
        const inputs=def.state.numberDiscrete('input.inputs',0);
        def.expose.state('count',count);def.expose.state('inputs',inputs);
        def.expose.event('click');def.expose.event('input');
        def.event.on('host:click',()=>{count.set(count.get()+10);});
        def.event.on('input',()=>{inputs.set(inputs.get()+1);});
        def.event.on('press.commit',(run,event)=>{
          count.set(count.get()+1);
          run.expose.emit('click');run.expose.emit('input');
          event.control.requestDefaultActionPrevention();
        });
        return (r)=>r.el('output',count.get());
      }});`);
    document.body.appendChild(element);
    const outward: string[] = [];
    for (const type of ['click', 'input']) element.addEventListener(type, (event) => {
      if (event instanceof CustomEvent) outward.push(event.type);
    });
    expect(element.dispatchEvent(new MouseEvent('click', {button: 0, detail: 1, bubbles: true, cancelable: true}))).toBe(false);
    expect(outward).toEqual(['click', 'input']);
    expect(element.getExposes().count?.get()).toBe(11);
    expect(element.getExposes().inputs?.get()).toBe(0);
    element.dispatchEvent(new Event('input', {bubbles: true}));
    expect(element.getExposes().inputs?.get()).toBe(1);
    expect(element.shadowRoot?.textContent).toBe('0');
  });

  it('publishes readonly focus facts, refreshes Root projections without rendering, and releases detached listeners', async () => {
    const element = create(`import {definePrototype,tw} from '@proto.ui/core';
      import {asTrigger,asFocusable,asAccessible} from '@proto.ui/hooks';
      export default definePrototype({name:'focus-view',setup(def){
        def.props.define({visible:{type:'boolean',default:true}});
        asTrigger();const focus=asFocusable();const focused=focus.focused;
        focus.configure({disabled:true});
        const accessible=asAccessible();accessible.role('button');accessible.state('selected',focused);
        def.feedback.style.use(tw('bg-white'));
        def.rule({when:(w)=>w.state(focused).eq(true),intent:(i)=>i.feedback.style.use(tw('bg-black'))});
        const count=def.state.numberDiscrete('focus.count',0);
        def.expose.state('count',count);def.expose.state('focused',focused);def.expose.state('focusable',focus.focusable);
        def.expose.method('disable',(next:boolean)=>{focus.setDisabled(next);});
        def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
        def.event.on('press.commit',()=>{count.set(count.get()+1);});
        return (r)=>r.el('output',count.get());
      }});`);
    document.body.appendChild(element);
    const exposes = element.getExposes();
    const child = element.shadowRoot?.querySelector('output');
    const identity = element.logicalOwner;
    const facts: boolean[] = [];
    exposes.focused?.subscribe(({next}) => facts.push(next));
    expect(exposes.focusable?.get()).toBe(false);
    expect(element.getAttribute('tabindex')).toBe('-1');
    expect(element.getAttribute('role')).toBe('button');
    exposes.disable?.(false);
    expect(exposes.focusable?.get()).toBe(true);
    element.dispatchEvent(new FocusEvent('focus'));
    expect(exposes.focused?.get()).toBe(true);
    expect(element.getAttribute('aria-selected')).toBe('true');
    expect(element.getAttribute('data-pui-style')).toBe('bg-black');
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('output')).toBe(child);
    expect(element.shadowRoot?.textContent).toBe('0');
    element.setProps({visible:false});
    await Promise.resolve();
    expect(exposes.focused?.get()).toBe(false);
    expect(facts).toEqual([true, false]);
    expect(element.getAttribute('role')).toBeNull();
    element.dispatchEvent(new MouseEvent('click', {button: 0, detail: 1}));
    expect(exposes.count?.get()).toBe(0);
    element.setProps({visible:true});
    await Promise.resolve();
    element.remove();document.body.appendChild(element);
    await Promise.resolve();
    expect(element.logicalOwner).toBe(identity);
    element.dispatchEvent(new MouseEvent('click', {button: 0, detail: 1}));
    expect(exposes.count?.get()).toBe(1);
    element.remove();
    await Promise.resolve();
    expect(() => exposes.focused?.get()).toThrow(/dispos/);
    expect(() => exposes.focused?.subscribe(() => {})).toThrow(/dispos/);
  });

  it('rejects an illegal portable semantic input type before producing native output', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'unsupported-input',setup(def){
        def.event.on('click', (run,event)=>{event.control.requestDefaultActionPrevention();});
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const rejected = emitWebComponentSource(parsed.value);
    expect(rejected).toMatchObject({ok: false, diagnostics: [
      {code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED', category: 'unsupported-input'},
    ]});
    expect(emitWebComponentSource(parsed.value)).toEqual(rejected);
  });
});
