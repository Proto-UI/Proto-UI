// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';

const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');

interface StyleExposes {
  pressed: { get(): boolean };
  press(value: boolean): void;
  withdrawBase(): void;
}
interface NativeInstance {
  $el: Node;
  $forceUpdate(): void;
  getExposes(): StyleExposes;
  update(): void;
}
interface HostInstance {
  input: Record<string, unknown>;
  $el: Node;
  $children: NativeInstance[];
  $mount(): void;
  $destroy(): void;
}
interface VueRuntime {
  version: string;
  extend(options: Record<string, unknown>): new () => HostInstance;
  nextTick(): Promise<void>;
}
type H = (tag: unknown, data?: unknown, children?: unknown) => unknown;
const requireVue2 = createRequire(
  fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url))
);
const Vue2 = requireVue2('vue') as VueRuntime;

const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'vue2-style-owner',setup(def){
  def.props.define({active:{type:'boolean',default:true},present:{type:'boolean',default:true},mode:{type:'string',default:'none'},label:{type:'string',default:'initial'}});
  const pressed=def.state.bool('pressed',true);
  def.expose.state('pressed',pressed);
  def.expose.method('press',(value:boolean)=>{pressed.set(value);});
  const base=tw('bg-red opacity-50');
  const childStyle=tw('text-white');
  const withdrawn=def.feedback.style.use(tw('opacity-25'));
  withdrawn();
  const baseActive=def.state.bool('base-active',true);
  def.rule({when:w=>w.state(baseActive).eq(true),intent:i=>i.feedback.style.use(base)});
  def.expose.method('withdrawBase',()=>{baseActive.set(false);});
  def.rule({when:w=>w.state(pressed).eq(true),intent:i=>i.feedback.style.use(tw('bg-blue'))});
  def.rule({when:w=>w.prop('active').eq(true),intent:i=>i.feedback.style.use(tw('bg-green'))});
  const discarded=def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(tw('bg-black'))});
  discarded.dispose();
  def.props.watch(['mode'],(run,next)=>{
    if(next.mode==='patch'){run.feedback.style.patch(tw('bg-yellow'));}
    if(next.mode==='suppress'){run.feedback.style.suppress(tw('bg-red'));}
    if(next.mode==='clear'){run.feedback.style.clearPatch();}
  });
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
  def.expose.event('mounted',{payload:'void'});
  def.expose.event('updated',{payload:'void'});
  def.expose.event('unmounted',{payload:'void'});
  def.lifecycle.onMounted(run=>{run.expose.emit('mounted');});
  def.lifecycle.onUpdated(run=>{run.expose.emit('updated');});
  def.lifecycle.onUnmounted(run=>{run.expose.emit('unmounted');});
  return r=>{
    const label=r.read.props.get().label;
    if(pressed.get()) return r.el('output',{style:childStyle},['pressed:',label]);
    return r.el('output',{style:childStyle},['released:',label]);
  };
}});`;

function build(): unknown {
  const parsed = parsePrototype(source, { fileName: 'vue2-style.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVue2Source(parsed.value, { autoUpdateOnPropsChange: false });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const sources = new Map(
    (emitted.value.supportingFiles ?? []).map((file) => [posix.normalize(file.path), file.contents])
  );
  sources.set('component.js', emitted.value.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const previous = cache.get(path);
    if (previous) return previous;
    const code = sources.get(path);
    if (!code) throw new Error(`Missing generated dependency ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(code, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        allowJs: true,
      },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path), `${specifier}.ts`)));
    }, exports);
    return exports;
  }
  return load('component.js').default;
}

function mount(input: Record<string, unknown> = {}) {
  const component = build();
  const events: string[] = [];
  const Root = Vue2.extend({
    data() {
      return { input };
    },
    render(this: HostInstance, h: H) {
      return h(component, {
        props: this.input,
        on: Object.fromEntries(
          ['mounted', 'updated', 'unmounted'].map((kind) => [kind, () => events.push(kind)])
        ),
      });
    },
  });
  const vm = new Root();
  vm.$mount();
  const host = document.createElement('div');
  host.append(vm.$el);
  document.body.append(host);
  const instance = vm.$children[0];
  if (!instance) throw new Error('Generated Vue2 component did not mount.');
  return { vm, instance, host, events };
}

async function settle(): Promise<void> {
  await Vue2.nextTick();
  await Vue2.nextTick();
  await Vue2.nextTick();
}

function tokens(element: Element | null): string[] {
  return (element?.getAttribute('data-pui-style') ?? '').split(' ').filter(Boolean).sort();
}

describe('Vue2 generated native style projection', () => {
  it('withdraws declaration-order winners without rendering or replacing the Root', async () => {
    expect(Vue2.version).toBe('2.6.14');
    const { vm, instance, host, events } = mount();
    try {
      await settle();
      const root = host.querySelector('[data-pui-root]');
      const output = host.querySelector('output');
      expect(root).not.toBeNull();
      expect(output).not.toBeNull();
      expect(tokens(root)).toEqual(['bg-green', 'opacity-50']);
      expect(tokens(output)).toEqual(['text-white']);
      const force = vi.spyOn(instance, '$forceUpdate');
      vm.input = { active: false, label: 'new' };
      await settle();
      expect(tokens(root)).toEqual(['bg-blue', 'opacity-50']);
      force.mockClear();
      instance.getExposes().press(false);
      // Style projection is synchronous, even before Vue gets a commit tick.
      expect(tokens(root)).toEqual(['bg-red', 'opacity-50']);
      await settle();
      expect(force).not.toHaveBeenCalled();
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(host.querySelector('output')).toBe(output);
      expect(output?.textContent).toBe('pressed:initial');
      expect(events).toEqual(['mounted']);
      instance.update();
      await settle();
      expect(output?.textContent).toBe('released:new');
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(events).toEqual(['mounted', 'updated']);
      force.mockRestore();
    } finally {
      vm.$destroy();
      host.remove();
    }
  });

  it('applies patches and suppression above live Rules and restores the retained base', async () => {
    const { vm, instance, host, events } = mount();
    try {
      await settle();
      const root = host.querySelector('[data-pui-root]');
      vm.input = { mode: 'patch' };
      await settle();
      expect(tokens(root)).toEqual(['bg-yellow', 'opacity-50']);
      vm.input = { mode: 'suppress' };
      await settle();
      expect(tokens(root)).toEqual(['opacity-50']);
      instance.getExposes().press(false);
      vm.input = { mode: 'suppress', active: false };
      await settle();
      expect(tokens(root)).toEqual(['opacity-50']);
      vm.input = { mode: 'clear', active: false };
      await settle();
      expect(tokens(root)).toEqual(['bg-red', 'opacity-50']);
      instance.getExposes().withdrawBase();
      expect(tokens(root)).toEqual([]);
      expect(root?.hasAttribute('data-pui-style')).toBe(false);
      expect(tokens(host.querySelector('output'))).toEqual(['text-white']);
      expect(host.querySelector('[data-pui-root]')).toBe(root);
      expect(host.querySelector('output')?.textContent).toBe('pressed:initial');
      expect(events).toEqual(['mounted']);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });

  it('replays retained patches and current Rule conditions in a new epoch and clears terminal ownership', async () => {
    const { vm, instance, host, events } = mount();
    try {
      await settle();
      const api = instance.getExposes();
      const firstRoot = host.querySelector('[data-pui-root]');
      vm.input = { present: false };
      await settle();
      expect(host.querySelector('[data-pui-root]')).toBeNull();
      expect(firstRoot?.hasAttribute('data-pui-style')).toBe(false);
      api.press(false);
      vm.input = { present: false, active: false, mode: 'patch', label: 'retained' };
      await settle();
      vm.input = { present: true, active: false, mode: 'patch', label: 'retained' };
      await settle();
      const secondRoot = host.querySelector('[data-pui-root]');
      expect(secondRoot).not.toBe(firstRoot);
      expect(tokens(secondRoot)).toEqual(['bg-yellow', 'opacity-50']);
      expect(instance.getExposes().pressed).toBe(api.pressed);
      expect(host.querySelector('output')?.textContent).toBe('released:retained');
      vm.input = { present: true, active: false, mode: 'clear', label: 'retained' };
      await settle();
      expect(tokens(secondRoot)).toEqual(['bg-red', 'opacity-50']);
      api.press(true);
      expect(tokens(secondRoot)).toEqual(['bg-blue', 'opacity-50']);
      expect(events).toEqual(['mounted', 'unmounted', 'mounted']);
      vm.$destroy();
      expect(secondRoot?.hasAttribute('data-pui-style')).toBe(false);
      expect(() => api.press(false)).toThrow(/terminal/);
      expect(() => api.withdrawBase()).toThrow(/terminal/);
      expect(() => api.pressed.get()).toThrow(/terminal/);
      expect(instance.getExposes()).toEqual({});
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
