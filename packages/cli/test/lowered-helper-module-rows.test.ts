import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rows = "export const ROWS = ['left', 'right'] as const;";
const rule = `for (const profile of ROWS) {
  def.rule({ when: w => w.state(direction).eq(profile),
    intent: i => i.feedback.style.use(tw('bg-primary')) });
}`;
const state = `const direction = def.state.string('direction', 'left');
  def.expose.state('direction', direction);`;
const entry = `import { definePrototype, tw } from '@proto.ui/core';
  import { ROWS } from './rows';
  export default definePrototype({ name: 'finite-rows', setup(def) { ${state} ${rule} } });`;
const helperEntry = `import { definePrototype } from '@proto.ui/core';
  import { paint } from './visual';
  export default definePrototype({ name: 'finite-rows', setup(def) { paint(def); } });`;

describe('helper module rows retain their proven initialization and ownership', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-finite-module-rows-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const observe = async (changes: Record<string, string> = {}) => {
    const texts = { 'rows.ts': rows, 'entry.proto.ts': entry, ...changes };
    const files: string[] = [];
    for (const [file, text] of Object.entries(texts)) {
      const absolute = path.join(directory, file);
      await writeFile(absolute, text);
      files.push(absolute);
    }
    const inventory = scanRuleStateReadInventory(files);
    const tokens = await collectProtoStyleTokensFromFiles([path.join(directory, 'entry.proto.ts')]);
    return {
      inventory,
      unresolved: inventory.evaluated.flatMap((item) => item.unresolved),
      variants: tokens.filter((token) => token.includes('data-[') && token.endsWith(':bg-primary')),
    };
  };
  const covered = (result: Awaited<ReturnType<typeof observe>>, names = ['left', 'right']) => {
    expect(result.unresolved).toEqual([]);
    expect(result.variants).toEqual(
      names.map((name) => `data-[direction=${name}]:bg-primary`).sort()
    );
    expect(result.variants).not.toContain(
      'data-[direction=left]:data-[direction=right]:bg-primary'
    );
  };
  const unresolved = (result: Awaited<ReturnType<typeof observe>>) => {
    expect(result.unresolved).toEqual([
      { reason: 'comparison', expression: 'w.state(direction).eq(profile)' },
    ]);
  };

  const visual = (declarations = 'export const ALIAS = ROWS;', before = '', after = '') =>
    `import { tw } from '@proto.ui/core'; import { ROWS } from './rows';
      ${declarations}
      export function paint(def) { ${state} ${before}
        ${rule.replace('of ROWS', 'of ALIAS')} ${after} }`;

  for (const [name, declarations] of [
    ['the imported list', 'export const ALIAS = ROWS;'],
    ['a local alias chain', 'const FIRST = ROWS; export const ALIAS = FIRST;'],
    ['a complete literal list', "export const ALIAS = ['left', 'right'] as const;"],
    [
      'a complete spread list',
      "const FIRST = ['left'] as const; export const ALIAS = [...FIRST, 'right'];",
    ],
  ]) {
    it(`rebuilds only proven const rows for a helper reading ${name}`, async () => {
      const result = await observe({
        'visual.ts': visual(declarations),
        'entry.proto.ts': helperEntry,
      });
      covered(result);
      expect(result.inventory.evaluated).toHaveLength(2);
      expect(
        result.inventory.evaluated.every(
          (item) =>
            item.rule.file === path.join(directory, 'visual.ts') &&
            item.callPath.length === 1 &&
            !item.declarationOnly
        )
      ).toBe(true);
    });
  }

  for (const [name, declarations, before, after] of [
    ['a mutable alias', 'export let ALIAS = ROWS;', '', ''],
    ['an opaque alias initializer', 'export const ALIAS = external();', '', ''],
    ['a list handed to an unknown caller', 'export const ALIAS = ROWS;', 'mutate(ALIAS);', ''],
    ['a later member write', 'export const ALIAS = ROWS;', '', "ALIAS[0] = 'changed';"],
    [
      'a deferred escape',
      'export const ALIAS = ROWS;',
      '',
      'def.lifecycle.onCreated(() => mutate(ALIAS));',
    ],
    [
      'a forward module alias',
      "export const ALIAS = LATER; const LATER = ['left', 'right'] as const;",
      '',
      '',
    ],
  ]) {
    it(`does not rebuild ${name} while replaying a helper`, async () => {
      unresolved(
        await observe({
          'visual.ts': visual(declarations, before, after),
          'entry.proto.ts': helperEntry,
        })
      );
    });
  }

  it('does not certify an alias after a no-argument imported helper mutates the same rows', async () => {
    const result = await observe({
      'mutator.ts': `import { ROWS } from './rows';
        export function mutateRows() { ROWS[0] = unknown(); }`,
      'visual.ts':
        `import { mutateRows } from './mutator';\n` +
        visual('export const ALIAS = ROWS;', 'mutateRows();'),
      'entry.proto.ts': helperEntry,
    });
    unresolved(result);
    expect(result.variants).not.toContain('data-[direction=left]:bg-primary');
  });
});
