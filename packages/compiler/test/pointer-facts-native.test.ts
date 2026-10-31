// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import * as React from 'react';
import * as ReactJsx from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2, { type ComponentOptions as Vue2ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import type { GeneratedModule } from '../src/ir';
import { POINTER_TYPES, WEB_TARGETS, pointerFactsSource, type PointerWebTarget } from './pointer-facts-fixture';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const temporary: string[] = [];
afterEach(async () => { for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true }); });
const floating = createRequire(new NodeURL('../../modules/positioning/package.json', import.meta.url))('@floating-ui/dom');
let nextTag = 0;
function output(target: PointerWebTarget, scope: 'root' | 'global'): GeneratedModule {
  const parsed = parsePrototype(pointerFactsSource(scope), { fileName: 'pointer-facts-native.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = target === 'wc' ? emitWebComponentSource(parsed.value) : target === 'react' ? emitReactSource(parsed.value) : target === 'vue' ? emitVueSource(parsed.value) : emitVue2Source(parsed.value);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function entryName(target: PointerWebTarget) { return target === 'react' ? 'Component.tsx' : target === 'vue2' ? 'Component.js' : 'Component.ts'; }
function graph(target: PointerWebTarget, generated: GeneratedModule) {
  const files = new Map<string, string>();
  for (const file of [{ path: entryName(target), kind: 'source', contents: generated.code }, ...(generated.supportingFiles ?? [])]) {
    if (file.kind !== 'source' || path.posix.isAbsolute(file.path) || file.path.includes('\\') || file.path.split('/').some((part) => !part || part === '..' || part === '.') || files.has(file.path)) throw new Error(`Unexpected generated artifact ${file.path}`);
    files.set(file.path, file.contents);
  }
  return files;
}
/** Executes every actual emitted module; this transpilation is not the strict check below. */
function evaluate(target: PointerWebTarget, generated: GeneratedModule): Record<string, unknown> {
  const files = graph(target, generated); const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file); if (cached) return cached;
    const source = files.get(file); if (source === undefined) throw new Error(`Missing generated module ${file}`);
    const exports: Record<string, unknown> = {}; cache.set(file, exports);
    const javascript = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'react') return React;
      if (specifier === 'react/jsx-runtime') return ReactJsx;
      if (specifier === 'vue') return Vue;
      if (specifier === '@floating-ui/dom') return floating;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected generated dependency ${specifier}`);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find((name) => files.has(name));
      if (!resolved) throw new Error(`Unclosed generated import ${specifier} from ${file}`);
      return load(resolved);
    }, exports);
    return exports;
  }
  return load(entryName(target));
}
function callable(object: unknown, name: string): (...args: unknown[]) => unknown {
  if (!object || (typeof object !== 'object' && typeof object !== 'function')) throw new Error('Missing generated public object');
  const value: unknown = Reflect.get(object, name);
  if (typeof value !== 'function') throw new Error(`Missing generated public method ${name}`);
  return (...args) => Reflect.apply(value, object, args);
}
async function mount(target: PointerWebTarget, scope: 'root' | 'global', vue2Constructor = true) {
  const exports = evaluate(target, output(target, scope));
  const host = document.createElement('div'); document.body.append(host);
  const samples: unknown[] = []; const onSample = (value: unknown) => samples.push(value);
  let handle: unknown; let close: () => Promise<void>; let flush: () => Promise<void>;
  if (target === 'wc') {
    const tag = `pointer-compiled-${++nextTag}`;
    callable(exports, 'register')(tag);
    const element = document.createElement(tag); element.addEventListener('sample', (event) => onSample((event as CustomEvent<unknown>).detail)); host.append(element); handle = element;
    flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    close = async () => { element.remove(); callable(element, 'dispose')(); host.remove(); await flush(); };
  } else if (target === 'react') {
    if (!exports.CompiledComponent || typeof exports.CompiledComponent !== 'object') throw new Error('Missing real React.forwardRef output');
    const Component = exports.CompiledComponent as React.ForwardRefExoticComponent<{ onSample: (value: unknown) => void } & React.RefAttributes<unknown>>;
    const ref = React.createRef<unknown>(); const app = createRoot(host);
    await React.act(async () => { app.render(React.createElement(Component, { ref, onSample })); }); handle = ref.current;
    flush = async () => { await React.act(async () => { await Promise.resolve(); }); };
    close = async () => { await React.act(async () => app.unmount()); host.remove(); };
  } else if (target === 'vue') {
    if (!exports.default || typeof exports.default !== 'object') throw new Error('Missing real Vue.defineComponent output');
    const Component = exports.default as Vue.Component; const ref = Vue.shallowRef<unknown>();
    const app = Vue.createApp({ render: () => Vue.h(Component, { ref, onSample }) }); app.mount(host); handle = ref.value;
    flush = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick(); };
    close = async () => { app.unmount(); host.remove(); await flush(); };
  } else {
    if (!exports.default || typeof exports.default !== 'object') throw new Error('Missing emitted Vue2 component-options object');
    // Actual generated options consumed by Vue2.6, not a pretend Vue2Runtime bridge.
    const options = exports.default as Vue2ComponentOptions<Vue2>;
    const Component = vue2Constructor ? Vue2.extend(options) : options;
    const app = new Vue2({ render(h) { return h(Component, { on: { sample: onSample } }); } }).$mount(); host.append(app.$el); handle = app.$children[0];
    flush = async () => { await Vue2.nextTick(); await Promise.resolve(); await Vue2.nextTick(); };
    close = async () => { app.$destroy(); host.remove(); await flush(); };
  }
  await flush();
  const getRoot = () => {
    const root = host.querySelector<HTMLElement>('[data-pui-root]') ?? host.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('Missing native physical root');
    return root;
  };
  try { getRoot(); } catch (error) { await close(); throw error; }
  const exposes = callable(handle, 'getExposes')();
  return { get root() { return getRoot(); }, close, flush, samples, read: (name: string) => callable(exposes, name)(), async change(name: string, value: boolean) {
    if (target === 'react') await React.act(async () => { callable(exposes, name)(value); }); else callable(exposes, name)(value);
    await flush();
  }, async dispatch(event: Event) {
    const targetEl = scope === 'root' ? getRoot() : window;
    if (target === 'react') await React.act(async () => { targetEl.dispatchEvent(event); }); else targetEl.dispatchEvent(event);
    await flush();
  } };
}
function sample(type: string, kind: unknown, buttons: unknown) {
  const event = new Event(type.replace('.', ''), { bubbles: type !== 'pointer.enter' && type !== 'pointer.leave', composed: true, cancelable: true });
  Object.defineProperties(event, { pointerType: { value: kind }, buttons: { value: buttons } }); return event;
}

for (const target of WEB_TARGETS) describe(`${target}: complete emitted pointer consumer`, () => {
  for (const scope of ['root', 'global'] as const) it(`${scope}: all six input types retain the finite boundary and reject touch/pressed/unknown as hover`, async () => {
    const mounted = await mount(target, scope);
    try {
      let calls = 0; let hover = 0;
      for (const type of POINTER_TYPES) for (const [kind, buttons, expectedKind, expectedButtons] of [
        ['mouse', 0, 'mouse', 'none'], ['mouse', 2, 'mouse', 'active'], ['touch', 1, 'touch', 'active'], ['touch', 0, 'touch', 'none'], ['pen', 0, 'pen', 'none'], ['pen', 1, 'pen', 'active'], ['', undefined, 'unknown', 'unknown'], ['trackpad', -1, 'unknown', 'unknown'], ['mouse', NaN, 'mouse', 'unknown'], ['Mouse', 0.5, 'unknown', 'unknown'], ['mouse', Infinity, 'mouse', 'unknown'],
      ] as const) {
        const event = sample(type, kind, buttons); const keys = Reflect.ownKeys(event);
        await mounted.dispatch(event); calls++;
        if (type === 'pointer.move' && expectedKind === 'mouse' && expectedButtons === 'none') hover++;
        expect(mounted.read('type')).toBe(type); expect(mounted.read('kind')).toBe(expectedKind); expect(mounted.read('buttons')).toBe(expectedButtons); expect(mounted.read('calls')).toBe(calls); expect(mounted.read('hover')).toBe(hover); expect(mounted.read('commits')).toBe(0);
        expect(Reflect.ownKeys(event)).toEqual(keys); expect(event.defaultPrevented).toBe(false);
      }
      const key = new KeyboardEvent('keydown', { key: 'x', bubbles: true }); Object.defineProperties(key, { pointerType: { value: 'mouse' }, buttons: { value: 0 } });
      await mounted.dispatch(key); expect(mounted.read('type')).toBe('key.down'); expect(mounted.read('key')).toBe('x'); expect(mounted.read('kind')).toBe('absent'); expect(mounted.read('buttons')).toBe('absent');
    } finally { await mounted.close(); }
  });
  for (const scope of ['root', 'global'] as const) it(`${scope}: real control alias/direct calls deduplicate and positive identity keeps payload authority`, async () => {
    const mounted = await mount(target, scope);
    try {
      await mounted.change('prevent', true);
      const move = sample('pointer.move', 'mouse', 0); const prevent = vi.spyOn(move, 'preventDefault');
      await mounted.dispatch(move);
      expect(mounted.read('preventions')).toBe(3); expect(prevent).toHaveBeenCalledTimes(1); expect(move.defaultPrevented).toBe(true); expect(mounted.read('identity')).toBe('mouse');
      const pressed = sample('pointer.move', 'mouse', 2); const second = vi.spyOn(pressed, 'preventDefault');
      await mounted.dispatch(pressed);
      expect(mounted.read('preventions')).toBe(6); expect(second).toHaveBeenCalledTimes(1); expect(mounted.read('identity')).toBe('control');
      await mounted.change('prevent', false);
      const noRequest = sample('pointer.move', 'pen', 0); await mounted.dispatch(noRequest);
      expect(noRequest.defaultPrevented).toBe(false); expect(mounted.read('preventions')).toBe(6); expect(mounted.read('identity')).toBe('pen');
    } finally { await mounted.close(); }
  });
  it('preserves consumer enable policy and real close/reopen routing without reviving a stale view', async () => {
    const mounted = await mount(target, 'root');
    try {
      await mounted.dispatch(sample('pointer.move', 'mouse', 0)); expect(mounted.read('hover')).toBe(1);
      await mounted.change('enabled', false); await mounted.dispatch(sample('pointer.move', 'mouse', 0)); expect(mounted.read('hover')).toBe(1);
      await mounted.change('enabled', true); await mounted.dispatch(sample('pointer.move', 'mouse', 0)); expect(mounted.read('hover')).toBe(2);
      const retiredRoot = mounted.root; const before = mounted.samples.length;
      await mounted.change('present', false);
      retiredRoot.dispatchEvent(sample('pointer.move', 'mouse', 0)); window.dispatchEvent(sample('pointer.move', 'mouse', 0)); await mounted.flush();
      expect(mounted.samples).toHaveLength(before);
      await mounted.change('present', true); await mounted.dispatch(sample('pointer.move', 'mouse', 0));
      expect(mounted.samples).toHaveLength(before + 1); expect(mounted.read('hover')).toBe(3);
    } finally { await mounted.close(); }
  });
  it('retires root/global callbacks when the real owner is disposed', async () => {
    for (const scope of ['root', 'global'] as const) {
      const mounted = await mount(target, scope); let retired = false;
      try {
        await mounted.dispatch(sample('pointer.move', 'mouse', 0)); expect(mounted.samples).toHaveLength(1);
        const root = mounted.root; await mounted.close(); retired = true;
        root.dispatchEvent(sample('pointer.move', 'mouse', 0)); window.dispatchEvent(sample('pointer.move', 'mouse', 0));
        expect(mounted.samples).toHaveLength(1);
      } finally { if (!retired) await mounted.close(); }
    }
  });
  it('strict-checks the entire actual generated module graph with real declarations', async () => {
    const generated = output(target, 'global'); const files = graph(target, generated);
    const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules'); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'pointer-strict-')); temporary.push(directory);
    for (const [file, code] of files) { const destination = path.join(directory, file); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, code); }
    const repository = fileURLToPath(new NodeURL('../../../', import.meta.url));
    const config = ts.readConfigFile(path.join(repository, 'tsconfig.json'), ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repository);
    const program = ts.createProgram([...files.keys()].map((file) => path.join(directory, file)), { ...parsed.options, noEmit: true, strict: true, skipLibCheck: false, allowJs: target === 'vue2', checkJs: target === 'vue2' });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const records = diagnostics.map((d) => ({ code: d.code, category: ts.DiagnosticCategory[d.category], file: d.file?.fileName, start: d.start, length: d.length, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
    // Do not filter inherited helper diagnostics or mistake transpilation for strict checking.
    expect(records, JSON.stringify(records, null, 2)).toEqual([]);
  });
});

describe('Vue2 emitted constructor/options path parity', () => {
  it('keeps both real Vue2 public construction paths equivalent', async () => {
    const constructor = await mount('vue2', 'root', true); const options = await mount('vue2', 'root', false);
    try {
      for (const [kind, buttons] of [['mouse', 0], ['touch', 1], ['pen', 0], ['', undefined]] as const) {
        await constructor.dispatch(sample('pointer.move', kind, buttons)); await options.dispatch(sample('pointer.move', kind, buttons));
        for (const field of ['kind', 'buttons', 'type', 'calls', 'hover', 'commits']) expect(constructor.read(field)).toEqual(options.read(field));
      }
    } finally { await constructor.close(); await options.close(); }
  });
});
