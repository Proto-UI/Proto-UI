// @vitest-environment happy-dom
import { posix } from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Vue from 'vue';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';

const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');

interface Handle {
  update(): void;
  getExposes(): { active: { get(): boolean }; setActive(next: boolean): void };
}

const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'vue-style-owner',setup(def){
  def.props.define({enabled:{type:'boolean',default:false},visible:{type:'boolean',default:true},command:{type:'string',default:''}});
  const active=def.state.bool('active',false);
  def.expose.state('active',active);
  def.expose.method('setActive',(next:boolean)=>{active.set(next);});
  def.expose.event('phase',{payload:'json'});
  const withdrawn=def.feedback.style.use(tw('opacity-25'));
  withdrawn();
  const baseActive=def.state.bool('base-active',true);
  def.rule({when:w=>w.state(baseActive).eq(true),intent:i=>i.feedback.style.use(tw('bg-white w-48 opacity-100'))});
  const discarded=def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(tw('opacity-40'))});
  discarded.dispose();
  def.rule({when:w=>w.state(active).eq(true),intent:i=>i.feedback.style.use(tw('bg-red-500'))});
  def.rule({when:w=>w.prop('enabled').eq(true),intent:i=>i.feedback.style.use(tw('bg-blue-500'))});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  def.props.watch(['command'],(run,next)=>{
    if(next.command==='patch') run.feedback.style.patch(tw('bg-purple-500 w-72'));
    if(next.command==='suppress') run.feedback.style.suppress(tw('bg-black w-48'));
    if(next.command==='clear') run.feedback.style.clearPatch();
    if(next.command==='release') baseActive.set(false);
  });
  def.lifecycle.onMounted((run)=>{run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('phase','updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('phase','unmounted');});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('phase','disposed');});
  return r=>{
    if(active.get()) return r.el('section',{style:tw('bg-yellow-500 p-2')},'active');
    return r.el('section',{style:tw('bg-yellow-500 p-2')},'inactive');
  };
}});`;

function component(): Vue.Component {
  const parsed = parsePrototype(source, { fileName: 'vue-style.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVueSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const files = new Map(
    (emitted.value.supportingFiles ?? []).map((file) => [posix.normalize(file.path), file.contents])
  );
  files.set('component.ts', emitted.value.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const prior = cache.get(path);
    if (prior) return prior;
    const text = files.get(path);
    if (text === undefined) throw new Error(`Missing generated module ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  // Only emitted native modules execute; authored Proto source is never evaluated.
  return load('component.ts').default as Vue.Component;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}
function tokens(root: Element): string[] {
  return (root.getAttribute('data-pui-style') ?? '').split(' ').filter(Boolean).sort();
}

describe('Vue3 native Rule/style projection', () => {
  it('withdraws Rules synchronously on the same Root without implicit template updates', async () => {
    const Generated = component(),
      handle = Vue.shallowRef<Handle>();
    const input = Vue.shallowRef<Record<string, unknown>>({});
    const phase: string[] = [],
      host = document.createElement('div');
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(Generated, {
            ...input.value,
            ref: handle,
            onPhase: (value: string) => phase.push(value),
          });
      },
    });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!,
        exposed = owner.getExposes();
      const root = host.querySelector('[data-pui-root]')!,
        child = root.querySelector('section')!;
      expect(tokens(root)).toEqual(['bg-white', 'opacity-100', 'w-48']);
      expect(tokens(child)).toEqual(['bg-yellow-500', 'p-2']);
      expect(root.children[0]).toBe(child);
      expect(child.textContent).toBe('inactive');
      exposed.setActive(true);
      expect(tokens(root)).toEqual(['bg-red-500', 'opacity-100', 'w-48']);
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      await settle();
      expect(child.textContent).toBe('inactive');
      expect(phase).toEqual(['mounted']);
      exposed.setActive(false);
      expect(tokens(root)).toEqual(['bg-white', 'opacity-100', 'w-48']);
      exposed.setActive(true);
      input.value = { enabled: true };
      await settle();
      expect(tokens(root)).toEqual(['bg-blue-500', 'opacity-100', 'w-48']);
      input.value = { enabled: 'invalid' };
      await settle();
      // The previous validated true survives invalid raw input; Rules read the resolved snapshot.
      expect(tokens(root)).toEqual(['bg-blue-500', 'opacity-100', 'w-48']);
      input.value = {};
      await settle();
      expect(tokens(root)).toEqual(['bg-red-500', 'opacity-100', 'w-48']);
      expect(child.textContent).toBe('inactive');
      expect(phase).toEqual(['mounted']);
      owner.update();
      await settle();
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(root.querySelector('section')).toBe(child);
      expect(child.textContent).toBe('active');
      expect(tokens(child)).toEqual(['bg-yellow-500', 'p-2']);
      expect(phase).toEqual(['mounted', 'updated']);
    } finally {
      app.unmount();
    }
  });

  it('preserves patch/suppression precedence through detached writes and replay, then terminates the owner', async () => {
    const Generated = component(),
      handle = Vue.shallowRef<Handle>();
    const input = Vue.shallowRef<Record<string, unknown>>({});
    const phase: string[] = [],
      host = document.createElement('div');
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(Generated, {
            ...input.value,
            ref: handle,
            onPhase: (value: string) => phase.push(value),
          });
      },
    });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!,
        exposed = owner.getExposes(),
        state = exposed.active;
      const root = host.querySelector('[data-pui-root]')!;
      input.value = { enabled: true, command: 'patch' };
      await settle();
      expect(tokens(root)).toEqual(['bg-purple-500', 'opacity-100', 'w-72']);
      exposed.setActive(true);
      expect(tokens(root)).toEqual(['bg-purple-500', 'opacity-100', 'w-72']);
      input.value = { enabled: true, command: 'suppress' };
      await settle();
      expect(tokens(root)).toEqual(['opacity-100']);
      input.value = { enabled: true, command: 'clear' };
      await settle();
      expect(tokens(root)).toEqual(['bg-blue-500', 'opacity-100', 'w-48']);
      expect(root.textContent).toBe('inactive');
      expect(phase).toEqual(['mounted']);
      input.value = { visible: false };
      await settle();
      expect(host.querySelector('[data-pui-root]')).toBeNull();
      expect(root.hasAttribute('data-pui-style')).toBe(false);
      exposed.setActive(false);
      input.value = { visible: false, command: 'patch' };
      await settle();
      exposed.setActive(true);
      expect(root.hasAttribute('data-pui-style')).toBe(false);
      input.value = { visible: true, command: 'patch' };
      await settle();
      const nextRoot = host.querySelector('[data-pui-root]')!;
      expect(nextRoot).not.toBe(root);
      expect(owner.getExposes().active).toBe(state);
      expect(tokens(nextRoot)).toEqual(['bg-purple-500', 'opacity-100', 'w-72']);
      expect(nextRoot.textContent).toBe('active');
      input.value = { command: 'clear' };
      await settle();
      expect(tokens(nextRoot)).toEqual(['bg-red-500', 'opacity-100', 'w-48']);
      exposed.setActive(false);
      expect(tokens(nextRoot)).toEqual(['bg-white', 'opacity-100', 'w-48']);
      input.value = { command: 'release' };
      await settle();
      expect(nextRoot.hasAttribute('data-pui-style')).toBe(false);
      exposed.setActive(true);
      expect(tokens(nextRoot)).toEqual(['bg-red-500']);
      exposed.setActive(false);
      expect(nextRoot.hasAttribute('data-pui-style')).toBe(false);
      expect(phase).toEqual(['mounted', 'unmounted', 'mounted']);
      app.unmount();
      await settle();
      expect(nextRoot.hasAttribute('data-pui-style')).toBe(false);
      expect(phase).toEqual(['mounted', 'unmounted', 'mounted', 'unmounted', 'disposed']);
      expect(() => exposed.setActive(true)).toThrow(/disposed/);
      expect(() => state.get()).toThrow(/disposed/);
      expect(() => owner.update()).toThrow(/disposed/);
    } finally {
      app.unmount();
    }
  });

  it('unbinds projection while KeepAlive parks the Root and replays current Rules into that retained Root', async () => {
    const Generated = component(),
      show = Vue.ref(true),
      handle = Vue.shallowRef<Handle>();
    const phase: string[] = [],
      host = document.createElement('div');
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(Vue.KeepAlive, null, {
            default: () =>
              show.value
                ? Vue.h(Generated, {
                    key: 'owner',
                    ref: handle,
                    onPhase: (value: string) => phase.push(value),
                  })
                : Vue.h('aside', { key: 'other' }, 'parked'),
          });
      },
    });
    app.mount(host);
    try {
      await settle();
      const owner = handle.value!,
        exposed = owner.getExposes(),
        root = host.querySelector('[data-pui-root]')!;
      exposed.setActive(true);
      expect(tokens(root)).toEqual(['bg-red-500', 'opacity-100', 'w-48']);
      show.value = false;
      await settle();
      expect(host.querySelector('[data-pui-root]')).toBeNull();
      expect(root.hasAttribute('data-pui-style')).toBe(false);
      exposed.setActive(false);
      expect(root.hasAttribute('data-pui-style')).toBe(false);
      show.value = true;
      await settle();
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(tokens(root)).toEqual(['bg-white', 'opacity-100', 'w-48']);
      expect(root.textContent).toBe('inactive');
      expect(phase).toEqual(['mounted', 'unmounted', 'mounted']);
    } finally {
      app.unmount();
    }
  });
});
