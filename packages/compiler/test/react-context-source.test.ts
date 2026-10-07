// @vitest-environment happy-dom
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { writeArtifactSet } from '../src/artifact-output';
import type { OutputArtifact } from '../src/artifact-output';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Handle = {
  update(): void;
  getExposes(): { count: { get(): number }; value(): number };
};
type Component = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<Handle>
>;
type SSRExports = {
  renderGeneratedToString(props: Record<string, unknown>): {
    html: string;
    carrier: Record<string, unknown>;
  };
  hydrateGeneratedRoot(
    host: Element,
    props: Record<string, unknown>,
    carrier: Record<string, unknown>
  ): {
    root: Root;
    getHandle(): Handle;
    render(props: Record<string, unknown>): void;
  };
};
type Scope = {
  provide(key: object, value: unknown): void;
  subscribe(
    key: object,
    mode: 'required' | 'optional',
    callback?: (next: { value: number } | null, prev: { value: number } | null) => void
  ): () => void;
  read(key: object): { value: number };
  tryRead(key: object): { value: number } | null;
  update(key: object, value: unknown): void;
  tryUpdate(key: object, value: unknown): boolean;
  dispose(): void;
};
type Helpers = {
  createContextScope(options: {
    getParent(): Scope | null;
    isAlive(): boolean;
    invoke<T>(callback: () => T): T;
    validate(key: object, value: unknown): boolean;
  }): Scope;
  acceptsContextValue(schema: unknown, value: unknown): boolean;
};
const directories: string[] = [];
const roots: Root[] = [];
let identity = 0;
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const keySource = `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('same-debug-name');
export const OTHER=createContextKey<{value:number}>('same-debug-name');`;
const header = `import {definePrototype} from '@proto.ui/core'; import {KEY,OTHER} from './keys';`;
const provider = `${header}
export default definePrototype({name:'context-provider',setup(def){
  def.props.define({seed:{type:'number',default:1}});
  def.context.provide(KEY,{value:1});
  def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().seed ?? 1});});
  def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed ?? 1});});
  return r=>r.el('section',r.slot());
}});`;
const consumer = `${header}
export default definePrototype({name:'context-consumer',setup(def){
  def.props.define({present:{type:'boolean',default:true},bump:{type:'number',default:0}});
  const count=def.state.numberDiscrete('count',0);
  def.expose.state('count',count);
  def.expose.method('value',()=>count.get());
  def.expose.event('changed',{payload:'json'});
  def.context.subscribe(KEY,(run,next,prev)=>{
    count.set(next.value);
    run.expose.emit('changed',{next:next.value,prev:prev.value});
  });
  def.lifecycle.onCreated(run=>{count.set(run.context.read(KEY).value);});
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? true);});
  def.props.watch(['bump'],(run,next)=>{run.context.update(KEY,prev=>({value:prev.value+(next.bump ?? 0)}));});
  return r=>r.el('output',r.read.context.read(KEY).value);
}});`;
const optional = (key: 'KEY' | 'OTHER') => `${header}
export default definePrototype({name:'optional-${key}',setup(def){
  def.props.define({bump:{type:'number',default:0}});
  const count=def.state.numberDiscrete('count',0);
  def.expose.state('count',count);
  def.expose.method('value',()=>count.get());
  def.context.trySubscribe(${key},(_run,next)=>{count.set(next?.value ?? -1);});
  def.lifecycle.onCreated(run=>{count.set(run.context.tryRead(${key})?.value ?? -1);});
  def.props.watch(['bump'],(run,next)=>{run.context.tryUpdate(${key},prev=>({value:prev.value+(next.bump ?? 0)}));});
  return r=>r.el('output',r.read.context.tryRead(${key})?.value ?? 'missing');
}});`;

async function loadProject(
  sources: Readonly<Record<string, string>>,
  files: Readonly<Record<string, string>> = { 'keys.ts': keySource },
  ssr = false
) {
  const artifacts = new Map<string, OutputArtifact>();
  for (const [name, source] of Object.entries(sources)) {
    const parsed = parsePrototype(source, { fileName: `${name}.proto.ts`, files });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitReactSource(parsed.value, { componentName: name, ssr });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    artifacts.set(`${name}.tsx`, {
      path: `${name}.tsx`,
      contents: emitted.value.code,
      kind: 'source',
    });
    for (const file of emitted.value.supportingFiles ?? []) {
      const previous = artifacts.get(file.path);
      if (previous && previous.contents !== file.contents)
        throw new Error(`Conflicting shared artifact: ${file.path}`);
      artifacts.set(file.path, file);
    }
  }
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `context-${process.pid}-${identity++}`
  );
  const written = await writeArtifactSet([...artifacts.values()], directory);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  directories.push(directory);
  const components: Record<string, Component> = {};
  const modules: Record<string, Record<string, unknown>> = {};
  // The generated temporary directory and module specifiers are selected at runtime.
  for (const name of Object.keys(sources)) {
    const filename = path.join(directory, `${name}.tsx`);
    modules[name] = (await import(/* @vite-ignore */ filename)) as Record<string, unknown>;
    components[name] = modules[name][name] as Component;
  }
  const helperFilename = path.join(directory, '.proto-ui/context/scope-v1.ts');
  const helpers = (await import(/* @vite-ignore */ helperFilename)) as Helpers;
  return { components, helpers, modules };
}
function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root };
}

describe('native React Context scope ownership', () => {
  it('rejects absent initial projections and preserves Context for fresh post-adoption children', async () => {
    const {
      components: { Consumer },
      modules: { Provider: exports },
    } = await loadProject({ Provider: provider, Consumer: consumer }, undefined, true);
    const generated = exports as unknown as SSRExports;
    const childRef = React.createRef<Handle>();
    const props = { seed: 7, children: React.createElement(Consumer, { ref: childRef }) };
    const server = generated.renderGeneratedToString(props);
    const host = document.createElement('div');
    host.innerHTML = server.html;
    document.body.append(host);
    const originalRoot = host.firstElementChild;
    expect(() => {
      const invalid = generated.hydrateGeneratedRoot(host, props, {
        ...server.carrier,
        projections: {},
      });
      roots.push(invalid.root);
    }).toThrow();
    expect(host.firstElementChild).toBe(originalRoot);
    let hydrated!: ReturnType<SSRExports['hydrateGeneratedRoot']>;
    await React.act(async () => {
      hydrated = generated.hydrateGeneratedRoot(host, props, server.carrier);
      roots.push(hydrated.root);
    });
    hydrated.getHandle();
    expect(childRef.current!.getExposes().count.get()).toBe(7);
    expect(host.querySelector('output')?.textContent).toBe('7');
    const originalChild = host.querySelector('output');
    await React.act(async () => {
      hydrated.render({ seed: 7, children: null });
    });
    expect(childRef.current).toBeNull();
    expect(host.querySelector('output')).toBeNull();
    await React.act(async () => {
      hydrated.render(props);
    });
    expect(childRef.current!.getExposes().count.get()).toBe(7);
    expect(host.querySelector('output')?.textContent).toBe('7');
    expect(host.querySelector('output')).not.toBe(originalChild);
    expect(host.firstElementChild).toBe(originalRoot);
  });

  it('preserves nominal Anatomy callback parts across child attachment and removal', async () => {
    const files = {
      'family.ts': `import {createAnatomyFamily} from '@proto.ui/core';
      export const FAMILY=createAnatomyFamily('callback-parts',{roles:{root:{cardinality:{min:1,max:1}},item:{cardinality:{min:0,max:'*'}}}});`,
    };
    const parentSource = `import {definePrototype} from '@proto.ui/core';import {FAMILY} from './family';
      export default definePrototype({name:'callback-parent',setup(def){
        def.anatomy.claim(FAMILY,{role:'root'});
        const count=def.state.numberDiscrete('count',0);const role=def.state.string('role','none');const focusable=def.state.bool('focusable',false);
        def.expose.state('count',count);def.expose.state('role',role);def.expose.state('focusable',focusable);
        def.anatomy.subscribeParts(FAMILY,'item',(run,parts)=>{
          count.set(parts.length);const first=parts[0]??null;
          if(first!==null){role.set(first.role);focusable.set(first.hasHook('asFocusable'));}
          else{role.set('none');focusable.set(false);}
        });return r=>r.el('section',[r.el('span','stamp:'+count.get()),r.slot()]);
      }});`;
    const childSource = `import {definePrototype} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';import {FAMILY} from './family';
      export default definePrototype({name:'callback-item',setup(def){def.anatomy.claim(FAMILY,{role:'item'});asFocusable();return ()=>'item';}});`;
    const {
      components: { Parent, Child },
    } = await loadProject({ Parent: parentSource, Child: childSource }, files);
    const { host, root } = mount();
    const ref = React.createRef<Handle>();
    await React.act(async () => {
      root.render(React.createElement(Parent, { ref }, React.createElement(Child)));
    });
    const exposed = ref.current!.getExposes() as unknown as {
      count: { get(): number };
      role: { get(): string };
      focusable: { get(): boolean };
    };
    expect([exposed.count.get(), exposed.role.get(), exposed.focusable.get()]).toEqual([
      1,
      'item',
      true,
    ]);
    expect(host.querySelector('span')?.textContent).toBe('stamp:0');
    await React.act(async () => {
      root.render(React.createElement(Parent, { ref }));
    });
    expect([exposed.count.get(), exposed.role.get(), exposed.focusable.get()]).toEqual([
      0,
      'none',
      false,
    ]);
    expect(host.querySelector('span')?.textContent).toBe('stamp:0');
  });

  it('shares declaration references through native wrappers and portals, resolves nearest scopes, and requires explicit rendering', async () => {
    const {
      components: { Provider, Consumer, Other, Optional },
    } = await loadProject({
      Provider: provider,
      Consumer: consumer,
      Other: optional('OTHER'),
      Optional: optional('KEY'),
    });
    const { host, root } = mount();
    const portalHost = document.createElement('div');
    document.body.append(portalHost);
    const outer = React.createRef<Handle>();
    const inner = React.createRef<Handle>();
    const direct = React.createRef<Handle>();
    const nested = React.createRef<Handle>();
    const portal = React.createRef<Handle>();
    const wrongKey = React.createRef<Handle>();
    const wrongParent = React.createRef<Handle>();
    const unrelated = React.createRef<Handle>();
    const transitions: { who: string; next: number; prev: number }[] = [];
    const sink = (who: string) => (event: { next: number; prev: number }) =>
      transitions.push({ who, ...event });
    const tree = (outerSeed: number, innerSeed: number, bump = 0) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Provider,
          { ref: outer, seed: outerSeed },
          React.createElement(
            'div',
            null,
            React.createElement(Consumer, { ref: direct, onChanged: sink('direct') })
          ),
          React.createElement(
            'aside',
            null,
            React.createElement(
              Provider,
              { ref: inner, seed: innerSeed },
              React.createElement(
                'nav',
                null,
                React.createElement(Consumer, { ref: nested, bump, onChanged: sink('nested') })
              ),
              createPortal(
                React.createElement(
                  'article',
                  null,
                  React.createElement(Consumer, { ref: portal, onChanged: sink('portal') })
                ),
                portalHost
              )
            )
          ),
          React.createElement(Other, { ref: wrongKey })
        ),
        React.createElement(
          Provider,
          { seed: 90 },
          React.createElement(Consumer, { ref: unrelated, onChanged: sink('unrelated') })
        ),
        React.createElement('div', null, React.createElement(Optional, { ref: wrongParent }))
      );
    await React.act(async () => {
      root.render(tree(10, 20));
    });
    expect(direct.current!.getExposes().value()).toBe(10);
    expect(nested.current!.getExposes().value()).toBe(20);
    expect(portal.current!.getExposes().value()).toBe(20);
    expect(portalHost.textContent).toBe('20');
    expect(unrelated.current!.getExposes().value()).toBe(90);
    expect(wrongKey.current!.getExposes().value()).toBe(-1);
    expect(wrongParent.current!.getExposes().value()).toBe(-1);

    await React.act(async () => {
      root.render(tree(11, 20));
    });
    expect(transitions).toEqual([{ who: 'direct', next: 11, prev: 10 }]);
    expect(host.querySelector('output')?.textContent).toBe('10');
    expect(direct.current!.getExposes().value()).toBe(11);
    await React.act(async () => {
      direct.current!.update();
    });
    expect(host.querySelector('output')?.textContent).toBe('11');

    await React.act(async () => {
      root.render(tree(11, 21));
    });
    await React.act(async () => {
      outer.current!.update();
    });
    expect(transitions.slice(1)).toEqual([
      { who: 'nested', next: 21, prev: 20 },
      { who: 'portal', next: 21, prev: 20 },
    ]);
    expect(portalHost.textContent).toBe('20');
    await React.act(async () => {
      portal.current!.update();
      nested.current!.update();
    });
    expect(portalHost.textContent).toBe('21');

    await React.act(async () => {
      root.render(tree(11, 21, 2));
    });
    await React.act(async () => {
      outer.current!.update();
    });
    await React.act(async () => {
      inner.current!.update();
    });
    expect(transitions.slice(3)).toEqual([
      { who: 'nested', next: 23, prev: 21 },
      { who: 'portal', next: 23, prev: 21 },
    ]);
    expect(nested.current!.getExposes().value()).toBe(23);
    expect(portal.current!.getExposes().value()).toBe(23);
    expect(portalHost.textContent).toBe('21');
    expect(unrelated.current!.getExposes().value()).toBe(90);
  });

  it('retains subscriptions while a view is absent and removes them on terminal owner disposal', async () => {
    const {
      components: { Provider, Consumer },
    } = await loadProject({ Provider: provider, Consumer: consumer });
    const { host, root } = mount();
    const owner = React.createRef<Handle>();
    const child = React.createRef<Handle>();
    const changes: unknown[] = [];
    const tree = (seed: number, present: boolean, include = true) =>
      React.createElement(
        Provider,
        { ref: owner, seed },
        include
          ? React.createElement(Consumer, {
              ref: child,
              present,
              onChanged: (event: unknown) => changes.push(event),
            })
          : null
      );
    await React.act(async () => {
      root.render(tree(5, true));
    });
    const heldOwner = child.current!;
    const heldState = heldOwner.getExposes().count;
    const heldMethod = heldOwner.getExposes().value;
    await React.act(async () => {
      root.render(tree(5, false));
    });
    await React.act(async () => {
      owner.current!.update();
    });
    expect(host.querySelector('output')).toBeNull();
    expect(child.current).toBe(heldOwner);
    await React.act(async () => {
      root.render(tree(6, false));
    });
    expect(heldMethod()).toBe(6);
    expect(heldState.get()).toBe(6);
    expect(changes).toEqual([{ next: 6, prev: 5 }]);
    await React.act(async () => {
      root.render(tree(6, true));
    });
    await React.act(async () => {
      owner.current!.update();
    });
    expect(host.querySelector('output')?.textContent).toBe('6');
    expect(child.current!.getExposes().count).toBe(heldState);
    await React.act(async () => {
      root.render(tree(6, true, false));
    });
    await React.act(async () => {
      owner.current!.update();
    });
    expect(() => heldMethod()).toThrow(/terminal disposal/);
    expect(() => heldState.get()).toThrow(/terminal disposal/);
    await React.act(async () => {
      root.render(tree(7, true, false));
    });
    expect(changes).toEqual([{ next: 6, prev: 5 }]);
  });

  it('prefers self-provided Context over ancestors without granting read authority to an unsubscribed provider', async () => {
    const self = `${header} export default definePrototype({name:'self-context',setup(def){
      def.props.define({seed:{type:'number',default:31},present:{type:'boolean',default:true}});
      const count=def.state.numberDiscrete('count',0);
      def.expose.state('count',count);
      def.expose.method('value',()=>count.get());
      def.context.provide(KEY,{value:31});
      def.context.subscribe(KEY,(_run,next)=>{count.set(next.value);});
      def.lifecycle.onCreated(run=>{count.set(run.context.read(KEY).value);});
      def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed ?? 31});});
      def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? true);});
      return r=>r.el('output',r.read.context.read(KEY).value);
    }});`;
    const {
      components: { Provider, Self },
      helpers,
    } = await loadProject({ Provider: provider, Self: self });
    const { host, root } = mount();
    const wrapper = React.createRef<Handle>();
    const selfRef = React.createRef<Handle>();
    const tree = (seed: number, present: boolean) =>
      React.createElement(
        Provider,
        { ref: wrapper, seed: 10 },
        React.createElement('div', null, React.createElement(Self, { ref: selfRef, seed, present }))
      );
    await React.act(async () => {
      root.render(tree(31, true));
    });
    expect(host.querySelector('output')?.textContent).toBe('31');
    const held = selfRef.current!;
    await React.act(async () => {
      root.render(tree(31, false));
    });
    await React.act(async () => {
      wrapper.current!.update();
    });
    expect(host.querySelector('output')).toBeNull();
    await React.act(async () => {
      root.render(tree(32, false));
    });
    await React.act(async () => {
      wrapper.current!.update();
    });
    expect(held.getExposes().value()).toBe(32);
    await React.act(async () => {
      root.render(tree(32, true));
    });
    await React.act(async () => {
      wrapper.current!.update();
    });
    expect(host.querySelector('output')?.textContent).toBe('32');
    expect(selfRef.current).toBe(held);
    const key = Object.freeze({ debugName: 'self' });
    const scope = helpers.createContextScope({
      getParent: () => null,
      isAlive: () => true,
      invoke: (callback) => callback(),
      validate: () => true,
    });
    try {
      scope.provide(key, { value: 1 });
      scope.update(key, { value: 2 });
      expect(() => scope.read(key)).toThrow(/subscription/);
      expect(() => scope.tryUpdate(key, { value: 3 })).toThrow(/optional.*subscription/);
      scope.subscribe(key, 'required');
      expect(scope.read(key)).toEqual({ value: 2 });
    } finally {
      scope.dispose();
    }
  });

  it('rebounds against current ancestry, rejects same-debugName impostors, and preserves every nested transition in deterministic order', async () => {
    const { helpers } = await loadProject({ Provider: provider });
    const key = Object.freeze({ debugName: 'shared' });
    const impostor = Object.freeze({ debugName: 'shared' });
    const schema = { kind: 'record', fields: [{ name: 'value', type: 'number' }] };
    const scopes: Scope[] = [];
    const make = (getParent: () => Scope | null) => {
      const scope = helpers.createContextScope({
        getParent,
        isAlive: () => true,
        invoke: (callback) => callback(),
        validate: (_key, value) => helpers.acceptsContextValue(schema, value),
      });
      scopes.push(scope);
      return scope;
    };
    const left = make(() => null);
    const right = make(() => null);
    let parent: Scope | null = left;
    const required = make(() => parent);
    const optionalScope = make(() => parent);
    const absent = make(() => right);
    const deliveries: string[] = [];
    try {
      left.provide(key, { value: 1 });
      right.provide(key, { value: 10 });
      expect(() => absent.subscribe(impostor, 'required')).toThrow(/provider missing/);
      absent.subscribe(impostor, 'optional');
      expect(absent.tryRead(impostor)).toBeNull();
      expect(absent.tryUpdate(impostor, { value: 9 })).toBe(false);
      expect(right.read.bind(right, key)).toThrow(/subscription/);
      required.subscribe(key, 'required', (next, prev) => {
        deliveries.push(`required:${prev!.value}->${next!.value}`);
        if (next!.value === 2) required.update(key, { value: 3 });
      });
      const off = optionalScope.subscribe(key, 'optional', (next, prev) =>
        deliveries.push(`optional:${prev!.value}->${next!.value}`)
      );
      left.update(key, { value: 2 });
      expect(deliveries).toEqual([
        'required:1->2',
        'optional:1->2',
        'required:2->3',
        'optional:2->3',
      ]);
      expect(required.read(key)).toEqual({ value: 3 });
      parent = right;
      expect(required.read(key)).toEqual({ value: 10 });
      required.update(key, { value: 11 });
      expect(optionalScope.tryRead(key)).toEqual({ value: 11 });
      expect(() => required.update(key, { value: Infinity })).toThrow(/invalid checked/);
      expect(optionalScope.tryRead(key)).toEqual({ value: 11 });
      off();
      const count = deliveries.length;
      right.update(key, { value: 12 });
      expect(deliveries.slice(count)).toEqual(['required:11->12']);
      right.dispose();
      expect(() => required.read(key)).toThrow(/disconnected/);
      expect(optionalScope.tryRead(key)).toBeNull();
      expect(optionalScope.tryUpdate(key, { value: 13 })).toBe(false);
      parent = null;
      expect(() => required.update(key, { value: 14 })).toThrow(/disconnected/);
      required.dispose();
      expect(() => required.update(key, { value: 15 })).toThrow(/terminal disposal/);
    } finally {
      for (const scope of scopes) scope.dispose();
    }
  });
});
