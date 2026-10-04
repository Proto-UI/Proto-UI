// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';
import type { GeneratedModule } from './ir';
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
interface InteractionExposes {
  count: ExternalState<number>;
  globalCount: ExternalState<number>;
  focused: ExternalState<boolean>;
  focusable: ExternalState<boolean>;
  focus(): void;
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
const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');
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
  return loadGenerated(emitted.value);
}

function loadGenerated(module: GeneratedModule): unknown {
  const sources = new Map((module.supportingFiles ?? []).map((file) => [posix.normalize(file.path), file.contents]));
  sources.set('generated-vue2.js', module.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const previous = cache.get(path);
    if (previous) return previous;
    const source = sources.get(path);
    if (source === undefined) throw new Error(`Missing generated dependency ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const program = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
    }).outputText;
    // Only checked output and its emitted artifacts execute; authored modules remain parsed data.
    new Function('require', 'exports', program)((specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  return load('generated-vue2.js').CompiledComponent;
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

  it('distinguishes explicit undefined from omission in callback and render prop-presence reads', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'vue2-raw-read-boundary',setup(def){
        def.props.define({label:{type:'string',default:'fallback'}});
        const provided=def.state.bool('provided',false);
        def.expose.state('provided',provided);
        def.lifecycle.onCreated((run)=>{
          provided.set(run.props.isProvided('label'));
        });
        return (r)=>{
          if(r.read.props.isProvided('label')){
            return r.el('output','provided');
          }
          return r.el('output','omitted');
        };
      }});`;
    const mounted = mountNative(loadNative(source), { label: undefined });
    await flushVue2();
    // This prototype's checked Expose schema records callback observations of the raw boundary.
    const api = mounted.instance.getExposes() as unknown as {
      provided: ExternalState<boolean>;
    };
    expect(api.provided.get()).toBe(true);
    expect(mounted.host.querySelector('output')?.textContent).toBe('provided');
    mounted.vm.input = {};
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('omitted');
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
      export default definePrototype({name:'unsupported',setup(){const focus=asFocusable();focus.configure({scopeKey:'unsupported'});}});`);
    if (!unsupported.ok) throw new Error(JSON.stringify(unsupported.diagnostics));
    const result = emitVue2Source(unsupported.value);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'unsupported-input' }] });
  });

  it('binds input, focus and accessibility to the active Root and releases them across view epochs', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      import {asTrigger,asFocusable,asAccessible} from '@proto.ui/hooks';
      export default definePrototype({name:'vue2-native-interaction',setup(def){
        def.props.define({present:{type:'boolean',default:true},disabled:{type:'boolean',default:false},step:{type:'number',default:1}});
        asTrigger();
        const focus=asFocusable();
        focus.configure({autoFocus:false,navParticipation:'auto'});
        const accessible=asAccessible();
        const count=def.state.numberDiscrete('count',0);
        const globalCount=def.state.numberDiscrete('globalCount',0);
        const pressed=def.state.bool('pressed',false);
        def.expose.state('count',count);
        def.expose.state('globalCount',globalCount);
        def.expose.state('focused',focus.focused);
        def.expose.state('focusable',focus.focusable);
        def.expose.method('focus',()=>{focus.focusSelf({reason:'keyboard',preventScroll:true});});
        accessible.role('button');
        accessible.state('pressed',pressed);
        accessible.state('selected',focus.focused);
        accessible.action('activate',{event:'activated'});
        accessible.nameFromContent();
        def.expose.event('activated',{payload:'void'});
        def.expose.event('mounted',{payload:'void'});
        def.expose.event('unmounted',{payload:'void'});
        def.event.on('press.commit',(run)=>{
          count.set(count.get()+(run.props.get().step ?? 0));
          pressed.set(!pressed.get());
          run.expose.emit('activated');
        });
        def.event.on('key.down',(run,event)=>{event.control.requestDefaultActionPrevention({reason:'handled'});});
        def.event.onGlobal('host:vue2-global-input',()=>{globalCount.set(globalCount.get()+1);});
        def.props.watch(['disabled'],(run,next)=>{focus.setDisabled(next.disabled ?? false);});
        def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? false);});
        def.lifecycle.onMounted((run)=>{focus.focusSelf({reason:'keyboard'});run.expose.emit('mounted');});
        def.lifecycle.onUnmounted((run)=>{run.expose.emit('unmounted');});
        return (r)=>r.el('output',count.get());
      }});`;
    const mounted = mountNative(loadNative(source, { autoUpdateOnPropsChange: false }));
    await flushVue2();
    // This checked prototype has a different Expose schema from the counter mount helper.
    const api = mounted.instance.getExposes() as unknown as InteractionExposes;
    const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]');
    if (!root) throw new Error('Missing native Vue2 Root.');
    expect(document.activeElement).toBe(root);
    expect(api.focused.get()).toBe(true);
    expect(api.focusable.get()).toBe(true);
    expect(root.getAttribute('role')).toBe('button');
    expect(root.getAttribute('aria-selected')).toBe('true');
    expect(root.getAttribute('data-pui-a11y-actions')).toBe('activate');
    expect(root.getAttribute('tabindex')).toBe('0');
    const focusedEvents: StateEvent<boolean>[] = [];
    api.focused.subscribe((event) => focusedEvents.push(event));

    mounted.vm.input = { step: 3 };
    await flushVue2();
    root.querySelector('output')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    window.dispatchEvent(new Event('vue2-global-input'));
    expect(api.count.get()).toBe(3);
    expect(api.globalCount.get()).toBe(1);
    expect(root.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('output')?.textContent).toBe('0');
    expect(root.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }))).toBe(false);

    mounted.vm.input = { step: 3, disabled: true };
    await flushVue2();
    expect(api.focusable.get()).toBe(false);
    expect(api.focused.get()).toBe(false);
    expect(root.getAttribute('aria-selected')).toBe('false');
    expect(root.getAttribute('tabindex')).toBe('-1');
    root.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(api.count.get()).toBe(3);

    mounted.vm.input = { step: 3, present: false };
    await flushVue2();
    expect(mounted.host.querySelector('[data-pui-root]')).toBeNull();
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.hasAttribute('aria-pressed')).toBe(false);
    expect(root.hasAttribute('tabindex')).toBe(false);
    root.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    root.dispatchEvent(new FocusEvent('focus'));
    window.dispatchEvent(new Event('vue2-global-input'));
    expect(api.count.get()).toBe(3);
    expect(api.globalCount.get()).toBe(1);
    expect(api.focused.get()).toBe(false);

    mounted.vm.input = { step: 3, present: true };
    await flushVue2();
    const nextRoot = mounted.host.querySelector<HTMLElement>('[data-pui-root]');
    if (!nextRoot) throw new Error('Missing rematerialized native Vue2 Root.');
    expect(nextRoot).not.toBe(root);
    const remountedApi = mounted.instance.getExposes() as unknown as InteractionExposes;
    expect(remountedApi.focused).toBe(api.focused);
    expect(nextRoot.getAttribute('aria-pressed')).toBe('true');
    expect(api.focused.get()).toBe(true);
    nextRoot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    window.dispatchEvent(new Event('vue2-global-input'));
    expect(api.count.get()).toBe(6);
    expect(api.globalCount.get()).toBe(2);
    expect(mounted.events).toEqual(['mounted', 'unmounted', 'mounted']);

    mounted.vm.$destroy();
    nextRoot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    window.dispatchEvent(new Event('vue2-global-input'));
    expect(focusedEvents).toEqual([
      { type: 'next', prev: true, next: false, reason: 'native-focus' },
      { type: 'next', prev: false, next: true, reason: 'native-focus' },
      { type: 'disconnect', reason: 'unmount' },
    ]);
    expect(nextRoot.hasAttribute('role')).toBe(false);
    expect(() => api.focused.get()).toThrow(/terminal/);
    expect(() => api.focus()).toThrow(/terminal/);
  });

  it('refreshes style rules from readonly native focus facts without committing a template update', async () => {
    const source = `import {definePrototype,tw} from '@proto.ui/core';
      import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'vue2-observed-focus-style',setup(def){
        const focus=asFocusable();
        const focused=focus.focused;
        def.expose.method('focus',()=>{focus.focusSelf({reason:'programmatic'});});
        def.rule({when:w=>w.state(focused).eq(true),intent:i=>i.feedback.style.use(tw('bg-blue'))});
        return (r)=>{
          if(focused.get()){return r.el('output','focused');}
          return r.el('output','blurred');
        };
      }});`;
    const mounted = mountNative(loadNative(source));
    await flushVue2();
    const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]');
    if (!root) throw new Error('Missing native Vue2 focus-style Root.');
    // The checked generated Expose schema is known despite the shared counter helper type.
    const api = mounted.instance.getExposes() as unknown as { focus(): void };
    api.focus();
    expect(root.getAttribute('data-pui-style')).toBe('bg-blue');
    await flushVue2();
    expect(root.querySelector('output')?.textContent).toBe('blurred');
    root.blur();
    expect(root.hasAttribute('data-pui-style')).toBe(false);
    expect(root.querySelector('output')?.textContent).toBe('blurred');
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
    const mounted = mountNative(loadGenerated(emitted.value), { [hostileKey]: 'provided' });
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('provided');
    mounted.vm.input = {};
    await flushVue2();
    expect(mounted.host.querySelector('output')?.textContent).toBe('fallback');
  });
});
