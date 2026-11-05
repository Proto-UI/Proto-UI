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

// R15 additions only. Earlier tests and their original evidence budget stay intact.
function compileImage(
  label: string,
  options: {
    name?: string;
    reached?: string;
    dormant?: string;
    consumer?: boolean;
    capture?: boolean;
    records?: { inputs: unknown[]; results: unknown[] };
  } = {}
): GeneratedModule {
  const authored = options.consumer
    ? `def.props.define({source:{type:'string',default:'image:a'},present:{type:'boolean',default:true}});
       def.expose.event('status',{payload:'json'});
       def.expose.event('cancelled',{payload:'json'});
       const cancelled=image.on('loadingStatusChange',(run,event)=>run.expose.emit('cancelled',event));cancelled();
       image.on('loadingStatusChange',(run,event)=>run.expose.emit('status',event));
       def.lifecycle.onCreated(run=>image.sync({source:run.props.get().source,loadingStatus:'loaded'}));
       def.props.watch(['source'],(run,next)=>image.sync({source:next.source}));
       def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present));
       def.expose.method('read',()=>image.snapshot());`
    : '';
  const source = `import {definePrototype} from '@proto.ui/core';
import {asImageView as usePicture,asOverlay} from '@proto.ui/hooks';
import {declareImageView} from '@proto.ui/module-image-view';
export default definePrototype({name:${JSON.stringify(options.name ?? 'image-demand')},
 modules:[declareImageView({source:'',alternativeText:'Image',a11yMode:'informative',fit:'cover'})],
 setup(def){const image=usePicture();${authored}${options.reached ?? ''}return()=>null;${options.dormant ?? ''}}
});`;
  const parsed = parsePrototype(source, { fileName: label + '.proto.ts' });
  options.records?.inputs.push({ label, source, parsed });
  if (options.capture) capture(label + '-input', JSON.stringify({ source, parsed }, null, 2));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = emitVue2Source(parsed.value);
  options.records?.results.push({ label, result });
  if (options.capture) capture(label + '-result', JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

describe('reached Image native support', () => {
  it('selects checked Image atoms independent of names and preserves reached mixed fallback', () => {
    const records = { inputs: [] as unknown[], results: [] as unknown[] };
    const errors: unknown[] = [];
    try {
      const plain = compileImage('image-demand', { records });
      const renamed = compileImage('renamed-picture', {
        name: 'unrelated-name',
        dormant: 'asOverlay();',
        records,
      });
      const mixed = compileImage('image-overlay', { reached: 'asOverlay();', records });
      expect(helpers(renamed)).toEqual(helpers(plain));
      expect(
        helpers(plain)
          .map((file) => file.path)
          .sort()
      ).toEqual(['.proto-ui/interaction/image-v1.ts', '.proto-ui/interaction/ownership-v1.ts']);
      const output = helpers(plain)
        .map((file) => file.contents)
        .join('\n');
      expect(output).not.toMatch(
        /createNativeAdapterModules|computePosition|scrollAxes|textDeclaration|imageDeclaration|declarations:/
      );
      expect(output).toContain("alive(); return 'img';");
      expect(output).toContain('target.decode()');
      expect(output).toContain("['load', 'error']");
      expect(plain.code).toContain('imageConfig:');
      expect(plain.code).not.toContain('declarations:');
      expect(plain.code).not.toContain('registerGenericObservedState:');
      expect(plain.dependencies?.some((dependency) => dependency.name === '@floating-ui/dom')).toBe(
        false
      );
      expect(helpers(mixed).some((file) => file.path.endsWith('/adapter-modules-v1.ts'))).toBe(
        true
      );
      expect(mixed.dependencies?.some((dependency) => dependency.name === '@floating-ui/dom')).toBe(
        true
      );
      expect(helpers(mixed).find((file) => file.path.endsWith('/ownership-v1.ts'))).toEqual(
        helpers(plain).find((file) => file.path.endsWith('/ownership-v1.ts'))
      );
    } catch (error) {
      errors.push(error);
    }
    try {
      capture('image-demand-input', JSON.stringify(records.inputs, null, 2));
    } catch (error) {
      errors.push(error);
    }
    try {
      capture('image-demand-result', JSON.stringify(records.results, null, 2));
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, 'Image compilation assertion or capture failed');
  });

  it('binds Image completion to current native request and attachment in a real Vue2 consumer', async () => {
    const outer = compileConsumer('image-journey-outer', false);
    const inner = compileImage('image-journey', { consumer: true, capture: true });
    const loaded = consumerModules(outer, inner);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
    const requests: Array<{
      resolve(): void;
      reject(): void;
      target: HTMLImageElement;
      source: string | null;
    }> = [];
    const events: unknown[] = [],
      activated: unknown[] = [],
      cancelled: unknown[] = [];
    const trace: Record<string, unknown> = {};
    const errors: unknown[] = [];
    let app: Vue2 | undefined, host: HTMLDivElement | undefined;
    let nativeEvents = 0,
      closed = false,
      decodePatched = false;
    const close = () => {
      if (closed) return;
      closed = true;
      const failures: unknown[] = [];
      try {
        app?.$destroy();
      } catch (error) {
        failures.push(error);
      }
      try {
        host?.remove();
      } catch (error) {
        failures.push(error);
      }
      try {
        if (decodePatched) {
          if (descriptor) Object.defineProperty(HTMLImageElement.prototype, 'decode', descriptor);
          else if (!Reflect.deleteProperty(HTMLImageElement.prototype, 'decode'))
            throw new Error('Could not restore image decode descriptor');
        }
      } catch (error) {
        failures.push(error);
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(
          failures,
          'Image destroy, host removal or descriptor restoration failed'
        );
    };
    closeConsumers.push(close);
    const flush = async () => {
      await Promise.resolve();
      await Vue2.nextTick();
      await Vue2.nextTick();
    };
    try {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: function (this: HTMLImageElement) {
          const target = this;
          return new Promise<void>((resolve, reject) =>
            requests.push({
              resolve,
              reject: () => reject(new Error('test image failure')),
              target,
              source: target.getAttribute('src'),
            })
          );
        },
      });
      decodePatched = true;
      const state = Vue2.observable({ source: 'image:a', present: true });
      app = new Vue2({
        render(h) {
          return h(loaded.outer, {
            on: { activated: (value: unknown) => activated.push(value) },
            scopedSlots: {
              default: () => [
                h(loaded.inner, {
                  props: { source: state.source, present: state.present },
                  on: {
                    status: (value: unknown) => events.push(value),
                    cancelled: (value: unknown) => cancelled.push(value),
                  },
                }),
              ],
            },
          });
        },
      });
      host = document.createElement('div');
      document.body.append(host);
      host.addEventListener('load', () => ++nativeEvents);
      host.addEventListener('error', () => ++nativeEvents);
      app.$mount();
      host.append(app.$el);
      await flush();
      const image = host.querySelector('img');
      if (!image) throw new Error('Actual generated Image root absent');
      const instance = app.$children[0].$children.find((child) => child.$el === image);
      if (!instance) throw new Error('Actual generated Image instance absent');
      const read = () => method(method(instance, 'getExposes'), 'read');
      const physical = field(loaded.ownership, 'rootOwners');
      const logical = field(loaded.ownership, 'logicalOwners');
      const modules = field(loaded.ownership, 'owners');
      const identity = field(method(physical, 'get', image), 'identity');
      const owner = method(modules, 'get', identity);
      trace.initial = {
        tag: image.localName,
        source: image.getAttribute('src'),
        alt: image.alt,
        fit: image.style.objectFit,
        snapshot: read(),
        requests: requests.length,
      };
      image.dispatchEvent(new Event('load', { bubbles: true }));
      image.dispatchEvent(new Event('error', { bubbles: true }));
      trace.nativeBoundary = { propagated: nativeEvents, snapshot: read() };
      image.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      trace.afterImageClick = [...activated];
      state.source = 'image:b';
      await flush();
      trace.replacement = {
        source: image.getAttribute('src'),
        alt: image.alt,
        fit: image.style.objectFit,
        requests: requests.length,
      };
      requests[0].resolve();
      await flush();
      trace.afterStale = read();
      requests[1].resolve();
      await flush();
      trace.afterCurrent = read();
      const terminalCount = events.length;
      image.dispatchEvent(new Event('load', { bubbles: true }));
      image.dispatchEvent(new Event('error', { bubbles: true }));
      await flush();
      trace.terminalOnce = events.length === terminalCount;
      state.present = false;
      await flush();
      trace.detached = {
        physical: method(physical, 'has', image),
        logical: method(logical, 'has', identity),
        module: method(modules, 'get', identity) === owner,
        target: method(owner, 'target'),
      };
      state.present = true;
      await flush();
      const nextImage = host.querySelector('img');
      if (!nextImage) throw new Error('Rematerialized generated Image root absent');
      trace.remounted = {
        changedTarget: nextImage !== image,
        sameIdentity: field(method(physical, 'get', nextImage), 'identity') === identity,
        snapshot: read(),
        requests: requests.length,
      };
      requests.at(-1)!.reject();
      await flush();
      trace.afterError = read();
      state.source = '';
      await flush();
      trace.cleared = { source: nextImage.getAttribute('src'), snapshot: read() };
      state.source = 'image:c';
      await flush();
      const finalRequest = requests.at(-1)!;
      const beforeDispose = events.length;
      close();
      finalRequest.resolve();
      await flush();
      trace.disposed = {
        physical: method(physical, 'has', nextImage),
        logical: method(logical, 'has', identity),
        module: method(modules, 'has', identity),
        lateEvents: events.length - beforeDispose,
      };
      trace.events = events;
      trace.cancelled = cancelled;
      trace.requests = requests.map((entry) => ({ source: entry.source }));
      expect(trace.initial).toEqual({
        tag: 'img',
        source: 'image:a',
        alt: 'Image',
        fit: 'cover',
        snapshot: { source: 'image:a', loadingStatus: 'loading', fit: 'cover' },
        requests: 1,
      });
      expect(trace.nativeBoundary).toEqual({
        propagated: 0,
        snapshot: { source: 'image:a', loadingStatus: 'loading', fit: 'cover' },
      });
      expect(trace.afterImageClick).toEqual([]);
      expect(trace.cancelled).toEqual([]);
      expect(trace.replacement).toEqual({
        source: 'image:b',
        alt: 'Image',
        fit: 'cover',
        requests: 2,
      });
      expect(trace.afterStale).toEqual({
        source: 'image:b',
        loadingStatus: 'loading',
        fit: 'cover',
      });
      expect(trace.afterCurrent).toEqual({
        source: 'image:b',
        loadingStatus: 'loaded',
        fit: 'cover',
      });
      expect(trace.terminalOnce).toBe(true);
      expect(trace.detached).toEqual({
        physical: false,
        logical: false,
        module: true,
        target: null,
      });
      expect(trace.remounted).toEqual({
        changedTarget: true,
        sameIdentity: true,
        snapshot: { source: 'image:b', loadingStatus: 'loading', fit: 'cover' },
        requests: 3,
      });
      expect(trace.afterError).toEqual({ source: 'image:b', loadingStatus: 'error', fit: 'cover' });
      expect(trace.cleared).toEqual({
        source: null,
        snapshot: { source: '', loadingStatus: 'idle', fit: 'cover' },
      });
      expect(trace.disposed).toEqual({
        physical: false,
        logical: false,
        module: false,
        lateEvents: 0,
      });
    } catch (error) {
      errors.push(error);
    }
    try {
      close();
    } catch (error) {
      errors.push(error);
    }
    try {
      capture('image-journey-trace', JSON.stringify(trace, null, 2));
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, 'Image consumer assertion, cleanup or capture failed');
  });
});

// Additional evidence for draft Image definitions only. These HappyDOM host
// properties and decode promises are controlled facts, not network/cache proof.
let imageEdgeCaptures = 0,
  imageEdgeBytes = 0;
function captureImageEdge(label: string, value: unknown) {
  if (!evidence) return;
  if (!path.isAbsolute(evidence) || !/^image-edge-[a-z-]+$/.test(label))
    throw new Error('Invalid Image edge evidence destination');
  const contents = JSON.stringify(value, null, 2);
  const bytes = Buffer.byteLength(contents);
  imageEdgeBytes += bytes;
  if (++imageEdgeCaptures > 4 || bytes > 1024 * 1024 || imageEdgeBytes > 4 * 1024 * 1024)
    throw new Error('Image edge evidence budget');
  mkdirSync(evidence, { recursive: true });
  writeFileSync(path.join(evidence, label + '.json'), contents, { flag: 'wx' });
}
let imageEdgeCompilation:
  | { ok: true; module: GeneratedModule }
  | { ok: false; error: unknown }
  | undefined;
function compiledImageEdge(): GeneratedModule {
  if (imageEdgeCompilation) {
    if (!imageEdgeCompilation.ok) throw imageEdgeCompilation.error;
    return imageEdgeCompilation.module;
  }
  const source = `import {definePrototype} from '@proto.ui/core';
import {asImageView} from '@proto.ui/hooks';
import {declareImageView} from '@proto.ui/module-image-view';
export default definePrototype({name:'image-edge',
 modules:[declareImageView({source:'',alternativeText:'',a11yMode:'decorative',fit:'cover'})],
 setup(def){
  const image=asImageView();
  def.expose.event('status',{payload:'json'});
  image.on('loadingStatusChange',(run,event)=>run.expose.emit('status',event));
  def.expose.method('syncRead',(source:string,alternativeText:string,a11yMode:'informative'|'decorative')=>{
   image.sync({source,alternativeText,a11yMode});
   return image.snapshot();
  });
  return()=>null;
 }});`;
  const errors: unknown[] = [];
  let parsed: ReturnType<typeof parsePrototype> | undefined;
  let result: ReturnType<typeof emitVue2Source> | undefined;
  try {
    parsed = parsePrototype(source, { fileName: 'image-edge.proto.ts' });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    result = emitVue2Source(parsed.value);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  } catch (error) {
    errors.push(error);
  }
  try {
    captureImageEdge('image-edge-input', { source, parsed });
  } catch (error) {
    errors.push(error);
  }
  try {
    captureImageEdge('image-edge-result', { emitterCalled: result !== undefined, result });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length || !result?.ok) {
    const error =
      errors.length === 1
        ? errors[0]
        : new AggregateError(errors, 'Image edge compilation or capture failed');
    imageEdgeCompilation = { ok: false, error };
    throw error;
  }
  imageEdgeCompilation = { ok: true, module: result.value };
  return result.value;
}
async function imageEdgeConsumer(
  label: string,
  verify: (view: {
    image: HTMLImageElement;
    instance: Vue2;
    events: unknown[];
    trace: Record<string, unknown>;
    patch(name: string, descriptor: PropertyDescriptor): void;
  }) => void
) {
  const trace: Record<string, unknown> = {
    hostEvidence: 'Controlled HappyDOM getters/decode; no network loading or browser cache claim.',
  };
  const errors: unknown[] = [],
    events: unknown[] = [];
  const vueErrors: Array<{ message: string; info: string }> = [];
  const previousErrorHandler = Vue2.config.errorHandler;
  const patches: Array<{
    target: object;
    name: string;
    descriptor: PropertyDescriptor | undefined;
  }> = [];
  let app: Vue2 | undefined,
    host: HTMLDivElement | undefined,
    errorHandlerPatched = false;
  try {
    const module = compiledImageEdge();
    // Reuse the existing real-module loader without another compiler invocation.
    const loaded = consumerModules(module, module);
    Vue2.config.errorHandler = (error, _vm, info) => {
      errors.push(error);
      vueErrors.push({ message: error instanceof Error ? error.message : String(error), info });
    };
    errorHandlerPatched = true;
    app = new Vue2({
      render(h) {
        return h(loaded.inner, { on: { status: (event: unknown) => events.push(event) } });
      },
    });
    host = document.createElement('div');
    document.body.append(host);
    app.$mount();
    host.append(app.$el);
    await Vue2.nextTick();
    await Vue2.nextTick();
    const image = host.querySelector('img');
    const instance = app.$children[0];
    if (!image || !instance) throw new Error('Actual generated Image edge consumer absent');
    verify({
      image,
      instance,
      events,
      trace,
      patch(name, descriptor) {
        patches.push({
          target: image,
          name,
          descriptor: Object.getOwnPropertyDescriptor(image, name),
        });
        Object.defineProperty(image, name, descriptor);
      },
    });
  } catch (error) {
    errors.push(error);
  }
  try {
    app?.$destroy();
  } catch (error) {
    errors.push(error);
  }
  try {
    host?.remove();
  } catch (error) {
    errors.push(error);
  }
  for (const patch of patches.reverse()) {
    try {
      if (patch.descriptor) Object.defineProperty(patch.target, patch.name, patch.descriptor);
      else if (!Reflect.deleteProperty(patch.target, patch.name))
        throw new Error('Could not restore Image property ' + patch.name);
    } catch (error) {
      errors.push(error);
    }
  }
  // Keep the Vue error recorder installed through destruction and queued work.
  try {
    await Promise.resolve();
    await Vue2.nextTick();
  } catch (error) {
    errors.push(error);
  }
  try {
    if (errorHandlerPatched) Vue2.config.errorHandler = previousErrorHandler;
  } catch (error) {
    errors.push(error);
  }
  trace.vueErrors = vueErrors;
  trace.events = events;
  try {
    captureImageEdge(label, trace);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(
      errors,
      'Image edge assertion, Vue callback, cleanup or capture failed'
    );
}

describe('Image native edge semantics', () => {
  it('reports a displayable cached image before syncRead returns in the same callback', async () => {
    await imageEdgeConsumer(
      'image-edge-cache-trace',
      ({ image, instance, events, trace, patch }) => {
        let decodeCalls = 0;
        patch('complete', { configurable: true, get: () => true });
        patch('naturalWidth', { configurable: true, get: () => 1 });
        patch('decode', {
          configurable: true,
          value: () => {
            ++decodeCalls;
            return new Promise<void>(() => {});
          },
        });
        // No await or microtask flush between sync and the snapshot returned from
        // that same authored callback. A queued completion must fail this oracle.
        const immediate = method(
          method(instance, 'getExposes'),
          'syncRead',
          'image:cached',
          'Cached image',
          'informative'
        );
        trace.immediate = {
          snapshot: immediate,
          source: image.getAttribute('src'),
          decodeCalls,
          events: [...events],
        };
        expect(immediate).toEqual({
          source: 'image:cached',
          loadingStatus: 'loaded',
          fit: 'cover',
        });
        expect(decodeCalls).toBe(0);
        expect(events.map((event) => field(event, 'status'))).toEqual(['loading', 'loaded']);
      }
    );
  });

  it('fails closed for contradictory accessibility patches and recovers on valid input', async () => {
    await imageEdgeConsumer(
      'image-edge-accessibility-trace',
      ({ image, instance, trace, patch }) => {
        let decodeCalls = 0;
        patch('complete', { configurable: true, get: () => false });
        patch('naturalWidth', { configurable: true, get: () => 0 });
        patch('decode', {
          configurable: true,
          value: () => {
            ++decodeCalls;
            return new Promise<void>(() => {});
          },
        });
        const syncRead = (source: string, alternativeText: string, mode: string) => {
          const snapshot = method(
            method(instance, 'getExposes'),
            'syncRead',
            source,
            alternativeText,
            mode
          );
          return {
            snapshot,
            source: image.getAttribute('src'),
            alt: image.alt,
            fit: image.style.objectFit,
            decodeCalls,
          };
        };
        const missingAlternative = syncRead('image:informative', '', 'informative');
        const informativeRecovery = syncRead('image:informative', 'An image', 'informative');
        const contradictoryDecorative = syncRead(
          'image:decorative',
          'Contradictory text',
          'decorative'
        );
        const decorativeRecovery = syncRead('image:decorative', '', 'decorative');
        trace.patches = {
          missingAlternative,
          informativeRecovery,
          contradictoryDecorative,
          decorativeRecovery,
        };
        expect(missingAlternative).toEqual({
          snapshot: { source: '', loadingStatus: 'idle', fit: 'cover' },
          source: null,
          alt: '',
          fit: 'cover',
          decodeCalls: 0,
        });
        expect(informativeRecovery).toEqual({
          snapshot: { source: 'image:informative', loadingStatus: 'loading', fit: 'cover' },
          source: 'image:informative',
          alt: 'An image',
          fit: 'cover',
          decodeCalls: 1,
        });
        expect(contradictoryDecorative).toEqual({
          snapshot: { source: '', loadingStatus: 'idle', fit: 'cover' },
          source: null,
          alt: '',
          fit: 'cover',
          decodeCalls: 1,
        });
        expect(decorativeRecovery).toEqual({
          snapshot: { source: 'image:decorative', loadingStatus: 'loading', fit: 'cover' },
          source: 'image:decorative',
          alt: '',
          fit: 'cover',
          decodeCalls: 2,
        });
      }
    );
  });
});
