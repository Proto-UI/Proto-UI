import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';

type FixtureOptions = {
  alias?: boolean;
  imported?: boolean;
  declaration?: string;
  moduleSuffix?: string;
  parameter?: string;
  argument?: string;
  prefix?: string;
  state?: string;
};

describe('module declaration identity during Rule helper replay', () => {
  async function inventory(options: FixtureOptions = {}) {
    const directory = await mkdtemp(path.join(tmpdir(), 'pui-helper-module-binding-'));
    try {
      const producer =
        options.declaration ??
        "const asActual = defineAsHook({ name: 'actual', setup(def) { def.state.bool('ready', false); } });";
      const declarations = `${producer}\n${options.alias ? 'const useActual = asActual;' : ''}\n${options.moduleSuffix ?? ''}`;
      const helper = `export function paint(def${options.parameter ? ', ' + options.parameter : ''}) {
        ${options.prefix ?? ''}
        const facts = ${options.alias ? 'useActual' : 'asActual'}();
        const lookup = facts.getState!;
        def.rule({ when: w => w.state(lookup('${options.state ?? 'ready'}')!).eq(true), intent: i => i.feedback.style.use(tw('bg-accent')) });
      }`;
      const call = `paint(def${options.argument ? ', ' + options.argument : ''});`;
      const entry =
        "import { definePrototype } from '@proto.ui/core';\n" +
        (options.imported
          ? "import { paint } from './paint';\n"
          : "import { defineAsHook, tw } from '@proto.ui/core';\n" +
            declarations +
            '\n' +
            helper +
            '\n') +
        `export default definePrototype({ name: 'helper-consumer', setup(def) { ${call} } });`;
      if (options.imported)
        await writeFile(
          path.join(directory, 'paint.ts'),
          "import { defineAsHook, tw } from '@proto.ui/core';\n" + declarations + '\n' + helper
        );
      const file = path.join(directory, 'entry.proto.ts');
      await writeFile(file, entry);
      return scanRuleStateReadInventory([file]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  it.each<[string, FixtureOptions]>([
    ['local producer', {}],
    ['local constant producer alias', { alias: true }],
    ['imported helper own producer', { imported: true }],
    ['imported helper own alias', { imported: true, alias: true }],
  ])('retains the exact declaration of a %s', async (_label, options) => {
    const result = await inventory(options);
    expect(result.evaluated).toHaveLength(1);
    const row = result.evaluated[0];
    expect(row.callPath).toHaveLength(1);
    expect(row.declarationOnly).toBe(false);
    expect(row.unresolved).toEqual([]);
    expect(
      row.usages.map(({ state, provenance }) => ({
        state,
        declaredName: provenance?.declaredName,
      }))
    ).toEqual([{ state: 'ready', declaredName: 'ready' }]);
    expect(row.usages[0].provenance?.declaration.file).toBe(row.rule.file);
  });

  it.each<[string, FixtureOptions]>([
    ['shadowing helper parameter', { parameter: 'asActual', argument: 'external' }],
    ['shadowing local binding', { prefix: 'const asActual = external;' }],
    ['unknown producer initializer', { declaration: 'const asActual = external;' }],
    [
      'reassigned producer',
      {
        declaration:
          "let asActual = defineAsHook({ name: 'actual', setup(def) { def.state.bool('ready', false); } });",
        moduleSuffix: 'asActual = external;',
      },
    ],
    [
      'deferred producer reassignment',
      {
        declaration:
          "let asActual = defineAsHook({ name: 'actual', setup(def) { def.state.bool('ready', false); } });",
        moduleSuffix: 'export function later() { asActual = external; }',
      },
    ],
    ['undeclared state key', { state: 'missing' }],
  ])('keeps %s unresolved', async (_label, options) => {
    const result = await inventory(options);
    expect(result.evaluated).toHaveLength(1);
    expect(result.evaluated[0].usages).toEqual([]);
    expect(result.evaluated[0].unresolved).toEqual([
      {
        expression: `lookup('${options.state ?? 'ready'}')!`,
        reason: 'subject',
      },
    ]);
  });

  it('retains all five real Base Drawer Handle reads and their declaration provenance', () => {
    const file = path.resolve(
      import.meta.dirname,
      '../../prototypes/base/src/drawer/handle.proto.ts'
    );
    const result = scanRuleStateReadInventory([file]);
    expect(result.files).toEqual([file]);
    expect(result.evaluated).toHaveLength(5);
    expect(result.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
    const usages = result.evaluated.flatMap((row) => row.usages);
    expect(usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asDrawerHandle', state: 'focusVisible' },
      ...Array.from({ length: 4 }, () => ({
        hook: 'asDrawerHandle',
        state: 'side',
      })),
    ]);
    expect(usages.every((usage) => !!usage.provenance?.declaration)).toBe(true);
  });
});
