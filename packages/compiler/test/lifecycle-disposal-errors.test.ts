// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { writeArtifactSet } from '../src/artifact-output';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { mountNativeOwner, type NativeOwnerHandle } from './native-owner-consumer';

type DisposalCase = {
  name: string;
  statement: string;
  fails: boolean;
  value?: unknown;
  errorMessage?: string;
};
const cases: DisposalCase[] = [
  { name: 'zero', statement: 'throw 0;', fails: true, value: 0 },
  { name: 'negative zero', statement: 'throw -0;', fails: true, value: -0 },
  { name: 'false', statement: 'throw false;', fails: true, value: false },
  { name: 'empty string', statement: "throw '';", fails: true, value: '' },
  { name: 'null', statement: 'throw null;', fails: true, value: null },
  { name: 'undefined', statement: 'throw undefined;', fails: true, value: undefined },
  { name: 'NaN', statement: 'throw 0 / 0;', fails: true, value: NaN },
  {
    name: 'truthy string',
    statement: "throw 'disposal control';",
    fails: true,
    value: 'disposal control',
  },
  {
    name: 'Error',
    statement: "throw new Error('disposal control');",
    fails: true,
    errorMessage: 'disposal control',
  },
  { name: 'normal return', statement: '', fails: false },
];

function source(testCase: DisposalCase) {
  return `import {definePrototype,delay} from '@proto.ui/core';
export default definePrototype({name:'disposal-errors',setup(def){
  const audit={first:0,second:0,delayed:0};
  const count=def.state.numberDiscrete('count',1);
  def.expose.value('audit',audit);
  def.expose.state('count',count);
  def.expose.method('alive',()=>42);
  def.lifecycle.onBeforeDispose(()=>{
    audit.first=audit.first+1;
    delay(50,()=>{audit.delayed=audit.delayed+1;});
    ${testCase.statement}
  });
  def.lifecycle.onBeforeDispose(()=>{
    audit.second=audit.second+1;
    delay(51,()=>{audit.delayed=audit.delayed+1;});
  });
  return r=>r.el('output',[r.slot()]);
}});`;
}

const directories: string[] = [];
const mountedRoots = new Set<Root>();
const cleanups: (() => Promise<void>)[] = [];

/** Deliver the host microtask boundary explicitly so a thrown undefined remains observable. */
function unmountReact(root: Root): unknown[] {
  const errors: unknown[] = [];
  const tasks: (() => void)[] = [];
  const microtask = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
    tasks.push(task);
  });
  const observe = (task: () => void) => {
    try {
      task();
    } catch (error) {
      errors.push(error);
    }
  };
  try {
    observe(() => React.act(() => root.unmount()));
    mountedRoots.delete(root);
    let delivered = 0;
    while (tasks.length) {
      if (++delivered > 100) throw new Error('React unmount did not settle within 100 microtasks.');
      observe(tasks.shift()!);
    }
  } finally {
    microtask.mockRestore();
  }
  return errors;
}

afterEach(async () => {
  const errors: unknown[] = [];
  const complete = async (cleanup: () => unknown) => {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  };
  try {
    for (const root of [...mountedRoots]) await complete(() => errors.push(...unmountReact(root)));
    for (const cleanup of cleanups.splice(0).reverse()) await complete(cleanup);
    for (const directory of directories.splice(0))
      await complete(() => rm(directory, { recursive: true, force: true }));
  } finally {
    await complete(() => vi.restoreAllMocks());
    await complete(() => vi.useRealTimers());
    await complete(() => document.body.replaceChildren());
  }
  if (errors.length) throw new AggregateError(errors, 'Disposal test cleanup failed.');
});

async function loadReact(authored: string, ssr = false) {
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'disposal-errors-'));
  directories.push(directory);
  const output = path.join(directory, 'output');
  let filename: string;
  if (ssr) {
    // The existing direct SSR experiment remains separate from public profile admission.
    const parsed = parsePrototype(authored);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitReactSource(parsed.value, { ssr: true });
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const written = await writeArtifactSet(
      [
        { path: 'generated.tsx', contents: emitted.value.code, kind: 'source' },
        ...(emitted.value.supportingFiles ?? []),
      ],
      output
    );
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    filename = path.join(output, 'generated.tsx');
  } else {
    const profile = 'react-dom-source-v1';
    const compiled = compilePrototype(authored, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const written = await writeCompilation(compiled.value, output);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    filename = path.join(output, generatedSourcePath(profile));
  }
  return import(/* @vite-ignore */ filename);
}

function watchPrivateCleanup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const schedule = vi.spyOn(globalThis, 'setTimeout');
  const cancel = vi.spyOn(globalThis, 'clearTimeout');
  return (testCase: DisposalCase) => {
    // These timers are created during beforeDispose, after ordinary view detachment.
    // Cancellation therefore witnesses private terminal cleanup after the callback fails.
    for (const duration of [50, 51]) {
      const scheduled = schedule.mock.calls.flatMap((args, index) =>
        args[1] === duration ? [schedule.mock.results[index].value] : []
      );
      expect(scheduled).toHaveLength(duration === 50 || !testCase.fails ? 1 : 0);
      for (const timer of scheduled) expect(cancel).toHaveBeenCalledWith(timer);
    }
    vi.advanceTimersByTime(100);
  };
}

function expectFailure(errors: unknown[], testCase: DisposalCase) {
  expect(errors).toHaveLength(testCase.fails ? 1 : 0);
  if (!testCase.fails) return;
  if (testCase.errorMessage) {
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe(testCase.errorMessage);
  } else expect(Object.is(errors[0], testCase.value)).toBe(true);
}

for (const profile of ['react-dom-source-v1', 'vue2-source-v1'] as const) {
  describe(`${profile} ordinary terminal disposal`, () => {
    it.each(cases)('preserves $name and retires the owner', async (testCase) => {
      const privateCleanup = watchPrivateCleanup();
      let handle: NativeOwnerHandle;
      let dispose: () => Promise<unknown[]>;
      const previousErrorHandler = Vue2.config.errorHandler;
      const errors: unknown[] = [];
      try {
        if (profile === 'react-dom-source-v1') {
          (
            globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
          ).IS_REACT_ACT_ENVIRONMENT = true;
          const generated = await loadReact(source(testCase));
          const host = document.createElement('div');
          document.body.append(host);
          const root = createRoot(host);
          mountedRoots.add(root);
          const ref = React.createRef<NativeOwnerHandle>();
          await React.act(async () => {
            root.render(React.createElement(generated.CompiledComponent, { ref }));
          });
          handle = ref.current!;
          dispose = async () => unmountReact(root);
        } else {
          Vue2.config.errorHandler = (error) => {
            errors.push(error);
          };
          const owner = await mountNativeOwner(source(testCase), profile);
          cleanups.push(async () => {
            const previous = Vue2.config.errorHandler;
            Vue2.config.errorHandler = (error) => {
              errors.push(error);
            };
            try {
              await owner.dispose();
            } finally {
              Vue2.config.errorHandler = previous;
            }
          });
          handle = owner.handle;
          dispose = async () => {
            await owner.dispose();
            return errors;
          };
        }
        const exposed = handle.getExposes();
        expect(exposed.count.get()).toBe(1);
        expect(exposed.alive()).toBe(42);
        const observed = await dispose();
        expect(exposed.audit.first).toBe(1);
        expect(exposed.audit.second).toBe(testCase.fails ? 0 : 1);
        privateCleanup(testCase);
        expect(exposed.audit.delayed).toBe(0);
        expect(() => exposed.count.get()).toThrow(/dispos|alive|terminal/i);
        expect(() => exposed.alive()).toThrow(/dispos|alive|terminal/i);
        expectFailure(observed, testCase);
      } finally {
        Vue2.config.errorHandler = previousErrorHandler;
      }
    });
  });
}

describe('existing direct React SSR owner disposal', () => {
  it.each(cases)('preserves $name inside the established request aggregate', async (testCase) => {
    const privateCleanup = watchPrivateCleanup();
    const generated = await loadReact(source(testCase), true);
    const errors: unknown[] = [];
    let result: { html: string } | undefined;
    try {
      result = generated.renderGeneratedToString();
    } catch (error) {
      errors.push(error);
    }
    privateCleanup(testCase);
    if (!testCase.fails) {
      expect(errors).toEqual([]);
      expect(result?.html).toContain('<output');
      return;
    }
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(AggregateError);
    const aggregate = errors[0] as AggregateError;
    expect(aggregate.message).toBe('[SSR] request cleanup failed.');
    expectFailure(aggregate.errors, testCase);
  });
});
