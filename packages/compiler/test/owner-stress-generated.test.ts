// @vitest-environment happy-dom
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import type { GeneratedModule } from '../src/ir';

const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface State {
  get(): number;
  subscribe(callback: (event: { type: string; next?: number }) => void): () => void;
}
interface Exposes {
  count: State;
  write(next: number): void;
}
interface Handle {
  update(): void;
  getExposes(): Exposes;
}
interface Phase {
  kind: string;
  text: string;
}

// Commands issue multiple actual presence intents in one callback, rather than letting
// the framework coalesce raw props before the generated owner has observed them.
const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'owner-stress',setup(def){
  def.props.define({command:{type:'number',default:0}});
  const count=def.state.numberDiscrete('count',2);
  def.expose.state('count',count);
  def.expose.method('write',(next:number)=>{count.set(next);});
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated((run)=>{run.lifecycle.setPresent(false);run.expose.emit('phase','created');});
  def.lifecycle.onMounted((run)=>{run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('phase','updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('phase','unmounted');run.update();});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('phase','beforeDispose');run.update();});
  def.props.watch(['command'],(run,next)=>{
    if(next.command===1){run.lifecycle.setPresent(true);run.lifecycle.setPresent(false);}
    if(next.command===2){run.lifecycle.setPresent(true);}
    if(next.command===3){run.lifecycle.setPresent(false);run.lifecycle.setPresent(true);}
    if(next.command===4){run.lifecycle.setPresent(false);}
    if(next.command===5){run.lifecycle.setPresent(true);}
  });
  return (r)=>r.el('output',[count.get(),r.slot()]);
}});`;

function parsed() {
  const result = parsePrototype(source, { fileName: 'owner-stress.proto.ts' });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

// Resolve only emitted supporting artifacts and the concrete Vue consumer. This
// executes generated source without importing authored Proto code or an interpreter.
function evaluate(module: GeneratedModule): Record<string, unknown> {
  const files = new Map<string, string>([['Component.ts', module.code]]);
  for (const file of module.supportingFiles ?? []) files.set(file.path, file.contents);
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const previous = cache.get(file);
    if (previous) return previous;
    const contents = files.get(file);
    if (contents === undefined) throw new Error(`Missing generated artifact: ${file}`);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const program = ts.transpileModule(contents, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        allowJs: true,
      },
    }).outputText;
    new Function('require', 'exports', program)((specifier: string) => {
      if (specifier === 'vue') return Vue;
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency: ${specifier}`);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const target = [resolved, `${resolved}.ts`, `${resolved}.js`].find((candidate) =>
        files.has(candidate)
      );
      if (!target) throw new Error(`Missing generated dependency: ${specifier}`);
      return load(target);
    }, exports);
    return exports;
  }
  return load('Component.ts');
}

const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
function host(): HTMLDivElement {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}
function accepted(callback: () => unknown): boolean {
  try {
    callback();
    return true;
  } catch {
    return false;
  }
}

let moduleIdentity = 0;
async function reactComponent() {
  const result = emitReactSource(parsed());
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `owner-stress-${process.pid}-${moduleIdentity++}`
  );
  await mkdir(directory, { recursive: true });
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'Component.tsx');
  await writeFile(file, result.value.code, 'utf8');
  for (const artifact of result.value.supportingFiles ?? []) {
    const destination = path.join(directory, artifact.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, artifact.contents, 'utf8');
  }
  // The generated module path is selected at runtime; a static import cannot name it.
  const exports = (await import(/* @vite-ignore */ file)) as {
    CompiledComponent: React.ForwardRefExoticComponent<
      Record<string, unknown> & React.RefAttributes<Handle>
    >;
  };
  return exports.CompiledComponent;
}
function reactRoot(element: HTMLElement): Root {
  const root = createRoot(element);
  cleanup.push(async () => {
    await React.act(async () => root.unmount());
  });
  return root;
}

describe('generated React owner interrupted host work', () => {
  it('does not publish lifecycle for a superseded suspended first view, including StrictMode replay', async () => {
    const Component = await reactComponent();
    const element = host();
    const root = reactRoot(element);
    const ref = React.createRef<Handle>();
    const phases: Phase[] = [];
    let blocked = true,
      attempts = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    function Gate() {
      ++attempts;
      if (blocked) throw pending;
      return React.createElement('b', null, 'slot');
    }
    const render = (command: number) =>
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            React.Suspense,
            { fallback: React.createElement('i', null, 'waiting') },
            React.createElement(
              Component,
              {
                command,
                ref,
                onPhase: (kind: string) => phases.push({ kind, text: element.textContent ?? '' }),
              },
              React.createElement(Gate)
            )
          )
        )
      );
    await React.act(async () => render(0));
    const owner = ref.current!;
    const exposes = owner.getExposes();
    const count = exposes.count;
    exposes.write(7);
    await React.act(async () => owner.update());
    await React.act(async () => render(1));
    expect(element.querySelector('output')).toBeNull();
    expect(phases).toEqual([{ kind: 'created', text: '' }]);
    await React.act(async () => render(2));
    expect(attempts).toBeGreaterThan(0);
    expect(element.querySelector('i')?.textContent).toBe('waiting');
    expect(phases.map((phase) => phase.kind)).toEqual(['created']);
    // Supersede a real suspended frame, not an unstarted root.render call.
    await React.act(async () => render(4));
    blocked = false;
    await React.act(async () => {
      release();
      await pending;
    });
    expect(element.querySelector('output')).toBeNull();
    expect(phases.map((phase) => phase.kind)).toEqual(['created']);
    expect(owner.getExposes().count).toBe(count);
    await React.act(async () => render(5));
    expect(element.querySelector('output')?.textContent).toBe('7slot');
    expect(ref.current).toBe(owner);
    expect(owner.getExposes().write).toBe(exposes.write);
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '7slot' });
  });

  it('drops a suspended update on terminal unmount and closes public resources before teardown callbacks', async () => {
    const Component = await reactComponent();
    const element = host();
    const root = reactRoot(element);
    const ref = React.createRef<Handle>();
    const phases: string[] = [];
    const terminalAccess: boolean[] = [];
    let exposes: Exposes | undefined;
    let blocked = false,
      attempts = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let retryGate!: () => void;
    function Gate() {
      const [, retry] = React.useState(0);
      retryGate = () => retry((value) => value + 1);
      if (blocked) {
        ++attempts;
        throw pending;
      }
      return null;
    }
    const render = (command: number) =>
      root.render(
        React.createElement(
          React.Suspense,
          { fallback: 'waiting' },
          React.createElement(
            Component,
            {
              ref,
              command,
              onPhase: (kind: string) => {
                phases.push(kind);
                if ((kind === 'unmounted' || kind === 'beforeDispose') && exposes) {
                  terminalAccess.push(
                    accepted(() => exposes!.write(99)),
                    accepted(() => exposes!.count.subscribe(() => {}))
                  );
                }
              },
            },
            React.createElement(Gate)
          )
        )
      );
    await React.act(async () => render(0));
    await React.act(async () => render(2));
    const owner = ref.current!;
    exposes = owner.getExposes();
    const count = exposes.count;
    blocked = true;
    exposes.write(8);
    await React.act(async () => {
      retryGate();
      owner.update();
    });
    expect(attempts).toBeGreaterThan(0);
    expect(phases).toEqual(['created', 'mounted']);
    await React.act(async () => root.unmount());
    await React.act(async () => {
      blocked = false;
      release();
      await pending;
    });
    expect(phases).toEqual(['created', 'mounted', 'unmounted', 'beforeDispose']);
    expect(terminalAccess).toEqual([false, false, false, false]);
    expect(element.textContent).toBe('');
    expect(() => count.get()).toThrow();
    expect(() => owner.update()).toThrow(/dispos/);
  });
});

async function settleVue(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

describe('generated Vue 3 scheduled owner work', () => {
  it('cancels transient presence, retains detached dirty state, and invalidates queued work before terminal callbacks', async () => {
    const emitted = emitVueSource(parsed());
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const Component = evaluate(emitted.value).default as Vue.Component;
    const element = host();
    const input = Vue.ref(0);
    const ref = Vue.shallowRef<Handle>();
    const phases: Phase[] = [];
    const terminalAccess: boolean[] = [];
    let terminal = false;
    let exposes: Exposes | undefined;
    const app = Vue.createApp({
      setup: () => () =>
        Vue.h(Component, {
          command: input.value,
          ref,
          onPhase: (kind: string) => {
            phases.push({ kind, text: element.textContent ?? '' });
            if (terminal && exposes && (kind === 'unmounted' || kind === 'beforeDispose')) {
              terminalAccess.push(
                accepted(() => exposes!.write(99)),
                accepted(() => exposes!.count.subscribe(() => {}))
              );
            }
          },
        }),
    });
    app.mount(element);
    let appAlive = true;
    cleanup.push(() => {
      if (appAlive) app.unmount();
    });
    await settleVue();
    const owner = ref.value!;
    exposes = owner.getExposes();
    const count = exposes.count;
    exposes.write(7);
    owner.update();
    input.value = 1;
    await settleVue();
    expect(element.querySelector('output')).toBeNull();
    expect(phases).toEqual([{ kind: 'created', text: '' }]);
    input.value = 2;
    await settleVue();
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '7' });
    const firstRoot = element.querySelector('[data-pui-root]');
    input.value = 3;
    await settleVue();
    expect(element.querySelector('[data-pui-root]')).toBe(firstRoot);
    expect(phases.filter((phase) => phase.kind === 'mounted')).toEqual([
      { kind: 'mounted', text: '7' },
    ]);
    expect(phases.some((phase) => phase.kind === 'unmounted')).toBe(false);
    const beforeDetach = phases.length;
    exposes.write(8);
    owner.update();
    input.value = 4;
    await settleVue();
    expect(phases.slice(beforeDetach)).toEqual([{ kind: 'unmounted', text: '' }]);
    exposes.write(9);
    owner.update();
    owner.update();
    await settleVue();
    expect(element.querySelector('output')).toBeNull();
    input.value = 5;
    await settleVue();
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '9' });
    expect(ref.value).toBe(owner);
    expect(owner.getExposes().count).toBe(count);
    expect(owner.getExposes().write).toBe(exposes.write);
    const beforeDispose = phases.length;
    exposes.write(10);
    owner.update();
    terminal = true;
    app.unmount();
    appAlive = false;
    await settleVue();
    expect(phases.slice(beforeDispose).map((phase) => phase.kind)).toEqual([
      'unmounted',
      'beforeDispose',
    ]);
    expect(terminalAccess).toEqual([false, false, false, false]);
    expect(() => count.get()).toThrow(/dispos/);
  });
});

interface Vue2Instance extends Handle {
  $el: Node;
  $children: Vue2Instance[];
  $mount(): void;
  $destroy(): void;
  command: number;
}
interface Vue2Runtime {
  extend(options: Record<string, unknown>): new () => Vue2Instance;
  nextTick(): Promise<void>;
}
const requireVue2 = createRequire(
  fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url))
);
const Vue2 = requireVue2('vue') as Vue2Runtime;
async function settleVue2(): Promise<void> {
  await Vue2.nextTick();
  await Vue2.nextTick();
  await Vue2.nextTick();
}

describe('generated Vue 2 commit completion invalidation', () => {
  it('drops the old update completion when a callback reverses presence before Vue commits', async () => {
    const emitted = emitVue2Source(parsed(), { autoUpdateOnPropsChange: false });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const Component = evaluate(emitted.value).CompiledComponent;
    const element = host();
    const phases: Phase[] = [];
    const Host = Vue2.extend({
      data() {
        return { command: 0 };
      },
      render(this: Vue2Instance, h: (component: unknown, data: unknown) => unknown) {
        return h(Component, {
          props: { command: this.command },
          on: {
            phase: (kind: string) => phases.push({ kind, text: element.textContent ?? '' }),
          },
        });
      },
    });
    const vm = new Host();
    vm.$mount();
    element.append(vm.$el);
    cleanup.push(() => vm.$destroy());
    await settleVue2();
    const owner = vm.$children[0]!;
    const exposes = owner.getExposes();
    const count = exposes.count;
    exposes.write(7);
    owner.update();
    vm.command = 1;
    await settleVue2();
    expect(phases).toEqual([{ kind: 'created', text: '' }]);
    vm.command = 2;
    await settleVue2();
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '7' });
    const firstRoot = element.querySelector('[data-pui-root]');
    exposes.write(8);
    owner.update();
    vm.command = 3;
    await settleVue2();
    expect(element.querySelector('[data-pui-root]')).toBe(firstRoot);
    expect(element.querySelector('output')?.textContent).toBe('8');
    expect(phases.map((phase) => phase.kind)).toEqual(['created', 'mounted']);
    vm.command = 4;
    await settleVue2();
    expect(phases.at(-1)).toEqual({ kind: 'unmounted', text: '' });
    exposes.write(9);
    owner.update();
    owner.update();
    await settleVue2();
    expect(element.querySelector('output')).toBeNull();
    vm.command = 5;
    await settleVue2();
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '9' });
    expect(vm.$children[0]).toBe(owner);
    expect(owner.getExposes().count).toBe(count);
    expect(owner.getExposes().write).toBe(exposes.write);
    expect(phases.map((phase) => phase.kind)).toEqual([
      'created',
      'mounted',
      'unmounted',
      'mounted',
    ]);
  });

  it('invalidates an already committed first-view completion when the parent destroys in its updated hook', async () => {
    const emitted = emitVue2Source(parsed(), { autoUpdateOnPropsChange: false });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const Component = evaluate(emitted.value).CompiledComponent;
    const element = host();
    const phases: string[] = [];
    let armed = false,
      interruptedText: string | null = null;
    let exposes: Exposes | undefined;
    const terminalAccess: boolean[] = [];
    const Host = Vue2.extend({
      data() {
        return { command: 0 };
      },
      render(this: Vue2Instance, h: (component: unknown, data: unknown) => unknown) {
        return h(Component, {
          props: { command: this.command },
          on: {
            phase: (kind: string) => {
              phases.push(kind);
              if (kind === 'beforeDispose' && exposes)
                terminalAccess.push(
                  accepted(() => exposes!.write(99)),
                  accepted(() => exposes!.count.subscribe(() => {}))
                );
            },
          },
        });
      },
      updated(this: Vue2Instance) {
        if (!armed) return;
        interruptedText = element.querySelector('output')?.textContent ?? null;
        this.$destroy();
      },
    });
    const vm = new Host();
    vm.$mount();
    element.append(vm.$el);
    cleanup.push(() => vm.$destroy());
    await settleVue2();
    const owner = vm.$children[0]!;
    exposes = owner.getExposes();
    const count = exposes.count;
    exposes.write(7);
    owner.update();
    vm.command = 1;
    await settleVue2();
    expect(element.querySelector('output')).toBeNull();
    expect(phases).toEqual(['created']);
    armed = true;
    vm.command = 2;
    await settleVue2();
    // The DOM really committed, but the child's queued completion is now obsolete.
    expect(interruptedText).toBe('7');
    expect(phases).toEqual(['created', 'beforeDispose']);
    expect(terminalAccess).toEqual([false, false]);
    expect(() => count.get()).toThrow(/terminal|dispos/);
    expect(() => exposes!.write(8)).toThrow(/terminal|dispos/);
  });
});

interface Element extends HTMLElement, Handle {
  logicalOwner: symbol | null;
  setProps(props: Record<string, unknown>): void;
  dispose(): void;
}
let nextTag = 0;
function customElement(): Element {
  const emitted = emitWebComponentSource(parsed(), { shadow: true });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const exports = evaluate(emitted.value) as { register(name: string): void };
  const tag = `x-owner-stress-${++nextTag}`;
  exports.register(tag);
  const element = document.createElement(tag) as Element;
  cleanup.push(() => {
    element.dispose();
    element.remove();
  });
  return element;
}

describe('generated custom element settled disconnection', () => {
  it('retains dirty state through canceled presence but invalidates queued updates and resources at settled removal', async () => {
    const element = customElement();
    const phases: Phase[] = [];
    const terminalAccess: boolean[] = [];
    let terminal = false;
    let exposes: Exposes | undefined;
    element.addEventListener('phase', (event) => {
      const kind = (event as CustomEvent<string>).detail;
      phases.push({ kind, text: element.shadowRoot?.textContent ?? '' });
      if (terminal && exposes && (kind === 'unmounted' || kind === 'beforeDispose')) {
        terminalAccess.push(
          accepted(() => exposes!.write(99)),
          accepted(() => exposes!.count.subscribe(() => {}))
        );
      }
    });
    document.body.append(element);
    exposes = element.getExposes();
    const identity = element.logicalOwner;
    const count = exposes.count;
    exposes.write(7);
    element.update();
    element.setProps({ command: 1 });
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('output')).toBeNull();
    expect(phases).toEqual([{ kind: 'created', text: '' }]);
    element.setProps({ command: 2 });
    await Promise.resolve();
    expect(phases.at(-1)).toEqual({ kind: 'mounted', text: '7' });
    element.setProps({ command: 3 });
    await Promise.resolve();
    expect(phases.filter((phase) => phase.kind === 'mounted')).toEqual([
      { kind: 'mounted', text: '7' },
    ]);
    expect(phases.some((phase) => phase.kind === 'unmounted')).toBe(false);
    element.setProps({ command: 4 });
    await Promise.resolve();
    exposes.write(9);
    element.update();
    await Promise.resolve();
    element.setProps({ command: 5 });
    await Promise.resolve();
    expect(element.shadowRoot?.querySelector('output')?.textContent).toBe('9');
    expect(element.logicalOwner).toBe(identity);
    expect(element.getExposes().count).toBe(count);
    expect(element.getExposes().write).toBe(exposes.write);
    const stateEvents: string[] = [];
    count.subscribe((event) => stateEvents.push(event.type));
    const beforeDispose = phases.length;
    // Queue disconnection first, then old owner work. Its microtask must never
    // publish updated after terminal cleanup, even if the element later reconnects.
    terminal = true;
    element.remove();
    element.update();
    await Promise.resolve();
    await Promise.resolve();
    expect(phases.slice(beforeDispose).map((phase) => phase.kind)).toEqual([
      'unmounted',
      'beforeDispose',
    ]);
    expect(terminalAccess).toEqual([false, false, false, false]);
    expect(stateEvents).toEqual([]);
    expect(element.logicalOwner).toBeNull();
    expect(() => count.get()).toThrow(/dispos/);
    expect(() => exposes!.write(10)).toThrow(/dispos/);
    const terminalPhases = phases.length;
    document.body.append(element);
    await Promise.resolve();
    expect(element.logicalOwner).not.toBe(identity);
    expect(element.getExposes().count).not.toBe(count);
    expect(phases.slice(terminalPhases)).toEqual([{ kind: 'created', text: '' }]);
    element.getExposes().write(11);
    expect(stateEvents).toEqual([]);
    expect(() => count.subscribe(() => {})).toThrow(/dispos/);
  });
});
