// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

async function mount(body: string, declarations = '') {
  const source = `import { definePrototype, createContextKey } from '@proto.ui/core';
    ${declarations}
    export default definePrototype({ name: 'runtime-public-consumer', setup(def) {
      ${body}
      return r => r.el('div', []);
    }});`;
  return mountSource(source);
}

async function mountSource(source: string) {
  const compiled = compilePrototype(source, { profile: 'react-runtime-v1' });
  expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.diagnostics)).toBe(true);
  if (!compiled.ok) throw new Error('expected admitted runtime source');
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, 'review-runtime-public-'));
  const directory = path.join(temporary, 'output');
  cleanup.push(async () => {
    await rm(temporary, { recursive: true, force: true });
  });
  const written = await writeCompilation(compiled.value, directory);
  expect(written.ok, JSON.stringify(written.ok ? {} : written.diagnostics)).toBe(true);
  const generated = await import(
    /* @vite-ignore */ path.join(directory, generatedSourcePath('react-runtime-v1'))
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<{ getExposes(): Record<string, any> }>();
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    try {
      await React.act(async () => root.unmount());
    } finally {
      host.remove();
      await rm(temporary, { recursive: true, force: true });
    }
  };
  cleanup.push(dispose);
  await React.act(async () =>
    root.render(React.createElement(generated.CompiledComponent, { ref }))
  );
  expect(ref.current).toBeDefined();
  return { handle: ref.current!, dispose };
}

it('enters the owner callback for a generated runtime method result and rejects it after disposal', async () => {
  const owner = await mount(`
    const count = def.state.numberDiscrete('count', 0);
    const increment = () => { count.set(count.get() + 1); return count.get(); };
    def.expose.method('factory', () => increment);
  `);
  const increment = owner.handle.getExposes().factory();
  await React.act(async () => {
    expect(increment()).toBe(1);
  });
  await owner.dispose();
  expect(() => increment()).toThrow(/dispos|alive|terminal/i);
});

it('preserves callable record identity and refreshes data across generated runtime public boundaries', async () => {
  const owner = await mount(`
    let count = 0;
    const record = { value: 0, increment: () => ++count };
    def.expose.value('record', record);
    def.expose.method('read', () => record);
    def.expose.method('step', () => { record.value = record.value + 1; return record.value; });
  `);
  const api = owner.handle.getExposes();
  const before = api.read();
  expect(before).toBe(api.record);
  expect(before.increment()).toBe(1);
  expect(api.step()).toBe(1);
  const after = api.read();
  expect(after).toBe(before);
  expect(after.value).toBe(1);
  const increment = after.increment;
  await owner.dispose();
  expect(() => increment()).toThrow(/dispos|alive|terminal/i);
});

it('retains pure-data and nominal identity without exposing a mutable registry', async () => {
  const owner = await mount(
    `
    const data = { value: 1 };
    def.expose.value('data', data);
    def.expose.method('readData', () => data);
    def.expose.value('key', KEY);
    def.expose.value('other', OTHER);
    def.expose.method('readKey', () => KEY);
  `,
    `const KEY = createContextKey<{ value: number }>('same');
      const OTHER = createContextKey<{ value: number }>('same');`
  );
  const api = owner.handle.getExposes();
  expect(api.readData()).toBe(api.data);
  expect(api.readKey()).toBe(api.key);
  expect(api.other).not.toBe(api.key);
  const original = api.readData;
  api.readData = () => ({ value: 999 });
  expect(owner.handle.getExposes().readData).toBe(original);
});

it('keeps recorded borrowed-State notifications after a sibling throws', async () => {
  const source = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures/reviewer-borrowed-notification.proto.ts'
    ),
    'utf8'
  );
  const owner = await mountSource(source);
  const api = owner.handle.getExposes();
  let failure: unknown = 'missing';
  try {
    api.write(1);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBe(0);
  expect(api.trace()).toBe('a1,b1,a2,b2,');
  api.write(3);
  expect(api.trace()).toBe('a1,b1,a2,b2,a3,b3,');
});

it('preserves previously projected record and callable identities across a public round trip', async () => {
  const source = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures/reviewer-public-roundtrip.proto.ts'
    ),
    'utf8'
  );
  const owner = await mountSource(source);
  const api = owner.handle.getExposes();
  const record = api.getRecord();
  expect(api.echoRecord(record)).toBe(record);
  expect(api.echoRecord(record).action).toBe(record.action);
  const callable = api.getFunction();
  expect(api.echoFunction(callable)).toBe(callable);
  expect(callable()).toBe(7);
});

it('resolves a forward State watcher disposer and cancels its recorded third notification', async () => {
  const source = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures/reviewer-forward-state-watch.proto.ts'
    ),
    'utf8'
  );
  const owner = await mountSource(source);
  const api = owner.handle.getExposes();
  let failure: unknown = 'missing';
  try {
    api.write(1);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBe(0);
  expect(api.trace()).toBe('a1,b1,a2,b2,');
  api.write(3);
  expect(api.trace()).toBe('a1,b1,a2,b2,a3,');
});

it('guards a newly assigned callable when an already-projected record crosses the public boundary again', async () => {
  const source = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures/reviewer-projected-record-mutation.proto.ts'
    ),
    'utf8'
  );
  const owner = await mountSource(source);
  const api = owner.handle.getExposes();
  const before = api.getRecord();
  const after = api.replaceRecord(before);
  expect(after).toBe(before);
  const action = after.action;
  expect(action()).toBe(9);
  await owner.dispose();
  expect(() => action()).toThrow(/dispos|alive|terminal/i);
});
