// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2, {
  type ComponentOptions,
  type CreateElement,
} from '../../adapters/vue2/node_modules/vue';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compileProject,
  prepareCompilerLibrary,
  readCompilerLibrary,
  writeCompilerLibrary,
  writeLinkedCompilerLibraries,
  linkCompilerLibraries,
  type CompilerLibraryOptions,
  type CompilerLibrary,
} from '../src/index';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface Handle {
  update(): void;
  getExposes(): { count: { get(): number } };
}
type Component = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<Handle>
>;
interface NativeElement extends HTMLElement, Handle {
  setProps(value: Record<string, unknown>): void;
  dispose(): void;
}
const directories: string[] = [];
const cleanup: (() => void | Promise<void>)[] = [];
let nextTag = 0;
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function workspace(): Promise<string> {
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'library-link-'));
  directories.push(directory);
  return directory;
}

/** Public publication and transport APIs, followed by ordinary module imports. */
async function publish(
  directory: string,
  id: string,
  profile: string,
  sources: Record<string, string>,
  options: Pick<CompilerLibraryOptions, 'exports' | 'imports'> = {}
): Promise<CompilerLibrary> {
  const root = path.join(directory, `${id}-author`);
  await mkdir(root);
  for (const [filename, source] of Object.entries(sources))
    await writeFile(path.join(root, filename), source);
  const generation = await compileProject({ root, entries: ['entry.proto.ts'], profile });
  if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
  const extension =
    profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
  const prepared = prepareCompilerLibrary(generation.value, {
    id,
    sourcePaths: { 'entry.proto.ts': `Component${extension}` },
    ...options,
  });
  if (!prepared.ok) throw new Error(JSON.stringify(prepared.diagnostics));
  const destination = path.join(directory, `${id}-published`);
  const written = await writeCompilerLibrary(prepared.value, destination);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const restored = await readCompilerLibrary(destination);
  if (!restored.ok) throw new Error(JSON.stringify(restored.diagnostics));
  return restored.value;
}

async function link(directory: string, libraries: CompilerLibrary[]) {
  const output = path.join(directory, 'linked');
  const linked = await writeLinkedCompilerLibraries(libraries, output, {
    directories: Object.fromEntries(libraries.map(({ manifest }) => [manifest.id, manifest.id])),
  });
  if (!linked.ok) throw new Error(JSON.stringify(linked.diagnostics));
  return {
    output,
    async entry(id: string): Promise<Record<string, unknown>> {
      return import(
        /* @vite-ignore */ path.join(output, linked.value.entries[id]['entry.proto.ts'])
      );
    },
    async declarations(id: string): Promise<Record<string, unknown>> {
      return import(/* @vite-ignore */ path.join(output, id, 'proto-declarations.ts'));
    },
  };
}

const keys = `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('same-debug-name');`;
const alias = `export {KEY as ALIAS} from './keys';`;
const provider = `import {definePrototype} from '@proto.ui/core';import {ALIAS as KEY} from './bridge';
export default definePrototype({name:'linked-provider',setup(def){
  def.props.define({seed:{type:'number',default:1}});
  def.context.provide(KEY,{value:1});
  def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().seed});});
  def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed});});
  return r=>r.el('section',r.slot());
}});`;
const consumer = `import {definePrototype} from '@proto.ui/core';import {ALIAS as KEY} from './bridge';
export default definePrototype({name:'linked-consumer',setup(def){
  const count=def.state.numberDiscrete('count',-1);def.expose.state('count',count);
  def.context.trySubscribe(KEY,(run,next)=>{count.set(next?.value??-1);run.update();});
  def.lifecycle.onCreated(run=>{count.set(run.context.tryRead(KEY)?.value??-1);});
  return r=>r.el('output',r.read.context.tryRead(KEY)?.value??'missing');
}});`;

async function contextFixture(profile: string) {
  const directory = await workspace();
  const sources = (entry: string) => ({
    'keys.ts': keys,
    'bridge.ts': alias,
    'entry.proto.ts': entry,
  });
  const owner = await publish(directory, 'owner', profile, sources(provider), {
    exports: { PublicKey: 'keys.ts#KEY' },
  });
  const bridge = await publish(directory, 'bridge', profile, sources(consumer), {
    imports: { 'keys.ts#KEY': { library: 'owner', export: 'PublicKey' } },
    exports: { ReexportedKey: 'keys.ts#KEY' },
  });
  const subscriber = await publish(directory, 'subscriber', profile, sources(consumer), {
    imports: { 'keys.ts#KEY': { library: 'bridge', export: 'ReexportedKey' } },
    exports: { Key: 'keys.ts#KEY' },
  });
  const privateLibrary = await publish(directory, 'private', profile, sources(consumer), {
    exports: { Key: 'keys.ts#KEY' },
  });
  const linked = await link(directory, [subscriber, privateLibrary, bridge, owner]);
  const [ownerKeys, bridgeKeys, subscriberKeys, privateKeys] = await Promise.all(
    ['owner', 'bridge', 'subscriber', 'private'].map(linked.declarations)
  );
  expect(bridgeKeys.ReexportedKey).toBe(ownerKeys.PublicKey);
  expect(subscriberKeys.Key).toBe(ownerKeys.PublicKey);
  expect(privateKeys.Key).not.toBe(ownerKeys.PublicKey);
  return linked;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2.nextTick();
  await Promise.resolve();
}

describe('ordinary consumers of independently compiled and linked libraries', () => {
  it('fails visibly when an ordinary import evaluates an unlinked external obligation', async () => {
    const directory = await workspace();
    await publish(
      directory,
      'unlinked',
      'react-dom-source-v1',
      {
        'keys.ts': keys,
        'bridge.ts': alias,
        'entry.proto.ts': consumer,
      },
      {
        exports: { Key: 'keys.ts#KEY' },
        imports: { 'keys.ts#KEY': { library: 'absent-owner', export: 'Key' } },
      }
    );
    await expect(
      import(/* @vite-ignore */ path.join(directory, 'unlinked-published/proto-declarations.ts'))
    ).rejects.toThrow(/Unresolved external declaration.*absent-owner/);
  });

  it('uses React imports through native wrappers and portals, updates repeatedly and disposes subscriptions', async () => {
    const linked = await contextFixture('react-dom-source-v1');
    const Provider = (await linked.entry('owner')).CompiledComponent as Component;
    const Consumer = (await linked.entry('subscriber')).CompiledComponent as Component;
    const Private = (await linked.entry('private')).CompiledComponent as Component;
    const host = document.createElement('main'),
      portalHost = document.createElement('aside');
    document.body.append(host, portalHost);
    const root = createRoot(host);
    cleanup.push(async () => {
      await React.act(async () => root.unmount());
    });
    const ref = React.createRef<Handle>();
    const Wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement('article', null, children);
    const tree = (seed: number, visible = true) =>
      React.createElement(
        Provider,
        { seed },
        React.createElement(
          Wrapper,
          null,
          visible ? React.createElement(Consumer, { ref }) : null,
          React.createElement(Private),
          React.createElement('button', null, 'ordinary native child')
        ),
        React.createElement(Provider, { seed: 30 }, React.createElement(Consumer)),
        createPortal(React.createElement(Consumer), portalHost)
      );
    await React.act(async () => root.render(tree(7)));
    expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
      '7',
      'missing',
      '30',
    ]);
    expect(portalHost.querySelector('output')?.textContent).toBe('7');
    const held = ref.current!.getExposes().count;
    for (const seed of [8, 20]) {
      await React.act(async () => root.render(tree(seed)));
      expect(held.get()).toBe(seed);
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
        String(seed),
        'missing',
        '30',
      ]);
      expect(portalHost.querySelector('output')?.textContent).toBe(String(seed));
    }
    await React.act(async () => root.render(tree(21, false)));
    expect(ref.current).toBeNull();
    expect(() => held.get()).toThrow(/dispos/i);
    await React.act(async () => root.render(tree(22)));
    expect(ref.current!.getExposes().count.get()).toBe(22);
    expect(host.querySelector('button')?.textContent).toBe('ordinary native child');
  });

  it('uses Vue 3 native component slots, nearest providers and disposal', async () => {
    const linked = await contextFixture('vue-source-v1');
    const Provider = (await linked.entry('owner')).default as Vue.Component;
    const Consumer = (await linked.entry('subscriber')).default as Vue.Component;
    const Private = (await linked.entry('private')).default as Vue.Component;
    const host = document.createElement('main');
    document.body.append(host);
    const seed = Vue.ref(7),
      visible = Vue.ref(true),
      ref = Vue.shallowRef<Handle>();
    const Wrapper = Vue.defineComponent({
      setup(_props, ctx) {
        return () => Vue.h('article', ctx.slots.default?.());
      },
    });
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(
            Provider,
            { seed: seed.value },
            {
              default: () => [
                Vue.h(Wrapper, null, {
                  default: () => [
                    visible.value ? Vue.h(Consumer, { ref }) : null,
                    Vue.h(Private),
                    Vue.h('button', 'native'),
                  ],
                }),
                Vue.h(Provider, { seed: 30 }, { default: () => Vue.h(Consumer) }),
              ],
            }
          );
      },
    });
    app.mount(host);
    cleanup.push(() => app.unmount());
    await settle();
    expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
      '7',
      'missing',
      '30',
    ]);
    const held = ref.value!.getExposes().count;
    for (const value of [8, 20]) {
      seed.value = value;
      await settle();
      expect(held.get()).toBe(value);
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
        String(value),
        'missing',
        '30',
      ]);
    }
    visible.value = false;
    await settle();
    expect(() => held.get()).toThrow(/dispos/i);
    seed.value = 22;
    visible.value = true;
    await settle();
    expect(ref.value!.getExposes().count.get()).toBe(22);
  });

  it('uses Vue 2 ordinary options imports and native children without a Proto launcher', async () => {
    const linked = await contextFixture('vue2-source-v1');
    const Provider = (await linked.entry('owner')).default as ComponentOptions<Vue2>;
    const Consumer = (await linked.entry('subscriber')).default as ComponentOptions<Vue2>;
    const Private = (await linked.entry('private')).default as ComponentOptions<Vue2>;
    const input = Vue2.observable({ seed: 7, visible: true });
    const host = document.createElement('main');
    document.body.append(host);
    const app = new Vue2({
      render(h: CreateElement) {
        return h(Provider, { props: { seed: input.seed } }, [
          h('article', [
            input.visible ? h(Consumer, { ref: 'consumer' }) : null,
            h(Private),
            h('button', 'native'),
          ]),
          h(Provider, { props: { seed: 30 } }, [h(Consumer)]),
        ]);
      },
    });
    app.$mount(host);
    cleanup.push(() => app.$destroy());
    await settle();
    const output = () => [...app.$el.querySelectorAll('output')].map((node) => node.textContent);
    expect(output()).toEqual(['7', 'missing', '30']);
    const held = (app.$refs.consumer as unknown as Handle).getExposes().count;
    for (const seed of [8, 20]) {
      input.seed = seed;
      await settle();
      expect(held.get()).toBe(seed);
      expect(output()).toEqual([String(seed), 'missing', '30']);
    }
    input.visible = false;
    await settle();
    expect(() => held.get()).toThrow(/terminally invalidated/);
    input.seed = 22;
    input.visible = true;
    await settle();
    expect((app.$refs.consumer as unknown as Handle).getExposes().count.get()).toBe(22);
  });

  it('uses registered Web Components through ordinary DOM wrappers and terminal disconnect', async () => {
    const linked = await contextFixture('web-component-source-v1');
    const tags = new Map<string, string>();
    async function element(id: string): Promise<NativeElement> {
      let tag = tags.get(id);
      if (!tag) {
        const module = await linked.entry(id);
        tag = `linked-library-${++nextTag}`;
        (module.register as (tag: string) => void)(tag);
        tags.set(id, tag);
      }
      const value = document.createElement(tag) as NativeElement;
      cleanup.push(() => value.dispose());
      return value;
    }
    const outer = await element('owner'),
      inner = await element('owner');
    const direct = await element('subscriber'),
      nested = await element('subscriber'),
      privateChild = await element('private');
    outer.setProps({ seed: 7 });
    inner.setProps({ seed: 30 });
    const wrapper = document.createElement('article'),
      button = document.createElement('button');
    button.textContent = 'native';
    wrapper.append(direct, privateChild, button);
    inner.append(nested);
    outer.append(wrapper, inner);
    document.body.append(outer);
    await settle();
    expect([direct, privateChild, nested].map((node) => node.getExposes().count.get())).toEqual([
      7, -1, 30,
    ]);
    const held = direct.getExposes().count;
    for (const seed of [8, 20]) {
      outer.setProps({ seed });
      await settle();
      expect([
        held.get(),
        privateChild.getExposes().count.get(),
        nested.getExposes().count.get(),
      ]).toEqual([seed, -1, 30]);
      expect(direct.querySelector('output')?.textContent).toBe(String(seed));
    }
    direct.remove();
    await settle();
    expect(() => held.get()).toThrow(/dispos/i);
    outer.setProps({ seed: 22 });
    await settle();
    const replacement = await element('subscriber');
    wrapper.append(replacement);
    await settle();
    expect(replacement.getExposes().count.get()).toBe(22);
    expect(button.textContent).toBe('native');
  });

  it('shares Anatomy membership and Focus Scope keys between different independently compiled feature closures', async () => {
    const directory = await workspace();
    const declarations = `import {createAnatomyFamily,createFocusScopeKey} from '@proto.ui/core';
      export const FAMILY=createAnatomyFamily('linked-family',{roles:{root:{cardinality:{min:1,max:1}},item:{cardinality:{min:0,max:'*'}}}});
      export const SCOPE=createFocusScopeKey({kind:'linked-scope'});`;
    const parentSource = `import {definePrototype} from '@proto.ui/core';import {asFocusScope} from '@proto.ui/hooks';import {FAMILY,SCOPE} from './keys';
      export default definePrototype({name:'linked-parent',setup(def){
        def.anatomy.claim(FAMILY,{role:'root'});const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);
        def.anatomy.subscribeParts(FAMILY,'item',(run,parts)=>{count.set(parts.length);});
        const scope=asFocusScope();scope.configure({key:SCOPE,entry:'manual',restore:'none'});
        def.expose.method('first',()=>{scope.focusFirst();});return r=>r.el('section',r.slot());
      }});`;
    const childSource = `import {definePrototype} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';import {FAMILY,SCOPE} from './keys';
      export default definePrototype({name:'linked-item',setup(def){def.anatomy.claim(FAMILY,{role:'item'});
        const focus=asFocusable();focus.configure({scopeKey:SCOPE});return r=>r.el('span','linked item');
      }});`;
    const exports = { Family: 'keys.ts#FAMILY', Scope: 'keys.ts#SCOPE' };
    const parent = await publish(
      directory,
      'parent',
      'react-dom-source-v1',
      { 'keys.ts': declarations, 'entry.proto.ts': parentSource },
      { exports }
    );
    const child = await publish(
      directory,
      'child',
      'react-dom-source-v1',
      { 'keys.ts': declarations, 'entry.proto.ts': childSource },
      {
        imports: {
          'keys.ts#FAMILY': { library: 'parent', export: 'Family' },
          'keys.ts#SCOPE': { library: 'parent', export: 'Scope' },
        },
      }
    );
    const wrong = await publish(directory, 'wrong', 'react-dom-source-v1', {
      'keys.ts': declarations,
      'entry.proto.ts': childSource,
    });
    const linked = await link(directory, [parent, child, wrong]);
    const Parent = (await linked.entry('parent')).CompiledComponent as Component;
    const Child = (await linked.entry('child')).CompiledComponent as Component;
    const Private = (await linked.entry('wrong')).CompiledComponent as Component;
    const host = document.createElement('main');
    document.body.append(host);
    const root = createRoot(host);
    cleanup.push(async () => {
      await React.act(async () => root.unmount());
    });
    const ref = React.createRef<Handle>();
    const tree = (visible: boolean) =>
      React.createElement(
        Parent,
        { ref },
        React.createElement(
          'article',
          null,
          React.createElement('div', { 'data-private': 'yes' }, React.createElement(Private)),
          React.createElement(
            'div',
            { 'data-linked': 'yes' },
            visible ? React.createElement(Child) : null
          )
        )
      );
    await React.act(async () => root.render(tree(true)));
    const exposes = ref.current!.getExposes() as ReturnType<Handle['getExposes']> & {
      first(): void;
    };
    expect(exposes.count.get()).toBe(1);
    await React.act(async () => {
      exposes.first();
    });
    expect(document.activeElement).toBe(host.querySelector('[data-linked] > [data-pui-root]'));
    await React.act(async () => root.render(tree(false)));
    expect(exposes.count.get()).toBe(0);
    await React.act(async () => root.render(tree(true)));
    expect(exposes.count.get()).toBe(1);
  });

  it('resolves structured A11y targets across independent feature closures without crossing domains or private families', async () => {
    const directory = await workspace();
    const declarations = `import {createAnatomyFamily} from '@proto.ui/core';
      export const FAMILY=createAnatomyFamily('same-debug-name',{roles:{root:{cardinality:{min:1,max:1}},source:{cardinality:{min:0,max:'*'}},content:{cardinality:{min:0,max:'*'}}}});`;
    const rootSource = `import {definePrototype} from '@proto.ui/core';import {FAMILY} from './keys';
      export default definePrototype({name:'relationship-scope',setup(def){def.anatomy.claim(FAMILY,{role:'root'});return r=>r.el('section',r.slot());}});`;
    const endpoint = (target: boolean) => `import {definePrototype} from '@proto.ui/core';import {asAccessible} from '@proto.ui/hooks';import {FAMILY} from './keys';
      export default definePrototype({name:'arbitrary-${target ? 'target' : 'source'}',setup(def){
        def.anatomy.claim(FAMILY,{role:'${target ? 'content' : 'source'}'});
        const key=def.state.string('key','match');const accessible=asAccessible();
        ${target ? `accessible.part(FAMILY,{key});` : `accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:'content',key}});`}
        def.expose.method('key',(value:string)=>key.set(value));
        return r=>r.el('${target ? 'article' : 'button'}','endpoint');
      }});`;
    const profile = 'react-dom-source-v1';
    const scope = await publish(directory, 'scope', profile, { 'keys.ts': declarations, 'entry.proto.ts': rootSource }, { exports: { Family: 'keys.ts#FAMILY' } });
    const imports = { 'keys.ts#FAMILY': { library: 'scope', export: 'Family' } };
    const source = await publish(directory, 'source', profile, { 'keys.ts': declarations, 'entry.proto.ts': endpoint(false) }, { imports });
    const target = await publish(directory, 'target', profile, { 'keys.ts': declarations, 'entry.proto.ts': endpoint(true) }, { imports });
    const privateTarget = await publish(directory, 'private-target', profile, { 'keys.ts': declarations, 'entry.proto.ts': endpoint(true) });
    const linked = await link(directory, [scope, source, target, privateTarget]);
    const Scope = (await linked.entry('scope')).CompiledComponent as Component;
    const Source = (await linked.entry('source')).CompiledComponent as Component;
    const Target = (await linked.entry('target')).CompiledComponent as Component;
    const Private = (await linked.entry('private-target')).CompiledComponent as Component;
    const host = document.createElement('main'); document.body.append(host);
    const root = createRoot(host);
    cleanup.push(async () => { await React.act(async () => root.unmount()); });
    const sourceRef = React.createRef<Handle>(), targetRef = React.createRef<Handle>();
    const tree = (visible: boolean, duplicate = false) => React.createElement('div', null,
      React.createElement('div', { 'data-domain': 'one' }, React.createElement(Scope, null,
        React.createElement(Source, { ref: sourceRef }),
        visible ? React.createElement(Target, { key: 'target', ref: targetRef }) : null,
        duplicate ? React.createElement(Target, { key: 'duplicate' }) : null)),
      React.createElement('div', { 'data-domain': 'adjacent' }, React.createElement(Scope, null,
        React.createElement(Source), React.createElement(Target))),
      React.createElement('div', { 'data-domain': 'private' }, React.createElement(Scope, null,
        React.createElement(Source), React.createElement(Private))));
    await React.act(async () => root.render(tree(true)));
    const first = host.querySelector('[data-domain="one"] button')!;
    const article = host.querySelector<HTMLElement>('[data-domain="one"] article')!;
    const firstId = article.id;
    expect(firstId).toMatch(/^pui-part-/);
    expect(first.getAttribute('aria-controls')).toBe(firstId);
    const adjacent = host.querySelector<HTMLElement>('[data-domain="adjacent"] article')!;
    expect(adjacent.id).not.toBe(firstId);
    expect(host.querySelector('[data-domain="adjacent"] button')!.getAttribute('aria-controls')).toBe(adjacent.id);
    expect(host.querySelector('[data-domain="private"] button')!.hasAttribute('aria-controls')).toBe(false);
    const targetApi = targetRef.current!.getExposes() as unknown as { key(value: string): void };
    const sourceApi = sourceRef.current!.getExposes() as unknown as { key(value: string): void };
    await React.act(async () => targetApi.key('arbitrary / [] unicode 中'));
    expect(first.hasAttribute('aria-controls')).toBe(false);
    await React.act(async () => sourceApi.key('arbitrary / [] unicode 中'));
    expect(first.getAttribute('aria-controls')).toBe(firstId);
    await React.act(async () => { targetApi.key('match'); sourceApi.key('match'); });
    await React.act(async () => root.render(tree(true, true)));
    expect(first.hasAttribute('aria-controls')).toBe(false);
    await React.act(async () => root.render(tree(true)));
    expect(first.getAttribute('aria-controls')).toBe(firstId);
    await React.act(async () => root.render(tree(false)));
    expect(first.hasAttribute('aria-controls')).toBe(false);
    expect(article.hasAttribute('id')).toBe(false);
    await React.act(async () => root.render(tree(true)));
    const replacement = host.querySelector<HTMLElement>('[data-domain="one"] article')!;
    expect(replacement.id).toMatch(/^pui-part-/);
    expect(first.getAttribute('aria-controls')).toBe(replacement.id);
  });

  it('rejects incompatible Focus metadata and declaration kinds before native import', async () => {
    const directory = await workspace();
    const sources = (kind: string) => ({
      'keys.ts': `import {createFocusScopeKey} from '@proto.ui/core';export const KEY=createFocusScopeKey({kind:${JSON.stringify(kind)}});`,
      'entry.proto.ts': `import {definePrototype} from '@proto.ui/core';import {asFocusScope} from '@proto.ui/hooks';import {KEY} from './keys';
        export default definePrototype({name:'focus-contract',setup(){const scope=asFocusScope();scope.configure({key:KEY});return r=>r.slot();}});`,
    });
    const owner = await publish(directory, 'owner', 'react-dom-source-v1', sources('dialog'), {
      exports: { Key: 'keys.ts#KEY' },
    });
    const mismatch = await publish(directory, 'mismatch', 'react-dom-source-v1', sources('menu'), {
      imports: { 'keys.ts#KEY': { library: 'owner', export: 'Key' } },
    });
    expect(linkCompilerLibraries([owner, mismatch])).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4204' }],
    });
    const context = await publish(
      directory,
      'context',
      'react-dom-source-v1',
      { 'keys.ts': keys, 'bridge.ts': alias, 'entry.proto.ts': consumer },
      {
        imports: { 'keys.ts#KEY': { library: 'owner', export: 'Key' } },
      }
    );
    expect(linkCompilerLibraries([owner, context])).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4204' }],
    });
  });

  it.each(['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'])(
    'preserves actual nominal references for every declaration kind in %s',
    async (profile) => {
      const directory = await workspace();
      const source = {
        'keys.ts': `import {createContextKey,createAnatomyFamily,createFocusScopeKey,createFocusRovingKey,createA11ySemanticObjectRef} from '@proto.ui/core';
          export const KEY=createContextKey<{value:number}>('same');
          export const FAMILY=createAnatomyFamily('same',{roles:{root:{cardinality:{min:1,max:1}}}});
          export const SCOPE=createFocusScopeKey({debugLabel:'same'});
          export const ROVING=createFocusRovingKey({debugLabel:'same'});
          export const REF=createA11ySemanticObjectRef();`,
        'bridge.ts': `export {KEY,FAMILY,SCOPE,ROVING,REF as PUBLIC_REF} from './keys';`,
        'entry.proto.ts': `import {definePrototype} from '@proto.ui/core';import {asFocusScope,asFocusRoving,asAccessible} from '@proto.ui/hooks';
          import {KEY,FAMILY,SCOPE,ROVING,PUBLIC_REF as REF} from './bridge';
          export default definePrototype({name:'all-nominal-kinds',setup(def){
            def.context.trySubscribe(KEY);def.anatomy.claim(FAMILY,{role:'root'});
            const scope=asFocusScope();scope.configure({key:SCOPE});
            const roving=asFocusRoving();roving.configure({key:ROVING});
            const accessible=asAccessible();accessible.relation('labelledby',{target:REF});
            return r=>r.slot();
          }});`,
      };
      const names = ['KEY', 'FAMILY', 'SCOPE', 'ROVING', 'REF'];
      const exports = Object.fromEntries(names.map((name) => [name, `keys.ts#${name}`]));
      const owner = await publish(directory, 'owner', profile, source, { exports });
      const importing = await publish(directory, 'importing', profile, source, {
        exports,
        imports: Object.fromEntries(
          names.map((name) => [`keys.ts#${name}`, { library: 'owner', export: name }])
        ),
      });
      const privateLibrary = await publish(directory, 'private', profile, source, { exports });
      const linked = await link(directory, [importing, owner, privateLibrary]);
      const [owned, imported, separate] = await Promise.all(
        ['owner', 'importing', 'private'].map(linked.declarations)
      );
      for (const name of names) {
        expect(imported[name], name).toBe(owned[name]);
        expect(separate[name], name).not.toBe(owned[name]);
      }
      expect(owner.manifest.declarations.map((declaration) => declaration.kind).sort()).toEqual([
        'a11y-ref',
        'anatomy-family',
        'context-key',
        'focus-roving-key',
        'focus-scope-key',
      ]);
    }
  );
});
