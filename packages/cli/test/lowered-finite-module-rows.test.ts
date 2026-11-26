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

describe('finite module rows use the same admission as production', () => {
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

  for (const [name, sibling] of [
    ['direct Core literal handle', "export const STYLE = tw('p-2');"],
    [
      'nested Core literal handles',
      "export const STYLE = { a: tw('p-2'), b: { value: tw('h-4') } };",
    ],
    [
      'immutable primitive aliases',
      "const BASE = 'p-2'; const ALIAS = BASE; export const STYLE = tw(ALIAS, 'h-4');",
    ],
  ]) {
    it(`keeps exact imported rows beside ${name}`, async () => {
      covered(
        await observe({ 'rows.ts': `import { tw } from '@proto.ui/core';\n${rows}\n${sibling}` })
      );
    });
  }

  for (const [name, imports, sibling] of [
    [
      'a foreign same-named call',
      "import { tw } from './foreign';",
      "export const STYLE = tw('p-2');",
    ],
    [
      'a same-named local function',
      '',
      "function tw(value) { return value; } export const STYLE = tw('p-2');",
    ],
    [
      'a different Core export',
      "import { other as tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2');",
    ],
    ['a default import', "import tw from '@proto.ui/core';", "export const STYLE = tw('p-2');"],
    [
      'a type-only import',
      "import type { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2');",
    ],
    [
      'an optional call',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw?.('p-2');",
    ],
    [
      'an unknown argument',
      "import { tw } from '@proto.ui/core';",
      'export const STYLE = tw(unknown);',
    ],
    [
      'an effectful argument',
      "import { tw } from '@proto.ui/core';",
      'export const STYLE = tw(mutate(ROWS));',
    ],
    [
      'a getter argument',
      "import { tw } from '@proto.ui/core';",
      "const source = { get value() { return 'p-2'; } }; export const STYLE = tw(source.value);",
    ],
    [
      'a mutable string binding',
      "import { tw } from '@proto.ui/core';",
      "let BASE = 'p-2'; export const STYLE = tw(BASE);",
    ],
    [
      'a string initialized later',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw(BASE); const BASE = 'p-2';",
    ],
    [
      'a spread argument',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw(...['p-2']);",
    ],
    [
      'an unmodeled module statement',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); mutate(ROWS);",
    ],
    [
      'a rebound Core import',
      "import { tw } from '@proto.ui/core';",
      "function replace() { tw = foreign; } export const STYLE = tw('p-2');",
    ],
    [
      'a destructuring default effect',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const { missing = mutateRows() } = {};",
    ],
    [
      'a computed destructuring key',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const { [mutateRows()]: ignored } = {};",
    ],
    [
      'an unmodeled destructuring read',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const { value } = unknown;",
    ],
    [
      'a computed method name',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const object = { [mutateRows()]() {} };",
    ],
    [
      'a computed accessor name',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const object = { get [mutateRows()]() { return 1; } };",
    ],
    [
      'an unrelated getter read',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const value = unknown.value;",
    ],
    [
      'an unrelated coercion',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const value = unknown + 'suffix';",
    ],
    [
      'a computed object key coercion',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const value = { [{ toString() { mutateRows(); return 'x'; } } as any]: 'ok' };",
    ],
    [
      'a computed method key coercion',
      "import { tw } from '@proto.ui/core';",
      "export const STYLE = tw('p-2'); const value = { [{ toString() { mutateRows(); return 'x'; } } as any]() {} };",
    ],
  ]) {
    it(`keeps ${name} unresolved in both paths`, async () => {
      const result = await observe({
        'rows.ts': `${imports}\n${rows}\n${sibling}`,
        'foreign.ts': 'export function tw(value) { return value; }',
      });
      unresolved(result);
      expect(result.variants).toEqual([]);
    });
  }

  it('retains the real eight Select recipe profiles beside their Core StyleHandles', async () => {
    const target = path.relative(
      directory,
      path.join(ROOT, 'packages/prototypes/shadcn/src/select/recipes.ts')
    );
    const specifier = target.startsWith('.') ? target : `./${target}`;
    covered(
      await observe({
        'rows.ts': `export { SELECT_TRANSLUCENT_STYLES as ROWS } from ${JSON.stringify(specifier)};`,
      }),
      ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea']
    );
  });
});
