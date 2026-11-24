// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { nativeAuthoredHooksArtifact } from '../src/native-authored-hooks';
import { compilePrototype } from '../src/compile';
import { captureFacadeSource } from './fixtures/capture-facade';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
for (const profile of nativeOwnerProfiles)
  it(
    profile + ' executes the closed facade with shared identities and owner guards',
    async () => {
      const first = await mountNativeOwner(captureFacadeSource, profile);
      const second = await mountNativeOwner(captureFacadeSource, profile);
      cleanups.push(first.dispose, second.dispose);
      const exposes = first.handle.getExposes(),
        other = second.handle.getExposes();
      expect(exposes).toMatchObject({
        same: true,
        sameChild: true,
        sameRaw: true,
        sameState: true,
        sameMethod: true,
      });
      expect(exposes.readAlias()).toBe('seed');
      expect(exposes.readState()).toBe('seed');
      expect(exposes.read()).toBe('seed');
      expect(other.readAlias).not.toBe(exposes.readAlias);
      const retained = exposes.readAlias;
      await first.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
      expect(other.readAlias()).toBe('seed');
    },
    30_000
  );

for (const profile of nativeOwnerProfiles)
  it(profile + ' keeps a renamed lookup bound to its original installation', async () => {
    const source = `import {defineAsHook,definePrototype} from '@proto.ui/core';
      const use=defineAsHook({name:'renamed-lookup',setup(def){
        def.props.define({start:{type:'number',empty:'fallback'}});
        def.props.setDefaults({start:1});
        let value=0;
        def.lifecycle.onCreated(run=>{value=run.props.get().start??1;});
        def.expose.method('next',()=>{value++;return value;});
      },projectHandle(result){return {resolve:result.getMethod};}});
      export default definePrototype({name:'lookup-owner',setup(def){
        const handle=use();const resolve=handle.resolve;
        def.expose.method('invoke',()=>resolve?.('next')?.()??-1);
        return r=>r.el('output',[]);
      }});`;
    const first = await mountNativeOwner(source, profile, { props: { start: 1 } });
    const second = await mountNativeOwner(source, profile, { props: { start: 40 } });
    cleanups.push(first.dispose, second.dispose);
    const a = first.handle.getExposes(),
      b = second.handle.getExposes();
    expect(a.invoke()).toBe(2);
    expect(b.invoke()).toBe(41);
    expect(a.invoke()).toBe(3);
    expect(b.invoke()).toBe(42);
  });

function evaluate(
  source: string,
  require: (id: string) => unknown = () => {
    throw new Error('unexpected import');
  }
): any {
  const exports = {};
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', js)(exports, require);
  return exports;
}
function manager() {
  let setup = true;
  const { createNativeAuthoredHooks } = evaluate(nativeAuthoredHooksArtifact.contents);
  const capture = createNativeAuthoredHooks({
    setup() {
      if (!setup) throw new Error('setup-only');
    },
    borrow(state: { get(): unknown }) {
      return Object.freeze({ get: () => state.get() });
    },
  });
  return {
    capture,
    callback() {
      setup = false;
    },
  };
}

it('native Web capture preserves actual receipts, shared artifacts and child raw/projected references', () => {
  const { capture } = manager();
  const state = { get: () => 'seed' },
    read = () => 'seed',
    render = () => 'text';
  const props = { op: 'define', specMap: { seed: { type: 'string' } } },
    event = { op: 'expose.event', key: 'changed' };
  let projected: any;
  const child = {
    name: 'child',
    mode: 'once',
    setup() {
      capture.state('value', state);
      capture.effect('state', state);
      capture.effect('props', props);
      capture.effect('event', event);
      capture.eventKey('changed');
      capture.method('read', read);
      capture.effect('context', { op: 'expose.method', key: 'read', fn: read });
      return render;
    },
    project(raw: any) {
      return { ...raw, projected: true };
    },
  };
  const raw = capture.install({
    name: 'parent',
    mode: 'once',
    setup() {
      projected = capture.install(child);
      expect(capture.install(child)).toBe(projected);
    },
  });
  const descriptor = raw.getAsHook('child'),
    inner = descriptor.result;
  expect(descriptor.handle).toBe(projected);
  expect(inner).not.toBe(projected);
  expect(raw.getAsHook('child')).toBe(descriptor);
  expect(raw.getAsHookHandle('child')).toBe(projected);
  expect(raw.asHooks).toHaveLength(2);
  expect(raw.artifacts.asHooks).toBe(raw.asHooks);
  expect(raw.stateHandles).toBeUndefined();
  expect(inner.props).toBe(props);
  expect(inner.state).toBe(state);
  expect(inner.event).toBe(event);
  expect(inner.stateHandles).toBe(inner.artifacts.stateHandles);
  expect(inner.getState('value')).toBe(inner.stateHandles.value);
  expect(inner.getState('value')).not.toBe(state);
  expect(inner.methods).toBe(inner.artifacts.methods);
  expect(inner.methods.read).toBe(read);
  expect(inner.getMethod('read')).toBe(read);
  expect(inner.artifacts.eventKeys.changed).toBe('changed');
  expect(projected.getState).toBe(inner.getState);
  expect(projected.render).toBe(render);
  expect(inner.getState('__proto__')).toBeUndefined();
  expect(inner.getMethod('__proto__')).toBeUndefined();
});

it('native Web capture omits empty fields and keeps identical setup-only disposer entries', () => {
  const { capture, callback } = manager();
  const empty = capture.install({ name: 'empty', mode: 'once', setup() {} });
  expect(Object.keys(empty)).toEqual([]);
  let calls = 0;
  const original = () => {
    calls++;
  };
  const result = capture.install({
    name: 'cleanup',
    mode: 'once',
    setup() {
      capture.effect('props', { op: 'watchAll', off: original });
      capture.disposer('props', original);
    },
  });
  expect(result.disposers.all[0]).toBe(result.disposers.props[0]);
  expect(result.disposers.all[0]).not.toBe(original);
  result.disposers.all[0]();
  expect(calls).toBe(1);
  callback();
  expect(() => result.disposers.all[0]()).toThrow('setup-only');
  expect(calls).toBe(1);
});

it('captured Web event disposers retire exact semantic and host registrations', () => {
  const output = compilePrototype(
    `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'capture-listeners',setup(def){
      def.event.on('press.commit',()=>{});
      def.event.on('host:custom',()=>{});
      return r=>r.el('button',[]);
    }});`,
    { profile: 'react-dom-source-v1' }
  );
  expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
  if (!output.ok) return;
  const files = new Map(
    output.value.output.supportingFiles?.map((file) => [file.path, file.contents])
  );
  const entry = [...files].find(([, text]) =>
    text.includes('export function createNativeInteraction<')
  );
  expect(entry).toBeDefined();
  const cache = new Map<string, any>();
  const requireFloating = createRequire(
    fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
  );
  const load = (name: string): any => {
    if (cache.has(name)) return cache.get(name);
    const text = files.get(name);
    if (text === undefined) throw new Error('missing ' + name);
    const exports = evaluate(text, (id) => {
      if (id === '@floating-ui/dom') return requireFloating(id);
      if (!id.startsWith('.')) throw new Error('unexpected ' + id);
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(name), id));
      return load(next.endsWith('.ts') ? next : next + '.ts');
    });
    cache.set(name, exports);
    return exports;
  };
  const { createNativeInteraction } = load(entry![0]);
  const root = document.createElement('button');
  document.body.append(root);
  let inSetup = true,
    dead = false,
    removed = 0,
    live = 0;
  const interaction = createNativeInteraction({
    ensureSetup() {
      if (!inSetup) throw new Error('setup-only');
    },
    ensureRuntime() {},
    ensureEvent() {},
    isAlive: () => !dead,
    isSetupComplete: () => !inSetup,
    isReady: () => true,
    invoke: (fn: () => unknown) => fn(),
    getRun: () => ({}),
    getResolvedProps: () => ({}),
    getRoot: () => root,
  });
  const { capture } = manager();
  const result = capture.install({
    name: 'listeners',
    mode: 'once',
    setup() {
      for (const key of ['press.commit', 'host:custom']) {
        const token = interaction.event.on(key, () => {
          removed++;
        });
        const off = () => interaction.releaseListener(token);
        capture.effect('event', { token, off });
        capture.disposer('event', off);
        interaction.event.on(key, () => {
          live++;
        });
      }
    },
  });
  for (const off of result.disposers.all) off();
  expect(() => interaction.releaseListener({ id: 'ev_1' })).toThrow(/different owner/);
  inSetup = false;
  interaction.mount();
  root.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
  root.dispatchEvent(new Event('custom', { bubbles: true }));
  expect(removed).toBe(0);
  expect(live).toBe(2);
  interaction.unmount();
  interaction.mount();
  root.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
  root.dispatchEvent(new Event('custom', { bubbles: true }));
  expect(removed).toBe(0);
  expect(live).toBe(4);
  expect(() => result.disposers.all[0]()).toThrow('setup-only');
  dead = true;
  interaction.dispose();
});
