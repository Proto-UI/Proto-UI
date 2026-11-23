// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeArtifactSet } from '../src/artifact-output';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const roots = new Set<Root>(),
  directories: string[] = [];
const cleanup: (() => void)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) dispose();
  for (const root of roots) await React.act(async () => root.unmount());
  roots.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function load(source: string, exposeOwner = false) {
  const parsed = parsePrototype(source, { fileName: 'owner-failure.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'owner-failure-'));
  directories.push(directory);
  const output = path.join(directory, 'output');
  const written = await writeArtifactSet(
    [
      {
        path: 'Component.tsx',
        kind: 'source',
        contents:
          emitted.value.code +
          (exposeOwner
            ? '\n// Test-only observation seam: unchanged emitted owner, no alternative implementation.\nexport { __puiCreateOwner as observeGeneratedOwner };\n'
            : ''),
      },
      ...(emitted.value.supportingFiles ?? []),
    ],
    output
  );
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  return import(/* @vite-ignore */ path.join(output, 'Component.tsx'));
}

function capture(action: () => void) {
  try {
    action();
    return { failed: false };
  } catch (error) {
    return { failed: true, error };
  }
}
function drainTerminal(action: () => void) {
  const tasks: (() => void)[] = [],
    errors: unknown[] = [];
  const queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
    tasks.push(task);
  });
  const observe = (task: () => void) => {
    const result = capture(task);
    if (result.failed) errors.push(result.error);
  };
  try {
    observe(action);
    let count = 0;
    while (tasks.length) {
      if (++count > 100) throw new Error('Owner did not finish terminal cleanup');
      observe(tasks.shift()!);
    }
  } finally {
    queue.mockRestore();
  }
  return errors;
}

const failedCreation = (statement: string) => `import {definePrototype,delay} from '@proto.ui/core';
export default definePrototype({name:'created-cleanup-consumer',setup(def){
  const failure={code:'created-failure'};
  def.expose.event('created',{payload:'any'});
  def.expose.event('first',{payload:'void'});
  def.expose.event('second',{payload:'void'});
  def.expose.event('late',{payload:'void'});
  def.lifecycle.onCreated(run=>{
    delay(80,()=>run.expose.emit('late'));
    run.expose.emit('created',failure);
    ${statement}
  });
  def.lifecycle.onBeforeDispose(run=>{
    delay(81,()=>run.expose.emit('late'));
    run.expose.emit('first');
    throw new Error('secondary authored cleanup');
  });
  def.lifecycle.onBeforeDispose(run=>{
    delay(82,()=>run.expose.emit('late'));
    run.expose.emit('second');
  });
  return r=>r.el('output','consumer');
}});`;

describe('ordinary generated React client created failure', () => {
  it.each([
    { name: 'undefined', statement: 'throw undefined;', value: undefined },
    { name: 'zero', statement: 'throw 0;', value: 0 },
    { name: 'object identity', statement: 'throw failure;', value: 'captured' },
  ])(
    'preserves $name after exhaustive acquired cleanup and a failing timer release',
    async (testCase) => {
      const { CompiledComponent } = await load(failedCreation(testCase.statement));
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const schedule = vi.spyOn(globalThis, 'setTimeout');
      const nativeClear = globalThis.clearTimeout;
      let failRelease = true;
      const cancelled = vi.spyOn(globalThis, 'clearTimeout').mockImplementation((timer) => {
        nativeClear(timer);
        if (failRelease) {
          failRelease = false;
          throw new Error('secondary timer release');
        }
      });
      const callbacks: string[] = [];
      const host = document.createElement('div');
      document.body.append(host);
      let failure: { error: unknown } | undefined;
      let publishedFailure: unknown;
      const root = createRoot(host, {
        onUncaughtError(error) {
          failure = { error };
        },
      });
      roots.add(root);
      try {
        await React.act(async () =>
          root.render(
            React.createElement(CompiledComponent, {
              onCreated(value: unknown) {
                publishedFailure = value;
                callbacks.push('created');
              },
              onFirst() {
                callbacks.push('first');
              },
              onSecond() {
                callbacks.push('second');
              },
              onLate() {
                callbacks.push('late');
              },
            })
          )
        );
      } catch (error) {
        failure = { error };
      }
      expect(failure).toBeDefined();
      expect(
        Object.is(failure!.error, testCase.value === 'captured' ? publishedFailure : testCase.value)
      ).toBe(true);
      expect(callbacks).toEqual(['created', 'first', 'second']);
      for (const duration of [80, 81, 82]) {
        const calls = schedule.mock.calls.flatMap((args, index) =>
          args[1] === duration ? [schedule.mock.results[index].value] : []
        );
        expect(calls).toHaveLength(1);
        expect(cancelled).toHaveBeenCalledWith(calls[0]);
      }
      vi.advanceTimersByTime(200);
      expect(callbacks).toEqual(['created', 'first', 'second']);
    }
  );
});

const liveOwner = `import {definePrototype,delay,tw} from '@proto.ui/core';
export default definePrototype({name:'retirement-cleanup-consumer',setup(def){
  def.props.define({present:{type:'boolean',default:true},failCleanup:{type:'boolean',default:false}});
  const count=def.state.numberDiscrete('count',0);
  def.expose.state('count',count);
  def.expose.method('read',()=>count.get());
  def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present ?? true));
  def.rule({when:w=>w.meta('preference.forcedColors').eq('active'),intent:i=>i.feedback.style.use(tw('opacity-50'))});
  def.expose.event('created',{payload:'void'});
  def.expose.event('mounted',{payload:'void'});
  def.expose.event('unmounted',{payload:'void'});
  def.expose.event('first',{payload:'void'});
  def.expose.event('second',{payload:'void'});
  def.expose.event('late',{payload:'void'});
  def.lifecycle.onCreated(run=>run.expose.emit('created'));
  def.lifecycle.onMounted(run=>{
    delay(70,()=>run.expose.emit('late'));
    delay(71,()=>run.expose.emit('late'));
    run.expose.emit('mounted');
  });
  def.lifecycle.onUnmounted(run=>run.expose.emit('unmounted'));
  def.lifecycle.onBeforeDispose(run=>{delay(72,()=>run.expose.emit('late'));run.expose.emit('first');if(run.props.get().failCleanup)throw new Error('later authored cleanup');});
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('second'));
  return r=>r.el('output',[count.get(),r.slot()]);
}});`;

function media() {
  const listeners = new Map<string, Set<() => void>>();
  let fail = false;
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(forced-colors: active)',
        addEventListener(_type: string, listener: () => void) {
          const values = listeners.get(query) ?? new Set();
          values.add(listener);
          listeners.set(query, values);
        },
        removeEventListener(_type: string, listener: () => void) {
          listeners.get(query)?.delete(listener);
          if (fail) {
            fail = false;
            throw undefined;
          }
        },
      }) as unknown as MediaQueryList
  );
  return {
    fail: () => {
      fail = true;
    },
    live: () => [...listeners.values()].reduce((count, values) => count + values.size, 0),
    callbacks: () => [...listeners.values()].flatMap((values) => [...values]),
  };
}

it('acknowledges a failed view retirement, cancels old work and remounts the same generated owner', async () => {
  // Isolate the emitted owner acknowledgement boundary; ordinary React would
  // unmount a component after a layout-effect error and obscure this contract.
  const generated = await load(liveOwner, true),
    host = media();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const frames: any[] = [],
    calls: string[] = [];
  const props = {
    present: true,
    onCreated: () => calls.push('created'),
    onMounted: () => calls.push('mounted'),
    onUnmounted: () => calls.push('unmounted'),
    onFirst: () => calls.push('first'),
    onSecond: () => calls.push('second'),
    onLate: () => calls.push('late'),
  };
  const owner = generated.observeGeneratedOwner(
    props,
    (frame: unknown) => frames.push(frame),
    () => null,
    () => {}
  );
  cleanup.push(() => {
    drainTerminal(() => owner.disconnect());
  });
  const element = document.createElement('div');
  document.body.append(element);
  owner.start();
  await Promise.resolve();
  owner.bindRoot(element);
  owner.accept(frames.at(-1));
  const state = owner.handle.getExposes().count,
    read = owner.handle.getExposes().read;
  expect(host.live()).toBe(2);
  const stale = host.callbacks();
  host.fail();
  owner.applyProps({ ...props, present: false });
  await Promise.resolve();
  // Match the host commit before acknowledgement: this non-Overlay view has
  // actually removed its Root. Keeping it bound would request another detach.
  owner.bindRoot(null);
  element.remove();
  expect(capture(() => owner.accept(frames.at(-1)))).toEqual({ failed: true, error: undefined });
  expect(calls).toEqual(['created', 'mounted', 'unmounted']);
  expect(host.live()).toBe(0);
  for (const callback of stale) callback();
  vi.advanceTimersByTime(100);
  await Promise.resolve();
  expect(calls).not.toContain('late');
  owner.applyProps(props);
  await Promise.resolve();
  document.body.append(element);
  owner.bindRoot(element);
  owner.accept(frames.at(-1));
  expect(owner.handle.getExposes().count).toBe(state);
  expect(owner.handle.getExposes().read).toBe(read);
  expect(calls).toEqual(['created', 'mounted', 'unmounted', 'mounted']);
  expect(host.live()).toBe(2);
  const errors = drainTerminal(() => owner.disconnect());
  expect(errors).toEqual([]);
  expect(host.live()).toBe(0);
  expect(() => state.get()).toThrow(/terminal|dispos/i);
  expect(() => read()).toThrow(/terminal|dispos/i);
});

it('finishes ordinary terminal cleanup after Meta and authored errors without running later authored cleanup', async () => {
  const generated = await load(liveOwner),
    host = media();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const calls: string[] = [];
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  roots.add(root);
  const ref = React.createRef<any>();
  await React.act(async () =>
    root.render(
      React.createElement(generated.CompiledComponent, {
        ref,
        failCleanup: true,
        onUnmounted: () => calls.push('unmounted'),
        onFirst: () => {
          calls.push('first');
        },
        onSecond: () => calls.push('second'),
        onLate: () => calls.push('late'),
      })
    )
  );
  const exposed = ref.current.getExposes();
  host.fail();
  const errors = drainTerminal(() => React.act(() => root.unmount()));
  roots.delete(root);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeUndefined();
  expect(calls).toEqual(['unmounted', 'first']);
  expect(host.live()).toBe(0);
  vi.advanceTimersByTime(200);
  expect(calls).toEqual(['unmounted', 'first']);
  expect(() => exposed.count.get()).toThrow(/terminal|dispos/i);
  expect(() => exposed.read()).toThrow(/terminal|dispos/i);
});
