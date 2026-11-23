// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { recordGetterFixture } from './record-getter-fixture';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

it('keeps real getter behavior and shared module state in the explicit React Runtime profile', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const compiled = compilePrototype(recordGetterFixture, { profile: 'react-runtime-v1' });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, 'record-getter-runtime-'));
  cleanup.push(() => rm(temporary, { recursive: true, force: true }));
  const directory = path.join(temporary, 'output');
  const written = await writeCompilation(compiled.value, directory);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const generated = await import(
    /* @vite-ignore */ path.join(directory, generatedSourcePath('react-runtime-v1'))
  );
  const mount = async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const ref = React.createRef<{ getExposes(): Record<string, any> }>();
    let disposed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      await React.act(async () => root.unmount());
      host.remove();
    };
    cleanup.push(dispose);
    await React.act(async () =>
      root.render(React.createElement(generated.CompiledComponent, { ref }))
    );
    return { api: ref.current!.getExposes(), dispose };
  };
  const first = await mount();
  const second = await mount();
  expect(first.api.reads()).toBe(0);
  expect(second.api.reads()).toBe(0);
  expect(first.api.read()).toBe(1);
  expect(first.api.read()).toBe(2);
  expect(second.api.read()).toBe(1);
  expect(first.api.moduleRead()).toBe(1);
  expect(second.api.moduleRead()).toBe(2);
  expect(first.api.moduleReads()).toBe(2);
  expect(first.api.copy()).toEqual({ first: 3, second: 3, changed: 91, reads: 3 });
  expect(first.api.assign()).toEqual({ first: 4, second: 4, reads: 4 });
  let failure: unknown;
  try {
    first.api.broken();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBe(37);
  const retained = first.api.read;
  await first.dispose();
  expect(() => retained()).toThrow(/dispos|alive|terminal/i);
  expect(second.api.read()).toBe(2);
});
