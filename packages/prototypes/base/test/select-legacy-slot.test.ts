import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { afterEach, describe, expect, it } from 'vitest';
import { asSelectItem } from '../src/select';
import { historicalSelectItemSource } from './select-legacy-slot-source';
import {
  followsCommittedRoot,
  mountSelectLegacySlotProbe,
  selectLegacyFamilies,
} from './fixtures/select-legacy-slot';

const directories: string[] = [];
const disposers: (() => void)[] = [];
const settle = async () => {
  for (let i = 0; i < 32; ++i) await Promise.resolve();
};
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  await settle();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const hookConsumer = definePrototype({
  name: 'select-legacy-hook-consumer',
  setup() {
    return asSelectItem().render;
  },
});

async function exercise(
  family: keyof typeof selectLegacyFamilies,
  prototype?: Prototype<any, any>
) {
  const view = mountSelectLegacySlotProbe(family, prototype);
  disposers.push(view.dispose);
  await settle();
  const initial = view.read();
  expect(initial).toMatchObject({
    value: 'alpha',
    selected: [true, false],
    aria: ['true', 'false'],
  });
  expect(initial.writes).toEqual([0, 0]);
  expect(view.write([false, true])).toEqual([false, true]);
  await settle();
  const firstConflict = view.read();
  // Witness the injection itself: a no-op writer is not a passing negative control.
  expect(firstConflict).toMatchObject({
    value: 'alpha',
    legacy: [false, true],
    writes: [1, 1],
    connected: true,
  });
  view.refuse();
  await settle();
  const refused = view.read();
  expect(refused.value).toBe('alpha');
  expect(refused.requests).toEqual([{ value: 'beta', textValue: 'beta', reason: 'programmatic' }]);
  view.commit('beta');
  await settle();
  const committed = view.read();
  expect(committed).toMatchObject({
    value: 'beta',
    selected: [false, true],
    aria: ['false', 'true'],
  });
  expect(view.write([true, false])).toEqual([true, false]);
  await settle();
  const secondConflict = view.read();
  expect(secondConflict).toMatchObject({
    value: 'beta',
    legacy: [true, false],
    writes: [2, 2],
    connected: true,
  });
  view.commit('alpha');
  await settle();
  const repeated = view.read();
  expect(repeated).toMatchObject({
    value: 'alpha',
    selected: [true, false],
    aria: ['true', 'false'],
  });
  return [initial, firstConflict, refused, committed, secondConflict, repeated];
}

describe('#1156 actual retained legacy-slot conflicts', () => {
  it.each(['base', 'shadcn', 'brutalist'] as const)(
    '%s selected/aria-selected follow only committed Root across real conflicting writes',
    async (family) => {
      const snapshots = await exercise(family);
      expect(snapshots.every(followsCommittedRoot)).toBe(true);
    }
  );

  it('keeps the authored asSelectItem entry under the same ownership contract', async () => {
    const snapshots = await exercise('base', hookConsumer);
    expect(snapshots.every(followsCommittedRoot)).toBe(true);
  });

  it('rejects the historical accessor-backed implementation under the identical consumer', async () => {
    const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
    await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'legacy-selected-'));
    directories.push(directory);
    const file = path.join(directory, 'item.proto.ts');
    // Restore exactly the former storage declaration in the current complete
    // implementation. Resolve unchanged relative imports from their real source
    // directory; no mocked Root, A11y projection or manufactured state result.
    await writeFile(file, historicalSelectItemSource());
    const old = await import(/* @vite-ignore */ file);
    const snapshots = await exercise('base', old.default);
    expect(snapshots.map(followsCommittedRoot)).toEqual([true, false, true, true, false, true]);
    expect(snapshots[1]).toMatchObject({
      value: 'alpha',
      selected: [false, true],
      aria: ['false', 'true'],
    });
    expect(snapshots[4]).toMatchObject({
      value: 'beta',
      selected: [true, false],
      aria: ['true', 'false'],
    });
  });
});
