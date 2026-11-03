// @vitest-environment happy-dom
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import Vue2, { type ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { parsePrototype } from '../src/parser';
import { emitVue2Source } from '../src/vue2-source';
import type { GeneratedModule } from '../src/ir';

const evidence = process.env.PUI_NATIVE_SUPPORT_EVIDENCE_DIR;
let captures = 0;
let bytesWritten = 0;
function capture(label: string, contents: string) {
  if (!evidence) return;
  if (!path.isAbsolute(evidence) || !/^[a-z0-9-]+$/.test(label))
    throw new Error('Invalid native-support evidence destination');
  const bytes = Buffer.byteLength(contents);
  bytesWritten += bytes;
  if (++captures > 32 || bytes > 8 * 1024 * 1024 || bytesWritten > 64 * 1024 * 1024)
    throw new Error('Native-support evidence budget');
  mkdirSync(evidence, { recursive: true });
  writeFileSync(path.join(evidence, label + '.json'), contents, { flag: 'wx' });
}
function compile(
  label: string,
  additional = '',
  afterReturn = '',
  name = 'text-demand',
  lineMode = 'multiline'
): GeneratedModule {
  const source = `import {definePrototype} from '@proto.ui/core';
import {asTextControl,asOverlay,asFocusable} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({
  name:${JSON.stringify(name)},
  modules:[declareTextControl({content:'plain-text',lineMode:${JSON.stringify(lineMode)},engine:'host'})],
  setup(def) {
    const control=asTextControl();
    def.lifecycle.onCreated(()=>control.sync({defaultValue:'seed',valueMode:'uncontrolled'${lineMode === 'multiline' ? ',rows:3' : ''}}));
    ${additional}
    return()=>null;
    ${afterReturn}
  }
});`;
  const parsed = parsePrototype(source, { fileName: label + '.proto.ts' });
  capture(label + '-input', JSON.stringify({ source, parsed }, null, 2));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = emitVue2Source(parsed.value);
  capture(label + '-result', JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function helpers(module: GeneratedModule) {
  return (module.supportingFiles ?? []).filter((file) => file.path.includes('/interaction/'));
}
describe('reached native support compilation', () => {
  it('omits unrelated factories for actual Text and an unreachable Overlay', () => {
    const plain = compile('plain', 'def.lifecycle.onMounted(run=>run.update());');
    const dormant = compile(
      'dormant',
      'def.lifecycle.onMounted(run=>run.update());',
      'asOverlay();',
      'renamed-editor'
    );
    expect(helpers(dormant)).toEqual(helpers(plain));
    expect(
      helpers(plain)
        .map((file) => file.path)
        .sort()
    ).toEqual([
      '.proto-ui/interaction/ownership-v1.ts',
      '.proto-ui/interaction/text-multiline-v1.ts',
    ]);
    const output = helpers(plain)
      .map((file) => file.contents)
      .join('\n');
    expect(output).not.toMatch(
      /createNativeAdapterModules|computePosition|scrollAxes|observed[<(]|declarations|textDeclaration|lineMode/
    );
    expect(output).toContain("alive(); return 'textarea';");
    expect(plain.code).not.toContain('declarations:');
    expect(output).toContain('restoreTextValue');
    expect(output).toContain('selectionStart');
    expect(output).toContain('scrollTop');
    expect(output).toContain('rootOwners');
    expect(output).toContain('logicalOwners');
    expect(plain.dependencies?.some((dependency) => dependency.name === '@floating-ui/dom')).toBe(
      false
    );
    // This independent slice must not silently carry the unpublished R13 value fix.
    expect(plain.code).toContain(
      "if (key === 'value') { if (initial) result.domProps = { value }; }"
    );
    expect(plain.code).not.toContain("if (key === 'value') continue;");
    expect(plain.code).not.toContain('registerGenericObservedState:');
  });
  it('retains reached Overlay and Focus while sharing the same owner artifact', () => {
    const plain = compile('mixed-reference', '', '', 'native-single-editor', 'single');
    const single = helpers(plain).find((file) => file.path.endsWith('/text-single-v1.ts'))!;
    expect(single.contents).toContain("alive(); return 'input';");
    expect(single.contents).not.toMatch(
      /declarations|textDeclaration|lineMode|createNativeAdapterModules/
    );
    const overlay = compile('overlay', 'const layer=asOverlay();layer.configure({portal:true});');
    const focus = compile('focus', 'asFocusable();');
    for (const module of [overlay, focus]) {
      const output = helpers(module)
        .map((file) => file.contents)
        .join('\n');
      expect(output).toContain('createNativeAdapterModules');
      expect(output).toContain('computePosition');
      expect(
        module.dependencies?.some((dependency) => dependency.name === '@floating-ui/dom')
      ).toBe(true);
      expect(helpers(module).find((file) => file.path.endsWith('/ownership-v1.ts'))).toEqual(
        helpers(plain).find((file) => file.path.endsWith('/ownership-v1.ts'))
      );
    }
  });
});

// Real generated modules share the emitted ownership module, just as ordinary
// imports in a native consumer do. No substitute registry is supplied by the test.
function compileConsumer(label: string, text: boolean): GeneratedModule {
  const source = text
    ? `import {definePrototype} from '@proto.ui/core';
import {asTextControl} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'inner-native-editor',
 modules:[declareTextControl({content:'plain-text',lineMode:'multiline',engine:'host'})],
 setup(def){
  def.props.define({present:{type:'boolean',default:true}});
  const control=asTextControl();
  def.lifecycle.onCreated(()=>control.sync({defaultValue:'',valueMode:'uncontrolled'}));
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
  def.expose.method('read',()=>control.snapshot());
  return()=>null;
 }});`
    : `import {definePrototype} from '@proto.ui/core';
import {asTrigger} from '@proto.ui/hooks';
export default definePrototype({name:'outer-native-trigger',setup(def){
 asTrigger();def.expose.event('activated',{payload:'json'});
 def.event.on('press.commit',(run)=>{run.expose.emit('activated','outer');});
 return r=>r.el('div',[r.slot()]);
}});`;
  const parsed = parsePrototype(source, { fileName: label + '.proto.ts' });
  capture(label + '-input', JSON.stringify({ source, parsed }, null, 2));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = emitVue2Source(parsed.value);
  capture(label + '-result', JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function consumerModules(outer: GeneratedModule, inner: GeneratedModule) {
  const sources = new Map<string, string>([
    ['Outer.js', outer.code],
    ['Inner.js', inner.code],
  ]);
  for (const module of [outer, inner])
    for (const file of module.supportingFiles ?? []) {
      const before = sources.get(file.path);
      if (before !== undefined && before !== file.contents)
        throw new Error('Conflicting native support import: ' + file.path);
      sources.set(file.path, file.contents);
    }
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file);
    if (prior) return prior;
    const source = sources.get(file);
    if (source === undefined) throw new Error('Missing actual native source: ' + file);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const javascript = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', javascript)((specifier: string) => {
      if (specifier === 'vue') return Vue2;
      if (specifier === '@floating-ui/dom')
        return createRequire(
          fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
        )(specifier);
      if (!specifier.startsWith('.'))
        throw new Error('Unexpected native consumer dependency: ' + specifier);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const resolved = [base, base + '.ts', base + '.js'].find((candidate) =>
        sources.has(candidate)
      );
      if (!resolved) throw new Error('Unclosed actual native import: ' + specifier);
      return load(resolved);
    }, exports);
    return exports;
  }
  return {
    outer: load('Outer.js').default as ComponentOptions<Vue2>,
    inner: load('Inner.js').default as ComponentOptions<Vue2>,
    ownership: load('.proto-ui/interaction/ownership-v1.ts'),
  };
}
function field(value: unknown, key: string): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function'))
    throw new Error('Missing native receiver: ' + key);
  return Reflect.get(value, key);
}
function method(value: unknown, key: string, ...args: unknown[]): unknown {
  const fn = field(value, key);
  if (typeof fn !== 'function') throw new Error('Missing native method: ' + key);
  return Reflect.apply(fn, value, args);
}
const closeConsumers: Array<() => void> = [];
afterEach(() => {
  for (const close of closeConsumers.splice(0).reverse()) close();
});
async function nativeConsumer(label: string, erasePhysicalOwner = false) {
  const outer = compileConsumer(label + '-outer', false);
  let inner = compileConsumer(label + '-text', true);
  let fault: { path: string; before: string; after: string } | undefined;
  if (erasePhysicalOwner) {
    const before =
      '    rootOwners.set(root, routeOwner); rootOwners.set(host, routeOwner); logicalOwners.set(options.identity, routeOwner);';
    const after = '    logicalOwners.set(options.identity, routeOwner);';
    inner = {
      ...inner,
      supportingFiles: inner.supportingFiles?.map((file) => {
        if (!file.path.endsWith('/text-multiline-v1.ts')) return file;
        if (file.contents.split(before).length !== 2)
          throw new Error('Sole physical-owner negative control did not match once');
        fault = { path: file.path, before, after };
        return { ...file, contents: file.contents.replace(before, after) };
      }),
    };
    if (!fault) throw new Error('No actual Text artifact for sole negative control');
  }
  const loaded = consumerModules(outer, inner);
  const state = Vue2.observable({ present: true });
  const events: unknown[] = [];
  const app = new Vue2({
    render(h) {
      return h(loaded.outer, {
        on: { activated: (payload: unknown) => events.push(payload) },
        scopedSlots: { default: () => [h(loaded.inner, { props: { present: state.present } })] },
      });
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      app.$destroy();
    } finally {
      host.remove();
    }
  };
  closeConsumers.push(close);
  app.$mount();
  host.append(app.$el);
  await Vue2.nextTick();
  await Vue2.nextTick();
  const text = host.querySelector('textarea');
  if (!text) throw new Error('Actual native Text root absent');
  const innerOwner = app.$children[0].$children.find((child) => child.$el === text);
  if (!innerOwner) throw new Error('Actual native Text component instance absent');
  return { app, host, text, state, events, innerOwner, ownership: loaded.ownership, close, fault };
}

async function observedConsumer(
  label: string,
  view: Awaited<ReturnType<typeof nativeConsumer>>,
  trace: Record<string, unknown>,
  body: () => Promise<void>
) {
  const errors: unknown[] = [];
  try {
    await body();
  } catch (error) {
    errors.push(error);
  }
  try {
    view.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    capture(label + '-trace', JSON.stringify(trace, null, 2));
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, 'Native consumer assertion, cleanup or capture failed');
}

describe('mixed generated native owner lifetime', () => {
  it('isolates Text pointer and keyboard input from an outer Trigger', async () => {
    const view = await nativeConsumer('routing');
    const trace: Record<string, unknown> = {};
    await observedConsumer('routing', view, trace, async () => {
      view.text.value = 'native edit';
      view.text.dispatchEvent(new Event('input', { bubbles: true }));
      trace.textSnapshot = method(method(view.innerOwner, 'getExposes'), 'read');
      expect(trace.textSnapshot).toEqual({ value: 'native edit', composing: false });
      view.text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      for (const key of [' ', 'Enter']) {
        view.text.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, composed: true })
        );
        view.text.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, composed: true }));
      }
      trace.afterTextInput = [...view.events];
      expect(view.events).toEqual([]);
      view.app.$el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      trace.afterOuterClick = [...view.events];
      expect(view.events).toEqual(['outer']);
    });
  });
  it('detects removal of only the Text physical-owner registration', async () => {
    const view = await nativeConsumer('routing-fault', true);
    const trace: Record<string, unknown> = { fault: view.fault };
    await observedConsumer('routing-fault', view, trace, async () => {
      view.text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      trace.afterTextClick = [...view.events];
      // The unchanged outer native consumer now wrongly activates. The preceding
      // normal assertion would fail; this is a real one-operation counterexample.
      expect(view.events).toEqual(['outer']);
    });
  });
  it('keeps module ownership through detach and removes both registries on dispose', async () => {
    const view = await nativeConsumer('lifetime');
    const trace: Record<string, unknown> = {};
    await observedConsumer('lifetime', view, trace, async () => {
      const physical = field(view.ownership, 'rootOwners');
      const logical = field(view.ownership, 'logicalOwners');
      const modules = field(view.ownership, 'owners');
      const route = method(physical, 'get', view.text),
        identity = field(route, 'identity');
      const owner = method(modules, 'get', identity);
      expect(field(route, 'target')).toBe(view.text);
      expect(method(logical, 'get', identity)).toBe(route);
      expect(method(owner, 'target')).toBe(view.text);
      view.state.present = false;
      await Vue2.nextTick();
      await Vue2.nextTick();
      trace.detached = {
        physical: method(physical, 'has', view.text),
        logical: method(logical, 'has', identity),
        module: method(modules, 'has', identity),
        target: method(owner, 'target'),
      };
      expect(method(physical, 'has', view.text)).toBe(false);
      expect(method(logical, 'has', identity)).toBe(false);
      expect(method(modules, 'get', identity)).toBe(owner);
      expect(method(owner, 'target')).toBe(null);
      view.state.present = true;
      await Vue2.nextTick();
      await Vue2.nextTick();
      const next = view.host.querySelector('textarea');
      expect(next).not.toBe(null);
      expect(next).not.toBe(view.text);
      expect(field(method(physical, 'get', next), 'identity')).toBe(identity);
      expect(method(modules, 'get', identity)).toBe(owner);
      trace.remountedSameOwner = true;
      view.close();
      trace.disposed = {
        physical: method(physical, 'has', next),
        logical: method(logical, 'has', identity),
        module: method(modules, 'has', identity),
      };
      expect(method(physical, 'has', next)).toBe(false);
      expect(method(logical, 'has', identity)).toBe(false);
      expect(method(modules, 'has', identity)).toBe(false);
    });
  });
});
