// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import ts from 'typescript';
import { posix, resolve } from 'node:path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { validateIR } from './ir-validation';
import { emitReactSource } from './react-source';
import { emitVueSource } from './vue-source';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { emitGpuiSource } from './gpui-source';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';

function parse(body: string, imports = '') {
  return parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
    import {asFocusScope,asFocusable} from '@proto.ui/hooks';${imports}
    export default definePrototype({name:'ordinary-owner',setup(def){
      const scope=asFocusScope();${body}return r=>r.el('div','scope');
    }});`,
    { fileName: 'scope.proto.ts' }
  );
}
function admitted(body: string, imports = '') {
  const result = parse(body, imports);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
describe('activation-local focus entry admission', () => {
  it.each(['FocusScopeActivationOptions', 'Options'])(
    'admits the public imported type as %s',
    (name) => {
      const imported = name === 'Options' ? 'FocusScopeActivationOptions as Options' : name;
      expect(
        parse(
          `def.expose.method('go',(options:${name})=>{scope.activate(options);});`,
          `import type {${imported}} from '@proto.ui/core';`
        ).ok
      ).toBe(true);
    }
  );
  it('rejects a local declaration conflicting with the imported activation type', () => {
    expect(
      parse(
        "def.expose.method('go',(options:Options)=>{scope.activate(options);});",
        "import type {FocusScopeActivationOptions as Options} from '@proto.ui/core';type Options={entry:'first'};"
      ).ok
    ).toBe(false);
  });
  it('admits structural options through a local alias and closure', () => {
    const parsed = parse(
      "const activate=(options:Activation)=>{scope.activate(options);};def.expose.method('go',()=>{activate({entry:'manual'});});",
      "type Activation={entry?:'manual'|'configured';preventScroll?:boolean};"
    );
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(parsed.value).ok).toBe(true);
    for (const emit of [
      emitReactSource,
      emitVueSource,
      emitVue2Source,
      emitWebComponentSource,
      emitGpuiSource,
    ])
      expect(emit(parsed.value).ok, emit.name).toBe(true);
  });
  it.each(["{entry:'first'}", '{entry:true}', "{entry:'manual',preventScroll:'yes'}"])(
    'rejects incompatible literal helper options %s without widening the alias',
    (options) => {
      expect(
        parse(
          `const activate=(options:Activation)=>{scope.activate(options);};def.expose.method('go',()=>{activate(${options});});`,
          "type Activation={entry?:'manual'|'configured';preventScroll?:boolean};"
        )
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1006', message: 'Helper argument type mismatch.' }],
      });
    }
  );
  it('rejects a forged helper literal even when its coarse record type is unchanged', () => {
    const ir = admitted(
      "const activate=(options:Activation)=>{scope.activate(options);};def.expose.method('go',()=>{activate({entry:'manual'});});",
      "type Activation={entry?:'manual'|'configured';preventScroll?:boolean};"
    );
    const registration = ir.setup.body.find(
      (statement) =>
        statement.kind === 'effect' &&
        statement.expression.kind === 'operation' &&
        statement.expression.operation === 'expose.method'
    );
    if (
      !registration ||
      registration.kind !== 'effect' ||
      registration.expression.kind !== 'operation'
    )
      throw new Error('Missing exposed helper caller');
    const callback = registration.expression.arguments[1];
    if (callback?.kind !== 'function') throw new Error('Missing exposed method callback');
    const statement = callback.function.body[0];
    if (statement?.kind !== 'effect' || statement.expression.kind !== 'helper-call')
      throw new Error('Missing helper call');
    const request = statement.expression.arguments[0];
    const entry =
      request?.kind === 'record'
        ? request.entries.find((field) => field.key === 'entry')?.value
        : undefined;
    if (entry?.kind !== 'literal') throw new Error('Missing activation literal');
    entry.value = 'first';
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: 'Helper argument type mismatch.' }],
    });
  });
  it.each(["{entry:'first'}", '{entry:true}', "{entry:'manual',target:'arbitrary'}"])(
    'rejects invalid activation %s',
    (options) => {
      expect(parse(`def.expose.method('go',()=>{scope.activate(${options});});`).ok).toBe(false);
    }
  );
  it.each(['scope.deactivate', 'focus.focusSelf'])('does not widen %s', (method) => {
    expect(
      parse(`const focus=asFocusable();def.expose.method('go',()=>{${method}({entry:'manual'});});`)
        .ok
    ).toBe(false);
  });
  it('admits manual activation on GPUI with its native policy implementation', () => {
    const result = emitGpuiSource(
      admitted("def.expose.method('go',()=>{scope.activate({entry:'manual'});});")
    );
    expect(result.ok).toBe(true);
  });
  it('admits typed possibly-present entry on GPUI, including closures', () => {
    const result = emitGpuiSource(
      admitted(
        "def.expose.method('go',(options:Options)=>{scope.activate(options);});",
        "import type {FocusScopeActivationOptions as Options} from '@proto.ui/core';"
      )
    );
    expect(result.ok).toBe(true);
  });
  it.each([
    "const dormant=()=>{scope.activate({entry:'manual'});};const alias=dormant;def.expose.method('go',()=>{scope.activate();});",
    "def.expose.method('go',()=>{return;scope.activate({entry:'manual'});});",
  ])('does not reject GPUI for an unreachable entry override', (body) => {
    expect(emitGpuiSource(admitted(body)).ok).toBe(true);
  });
  it('preserves GPUI activation without the new option', () => {
    expect(
      emitGpuiSource(
        admitted("def.expose.method('go',()=>{scope.activate({preventScroll:true});});")
      ).ok
    ).toBe(true);
  });
  it.each([emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource, emitGpuiSource])(
    'lowers an ordinary owner with separately declared Entry fallback',
    (emit) => {
      const parsed = parsePrototype(
        `import {definePrototype} from '@proto.ui/core';import {asFocusScope,asFocusEntry} from '@proto.ui/hooks';
      export default definePrototype({name:'ordinary-entry-scope',setup(def){
        const scope=asFocusScope();scope.configure({entryFallback:'entry',emptyPolicy:'none'});
        const entry=asFocusEntry();entry.configure({strategy:'descendant-first',fallback:'self'});
        def.expose.method('activate',()=>scope.activate({reason:'keyboard',preventScroll:true}));
        def.expose.method('deactivate',()=>scope.deactivate());return r=>r.el('section',r.slot());}});`,
        { fileName: 'ordinary-entry.proto.ts' }
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      expect(emit(parsed.value).ok).toBe(true);
    }
  );
});

type Request = { reason?: string; preventScroll?: boolean; entry?: 'manual' | 'configured' };
interface Scope {
  configure(config: Record<string, unknown>): void;
  activate(request?: Request): void;
  deactivate(): void;
  isActive(): boolean;
}
interface Entry {
  configure(config: Record<string, unknown>): void;
  setDisabled(value: boolean): void;
  focus(request?: Request): void;
}
interface Capabilities {
  asFocusScope(): Scope;
  asFocusEntry(): Entry;
  configureFocusable(config: Record<string, unknown>): void;
  setFocusDisabled(value: boolean): void;
  focus(request?: Request): void;
  blur(): void;
  canFocus(): boolean;
  mount(): void;
  unmount(): void;
  refresh(): void;
  dispose(): void;
}
type Factory = (options: Record<string, unknown>) => Capabilities;
function nativeFactory(): Factory {
  const exports: Record<string, unknown> = {};
  const floating = createRequire(
    resolve(process.cwd(), 'packages/modules/positioning/package.json')
  )('@floating-ui/dom');
  const code = ts.transpileModule(nativeAdapterModulesArtifact.contents, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'exports', code)((name: string) => {
    if (name !== '@floating-ui/dom') throw new Error(name);
    return floating;
  }, exports);
  return exports.createNativeAdapterModules as Factory;
}
function fixture(config: Record<string, unknown> = {}) {
  const create = nativeFactory(),
    outside = document.createElement('button'),
    root = document.createElement('div'),
    inside = document.createElement('button');
  // Happy DOM 15 does not supply a button's intrinsic tabIndex. Declare this
  // native input explicitly; the browser fixture keeps unannotated buttons.
  inside.tabIndex = 0;
  root.append(inside);
  document.body.append(outside, root);
  outside.focus();
  const identity = {},
    requests: Request[] = [];
  const options = (el: HTMLElement, id: object, parent: object | null) => ({
    identity: id,
    getLogicalParent: () => parent,
    getRoot: () => el,
    declarations: [],
    ensureSetup: () => {},
    ensureRuntime: () => {},
    ensureEvent: () => {},
    isAlive: () => true,
    isReady: () => true,
    invoke: <T>(fn: () => T) => fn(),
    getRun: () => ({}),
    getResolvedProps: () => ({}),
  });
  const owner = create(options(root, identity, null)),
    scope = owner.asFocusScope();
  scope.configure({ trap: true, loop: true, ...config });
  const child = create({
    ...options(inside, {}, identity),
    baseFocus: () => ({
      focusSelf: (request: Request) => {
        requests.push(request);
        inside.focus();
      },
    }),
  });
  const external = create(options(outside, {}, null));
  external.configureFocusable({});
  child.configureFocusable({});
  owner.mount();
  child.mount();
  external.mount();
  return {
    owner,
    child,
    external,
    scope,
    root,
    outside,
    inside,
    requests,
    cleanup() {
      external.dispose();
      child.dispose();
      owner.dispose();
      root.remove();
      outside.remove();
    },
  };
}
describe('direct native activation entry policy (shared four-Web support)', () => {
  it('manual keeps the active boundary, explicit inside focus and restoration; next activation uses setup', () => {
    const f = fixture();
    try {
      f.scope.activate({ entry: 'manual' });
      expect(f.scope.isActive()).toBe(true);
      expect(f.requests).toEqual([]);
      expect(document.activeElement).toBe(f.outside);
      expect(f.external.canFocus()).toBe(false);
      expect(f.child.canFocus()).toBe(true);
      f.external.focus();
      expect(f.requests).toEqual([]);
      f.child.focus({ reason: 'keyboard' });
      expect(document.activeElement).toBe(f.inside);
      f.scope.deactivate();
      expect(document.activeElement).toBe(f.outside);
      f.scope.activate();
      expect(f.requests.at(-1)).toEqual({ reason: 'programmatic' });
      expect(document.activeElement).toBe(f.inside);
    } finally {
      f.cleanup();
    }
  });
  it('configured never overrides setup manual', () => {
    const f = fixture({ entry: 'manual' });
    try {
      f.scope.activate({ entry: 'configured' });
      expect(f.scope.isActive()).toBe(true);
      expect(f.requests).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
  it('strips entry while retaining exact native options and the original no-entry request', () => {
    const f = fixture();
    try {
      f.scope.activate({ entry: 'configured', reason: 'keyboard', preventScroll: true });
      expect(f.requests[0]).toEqual({ reason: 'keyboard', preventScroll: true });
      expect(Object.hasOwn(f.requests[0], 'entry')).toBe(false);
      f.scope.deactivate();
      const request = { reason: 'pointer', preventScroll: false };
      f.scope.activate(request);
      expect(f.requests[1]).toBe(request);
    } finally {
      f.cleanup();
    }
  });
});

describe('direct native owned Entry lifetime', () => {
  it('retains only the opted-in activation across an initial native target gap', () => {
    const f = fixture({ entryFallback: 'entry', emptyPolicy: 'none', restore: 'none' });
    try {
      f.child.dispose();
      f.inside.remove();
      const entry = f.owner.asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      entry.focus();
      f.root.append(f.inside);
      f.owner.refresh();
      expect(document.activeElement).toBe(f.outside);
      f.inside.remove();
      f.scope.activate({ reason: 'keyboard', preventScroll: true });
      expect(f.scope.isActive()).toBe(false);
      const replacement = document.createElement('button');
      replacement.tabIndex = 0;
      f.root.append(replacement);
      f.owner.refresh();
      expect(document.activeElement).toBe(replacement);
      f.outside.focus();
      f.owner.refresh();
      expect(document.activeElement).toBe(f.outside);
    } finally {
      f.cleanup();
    }
  });
  it('deactivate retires an already-inactive continuation before later native readiness', () => {
    const f = fixture({ entryFallback: 'entry', emptyPolicy: 'none', restore: 'none' });
    try {
      f.child.dispose();
      f.inside.remove();
      const entry = f.owner.asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      f.scope.activate();
      f.scope.deactivate();
      f.root.append(f.inside);
      f.owner.refresh();
      expect(document.activeElement).toBe(f.outside);
      entry.focus();
      expect(document.activeElement).toBe(f.inside);
    } finally {
      f.cleanup();
    }
  });
  it('a selected logical child with no current Root prevents native Entry fallback', () => {
    const f = fixture({ entryFallback: 'entry', emptyPolicy: 'none' });
    try {
      const entry = f.owner.asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'self' });
      f.child.unmount();
      f.scope.activate();
      f.owner.refresh();
      expect(f.requests).toEqual([]);
      expect(document.activeElement).toBe(f.outside);
    } finally {
      f.cleanup();
    }
  });
  it('Entry self fallback uses a removable programmatic lease and preserves authored tabindex', () => {
    const f = fixture({ entryFallback: 'entry', emptyPolicy: 'none' });
    try {
      f.child.dispose();
      f.inside.remove();
      const entry = f.owner.asFocusEntry();
      entry.configure({ fallback: 'self' });
      expect(f.root.hasAttribute('tabindex')).toBe(false);
      f.scope.activate();
      expect(document.activeElement).toBe(f.root);
      expect(f.root.getAttribute('tabindex')).toBe('-1');
      entry.setDisabled(true);
      expect(f.root.hasAttribute('tabindex')).toBe(false);
      f.root.setAttribute('tabindex', '-2');
      entry.setDisabled(false);
      entry.focus();
      entry.setDisabled(true);
      expect(f.root.getAttribute('tabindex')).toBe('-2');
    } finally {
      f.cleanup();
    }
  });
});

interface ConsumerAPI {
  manual(): void;
  configured(): void;
  deactivate(): void;
  focus(): void;
}
interface ConsumerHandle {
  getExposes(): Partial<ConsumerAPI>;
}
interface MountedConsumer {
  scope: ConsumerHandle;
  child: ConsumerHandle | null;
  expectedFocus: HTMLElement;
  settle(): Promise<void>;
  cleanup(): Promise<void>;
}
type Framework = 'react' | 'vue' | 'vue2' | 'wc';
const scopeSource = `import {definePrototype} from '@proto.ui/core';import {asFocusScope} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-scope',setup(def){const scope=asFocusScope();scope.configure({trap:true,loop:true,entry:'first',restore:'previous'});
def.expose.method('manual',()=>{scope.activate({entry:'manual'});});
def.expose.method('configured',()=>{scope.activate({entry:'configured'});});
def.expose.method('deactivate',()=>{scope.deactivate();});return r=>r.el('section',r.slot());}});`;
const childSource = `import {definePrototype} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-focus-child',setup(def){const focus=asFocusable();
def.expose.method('focus',()=>{focus.focusSelf({reason:'keyboard'});});return r=>r.el('button','inside focus');}});`;
const entryScopeSource = `import {definePrototype} from '@proto.ui/core';import {asFocusScope,asFocusEntry} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-owned-entry',setup(def){
const scope=asFocusScope();scope.configure({entryFallback:'entry',emptyPolicy:'none',restore:'none'});
const entry=asFocusEntry();entry.configure({strategy:'descendant-first',fallback:'none'});
def.expose.method('manual',()=>{scope.activate({entry:'manual',preventScroll:true});});
def.expose.method('configured',()=>{scope.activate({entry:'configured',reason:'keyboard',preventScroll:true});});
def.expose.method('deactivate',()=>{scope.deactivate();});
return r=>r.el('section',[r.el('button','native entry'),r.slot()]);}});`;
function consumerProject(
  framework: Framework,
  ownedEntry = false
): Record<string, Record<string, unknown>> {
  const files = new Map<string, string>(),
    require = createRequire(resolve(process.cwd(), 'packages/compiler/package.json'));
  const extension = framework === 'react' ? '.tsx' : '.ts';
  for (const [name, source] of Object.entries({
    Scope: ownedEntry ? entryScopeSource : scopeSource,
    Child: childSource,
  })) {
    const parsed = parsePrototype(source, { fileName: `${name}.proto.ts` });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const result =
      framework === 'react'
        ? emitReactSource(parsed.value, { componentName: name })
        : framework === 'vue'
          ? emitVueSource(parsed.value, { componentName: name })
          : framework === 'vue2'
            ? emitVue2Source(parsed.value, { componentName: name })
            : emitWebComponentSource(parsed.value, {
                className: name,
                tagName: `test-${name.toLowerCase()}`,
                shadow: false,
              });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    files.set(name + extension, result.value.code);
    for (const file of result.value.supportingFiles ?? []) {
      const old = files.get(file.path);
      if (old !== undefined && old !== file.contents)
        throw new Error(`Shared artifact differs: ${file.path}`);
      files.set(file.path, file.contents);
    }
  }
  const cache = new Map<string, Record<string, unknown>>();
  const load = (file: string): Record<string, unknown> => {
    const prior = cache.get(file);
    if (prior) return prior;
    const text = files.get(file);
    if (text === undefined) throw new Error(`Missing generated artifact ${file}`);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const js = ts.transpileModule(text, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;
    new Function('require', 'exports', js)((specifier: string) => {
      if (specifier.startsWith('.'))
        return load(posix.normalize(posix.join(posix.dirname(file), `${specifier}.ts`)));
      if (specifier === 'react') return React;
      if (specifier === 'vue') return Vue;
      if (specifier === '@floating-ui/dom')
        return createRequire(resolve(process.cwd(), 'packages/modules/positioning/package.json'))(
          specifier
        );
      if (
        specifier === 'react-dom' ||
        specifier === 'react-dom/client' ||
        specifier === 'react/jsx-runtime'
      )
        return require(specifier);
      throw new Error(`Unexpected generated dependency ${specifier}`);
    }, exports);
    return exports;
  };
  return { Scope: load('Scope' + extension), Child: load('Child' + extension) };
}
interface Vue2VM extends ConsumerHandle {
  $el: HTMLElement;
  $refs: Record<string, Vue2VM>;
  $mount(): Vue2VM;
  $destroy(): void;
}
interface Vue2Constructor {
  new (options: Record<string, unknown>): Vue2VM;
  version: string;
  nextTick(): Promise<void>;
}
let customElementSequence = 0;
async function mountConsumer(
  framework: Framework,
  host: HTMLElement,
  options?: { ownedEntry?: boolean; child?: boolean }
): Promise<MountedConsumer> {
  const withChild = options?.child !== false;
  const modules = consumerProject(framework, options?.ownedEntry);
  let scope: ConsumerHandle | null = null,
    child: ConsumerHandle | null = null;
  let cleanup: () => Promise<void>, settle: () => Promise<void>, wcTarget: HTMLElement | undefined;
  if (framework === 'react') {
    const actKey = 'IS_REACT_ACT_ENVIRONMENT',
      actDescriptor = Object.getOwnPropertyDescriptor(globalThis, actKey);
    const restoreAct = () => {
      if (actDescriptor) Object.defineProperty(globalThis, actKey, actDescriptor);
      else Reflect.deleteProperty(globalThis, actKey);
    };
    Object.defineProperty(globalThis, actKey, { configurable: true, writable: true, value: true });
    const Scope = modules.Scope.Scope as React.ForwardRefExoticComponent<
      React.PropsWithChildren & React.RefAttributes<ConsumerHandle>
    >;
    const Child = modules.Child.Child as React.ForwardRefExoticComponent<
      React.RefAttributes<ConsumerHandle>
    >;
    const root = (() => {
      try {
        return createRoot(host);
      } catch (error) {
        restoreAct();
        throw error;
      }
    })();
    try {
      await React.act(async () => {
        root.render(
          React.createElement(
            Scope,
            {
              ref: (value) => {
                scope = value;
              },
            },
            withChild
              ? React.createElement(Child, {
                  ref: (value) => {
                    child = value;
                  },
                })
              : null
          )
        );
      });
    } catch (error) {
      try {
        await React.act(async () => root.unmount());
      } finally {
        restoreAct();
      }
      throw error;
    }
    settle = async () => {
      await React.act(async () => {
        await Promise.resolve();
      });
    };
    cleanup = async () => {
      try {
        await React.act(async () => root.unmount());
      } finally {
        restoreAct();
      }
    };
  } else if (framework === 'vue') {
    const app = Vue.createApp({
      render: () =>
        Vue.h(
          modules.Scope.default as Vue.Component,
          {
            ref: (value: unknown) => {
              scope = value as ConsumerHandle;
            },
          },
          {
            default: () =>
              withChild
                ? [
                    Vue.h(modules.Child.default as Vue.Component, {
                      ref: (value: unknown) => {
                        child = value as ConsumerHandle;
                      },
                    }),
                  ]
                : [],
          }
        ),
    });
    try {
      app.mount(host);
    } catch (error) {
      app.unmount();
      throw error;
    }
    settle = async () => {
      await Vue.nextTick();
    };
    cleanup = async () => {
      app.unmount();
      await Vue.nextTick();
    };
  } else if (framework === 'vue2') {
    const Vue2 = createRequire(resolve(process.cwd(), 'packages/adapters/vue2/package.json'))(
      'vue'
    ) as Vue2Constructor;
    expect(Vue2.version).toBe('2.6.14');
    const vm = new Vue2({
      render(h: (tag: unknown, data?: unknown, children?: unknown) => unknown) {
        return h(
          modules.Scope.default,
          { ref: 'scope' },
          withChild ? [h(modules.Child.default, { ref: 'child' })] : []
        );
      },
    });
    try {
      vm.$mount();
      host.append(vm.$el);
    } catch (error) {
      vm.$destroy();
      vm.$el?.remove();
      throw error;
    }
    scope = vm.$refs.scope;
    child = withChild ? vm.$refs.child : null;
    settle = async () => {
      await Vue2.nextTick();
    };
    cleanup = async () => {
      vm.$destroy();
      vm.$el.remove();
      await Vue2.nextTick();
    };
  } else {
    const id = ++customElementSequence;
    (modules.Scope.register as (name: string) => unknown)(`activation-scope-${id}`);
    (modules.Child.register as (name: string) => unknown)(`activation-child-${id}`);
    const parent = document.createElement(`activation-scope-${id}`) as HTMLElement & ConsumerHandle;
    const nested = withChild
      ? (document.createElement(`activation-child-${id}`) as HTMLElement & ConsumerHandle)
      : null;
    if (nested) parent.append(nested);
    host.append(parent);
    scope = parent;
    child = nested;
    wcTarget = nested ?? undefined;
    settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    cleanup = async () => {
      parent.remove();
      await settle();
    };
  }
  try {
    await settle();
  } catch (error) {
    await cleanup();
    throw error;
  }
  const scopeHandle = scope as ConsumerHandle | null,
    childHandle = child as ConsumerHandle | null;
  if (!scopeHandle || (withChild && !childHandle)) {
    await cleanup();
    throw new Error('Native consumer did not expose its generated owners');
  }
  if (options?.ownedEntry) {
    const nativeEntry = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === 'native entry'
    );
    if (!nativeEntry) {
      await cleanup();
      throw new Error('Missing native Entry fixture input');
    }
    // Explicit DOM input compensates for Happy DOM's absent intrinsic tabIndex.
    // Keep it eligible with a logical child too, so priority remains observable.
    nativeEntry.tabIndex = 0;
  }
  // DOM identity is selected before requesting focus, never inferred from the result.
  const button = withChild
    ? Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'inside focus'
      )
    : host.querySelector('button');
  const expectedFocus = withChild ? (wcTarget ?? button?.closest('[data-pui-root]')) : button;
  if (!(expectedFocus instanceof HTMLElement)) {
    await cleanup();
    throw new Error('Missing exact child physical Root');
  }
  if (withChild && !wcTarget && expectedFocus === host.querySelector('[data-pui-root]')) {
    await cleanup();
    throw new Error('Child focus target incorrectly resolved to the scope Root');
  }
  return { scope: scopeHandle, child: childHandle, expectedFocus, settle, cleanup };
}
describe('ordinary native-framework consumers of generated activation', () => {
  it.each<Framework>(['react', 'vue', 'vue2', 'wc'])(
    '%s preserves manual entry, restoration and later configured entry',
    async (framework) => {
      const host = document.createElement('div'),
        outside = document.createElement('button');
      document.body.append(outside, host);
      let mounted: MountedConsumer | undefined;
      try {
        mounted = await mountConsumer(framework, host);
        outside.focus();
        expect(document.activeElement).toBe(outside);
        const scope = mounted.scope.getExposes(),
          child = mounted.child!.getExposes();
        expect(typeof scope.manual).toBe('function');
        expect(typeof scope.configured).toBe('function');
        expect(typeof scope.deactivate).toBe('function');
        expect(typeof child.focus).toBe('function');
        scope.manual!();
        await mounted.settle();
        expect(document.activeElement).toBe(outside);
        child.focus!();
        await mounted.settle();
        const inside = mounted.expectedFocus;
        expect(document.activeElement).toBe(inside);
        expect(inside).not.toBe(outside);
        scope.deactivate!();
        await mounted.settle();
        expect(document.activeElement).toBe(outside);
        scope.configured!();
        await mounted.settle();
        expect(document.activeElement).toBe(inside);
        scope.deactivate!();
        await mounted.settle();
        expect(document.activeElement).toBe(outside);
      } finally {
        try {
          await mounted?.cleanup();
        } finally {
          host.remove();
          outside.remove();
        }
      }
      expect(host.childElementCount).toBe(0);
    }
  );
});

describe('ordinary generated consumers of Scope-owned Entry', () => {
  it.each<Framework>(['react', 'vue', 'vue2', 'wc'])(
    '%s uses the enabled native Entry only after logical selection is empty',
    async (framework) => {
      for (const child of [false, true]) {
        const host = document.createElement('div'),
          outside = document.createElement('button');
        document.body.append(outside, host);
        let mounted: MountedConsumer | undefined;
        try {
          mounted = await mountConsumer(framework, host, { ownedEntry: true, child });
          outside.focus();
          const scope = mounted.scope.getExposes();
          scope.manual!();
          await mounted.settle();
          expect(document.activeElement).toBe(outside);
          scope.deactivate!();
          scope.configured!();
          await mounted.settle();
          expect(document.activeElement).toBe(mounted.expectedFocus);
          const native = Array.from(host.querySelectorAll('button')).find(
            (button) => button.textContent === 'native entry'
          );
          if (child) expect(document.activeElement).not.toBe(native);
          else expect(document.activeElement).toBe(native);
          outside.focus();
          scope.deactivate!();
          await mounted.settle();
          expect(document.activeElement).toBe(outside);
        } finally {
          try {
            await mounted?.cleanup();
          } finally {
            host.remove();
            outside.remove();
          }
        }
      }
    }
  );
});
