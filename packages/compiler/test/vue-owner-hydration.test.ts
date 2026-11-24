// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import * as Vue from 'vue';
import * as VueRenderer from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const floatingRequire = createRequire(
  new NodeURL('../../modules/positioning/package.json', import.meta.url)
);
const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'adoption-owner',setup(def){
  def.props.define({seed:{type:'number',default:3}});
  const value=def.state.numberDiscrete('value',0);
  def.expose.state('value',value);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{value.set(run.props.get().seed);run.expose.emit('phase','created');});
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('section',{},[r.el('output',value.get()),r.slot()]);
}});`;

interface GeneratedModule {
  renderToString(
    props?: Record<string, unknown>,
    options?: { slots?: Vue.Slots }
  ): Promise<{ html: string; handoff: unknown }>;
  hydrate(
    container: Element,
    handoff: unknown,
    options?: {
      props?: Record<string, unknown>;
      slots?: Vue.Slots;
      configureApp?: (app: Vue.App) => void;
      onMismatch?: (message: string) => void;
    }
  ): Vue.App;
}

function generated(): GeneratedModule {
  const parsed = parsePrototype(source, { fileName: 'adoption-owner.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVueSource(parsed.value, { ssr: true });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const sources = new Map(
    (emitted.value.supportingFiles ?? []).map((file) => [file.path, file.contents])
  );
  sources.set('Component.ts', emitted.value.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const previous = cache.get(path);
    if (previous) return previous;
    const input = sources.get(path);
    if (input === undefined) throw new Error(`Missing actual emitted module: ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(input, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', javascript)(exports, (specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === 'vue/server-renderer') return VueRenderer;
      if (specifier === '@floating-ui/dom') return floatingRequire(specifier);
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected emitted dependency: ${specifier}`);
      const relative = posix.normalize(posix.join(posix.dirname(path), specifier));
      return load(sources.has(relative) ? relative : `${relative}.ts`);
    });
    return exports;
  }
  return load('Component.ts') as unknown as GeneratedModule;
}

async function settle() {
  await Vue.nextTick();
  await Vue.nextTick();
  await Promise.resolve();
}

let sequence = 0;
function nativeProbe(
  text: string,
  failures: { mounted?: unknown; beforeUnmount?: unknown } = {},
  onMounted?: () => void
) {
  const tick = Vue.ref(0);
  const audit = { scopes: 0, mounted: 0, unmounted: 0, watched: 0, events: 0 };
  const event = `owner-probe-${++sequence}`;
  const listener = () => {
    audit.events += 1;
  };
  const component = Vue.defineComponent({
    setup() {
      audit.scopes += 1;
      Vue.watchEffect(() => {
        tick.value;
        audit.watched += 1;
      });
      Vue.onScopeDispose(() => {
        audit.scopes -= 1;
      });
      Vue.onMounted(() => {
        audit.mounted += 1;
        window.addEventListener(event, listener);
        onMounted?.();
        if ('mounted' in failures) throw failures.mounted;
      });
      Vue.onBeforeUnmount(() => {
        if ('beforeUnmount' in failures) throw failures.beforeUnmount;
      });
      Vue.onUnmounted(() => {
        audit.unmounted += 1;
        window.removeEventListener(event, listener);
      });
      return () => Vue.h('button', text);
    },
  });
  return {
    component,
    audit,
    async poke() {
      tick.value += 1;
      window.dispatchEvent(new Event(event));
      await settle();
    },
  };
}

describe('C-LIFECYCLE-OWNER-INITIALIZATION-0001-E: generated Vue adoption', () => {
  it('retires native child scopes and listeners when completed hydration is rejected', async () => {
    const module = generated();
    const rendered = await module.renderToString(
      {},
      { slots: { default: () => [Vue.h('button', 'server')] } }
    );
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const phases: unknown[] = [];
    const mismatches: string[] = [];
    const rejected = nativeProbe('client');
    let app: Vue.App | undefined;
    try {
      expect(() =>
        module.hydrate(host, rendered.handoff, {
          props: { onPhase: (phase: unknown) => phases.push(phase) },
          slots: { default: () => [Vue.h(rejected.component)] },
          configureApp(value) {
            app = value;
          },
          onMismatch: (message) => mismatches.push(message),
        })
      ).toThrow(/hydration mismatch/);
      expect(mismatches).toHaveLength(1);
      expect(rejected.audit.mounted).toBe(1);
      await settle();
      expect(phases).toEqual([]);
      expect(rejected.audit.scopes).toBe(0);
      expect(rejected.audit.unmounted).toBe(1);
      const before = rejected.audit.watched;
      await rejected.poke();
      expect(rejected.audit.watched).toBe(before);
      expect(rejected.audit.events).toBe(0);

      // Recovery explicitly creates another application from the selected
      // original projection; it does not resume the rejected native scope.
      const fresh = nativeProbe('server');
      host.innerHTML = rendered.html;
      app = module.hydrate(host, rendered.handoff, {
        props: { onPhase: (phase: unknown) => phases.push(phase) },
        slots: { default: () => [Vue.h(fresh.component)] },
      });
      await settle();
      expect(phases).toEqual(['created']);
      expect(fresh.audit.scopes).toBe(1);
      expect(rejected.audit.scopes).toBe(0);
      expect(host.querySelector('output')?.textContent).toBe('3');
      await fresh.poke();
      expect(fresh.audit.watched).toBe(2);
      expect(fresh.audit.events).toBe(1);
      app.unmount();
      await settle();
      expect(fresh.audit.scopes).toBe(0);
      expect(fresh.audit.unmounted).toBe(1);
      expect(phases).toEqual(['created', 'disposed']);
    } finally {
      app?.unmount();
      await settle();
      host.remove();
    }
  });

  it('preserves a falsy mounted failure while exhausting native retirement despite a second cleanup error', async () => {
    const module = generated();
    const rendered = await module.renderToString(
      {},
      { slots: { default: () => [Vue.h('button', 'server')] } }
    );
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const child = nativeProbe('server', { mounted: false, beforeUnmount: 'cleanup-second' });
    const observed: unknown[] = [];
    let app: Vue.App | undefined;
    let result: { ok: boolean; error?: unknown };
    try {
      try {
        app = module.hydrate(host, rendered.handoff, {
          slots: { default: () => [Vue.h(child.component)] },
          configureApp(value) {
            app = value;
            value.config.errorHandler = (error) => {
              observed.push(error);
              if (error === 'cleanup-second') throw 'observer-third';
            };
          },
        });
        result = { ok: true };
      } catch (error) {
        result = { ok: false, error };
      }
      expect(result).toEqual({ ok: false, error: false });
      await settle();
      expect(observed).toEqual([false, 'cleanup-second']);
      expect(child.audit).toEqual({ scopes: 0, mounted: 1, unmounted: 1, watched: 1, events: 0 });
      await child.poke();
      expect(child.audit.watched).toBe(1);
      expect(child.audit.events).toBe(0);
    } finally {
      try {
        app?.unmount();
      } catch {
        /* A failed baseline may still own the partial native tree. */
      }
      await settle();
      host.remove();
    }
  });

  it('retires the native application when deferred logical startup fails after hydrate returns', async () => {
    const module = generated();
    const rendered = await module.renderToString(
      {},
      { slots: { default: () => [Vue.h('button', 'server')] } }
    );
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const child = nativeProbe('server');
    const phases: unknown[] = [],
      errors: unknown[] = [];
    let app: Vue.App | undefined;
    try {
      app = module.hydrate(host, rendered.handoff, {
        props: {
          onPhase: (phase: unknown) => {
            phases.push(phase);
            if (phase === 'created') throw false;
          },
        },
        slots: { default: () => [Vue.h(child.component)] },
        configureApp(value) {
          value.config.errorHandler = (error) => {
            errors.push(error);
          };
        },
      });
      expect(child.audit.scopes).toBe(1);
      await settle();
      expect(errors).toEqual([false]);
      expect(phases).toEqual(['created', 'disposed']);
      expect(child.audit).toEqual({ scopes: 0, mounted: 1, unmounted: 1, watched: 1, events: 0 });
      await child.poke();
      expect(child.audit.watched).toBe(1);
      expect(child.audit.events).toBe(0);
    } finally {
      app?.unmount();
      await settle();
      host.remove();
    }
  });

  it('finishes terminal native retirement requested synchronously inside a mounted hook', async () => {
    const module = generated();
    const rendered = await module.renderToString(
      {},
      { slots: { default: () => [Vue.h('button', 'server')] } }
    );
    const host = document.createElement('div');
    host.innerHTML = rendered.html;
    document.body.append(host);
    const phases: unknown[] = [];
    let app: Vue.App | undefined;
    const child = nativeProbe('server', {}, () => app!.unmount());
    try {
      app = module.hydrate(host, rendered.handoff, {
        props: { onPhase: (phase: unknown) => phases.push(phase) },
        slots: { default: () => [Vue.h(child.component)] },
        configureApp(value) {
          app = value;
        },
      });
      await settle();
      expect(phases).toEqual([]);
      expect(child.audit).toEqual({ scopes: 0, mounted: 1, unmounted: 1, watched: 1, events: 0 });
      await child.poke();
      expect(child.audit.watched).toBe(1);
      expect(child.audit.events).toBe(0);
      app.unmount();
      await settle();
      expect(phases).toEqual([]);
      expect(child.audit.unmounted).toBe(1);
    } finally {
      app?.unmount();
      await settle();
      host.remove();
    }
  });
});
