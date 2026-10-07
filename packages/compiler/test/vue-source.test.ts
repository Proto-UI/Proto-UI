// @vitest-environment happy-dom
import { posix } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import * as Vue from 'vue';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');
const vueServerRenderer = createRequire(fileURLToPath(new NodeURL('../package.json', import.meta.url)))('vue/server-renderer');

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
interface InteractionExposes {
  count: PublicState<number>;
  focused: PublicState<boolean>;
  focusVisible: PublicState<boolean>;
  focusable: PublicState<boolean>;
  disable(next: boolean): void;
  focus(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean }): void;
}
interface InteractionHandle { update(): void; getExposes(): InteractionExposes }

const interactionSource = `import {definePrototype} from '@proto.ui/core';
import {asTrigger,asFocusable,asAccessible} from '@proto.ui/hooks';
export default definePrototype({name:'native-input-owner',setup(def){
  def.props.define({visible:{type:'boolean',default:true},disabled:{type:'boolean',default:false}});
  const count=def.state.numberDiscrete('count',0);
  const disabled=def.state.bool('disabled',false);
  const checked=def.state.bool('checked',false);
  asTrigger();
  const focus=asFocusable();focus.configure({navParticipation:'auto'});
  const a11y=asAccessible();a11y.role('button');a11y.nameFromContent();
  a11y.state('disabled',disabled);a11y.state('checked',checked);a11y.state('busy',focus.focused);
  a11y.action('activate',{event:'action'});
  def.expose.state('count',count);def.expose.state('focused',focus.focused);
  def.expose.state('focusVisible',focus.focusVisible);def.expose.state('focusable',focus.focusable);
  def.expose.method('disable',(next:boolean)=>{disabled.set(next);focus.setDisabled(next);});
  def.expose.method('focus',(options?:{reason?:'programmatic'|'keyboard'|'pointer';preventScroll?:boolean})=>{focus.focusSelf(options);});
  def.expose.event('action',{payload:'json'});def.expose.event('phase',{payload:'json'});
  def.event.on('key.down',(run,event)=>{if(event.key===' ')event.control.requestDefaultActionPrevention();});
  def.event.on('press.commit',(run)=>{count.set(count.get()+1);checked.set(!checked.get());run.expose.emit('action',count.get());});
  def.event.on('host:ping',(run)=>{count.set(count.get()+10);run.expose.emit('action',count.get());});
  def.event.onGlobal('host:ping',(run)=>{count.set(count.get()+100);run.expose.emit('action',count.get());});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  def.props.watch(['disabled'],(run,next)=>{disabled.set(next.disabled);focus.setDisabled(next.disabled);});
  def.lifecycle.onCreated((run)=>{disabled.set(run.props.get().disabled);focus.setDisabled(run.props.get().disabled);run.lifecycle.setPresent(run.props.get().visible);});
  def.lifecycle.onMounted((run)=>{run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('phase','updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('phase','unmounted');});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('phase','disposed');});
  return r=>r.el('output',count.get());
}});`;

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

function moduleExports(source: string, files?: Record<string, string>, ssr = false): Record<string, unknown> {
  const parsed = parsePrototype(source, { fileName: 'fixture.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVueSource(parsed.value, {ssr});
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const filesByPath = new Map((emitted.value.supportingFiles ?? []).map((file) => [posix.normalize(file.path), file.contents]));
  filesByPath.set('component.ts', emitted.value.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const prior = cache.get(path);
    if (prior) return prior;
    const text = filesByPath.get(path);
    if (text === undefined) throw new Error(`Missing generated module ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    // Execute only emitted native modules. Any hidden Proto bridge fails here.
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === 'vue/server-renderer') return vueServerRenderer;
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected generated dependency: ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  return load('component.ts');
}

function component(source: string, files?: Record<string, string>): Vue.Component {
  const exports = moduleExports(source, files);
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
  it('uses the SSR projection only for adoption, retaining changed State across later view epochs', async () => {
    const generated = moduleExports(counterSource, undefined, true);
    const renderToString = generated.renderToString as (props: {seed: number; visible: boolean}) => Promise<{html: string; handoff: unknown}>;
    const hydrate = generated.hydrate as (host: Element, handoff: unknown, options: {props: object}) => Vue.App;
    const server = await renderToString({seed: 2, visible: true});
    const host = document.createElement('div'); document.body.append(host); host.innerHTML = server.html;
    const initialRoot = host.firstElementChild;
    const reference = Vue.shallowRef<CounterHandle>();
    const input = Vue.shallowReactive({seed: 2, visible: true, ref: reference});
    const app = hydrate(host, server.handoff, {props: input});
    let owner: CounterHandle | undefined;
    try {
      await settle(); await settle();
      owner = reference.value!;
      const held = owner.getExposes().counter, write = owner.getExposes().write;
      expect(host.firstElementChild).toBe(initialRoot);
      expect(held.get()).toBe(2);
      input.visible = false; await settle(); await settle();
      expect(host.firstElementChild).toBeNull();
      write(9); owner.update(); await settle();
      expect(held.get()).toBe(9);
      expect(host.firstElementChild).toBeNull();
      input.visible = true; await settle(); await settle();
      expect(owner.getExposes().counter).toBe(held);
      expect(host.querySelector('section')?.textContent).toBe('9');
    } finally {
      app.unmount(); host.remove();
    }
    expect(() => owner!.getExposes()).toThrow();
  });

  it('projects focus facts and A11y without updating templates, and retires stale presence Roots', async () => {
    const Generated = component(interactionSource), handle = Vue.shallowRef<InteractionHandle>();
    const input = Vue.shallowRef({ visible: true, disabled: false });
    const actions: number[] = [], phase: string[] = [], focused: boolean[] = [];
    const host = document.createElement('div'); document.body.append(host);
    const app = Vue.createApp({ setup() { return () => Vue.h(Generated, {
      ...input.value, ref: handle, onAction: (value: number) => actions.push(value), onPhase: (value: string) => phase.push(value),
    }); } });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!, exposed = owner.getExposes(), root = host.querySelector<HTMLElement>('[data-pui-root]')!;
      const off = exposed.focused.subscribe((event) => focused.push(event.next));
      expect(exposed.focusable.get()).toBe(true);
      expect('set' in exposed.focused).toBe(false);
      expect(root.getAttribute('tabindex')).toBe('0');
      expect(root.getAttribute('role')).toBe('button');
      expect(root.getAttribute('aria-busy')).toBe('false');
      exposed.focus({ reason: 'keyboard', preventScroll: true });
      expect(document.activeElement).toBe(root);
      expect(exposed.focused.get()).toBe(true);
      expect(exposed.focusVisible.get()).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');
      const key = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      root.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(true);
      expect(exposed.count.get()).toBe(1);
      expect(root.getAttribute('aria-checked')).toBe('true');
      await settle();
      expect(root.textContent).toBe('0');
      expect(phase).toEqual(['mounted']);

      input.value = { visible: true, disabled: true };
      await settle();
      expect(exposed.focusable.get()).toBe(false);
      expect(exposed.focused.get()).toBe(false);
      expect(exposed.focusVisible.get()).toBe(false);
      expect(root.getAttribute('tabindex')).toBe('-1');
      expect(root.getAttribute('aria-disabled')).toBe('true');
      expect(root.textContent).toBe('0');
      expect(phase).toEqual(['mounted']);
      exposed.focus(); root.click();
      expect(exposed.count.get()).toBe(1);

      exposed.disable(false);
      root.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      root.dispatchEvent(new MouseEvent('click', { detail: 1, button: 0, bubbles: true }));
      expect(exposed.count.get()).toBe(2);
      expect(root.getAttribute('aria-checked')).toBe('false');
      expect(root.textContent).toBe('0');
      input.value = { visible: false, disabled: true };
      await settle();
      root.dispatchEvent(new Event('ping'));
      window.dispatchEvent(new Event('ping'));
      expect(exposed.count.get()).toBe(2);
      exposed.focus();
      input.value = { visible: true, disabled: false };
      await settle();
      const nextRoot = host.querySelector<HTMLElement>('[data-pui-root]')!;
      expect(nextRoot).not.toBe(root);
      expect(owner.getExposes().focused).toBe(exposed.focused);
      expect(nextRoot.textContent).toBe('2');
      expect(document.activeElement).toBe(nextRoot);
      expect(nextRoot.getAttribute('aria-busy')).toBe('true');
      root.dispatchEvent(new Event('ping'));
      expect(exposed.count.get()).toBe(2);
      nextRoot.dispatchEvent(new Event('ping'));
      expect(actions).toEqual([1, 2, 12]);
      expect(focused).toEqual([true, false, true]);

      app.unmount();
      nextRoot.dispatchEvent(new Event('ping')); window.dispatchEvent(new Event('ping'));
      expect(actions).toEqual([1, 2, 12]);
      expect(() => exposed.focused.get()).toThrow(/disposed/);
      expect(() => exposed.focused.subscribe(() => {})).toThrow(/disposed/);
      expect(() => exposed.focused.unsubscribe(off)).toThrow(/disposed/);
      expect(() => off()).toThrow(/disposed/);
      expect(() => exposed.focus()).toThrow(/disposed/);
      expect(phase.at(-1)).toBe('disposed');
    } finally { app.unmount(); host.remove(); }
  });

  it('parks input bindings under KeepAlive and reactivates the same owner without duplicate listeners', async () => {
    const Generated = component(interactionSource), handle = Vue.shallowRef<InteractionHandle>(), visible = Vue.ref(true);
    const actions: number[] = [], phase: string[] = [], host = document.createElement('div'); document.body.append(host);
    const app = Vue.createApp({ setup() { return () => Vue.h(Vue.KeepAlive, null, { default: () => visible.value
      ? Vue.h(Generated, { key: 'owner', ref: handle, onAction: (value: number) => actions.push(value), onPhase: (value: string) => phase.push(value) })
      : Vue.h('aside', { key: 'parked' }, 'parked') }); } });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!, exposed = owner.getExposes(), root = host.querySelector<HTMLElement>('[data-pui-root]')!;
      root.click(); window.dispatchEvent(new Event('ping'));
      expect(exposed.count.get()).toBe(101);
      visible.value = false;
      await settle();
      root.click(); root.dispatchEvent(new Event('ping')); window.dispatchEvent(new Event('ping'));
      expect(exposed.count.get()).toBe(101);
      exposed.disable(true);
      expect(exposed.focusable.get()).toBe(false);
      visible.value = true;
      await settle();
      expect(handle.value).toBe(owner);
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(root.getAttribute('tabindex')).toBe('-1');
      expect(root.getAttribute('aria-disabled')).toBe('true');
      root.click();
      expect(exposed.count.get()).toBe(101);
      exposed.disable(false);
      root.click(); window.dispatchEvent(new Event('ping'));
      expect(exposed.count.get()).toBe(202);
      expect(actions).toEqual([1, 101, 102, 202]);
      expect(phase).toEqual(['mounted', 'unmounted', 'mounted']);
    } finally { app.unmount(); host.remove(); }
  });

  it('refreshes style Rules subscribed to helper-owned focus facts without requesting a template update', async () => {
    const Generated = component(`import {definePrototype,tw} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'focus-style-owner',setup(def){
        const focus=asFocusable();const focused=focus.focused;
        def.expose.state('focused',focused);
        def.expose.method('focus',()=>{focus.focusSelf({reason:'keyboard'});});
        def.expose.method('disable',()=>{focus.setDisabled(true);});
        def.rule({when:w=>w.state(focused).eq(true),intent:i=>i.feedback.style.use(tw('ring-2'))});
        return r=>{if(focused.get())return r.el('span','focused');return r.el('span','idle');};
      }});`);
    const host = document.createElement('div'); document.body.append(host);
    const app = Vue.createApp(Generated);
    const owner = app.mount(host) as unknown as { getExposes(): { focused: PublicState<boolean>; focus(): void; disable(): void } };
    try {
      await settle();
      const root = host.querySelector('[data-pui-root]')!, exposed = owner.getExposes();
      exposed.focus();
      expect(exposed.focused.get()).toBe(true);
      expect(root.getAttribute('data-pui-style')).toBe('ring-2');
      await settle();
      expect(root.textContent).toBe('idle');
      exposed.disable();
      expect(exposed.focused.get()).toBe(false);
      expect(root.hasAttribute('data-pui-style')).toBe(false);
      await settle();
      expect(root.textContent).toBe('idle');
    } finally { app.unmount(); host.remove(); }
  });

  it('distinguishes omitted and explicitly undefined host keys in runtime and frame reads', async () => {
    const Generated = component(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'raw-presence-owner',setup(def){
        def.props.define({label:{type:'string',default:'fallback'}});
        const provided=def.state.bool('provided',false);def.expose.state('provided',provided);
        def.lifecycle.onCreated(run=>{provided.set(run.props.isProvided('label'));});
        def.event.on('host:probe',run=>{provided.set(run.props.isProvided('label'));});
        return r=>{if(r.read.props.isProvided('label'))return r.el('output','provided');return r.el('output','missing');};
      }});`);
    const input = Vue.shallowRef<Record<string, unknown>>({}), handle = Vue.shallowRef<{ update(): void; getExposes(): { provided: PublicState<boolean> } }>();
    const host = document.createElement('div');
    const app = Vue.createApp({ setup() { return () => Vue.h(Generated, { ...input.value, ref: handle }); } });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!, exposed = owner.getExposes(), root = host.querySelector('[data-pui-root]')!;
      expect(exposed.provided.get()).toBe(false);
      expect(host.textContent).toBe('missing');
      input.value = { label: undefined };
      await settle();
      root.dispatchEvent(new Event('probe'));
      expect(exposed.provided.get()).toBe(true);
      expect(host.textContent).toBe('missing');
      owner.update();
      await settle();
      expect(host.textContent).toBe('provided');
      input.value = {};
      await settle();
      root.dispatchEvent(new Event('probe'));
      expect(exposed.provided.get()).toBe(false);
      owner.update();
      await settle();
      expect(host.textContent).toBe('missing');
    } finally { app.unmount(); }
  });

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
      files: { 'hook.ts': `import {defineAsHook} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';
        export const install=defineAsHook({name:'install',setup(){const focus=asFocusable();focus.configure({focusScope:true});}});` },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const rejected = emitVueSource(parsed.value);
    expect(rejected).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED', span: { file: 'hook.ts', line: 2 } }] });
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
