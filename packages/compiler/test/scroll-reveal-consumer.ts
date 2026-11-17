import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { compileProject } from '../src/project';
import { writeProjectCompilation } from '../src/project-output';
import type { NativeOwnerHandle, NativeOwnerProfile } from './native-owner-consumer';

const cleanup: (() => void | Promise<void>)[] = [];
let sequence = 0;
export async function cleanupScrollConsumers() {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
}
const familyDeclaration = `{roles:{root:{cardinality:{min:1,max:1}},surface:{cardinality:{min:0,max:'*'}},item:{cardinality:{min:0,max:'*'}}}}`;
const family = `import{createAnatomyFamily}from'@proto.ui/core';
export const FAMILY=createAnatomyFamily('scroll-consumer-family',${familyDeclaration});
export const OTHER=createAnatomyFamily('scroll-consumer-family',${familyDeclaration});`;
const lifecycle = `let current:RunHandle<{}>|null=null;
def.lifecycle.onCreated(run=>{current=run;});
def.expose.method('hide',()=>current?.lifecycle.setPresent(false));
def.expose.method('show',()=>current?.lifecycle.setPresent(true));`;
const rootSource = `import{definePrototype}from'@proto.ui/core';import{FAMILY}from'./family';
export default definePrototype({name:'scroll-family-root',setup(def){
def.anatomy.claim(FAMILY,{role:'root'});return r=>r.slot();}});`;
const itemSource = `import{definePrototype,type RunHandle}from'@proto.ui/core';import{FAMILY}from'./family';
export default definePrototype({name:'scroll-family-item',setup(def){
def.anatomy.claim(FAMILY,{role:'item'});${lifecycle}return r=>r.el('span','item');}});`;
const appliedRevealScenario = `let completionArmed=false;
let completionVisits=0;
let completionBeforeAtEnd=false;
let completionBeforeState='';
let completionAfterAtEnd=false;
let completionAfterState='';
let completionNestedKind='';
scroll.endFollow.requestStatus.watch((run,event)=>{
  if(event.type!=='next'||event.next!=='applied'||!completionArmed)return;
  completionArmed=false;
  completionVisits=completionVisits+1;
  completionBeforeAtEnd=scroll.vertical.atEnd.get();
  completionBeforeState=scroll.endFollow.state.get();
  const parts=run.anatomy.order.partsOf(FAMILY,'item');
  const part=parts[0];
  if(part){const outcome=scroll.request({kind:'reveal',axis:'vertical',family:FAMILY,part});completionNestedKind=outcome.kind;}
  completionAfterAtEnd=scroll.vertical.atEnd.get();
  completionAfterState=scroll.endFollow.state.get();
});
def.expose.method('armCompletionReveal',()=>{completionArmed=true;});
def.expose.method('requestEnd',()=>scroll.request({kind:'to-end',axis:'vertical'}));
def.expose.method('readCompletionTrace',()=>({visits:completionVisits,beforeAtEnd:completionBeforeAtEnd,beforeState:completionBeforeState,nestedKind:completionNestedKind,afterAtEnd:completionAfterAtEnd,afterState:completionAfterState}));
`;
const surfaceSource = (
  appliedReveal = false
) => `import{definePrototype,type RunHandle,type ScrollSurfaceRevealRequest}from'@proto.ui/core';
import{asScrollSurface}from'@proto.ui/hooks';import{FAMILY,OTHER}from'./family';
export default definePrototype({name:'scroll-family-surface',setup(def){
def.anatomy.claim(FAMILY,{role:'surface'});${lifecycle}
const scroll=asScrollSurface();scroll.configure({axes:'vertical',projection:'system',endFollow:{mode:'while-at-end',axis:'vertical'}});
let saved:ScrollSurfaceRevealRequest|null=null;
def.expose.method('reveal',(index:number)=>{
  if(current){const parts=current.anatomy.order.partsOf(FAMILY,'item');const part=index===0?parts[0]:index===1?parts[1]:parts[2];
    if(part)return scroll.request({kind:'reveal',axis:'vertical',family:FAMILY,part});}
  return {kind:'rejected',reason:'unavailable'};
});
def.expose.method('revealOther',(index:number)=>{
  if(current){const parts=current.anatomy.order.partsOf(FAMILY,'item');const part=index===0?parts[0]:index===1?parts[1]:parts[2];
    if(part)return scroll.request({kind:'reveal',axis:'vertical',family:OTHER,part});}
  return {kind:'rejected',reason:'unavailable'};
});
def.expose.method('revealSelf',()=>{
  if(current){const index=current.anatomy.order.indexOfSelf(FAMILY,'surface');const parts=current.anatomy.order.partsOf(FAMILY,'surface');const part=index===0?parts[0]:index===1?parts[1]:parts[2];
    if(part)return scroll.request({kind:'reveal',axis:'vertical',family:FAMILY,part});}
  return {kind:'rejected',reason:'unavailable'};
});
def.expose.method('revealSurface',(index:number)=>{
  if(current){const parts=current.anatomy.order.partsOf(FAMILY,'surface');const part=index===0?parts[0]:index===1?parts[1]:parts[2];
    if(part)return scroll.request({kind:'reveal',axis:'vertical',family:FAMILY,part});}
  return {kind:'rejected',reason:'unavailable'};
});
def.expose.method('capture',(index:number)=>{
  if(current){const parts=current.anatomy.order.partsOf(FAMILY,'item');const part=index===0?parts[0]:index===1?parts[1]:parts[2];
    if(part){const request:ScrollSurfaceRevealRequest={kind:'reveal',axis:'vertical',family:FAMILY,part};saved=request;}}
});
def.expose.method('revealSaved',()=>{if(saved)return scroll.request(saved);return{kind:'rejected',reason:'unavailable'};});
${appliedReveal ? appliedRevealScenario : ''}def.expose.method('read',()=>scroll.getSnapshot());
return r=>r.slot();}});`;

type Name = 'root' | 'surface' | 'direct' | 'nested' | 'nestedItem' | 'sibling' | 'siblingItem';
type Entry = 'Root' | 'Surface' | 'Item';
interface Tree {
  name: Name;
  entry: Entry;
  children?: Tree[];
}
const tree: Tree = {
  name: 'root',
  entry: 'Root',
  children: [
    {
      name: 'surface',
      entry: 'Surface',
      children: [
        { name: 'direct', entry: 'Item' },
        { name: 'nested', entry: 'Surface', children: [{ name: 'nestedItem', entry: 'Item' }] },
      ],
    },
    { name: 'sibling', entry: 'Surface', children: [{ name: 'siblingItem', entry: 'Item' }] },
  ],
};

/** One documented project/writer graph retains family and owner registry identity. */
export async function mountScrollFamily(
  profile: NativeOwnerProfile,
  options: { appliedReveal?: boolean; captureDirectory?: string } = {}
) {
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, 'scroll-family-'));
  cleanup.push(() => rm(temporary, { recursive: true, force: true }));
  const author = path.join(temporary, 'author');
  await mkdir(author);
  const sources = {
    'family.ts': family,
    'root.proto.ts': rootSource,
    'surface.proto.ts': surfaceSource(options.appliedReveal),
    'item.proto.ts': itemSource,
  };
  for (const [file, contents] of Object.entries(sources))
    await writeFile(path.join(author, file), contents);
  const capture = options.captureDirectory && path.join(options.captureDirectory, profile);
  if (capture) {
    await mkdir(capture, { recursive: true });
    await cp(author, path.join(capture, 'author'), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
  const compilation = await compileProject({
    root: author,
    entries: ['root.proto.ts', 'surface.proto.ts', 'item.proto.ts'],
    profile,
  });
  if (capture)
    await writeFile(
      path.join(capture, 'compilation.json'),
      JSON.stringify(
        compilation.ok
          ? { ok: true, profile }
          : { ok: false, diagnostics: compilation.diagnostics },
        null,
        2
      )
    );
  if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
  const extension =
    profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
  const sourcePaths = {
    'root.proto.ts': 'Root' + extension,
    'surface.proto.ts': 'Surface' + extension,
    'item.proto.ts': 'Item' + extension,
  };
  const output = path.join(temporary, 'output');
  const written = await writeProjectCompilation(compilation.value, output, { sourcePaths });
  if (capture)
    await writeFile(
      path.join(capture, 'writer.json'),
      JSON.stringify(
        written.ok ? { ok: true, profile } : { ok: false, diagnostics: written.diagnostics },
        null,
        2
      )
    );
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  if (capture)
    await cp(output, path.join(capture, 'output'), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  const generated: Record<string, any> = {};
  for (const file of Object.values(sourcePaths))
    generated[path.basename(file, extension)] = await import(
      /* @vite-ignore */ path.join(output, file)
    );
  const host = document.createElement('main');
  document.body.append(host);
  cleanup.push(() => host.remove());
  const handles = {} as Record<Name, NativeOwnerHandle>;
  const collect = (name: Name, value: unknown) => {
    if (value) handles[name] = value as NativeOwnerHandle;
  };
  const removed = new Set<Name>();
  let flush: () => Promise<void>;
  let remove: (name: Name) => Promise<void>;
  if (profile === 'react-dom-source-v1') {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(host);
    cleanup.push(async () => {
      await React.act(async () => root.unmount());
    });
    const render = (node: Tree): React.ReactElement | null =>
      removed.has(node.name)
        ? null
        : React.createElement(
            'div',
            { key: node.name, 'data-scroll-probe': node.name },
            React.createElement(
              generated[node.entry].CompiledComponent,
              { ref: (value: unknown) => collect(node.name, value) },
              ...(node.children ?? []).map(render)
            )
          );
    await React.act(async () => root.render(render(tree)));
    flush = async () => {
      await React.act(async () => {
        await Promise.resolve();
      });
    };
    remove = async (name) => {
      removed.add(name);
      await React.act(async () => root.render(render(tree)));
    };
  } else if (profile === 'vue-source-v1') {
    const revision = Vue.ref(0);
    const render = (node: Tree): Vue.VNode | null =>
      removed.has(node.name)
        ? null
        : Vue.h('div', { key: node.name, 'data-scroll-probe': node.name }, [
            Vue.h(
              generated[node.entry].CompiledComponent,
              { ref: (value: unknown) => collect(node.name, value) },
              { default: () => (node.children ?? []).map(render) }
            ),
          ]);
    const app = Vue.createApp({
      render: () => {
        void revision.value;
        return render(tree);
      },
    });
    app.mount(host);
    cleanup.push(() => app.unmount());
    flush = async () => {
      await Promise.resolve();
      await Vue.nextTick();
      await Vue.nextTick();
    };
    remove = async (name) => {
      removed.add(name);
      ++revision.value;
      await flush();
    };
  } else if (profile === 'vue2-source-v1') {
    const vm = new Vue2({
      data: () => ({ revision: 0 }),
      render(h) {
        void this.revision;
        const render = (node: Tree): any =>
          removed.has(node.name)
            ? null
            : h('div', { key: node.name, attrs: { 'data-scroll-probe': node.name } }, [
                h(
                  generated[node.entry].CompiledComponent,
                  { ref: node.name },
                  (node.children ?? []).map(render)
                ),
              ]);
        return render(tree);
      },
    });
    vm.$mount();
    host.append(vm.$el);
    cleanup.push(() => vm.$destroy());
    flush = async () => {
      await Promise.resolve();
      await Vue2.nextTick();
      await Vue2.nextTick();
      for (const name of Object.keys(vm.$refs)) collect(name as Name, vm.$refs[name]);
    };
    remove = async (name) => {
      removed.add(name);
      ++vm.revision;
      await flush();
    };
  } else {
    const tags = {} as Record<Entry, string>;
    for (const entry of ['Root', 'Surface', 'Item'] as const) {
      tags[entry] = `x-scroll-${entry.toLowerCase()}-${++sequence}`;
      generated[entry].register(tags[entry]);
    }
    const render = (node: Tree): HTMLElement => {
      const wrapper = document.createElement('div');
      wrapper.dataset.scrollProbe = node.name;
      const element = document.createElement(tags[node.entry]) as HTMLElement &
        NativeOwnerHandle & { dispose(): void };
      collect(node.name, element);
      for (const child of node.children ?? []) element.append(render(child));
      wrapper.append(element);
      return wrapper;
    };
    host.append(render(tree));
    cleanup.push(() => {
      for (const handle of Object.values(handles).reverse())
        (handle as NativeOwnerHandle & { dispose(): void }).dispose();
    });
    flush = async () => {
      await Promise.resolve();
      await Promise.resolve();
    };
    remove = async (name) => {
      (handles[name] as NativeOwnerHandle & { dispose(): void }).dispose();
      host.querySelector(`[data-scroll-probe="${name}"]`)?.remove();
      await flush();
    };
  }
  await flush();
  return {
    host,
    handles,
    compilation: compilation.value,
    output,
    flush,
    remove,
    physical(name: Name): HTMLElement {
      const wrapper = host.querySelector(`[data-scroll-probe="${name}"]`);
      const result =
        profile === 'web-component-source-v1'
          ? wrapper?.firstElementChild
          : wrapper?.querySelector('[data-pui-root]');
      if (!(result instanceof HTMLElement))
        throw new Error('missing current physical root: ' + name);
      return result;
    },
    async act<T>(callback: () => T): Promise<T> {
      let value!: T;
      if (profile === 'react-dom-source-v1')
        await React.act(async () => {
          value = callback();
        });
      else {
        value = callback();
        await flush();
      }
      return value;
    },
  };
}
