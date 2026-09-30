// @vitest-environment happy-dom
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';

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
    bump?: (next: number) => void;
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
  const emitted = emitWebComponentSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  // Execute the generated consumer, not authored input and not an IR interpreter.
  const program = ts.transpileModule(emitted.value.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: { register?: (name: string) => CustomElementConstructor } = {};
  new Function('exports', program)(exports);
  const tag = `x-native-compiler-${++nextTag}`;
  if (!exports.register) throw new Error('Registration API missing');
  exports.register(tag);
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

  it('rejects input and default-action capabilities before producing native output', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'unsupported-input',setup(def){
        def.event.on('click', (run,event)=>{event.control.requestDefaultActionPrevention();});
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const rejected = emitWebComponentSource(parsed.value);
    expect(rejected).toMatchObject({ok: false, diagnostics: [
      {code: 'PUI3302', category: 'unsupported-input'},
      {code: 'PUI3302', category: 'unsupported-input'},
    ]});
    expect(emitWebComponentSource(parsed.value)).toEqual(rejected);
  });
});
