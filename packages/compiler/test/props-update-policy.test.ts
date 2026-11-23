// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { propsPolicySource } from './props-policy-source';
import {
  mountPropsPolicyProbe,
  type PropsPolicyMode,
  type PropsPolicyProbe,
  type PropsPolicySnapshot,
} from './fixtures/differential-browser/props-policy-probe';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const modes: PropsPolicyMode[] = ['adapter-default', 'adapter-explicit', 'compiled-explicit'];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

async function consumer(mode: PropsPolicyMode, watcher: boolean) {
  const generatedRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules'
  );
  await mkdir(generatedRoot, { recursive: true });
  const directory = await mkdtemp(path.join(generatedRoot, 'props-policy-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const source = propsPolicySource(watcher);
  let component: React.ElementType;
  if (mode === 'compiled-explicit') {
    const compiled = compilePrototype(source, { profile: 'react-dom-source-v1' });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    expect(compiled.value.output.provenance.observableSemantics?.props.update).toBe('explicit');
    const output = path.join(directory, 'output');
    const written = await writeCompilation(compiled.value, output);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    const generated = await import(
      /* @vite-ignore */ path.join(output, generatedSourcePath('react-dom-source-v1'))
    );
    component = generated.CompiledComponent;
  } else {
    // Execute the exact same authored source through the independent Runtime
    // Adapter. Do not use the compiler's runtime-backed output as its oracle.
    const original = path.join(directory, 'authored.proto.ts');
    await writeFile(original, source);
    const authored = await import(/* @vite-ignore */ original);
    component = createReactAdapter(React)(
      authored.default,
      mode === 'adapter-explicit' ? { autoUpdateOnPropsChange: false } : {}
    );
  }
  const host = document.createElement('div');
  document.body.append(host);
  let view!: PropsPolicyProbe;
  await React.act(async () => {
    view = mountPropsPolicyProbe(component, host);
  });
  cleanups.push(async () => {
    await React.act(() => view.dispose());
    host.remove();
  });
  expect(view.ready()).toBe(true);
  return view;
}

function expectIdentity(snapshot: PropsPolicySnapshot) {
  expect(snapshot).toMatchObject({
    sameRoot: true,
    sameLabel: true,
    sameChild: true,
    sameHandle: true,
    childText: 'native-child',
  });
  expect(snapshot.phases.filter(({ phase }) => phase === 'created')).toHaveLength(1);
  expect(snapshot.phases.filter(({ phase }) => phase === 'mounted')).toHaveLength(1);
}

describe.each(modes)('#1453 %s Props ownership', (mode) => {
  it.each([false, true])(
    'keeps lawful watcher=%s behavior, identity and lifecycle',
    async (watcher) => {
      const view = await consumer(mode, watcher);
      const initial = view.read();
      expect(initial).toMatchObject({ text: 'first', online: false });
      expect(initial.phases.map(({ phase }) => phase)).toEqual(['created', 'mounted']);
      expectIdentity(initial);

      for (const [label, tone] of [
        ['second', 'online'],
        ['third', 'offline'],
        ['fourth', 'online'],
      ] as const) {
        const before = view.read();
        let invalidated!: PropsPolicySnapshot;
        await React.act(async () => {
          view.write(label, tone);
          invalidated = view.read();
        });
        const received = view.read();
        expectIdentity(received);
        if (mode === 'adapter-explicit') {
          // HC-PROPS-SOURCE-0001-C: host invalidation alone is not delivery.
          expect(invalidated.text).toBe(before.text);
          expect(invalidated.online).toBe(before.online);
          expect(invalidated.phases).toEqual(before.phases);
          // A later callback (including rule-feedback work) may synchronize Props
          // before the next statement. Assert the semantic commit after an
          // explicit synchronization below; do not require permanent staleness.
        } else {
          expect(received.online).toBe(tone === 'online');
          expect(received.text).toBe(mode === 'adapter-default' || watcher ? label : before.text);
        }

        await React.act(async () => view.synchronize());
        const synchronized = view.read();
        expectIdentity(synchronized);
        expect(synchronized.online).toBe(tone === 'online');
        expect(synchronized.text).toBe(mode === 'adapter-default' || watcher ? label : before.text);
        if (!watcher && mode !== 'adapter-default')
          expect(synchronized.phases).toEqual(before.phases);

        await React.act(async () => view.update());
        const committed = view.read();
        expect(committed).toMatchObject({ text: label, online: tone === 'online' });
        expectIdentity(committed);
        const newUpdates = committed.phases
          .slice(before.phases.length)
          .filter(({ phase }) => phase === 'updated');
        expect(newUpdates.length).toBeGreaterThan(0);
        expect(newUpdates.every((entry) => entry.text === label)).toBe(true);

        // A same-value parent render must not manufacture watcher or update cycles.
        await React.act(async () => view.write(label, tone));
        await React.act(async () => view.synchronize());
        expect(view.read()).toEqual(committed);
      }

      const beforeRedundant = view.read();
      await React.act(async () => view.update(6));
      const afterRedundant = view.read();
      expectIdentity(afterRedundant);
      const updates = afterRedundant.phases.slice(beforeRedundant.phases.length);
      expect(updates.length).toBeGreaterThan(0);
      expect(updates.length).toBeLessThanOrEqual(6);
      expect(updates.every((entry) => entry.phase === 'updated' && entry.text === 'fourth')).toBe(
        true
      );
      await React.act(async () => {
        await Promise.resolve();
      });
      expect(view.read()).toEqual(afterRedundant);
      expect(afterRedundant.phases.filter(({ phase }) => phase === 'watch')).toHaveLength(
        watcher ? 3 : 0
      );

      await React.act(() => view.dispose());
      const disposed = view.read();
      expect(disposed.text).toBeNull();
      expect(disposed.phases.filter(({ phase }) => phase === 'unmounted')).toHaveLength(1);
      expect(disposed.phases.filter(({ phase }) => phase === 'beforeDispose')).toHaveLength(1);
      expect(view.retainedTouchRejects()).toBe(true);
    },
    30_000
  );
});
