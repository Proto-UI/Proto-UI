// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import * as Vue from 'vue';
import * as Renderer from 'vue/server-renderer';
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const floating = createRequire(
  new NodeURL('../../modules/positioning/package.json', import.meta.url)
);
const key = `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('initial-graph-context');`;

/** Actual private emitted components and native Vue; no authored runtime substitute. */
function compile(mutateDuringCommit: boolean) {
  const sources = new Map<string, string>();
  const authored = {
    Provider: `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'initial-graph-provider',setup(def){
  def.props.define({seed:{type:'number',default:3}});
  const value=def.state.numberDiscrete('value',0);
  def.context.provide(KEY,{value:0});
  def.context.subscribe(KEY,(run,next)=>{value.set(next.value);run.update();});
  def.props.watch(['seed'],(run,next)=>run.context.update(KEY,{value:next.seed}));
  def.expose.state('value',value);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().seed});run.expose.emit('phase','created');});
  def.lifecycle.onMounted(run=>{${mutateDuringCommit ? 'run.context.update(KEY,{value:7});' : ''}run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated(run=>{${mutateDuringCommit ? "if(value.get()===7){run.context.update(KEY,{value:8});run.expose.emit('phase','updated');}" : ''}});
  def.lifecycle.onUnmounted(run=>run.expose.emit('phase','unmounted'));
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('section',{},[r.el('output',value.get()),r.slot()]);
}});`,
    Child: `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'initial-graph-child',setup(def){
  const value=def.state.numberDiscrete('value',0);
  def.context.subscribe(KEY,(run,next)=>{value.set(next.value);run.update();});
  def.expose.state('value',value);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{value.set(run.context.read(KEY).value);run.expose.emit('phase','created');});
  def.lifecycle.onMounted(run=>run.expose.emit('phase','mounted'));
  def.lifecycle.onUnmounted(run=>run.expose.emit('phase','unmounted'));
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('output',value.get());
}});`,
  };
  for (const [name, source] of Object.entries(authored)) {
    const parsed = parsePrototype(source, {
      fileName: `${name}.proto.ts`,
      files: { 'keys.ts': key },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitVueSource(parsed.value, { ssr: true, componentName: `Initial${name}` });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    sources.set(`${name}.ts`, emitted.value.code);
    for (const file of emitted.value.supportingFiles ?? []) {
      const previous = sources.get(file.path);
      if (previous !== undefined && previous !== file.contents)
        throw new Error(`Conflicting artifact ${file.path}`);
      sources.set(file.path, file.contents);
    }
  }
  const cache = new Map<string, any>();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file);
    const input = sources.get(file);
    if (input === undefined) throw new Error(`Missing emitted artifact ${file}`);
    const exports = {};
    cache.set(file, exports);
    const javascript = ts.transpileModule(input, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', javascript)(exports, (specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === 'vue/server-renderer') return Renderer;
      if (specifier === '@floating-ui/dom') return floating(specifier);
      if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency ${specifier}`);
      const name = posix.normalize(posix.join(posix.dirname(file), specifier));
      return load(sources.has(name) ? name : `${name}.ts`);
    });
    return exports;
  }
  return { provider: load('Provider.ts'), child: load('Child.ts') };
}

async function settle() {
  for (let i = 0; i < 16; i++) {
    await Vue.nextTick();
    await Promise.resolve();
  }
}
function transport(app: Vue.App) {
  return app._context.provides[Symbol.for('ProtoUI.Vue.SSR.Session.v1')];
}
function closed(app: Vue.App) {
  const session = transport(app);
  expect(session.closed).toBe(true);
  for (const key of ['owners', 'pending', 'initialOwners', 'deferredProps'])
    expect(session[key].size, key).toBe(0);
  if (session.initialCommits) expect(session.initialCommits.size).toBe(0);
}

it.each([false, true])(
  'validates all initial descendants before mounted and updated Context writes (%s)',
  async (mutate) => {
    const { provider, child } = compile(mutate);
    const phases: string[] = [];
    const root = Vue.shallowRef<any>(),
      nested = Vue.shallowRef<any>();
    const rendered = await provider.renderToString(
      { seed: 3 },
      {
        slots: { default: () => [Vue.h(child.default)] },
      }
    );
    expect(rendered.html.match(/<output>3<\/output>/g)).toHaveLength(2);
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const original = host.firstElementChild;
    const app = provider.hydrate(host, rendered.handoff, {
      props: { seed: 3, ref: root, onPhase: (phase: string) => phases.push(`root:${phase}`) },
      slots: {
        default: () => [
          Vue.h(child.default, {
            ref: nested,
            onPhase: (phase: string) => phases.push(`child:${phase}`),
          }),
        ],
      },
    });
    try {
      await settle();
      expect(transport(app).closed, String(transport(app).failure?.value)).toBe(false);
      expect(host.firstElementChild).toBe(original);
      for (const owner of ['root', 'child']) {
        expect(phases.filter((phase) => phase === `${owner}:created`)).toHaveLength(1);
        expect(phases.filter((phase) => phase === `${owner}:mounted`)).toHaveLength(1);
        expect(phases.indexOf(`${owner}:created`)).toBeLessThan(phases.indexOf(`${owner}:mounted`));
      }
      if (mutate)
        expect(phases.slice(0, 4)).toEqual([
          'root:created',
          'child:created',
          'root:mounted',
          'child:mounted',
        ]);
      expect(phases.filter((phase) => phase === 'root:updated')).toHaveLength(mutate ? 1 : 0);
      expect(root.value.getExposes().value.get()).toBe(mutate ? 8 : 3);
      expect(nested.value.getExposes().value.get()).toBe(mutate ? 8 : 3);
      expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual(
        mutate ? ['8', '8'] : ['3', '3']
      );
    } finally {
      app.unmount();
      host.remove();
    }
    closed(app);
  },
  10_000
);

it.each([false, true])(
  'holds commits and current Props for an actual async descendant, terminal=%s',
  async (terminal) => {
    const { provider, child } = compile(true);
    const rendered = await provider.renderToString(
      { seed: 3 },
      {
        slots: { default: () => [Vue.h(child.default)] },
      }
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const phases: string[] = [];
    const root = Vue.shallowRef<any>(),
      nested = Vue.shallowRef<any>();
    let initialChildValue: number | undefined;
    const input = Vue.shallowReactive({
      seed: 3,
      ref: root,
      onPhase: (phase: string) => phases.push(`root:${phase}`),
    });
    const AsyncChild = Vue.defineComponent({
      async setup() {
        await gate;
        return () =>
          Vue.h(child.default, {
            ref: nested,
            onPhase: (phase: string) => {
              phases.push(`child:${phase}`);
              if (phase === 'created') initialChildValue = nested.value.getExposes().value.get();
            },
          });
      },
    });
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const app = provider.hydrate(host, rendered.handoff, {
      props: input,
      slots: { default: () => [Vue.h(Vue.Suspense, null, { default: () => Vue.h(AsyncChild) })] },
    });
    let state: { get(): number } | undefined;
    try {
      await settle();
      state = root.value.getExposes().value;
      expect(state!.get()).toBe(3);
      expect(phases).toEqual(['root:created']);
      expect(transport(app).initialOwners.size).toBe(1);
      expect(transport(app).initialCommits.size).toBe(1);
      input.seed = 9;
      await settle();
      expect(state!.get()).toBe(3);
      expect(phases).toEqual(['root:created']);
      expect(transport(app).deferredProps.size).toBe(1);
      if (terminal) {
        app.unmount();
        closed(app);
      }
      release();
      await settle();
      if (terminal) {
        expect(phases).toEqual(['root:created', 'root:disposed']);
        expect(initialChildValue).toBeUndefined();
        expect(() => state!.get()).toThrow(/disposed/i);
        expect(host.innerHTML).toBe('');
      } else {
        expect(transport(app).closed, String(transport(app).failure?.value)).toBe(false);
        expect(initialChildValue).toBe(3);
        expect(phases).toEqual(['root:created', 'child:created', 'root:mounted', 'child:mounted']);
        expect(state!.get()).toBe(9);
        expect(nested.value.getExposes().value.get()).toBe(9);
        expect([...host.querySelectorAll('output')].map((node) => node.textContent)).toEqual([
          '9',
          '9',
        ]);
        for (const key of ['pending', 'initialOwners', 'initialCommits', 'deferredProps'])
          expect(transport(app)[key].size, key).toBe(0);
      }
    } finally {
      release();
      app.unmount();
      host.remove();
    }
  },
  10_000
);

it('preserves a first falsy mounted failure and never delivers the remaining initial commits', async () => {
  const { provider, child } = compile(true);
  const rendered = await provider.renderToString(
    { seed: 3 },
    {
      slots: { default: () => [Vue.h(child.default)] },
    }
  );
  const phases: string[] = [];
  const root = Vue.shallowRef<any>();
  let state: { get(): number } | undefined;
  const host = document.createElement('div');
  host.innerHTML = rendered.html;
  document.body.append(host);
  const app = provider.hydrate(host, rendered.handoff, {
    props: {
      seed: 3,
      ref: root,
      onPhase: (phase: string) => {
        phases.push(`root:${phase}`);
        if (phase === 'mounted') {
          state = root.value.getExposes().value;
          throw false;
        }
        if (phase === 'disposed') throw new Error('secondary cleanup');
      },
    },
    slots: {
      default: () => [
        Vue.h(child.default, {
          onPhase: (phase: string) => phases.push(`child:${phase}`),
        }),
      ],
    },
  });
  try {
    await settle();
    closed(app);
    expect(transport(app).failure?.value).toBe(false);
    expect(phases.slice(0, 3)).toEqual(['root:created', 'child:created', 'root:mounted']);
    expect(phases).not.toContain('child:mounted');
    expect(phases).not.toContain('child:unmounted');
    expect(phases).not.toContain('root:updated');
    expect(phases.filter((phase) => phase === 'child:disposed')).toHaveLength(1);
    expect(phases.filter((phase) => phase === 'root:disposed')).toHaveLength(1);
    expect(() => state!.get()).toThrow(/disposed/i);
    expect(host.innerHTML).toBe('');
  } finally {
    try {
      app.unmount();
    } catch {
      /* Recorded first failure remains authoritative. */
    }
    host.remove();
  }
}, 10_000);
