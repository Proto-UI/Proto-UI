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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface ExternalState<T> {
  get(): T;
  subscribe(
    callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void
  ): () => void;
  unsubscribe(off: () => void): void;
  readonly spec: Readonly<{ kind: string }>;
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
  CompiledComponent: React.ForwardRefExoticComponent<
    Record<string, unknown> & React.RefAttributes<NativeHandle>
  >;
}
const directories: string[] = [];
const roots: Root[] = [];
let moduleIdentity = 0;
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function loadNative(
  source: string,
  files?: Readonly<Record<string, string>>
): Promise<NativeModule> {
  const parsed = parsePrototype(source, { fileName: 'native.proto.ts', files });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `native-${process.pid}-${moduleIdentity++}`
  );
  await mkdir(directory, { recursive: true });
  directories.push(directory);
  const file = path.join(directory, 'Component.tsx');
  await writeFile(file, emitted.value.code, 'utf8');
  for (const supporting of emitted.value.supportingFiles ?? []) {
    const destination = path.join(directory, supporting.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, supporting.contents, 'utf8');
  }
  // The emitted program and its temporary module path are selected at runtime; no static import can name them.
  return (await import(/* @vite-ignore */ file)) as NativeModule;
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
  it('selects a statically required physical Root without activating its Module properties', async () => {
    const image = await loadNative(`import {definePrototype} from '@proto.ui/core';
import {declareImageView} from '@proto.ui/module-image-view';
export default definePrototype({name:'inactive-image',modules:[declareImageView({
  source:'',alternativeText:'Inactive declaration',a11yMode:'informative',fit:'cover'
})],setup(def){return ()=>null;}});`);
    const text = await loadNative(`import {definePrototype} from '@proto.ui/core';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'inactive-input',modules:[declareTextControl({
  content:'plain-text',engine:'host',lineMode:'single'
})],setup(def){return ()=>null;}});`);
    const { host, root } = mountHost();
    const imageRef = React.createRef<NativeHandle>();
    const textRef = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(image.CompiledComponent, { ref: imageRef }),
          React.createElement(text.CompiledComponent, { ref: textRef })
        )
      );
    });
    const physicalImage = host.querySelector('img')!;
    const physicalInput = host.querySelector('input')!;
    expect(physicalImage.getAttribute('alt')).toBeNull();
    expect(physicalImage.style.objectFit).toBe('');
    expect(physicalInput.getAttribute('type')).toBeNull();
    physicalImage.alt = 'Consumer alternative';
    physicalImage.style.objectFit = 'fill';
    physicalInput.value = 'Consumer value';
    await React.act(async () => {
      imageRef.current!.update();
      textRef.current!.update();
    });
    expect(host.querySelector('img')).toBe(physicalImage);
    expect(physicalImage.alt).toBe('Consumer alternative');
    expect(physicalImage.style.objectFit).toBe('fill');
    expect(physicalInput.value).toBe('Consumer value');
  });

  it('projects the negotiated Scroll policy through explicit commits and replacement view epochs', async () => {
    const { CompiledComponent } = await loadNative(`import {definePrototype} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';
export default definePrototype({name:'scroll-root-policy',setup(def){
  def.props.define({present:{type:'boolean',default:true}});
  const surface=asScrollSurface();
  surface.configure({axes:'vertical',projection:'system'});
  const detaches=def.state.numberDiscrete('scroll.detaches',0);
  def.expose.state('count',detaches);
  def.expose.state('projection',surface.projection);
  surface.projection.watch((run,event)=>{
    if(event.type==='next' && event.next==='unresolved'){detaches.set(detaches.get()+1);}
  });
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
  return (r)=>r.el('section','Scrollable content');
}});`);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    const projection = (
      ref.current!.getExposes() as unknown as { projection: ExternalState<string> }
    ).projection;
    const transitions: [string, string][] = [];
    projection.subscribe((event) => transitions.push([event.prev, event.next]));
    const first = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(projection.get()).toBe('system');
    expect(first.getAttribute('data-pui-scroll-projection')).toBe(projection.get());
    expect(first.style.overflowX).toBe('hidden');
    expect(first.style.overflowY).toBe('auto');
    await React.act(async () => {
      ref.current!.update();
    });
    expect(host.querySelector('[data-pui-root]')).toBe(first);
    expect(first.getAttribute('data-pui-scroll-projection')).toBe('system');
    expect(first.style.overflowX).toBe('hidden');
    expect(first.style.overflowY).toBe('auto');
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, present: false }));
    });
    expect(projection.get()).toBe('unresolved');
    expect(ref.current!.getExposes().count.get()).toBe(1);
    expect(transitions).toEqual([['system', 'unresolved']]);
    expect(first.getAttribute('data-pui-scroll-projection')).toBeNull();
    expect(first.style.overflowX).toBe('');
    expect(first.style.overflowY).toBe('');
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, present: true }));
    });
    const second = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(second).not.toBe(first);
    expect(second.getAttribute('data-pui-scroll-projection')).toBe(projection.get());
    expect(second.style.overflowY).toBe('auto');
    expect(transitions).toEqual([
      ['system', 'unresolved'],
      ['unresolved', 'system'],
    ]);
    await React.act(async () => {
      root.unmount();
    });
    expect(transitions).toEqual([
      ['system', 'unresolved'],
      ['unresolved', 'system'],
      ['system', 'unresolved'],
    ]);
    expect(() => projection.get()).toThrow();
    second.dispatchEvent(new Event('scroll'));
    expect(transitions).toEqual([
      ['system', 'unresolved'],
      ['unresolved', 'system'],
      ['system', 'unresolved'],
    ]);
  });

  it('selects the physical Root from aliased pre-render Module requirements', async () => {
    const { CompiledComponent } = await loadNative(
      `import {definePrototype} from '@proto.ui/core';
import {Requirements as useMedia} from './bridge';
export default definePrototype({name:'borrowed-root',modules:useMedia.modules,setup(def){
  useMedia();
  const count=def.state.numberDiscrete('count',5,{min:0,max:100,step:1});
  def.expose.state('count',count);
  return ()=>null;
}});`,
      {
        'bridge.ts': `export {default as Requirements} from './media';`,
        'media.ts': `import {defineAsHook} from '@proto.ui/core';
import {asImageView} from '@proto.ui/hooks';
import {declareImageView} from '@proto.ui/module-image-view';
export default defineAsHook({name:'media-requirements',modules:[declareImageView({
  source:'',alternativeText:'Borrowed image',a11yMode:'informative',fit:'cover'
})],setup(def){
  asImageView();
}});`,
      }
    );
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    const physical = host.querySelector<HTMLElement>('[data-pui-root]');
    expect(physical?.tagName).toBe('IMG');
    expect(physical?.getAttribute('alt')).toBe('Borrowed image');
    expect(physical?.style.objectFit).toBe('cover');
    expect(ref.current!.getExposes().count.get()).toBe(5);
  });

  it('does not lift setup-only Module requirements into physical Root selection', async () => {
    const { CompiledComponent } =
      await loadNative(`import {definePrototype,defineAsHook} from '@proto.ui/core';
import {declareImageView} from '@proto.ui/module-image-view';
const useMedia=defineAsHook({name:'media-requirements',modules:[declareImageView({
  source:'',alternativeText:'Not a caller declaration',a11yMode:'informative',fit:'contain'
})],setup(def){}});
export default definePrototype({name:'ordinary-root',setup(def){
  useMedia();
  const count=def.state.numberDiscrete('count',5,{min:0,max:100,step:1});
  def.expose.state('count',count);
  return ()=>null;
}});`);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    expect(host.querySelector('[data-pui-root]')?.tagName).toBe('DIV');
    expect(ref.current!.getExposes().count.get()).toBe(5);
  });

  it('retains a numeric owner across view epochs, commits only explicit updates and invalidates held handles', async () => {
    const { CompiledComponent } = await loadNative(numericSource);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const lifecycle: string[] = [];
    const props = {
      ref,
      onCreated: () => lifecycle.push('created'),
      onMounted: () => lifecycle.push('mounted'),
      onUpdated: () => lifecycle.push('updated'),
      onUnmounted: () => lifecycle.push('unmounted'),
      onBeforeDispose: () => lifecycle.push('beforeDispose'),
      children: React.createElement('b', null, 'slot'),
    };
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, props));
    });
    const handle = ref.current!;
    const exposes = handle.getExposes();
    const heldState = exposes.count;
    const heldMethod = exposes.add;
    const firstView = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(host.querySelector('output')?.textContent).toBe('2slot');
    expect(heldState.get()).toBe(4);
    expect(firstView.getAttribute('data-count')).toBe('4');
    expect(firstView.style.getPropertyValue('--pui-count')).toBe('4');
    expect(lifecycle).toEqual(['created', 'mounted']);

    const transitions: number[] = [];
    const off = heldState.subscribe((event) => transitions.push(event.next));
    await React.act(async () => {
      heldMethod(3);
    });
    expect(heldState.get()).toBe(7);
    expect(exposes.read()).toBe(7);
    expect(host.querySelector('output')?.textContent).toBe('2slot');
    expect(firstView.getAttribute('data-count')).toBe('7');
    expect(firstView.style.getPropertyValue('--pui-count')).toBe('7');
    expect(transitions).toEqual([7]);
    await React.act(async () => {
      handle.update();
      handle.update();
      handle.update();
    });
    expect(host.querySelector('output')?.textContent).toBe('7slot');
    expect(lifecycle).toEqual(['created', 'mounted', 'updated']);

    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ...props, present: false }));
    });
    expect(host.querySelector('output')).toBeNull();
    expect(handle.getExposes().count).toBe(heldState);
    await React.act(async () => {
      heldMethod(2);
      handle.update();
    });
    expect(heldState.get()).toBe(9);
    expect(host.querySelector('output')).toBeNull();
    expect(firstView.getAttribute('data-count')).toBe('7');
    expect(firstView.style.getPropertyValue('--pui-count')).toBe('7');
    expect(lifecycle).toEqual(['created', 'mounted', 'updated', 'unmounted']);
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ...props, present: true }));
    });
    expect(host.querySelector('output')?.textContent).toBe('9slot');
    const replacementView = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(replacementView).not.toBe(firstView);
    expect(replacementView.getAttribute('data-count')).toBe('4');
    expect(replacementView.style.getPropertyValue('--pui-count')).toBe('4');
    expect(handle.getExposes().add).toBe(heldMethod);
    expect(lifecycle).toEqual(['created', 'mounted', 'updated', 'unmounted', 'mounted']);
    off();
    await React.act(async () => {
      heldMethod(1);
    });
    expect(transitions).toEqual([7, 9, 4]);

    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    expect(lifecycle).toEqual([
      'created',
      'mounted',
      'updated',
      'unmounted',
      'mounted',
      'unmounted',
      'beforeDispose',
    ]);
    expect(() => heldMethod(1)).toThrow(/terminal disposal/);
    expect(() => heldState.get()).toThrow(/terminal disposal/);
    expect(() => heldState.subscribe(() => undefined)).toThrow(/terminal disposal/);
    expect(() => handle.update()).toThrow(/terminal disposal/);
  });

  it('projects State kinds and semantic names independently of Expose keys and template updates', async () => {
    const { CompiledComponent } = await loadNative(`import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'semantic-projection',setup(def){
  const enabled=def.state.bool('@interaction/disabled',true);
  const text=def.state.string('constructor','ready');
  const choice=def.state.enum('panel.Mode','idle',{options:['idle','busy']});
  const steps=def.state.numberDiscrete('  Panel.stepCount!  ',2,{min:0,max:9,step:1});
  const progress=def.state.numberRange('panel.progress',0.25,{min:0,max:1});
  def.expose.state('flag',enabled);
  def.expose.state('label',text);
  def.expose.state('choice',choice);
  def.expose.state('steps',steps);
  def.expose.state('progress',progress);
  def.expose.method('advance',()=>{
    enabled.set(false); text.set('changed'); choice.set('busy'); steps.set(3); progress.set(0.75);
  });
  return r=>r.el('output','unchanged');
}});`);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    const physical = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(physical.getAttribute('data-disabled')).toBe('');
    expect(physical.getAttribute('data-constructor')).toBe('ready');
    expect(physical.getAttribute('data-panel-mode')).toBe('idle');
    expect(physical.getAttribute('data-panel-step-count')).toBe('2');
    expect(physical.style.getPropertyValue('--pui-panel-step-count')).toBe('2');
    expect(physical.style.getPropertyValue('--pui-panel-progress')).toBe('0.25');
    expect(physical.hasAttribute('data-panel-progress')).toBe(false);
    expect(physical.hasAttribute('data-flag')).toBe(false);
    expect(physical.style.getPropertyValue('--pui-constructor')).toBe('');
    const exposes = ref.current!.getExposes() as unknown as { advance(): void };
    await React.act(async () => {
      exposes.advance();
    });
    expect(physical.hasAttribute('data-disabled')).toBe(false);
    expect(physical.getAttribute('data-constructor')).toBe('changed');
    expect(physical.getAttribute('data-panel-mode')).toBe('busy');
    expect(physical.getAttribute('data-panel-step-count')).toBe('3');
    expect(physical.style.getPropertyValue('--pui-panel-step-count')).toBe('3');
    expect(physical.style.getPropertyValue('--pui-panel-progress')).toBe('0.75');
    expect(host.querySelector('output')?.textContent).toBe('unchanged');
  });

  it('runs setup/created exactly once through StrictMode replay and never starts an abandoned shell', async () => {
    const { CompiledComponent } = await loadNative(numericSource);
    const { root } = mountHost();
    const callbacks: string[] = [];
    await React.act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(CompiledComponent, {
            onCreated: () => callbacks.push('created'),
            onMounted: () => callbacks.push('mounted'),
          })
        )
      );
    });
    expect(callbacks).toEqual(['created', 'mounted']);
    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    const abandoned = mountHost();
    const pending = new Promise<never>(() => {});
    function Suspender(): React.ReactNode {
      throw pending;
    }
    await React.act(async () => {
      abandoned.root.render(
        React.createElement(
          React.Suspense,
          { fallback: 'pending' },
          React.createElement(CompiledComponent, { onCreated: () => callbacks.push('abandoned') }),
          React.createElement(Suspender)
        )
      );
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
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, seed: 10 }));
    });
    const state = ref.current!.getExposes().count;
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, seed: null }));
    });
    expect(state.get()).toBe(10);
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    expect(state.get()).toBe(2);
    expect(host.textContent).toBe('10');
    await React.act(async () => {
      ref.current!.update();
    });
    expect(host.textContent).toBe('2');
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, seed: 'invalid' }));
    });
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
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, onChanged }));
    });
    const exposes = ref.current!.getExposes();
    const hookExposes = exposes as unknown as {
      enabled: ExternalState<boolean>;
      label: ExternalState<string>;
      finish(): void;
    };
    await React.act(async () => {
      hookExposes.finish();
    });
    expect(hookExposes.enabled.get()).toBe(false);
    expect(hookExposes.label.get()).toBe('done');
    expect(() => (exposes.add as unknown as (value: unknown) => void)('wrong')).toThrow(
      /invalid method arguments/
    );
    expect(exposes.read()).toBe(0);
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref, seed: 12, onChanged }));
    });
    expect(events).toEqual([12]);
    expect(exposes.read()).toBe(12);
    expect(host.textContent).toBe('12');
  });

  it('rejects reached host capabilities before output instead of silently bridging native source', () => {
    const parsed =
      parsePrototype(`import {definePrototype} from '@proto.ui/core'; import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'unsupported-native',setup(def){const focus=asFocusable();focus.configure({scopeKey:'unsupported'});return r=>r.el('div','value');}});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(emitReactSource(parsed.value)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input' }],
    });
  });

  it('routes native input in owner scope and projects readonly focus/ARIA facts without a template update', async () => {
    const source = `import {definePrototype,tw} from '@proto.ui/core';
    import {asTrigger,asFocusable,asAccessible} from '@proto.ui/hooks';
    export default definePrototype({name:'interaction-owner',setup(def){
      def.props.define({disabled:{type:'boolean',default:false},present:{type:'boolean',default:true}});
      asTrigger();
      const focus=asFocusable();
      focus.configure({disabled:true});
      const accessible=asAccessible();
      const count=def.state.numberDiscrete('count',0,{min:0,max:20,step:1});
      const disabled=def.state.bool('disabled',false);
      const focused=focus.focused;
      def.expose.state('count',count);
      def.expose.state('focused',focused);
      def.expose.state('focusVisible',focus.focusVisible);
      def.expose.state('focusable',focus.focusable);
      accessible.role('button');
      accessible.state('disabled',disabled);
      accessible.state('pressed',focused);
      accessible.action('activate',{event:'click'});
      def.rule({when:w=>w.state(focused).eq(true),intent:i=>i.feedback.style.use(tw('ring-2'))});
      def.expose.event('click',{payload:'void'});
      def.expose.method('focusSelf',(options?:{reason?:'programmatic'|'keyboard'|'pointer',preventScroll?:boolean})=>{focus.focusSelf(options);});
      def.lifecycle.onCreated(run=>{focus.setDisabled(run.props.get().disabled ?? false);});
      def.props.watch(['disabled'],(run,next)=>{disabled.set(next.disabled ?? false);focus.setDisabled(next.disabled ?? false);});
      def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? false);});
      def.event.on('press.commit',(run,event)=>{event.control.requestDefaultActionPrevention();count.set(count.get()+1);run.expose.emit('click');});
      return r=>r.el('span',count.get());
    }});`;
    const { CompiledComponent } = await loadNative(source);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const events: string[] = [];
    const props = { ref, onClick: () => events.push('click') };
    await React.act(async () => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(CompiledComponent, props))
      );
    });
    const handle = ref.current!;
    const exposed = handle.getExposes() as unknown as {
      count: ExternalState<number>;
      focused: ExternalState<boolean>;
      focusVisible: ExternalState<boolean>;
      focusable: ExternalState<boolean>;
      focusSelf(options?: {
        reason?: 'programmatic' | 'keyboard' | 'pointer';
        preventScroll?: boolean;
      }): void;
    };
    const first = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(first.getAttribute('role')).toBe('button');
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('aria-disabled')).toBe('false');
    expect(exposed.focused.spec).toEqual({ kind: 'bool' });
    expect('set' in exposed.focused).toBe(false);
    const transitions: boolean[] = [];
    const off = exposed.focused.subscribe((event) => transitions.push(event.next));
    await React.act(async () => {
      exposed.focusSelf({ reason: 'keyboard', preventScroll: true });
    });
    expect(document.activeElement).toBe(first);
    expect(exposed.focused.get()).toBe(true);
    expect(exposed.focusVisible.get()).toBe(true);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(first.getAttribute('data-pui-style')).toBe('ring-2');
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await React.act(async () => {
      first.dispatchEvent(key);
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    });
    expect(key.defaultPrevented).toBe(true);
    expect(exposed.count.get()).toBe(1);
    expect(events).toEqual(['click']);
    expect(host.textContent).toBe('0');
    expect(() => exposed.focusSelf({ reason: 'wrong' } as never)).toThrow(
      /invalid method arguments/
    );
    await React.act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(CompiledComponent, { ...props, disabled: true })
        )
      );
    });
    expect(exposed.focused.get()).toBe(false);
    expect(exposed.focusable.get()).toBe(false);
    expect(first.getAttribute('aria-disabled')).toBe('true');
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(first.hasAttribute('data-pui-style')).toBe(false);
    expect(transitions).toEqual([true, false]);
    exposed.focused.unsubscribe(off);
    await React.act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(CompiledComponent, { ...props, disabled: false, present: false })
        )
      );
    });
    expect(host.querySelector('[data-pui-root]')).toBeNull();
    await React.act(async () => {
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(exposed.count.get()).toBe(1);
    await React.act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(CompiledComponent, { ...props, present: true })
        )
      );
    });
    const second = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(second).not.toBe(first);
    expect(ref.current!.getExposes()).toBe(exposed);
    await React.act(async () => {
      exposed.focusSelf();
      second.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(exposed.count.get()).toBe(2);
    expect(transitions).toEqual([true, false]);
    const heldFocused = exposed.focused;
    const heldFocusSelf = exposed.focusSelf;
    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    await React.act(async () => {
      second.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(events).toEqual(['click', 'click']);
    expect(() => heldFocused.get()).toThrow();
    expect(() => heldFocused.subscribe(() => undefined)).toThrow();
    expect(() => heldFocusSelf()).toThrow();
  });

  it('installs explicit raw host listeners without hooks and removes Root/global routes at terminal teardown', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'raw-input-owner',setup(def){
      const count=def.state.numberDiscrete('count',0);
      def.expose.state('count',count);
      def.expose.event('sample',{payload:'json'});
      def.event.on('host:sample',(run,event)=>{count.set(count.get()+1);run.expose.emit('sample',count.get());},{once:true});
      def.event.onGlobal('host:global-sample',(run,event)=>{count.set(count.get()+10);run.expose.emit('sample',count.get());});
      return r=>r.el('span',count.get());
    }});`;
    const { CompiledComponent } = await loadNative(source);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const samples: number[] = [];
    await React.act(async () => {
      root.render(
        React.createElement(CompiledComponent, {
          ref,
          onSample: (value: number) => samples.push(value),
        })
      );
    });
    const inputRoot = host.querySelector<HTMLElement>('[data-pui-root]')!;
    const count = ref.current!.getExposes().count;
    await React.act(async () => {
      inputRoot.dispatchEvent(new CustomEvent('sample', { bubbles: true }));
      inputRoot.dispatchEvent(new CustomEvent('sample', { bubbles: true }));
      window.dispatchEvent(new Event('global-sample'));
    });
    expect(count.get()).toBe(11);
    expect(samples).toEqual([1, 11]);
    expect(host.textContent).toBe('0');
    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    await React.act(async () => {
      inputRoot.dispatchEvent(new CustomEvent('sample', { bubbles: true }));
      window.dispatchEvent(new Event('global-sample'));
    });
    expect(samples).toEqual([1, 11]);
    expect(() => count.get()).toThrow(/terminal disposal/);
  });

  it('deactivates real Root and global input during Suspense layout disconnection without publishing lifecycle epochs', async () => {
    const source = `import {definePrototype} from '@proto.ui/core'; import {asFocusable} from '@proto.ui/hooks';
    export default definePrototype({name:'suspended-input',setup(def){
      const focus=asFocusable();focus.configure({autoFocus:true});
      const count=def.state.numberDiscrete('count',0);
      def.expose.state('count',count);def.expose.state('focused',focus.focused);
      def.expose.event('mounted',{payload:'void'});def.expose.event('unmounted',{payload:'void'});
      def.lifecycle.onMounted(run=>{run.expose.emit('mounted');});
      def.lifecycle.onUnmounted(run=>{run.expose.emit('unmounted');});
      def.event.on('press.commit',()=>{count.set(count.get()+1);});
      def.event.onGlobal('key.down',()=>{count.set(count.get()+10);});
      return r=>r.el('span','content');
    }});`;
    const { CompiledComponent } = await loadNative(source);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    const lifecycle: string[] = [];
    const props = {
      ref,
      onMounted: () => lifecycle.push('mounted'),
      onUnmounted: () => lifecycle.push('unmounted'),
    };
    const pending = new Promise<never>(() => {});
    function Gate({ blocked }: { blocked: boolean }): React.ReactNode {
      if (blocked) throw pending;
      return null;
    }
    const view = (blocked: boolean) =>
      React.createElement(
        React.Suspense,
        { fallback: 'pending' },
        React.createElement(CompiledComponent, props),
        React.createElement(Gate, { blocked })
      );
    await React.act(async () => {
      root.render(view(false));
    });
    const held = ref.current!.getExposes() as unknown as {
      count: ExternalState<number>;
      focused: ExternalState<boolean>;
    };
    const activeRoot = host.querySelector<HTMLElement>('[data-pui-root]')!;
    expect(held.focused.get()).toBe(true);
    await React.act(async () => {
      root.render(view(true));
    });
    expect(held.focused.get()).toBe(false);
    await React.act(async () => {
      activeRoot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    });
    expect(held.count.get()).toBe(0);
    expect(lifecycle).toEqual(['mounted']);
    await React.act(async () => {
      root.render(view(false));
    });
    expect(ref.current!.getExposes()).toBe(held);
    expect(held.focused.get()).toBe(true);
    const resumedRoot = host.querySelector<HTMLElement>('[data-pui-root]')!;
    await React.act(async () => {
      resumedRoot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(held.count.get()).toBe(1);
    expect(lifecycle).toEqual(['mounted']);
    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    expect(lifecycle).toEqual(['mounted', 'unmounted']);
  });

  it('enforces finite state domains atomically and clamps range definitions but not callback writes', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'state-domains',setup(def){
      const range=def.state.numberRange('range',-5,{min:0,max:4,clamp:true});
      const stepped=def.state.numberDiscrete('stepped',1,{min:1,max:5,step:2});
      const choice=def.state.numberDiscrete('choice',9,{options:[9,11],min:0,max:2,step:2});
      const label=def.state.string('label','ready',{options:['ready','done']});
      def.expose.state('range',range);def.expose.state('stepped',stepped);def.expose.state('choice',choice);def.expose.state('label',label);
      def.expose.method('setRange',(value:number)=>{range.set(value);});
      def.expose.method('step',(value:number)=>{stepped.set(value);});
      def.expose.method('choose',(value:number)=>{choice.set(value);});
      def.expose.method('setLabel',(value:string)=>{label.set(value);});
      def.expose.method('nonfinite',()=>{range.set(1/0);});
      return r=>r.el('span',range.get());
    }});`;
    const { CompiledComponent } = await loadNative(source);
    const { host, root } = mountHost();
    const ref = React.createRef<NativeHandle>();
    await React.act(async () => {
      root.render(React.createElement(CompiledComponent, { ref }));
    });
    const exposed = ref.current!.getExposes() as unknown as {
      range: ExternalState<number>;
      stepped: ExternalState<number>;
      choice: ExternalState<number>;
      label: ExternalState<string>;
      setRange(value: number): void;
      step(value: number): void;
      choose(value: number): void;
      setLabel(value: string): void;
      nonfinite(): void;
    };
    expect(exposed.range.get()).toBe(0);
    const rangeChanges: number[] = [];
    exposed.range.subscribe((event) => rangeChanges.push(event.next));
    expect(() => exposed.setRange(-1)).toThrow(/outside range/);
    expect(() => exposed.setRange(5)).toThrow(/outside range/);
    expect(() => exposed.nonfinite()).toThrow(/invalid state value/);
    expect(exposed.range.get()).toBe(0);
    expect(rangeChanges).toEqual([]);
    await React.act(async () => {
      exposed.setRange(4);
    });
    expect(exposed.range.get()).toBe(4);
    expect(rangeChanges).toEqual([4]);
    expect(host.textContent).toBe('0');
    expect(() => exposed.step(2)).toThrow(/violates step/);
    expect(() => exposed.step(7)).toThrow(/outside range/);
    expect(exposed.stepped.get()).toBe(1);
    expect(() => exposed.choose(2)).toThrow(/outside options/);
    expect(exposed.choice.get()).toBe(9);
    expect(() => exposed.setLabel('unknown')).toThrow(/outside options/);
    expect(exposed.label.get()).toBe('ready');
    await React.act(async () => {
      exposed.step(5);
      exposed.choose(11);
      exposed.setLabel('done');
    });
    expect(exposed.stepped.get()).toBe(5);
    expect(exposed.choice.get()).toBe(11);
    expect(exposed.label.get()).toBe('done');
  });

  it('rejects component names that would shadow globals used by native lowering', () => {
    const parsed = parsePrototype(numericSource);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(emitReactSource(parsed.value, { componentName: 'Object' })).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'invalid-input' }],
    });
  });
});
