import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createContextKey } from '../../core/src/context';
import { definePrototype } from '../../core/src/prototype';
import { constantModuleHasUnmodeledEffects } from '../src/services/constant-module-effects';
import {
  scanRuleStateReadInventory,
  scanRuleStateReads,
} from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rows = "export const ROWS = ['left', 'right'] as const;";
const entry = `import { definePrototype, tw } from '@proto.ui/core';
  import { ROWS } from './rows';
  export default definePrototype({ name: 'core-constant-rows', setup(def) {
    const direction = def.state.string('direction', 'left');
    def.expose.state('direction', direction);
    for (const profile of ROWS) {
      def.rule({ when: w => w.state(direction).eq(profile),
        intent: i => i.feedback.style.use(tw('bg-primary')) });
    }
  } });`;
const expectedRows = ['data-[direction=left]:bg-primary', 'data-[direction=right]:bg-primary'];
const sourceFile = (file: string, text: string) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

describe('the actual Core constructors used by constant-module admission', () => {
  it('creates a fresh frozen context key without changing caller data', () => {
    const first = createContextKey<{ value: string }>('constant-row-context');
    const second = createContextKey<{ value: string }>('constant-row-context');
    expect(first).not.toBe(second);
    expect(first).toEqual({ __brand: 'ContextKey', debugName: 'constant-row-context' });
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('initializes only the fresh prototype config and never invokes its setup', () => {
    const sharedRows = ['left', 'right'];
    const setup = vi.fn(() => {
      sharedRows[0] = 'changed';
    });
    const config = { name: 'constant-row-prototype', setup };
    const prototype = definePrototype(config);
    expect(prototype).toBe(config);
    expect(setup).not.toHaveBeenCalled();
    expect(sharedRows).toEqual(['left', 'right']);
    expect(prototype.modules).toEqual([]);
    expect(Object.isFrozen(prototype.modules)).toBe(true);
  });
});

describe('finite rows beside narrowly modeled Core construction', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-core-constant-rows-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const observe = async (sibling: string, changes: Record<string, string> = {}) => {
    const texts = {
      'rows.ts': `${rows}\n${sibling}`,
      'entry.proto.ts': entry,
      'setup.ts': 'export function setup() {}',
      'foreign.ts':
        'export function createContextKey(value) { return value; } export function definePrototype(value) { return value; }',
      ...changes,
    };
    const files: string[] = [];
    for (const [file, text] of Object.entries(texts)) {
      const absolute = path.join(directory, file);
      await writeFile(absolute, text);
      files.push(absolute);
    }
    const inventory = scanRuleStateReadInventory(files);
    const tokens = await collectProtoStyleTokensFromFiles([path.join(directory, 'entry.proto.ts')]);
    return {
      effects: constantModuleHasUnmodeledEffects(
        sourceFile(path.join(directory, 'rows.ts'), texts['rows.ts'])
      ),
      unresolved: inventory.evaluated.flatMap((item) => item.unresolved),
      variants: tokens.filter((token) => token.includes('data-[') && token.endsWith(':bg-primary')),
    };
  };
  const covered = (result: Awaited<ReturnType<typeof observe>>) => {
    expect(result.effects).toBe(false);
    expect(result.unresolved).toEqual([]);
    expect(result.variants).toEqual(expectedRows);
    expect(result.variants).not.toContain(
      'data-[direction=left]:data-[direction=right]:bg-primary'
    );
  };
  const rejected = (result: Awaited<ReturnType<typeof observe>>) => {
    expect(result.effects).toBe(true);
    expect(result.unresolved).toEqual([
      { reason: 'comparison', expression: 'w.state(direction).eq(profile)' },
    ]);
    expect(result.variants).toEqual([]);
  };

  for (const [name, sibling] of [
    [
      'a literal context key',
      "import { createContextKey } from '@proto.ui/core'; export const KEY = createContextKey('row-context');",
    ],
    [
      'an immutable context-name alias',
      "import { createContextKey } from '@proto.ui/core'; const NAME = 'row-context'; const ALIAS = NAME; export const KEY = createContextKey(ALIAS);",
    ],
    [
      'a fresh method setup',
      "import { definePrototype } from '@proto.ui/core'; const holder = definePrototype({ name: 'row-holder', setup() {} });",
    ],
    [
      'a local function declaration',
      "import { definePrototype } from '@proto.ui/core'; const holder = definePrototype({ name: 'row-holder', setup }); function setup() {}",
    ],
    [
      'a prior const function',
      "import { definePrototype } from '@proto.ui/core'; const setup = () => {}; const holder = definePrototype({ name: 'row-holder', setup });",
    ],
    [
      'the passive default-export form',
      "import { definePrototype } from '@proto.ui/core'; import { setup } from './setup'; const holder = definePrototype({ name: 'row-holder', setup }); export default holder;",
    ],
  ]) {
    it(`preserves exact row variants beside ${name}`, async () => {
      covered(await observe(sibling));
    });
  }

  for (const factory of ['createContextKey', 'definePrototype']) {
    const argument =
      factory === 'createContextKey' ? "'row-context'" : "{ name: 'row-holder', setup() {} }";
    for (const [name, imports, call, tail] of [
      ['a foreign same-named function', `import { ${factory} } from './foreign';`, factory, ''],
      ['a local same-named function', `function ${factory}(value) { return value; }`, factory, ''],
      [
        'a different Core export',
        `import { other as ${factory} } from '@proto.ui/core';`,
        factory,
        '',
      ],
      ['a default Core import', `import ${factory} from '@proto.ui/core';`, factory, ''],
      ['a type-only import', `import type { ${factory} } from '@proto.ui/core';`, factory, ''],
      ['a namespace call', "import * as Core from '@proto.ui/core';", `Core.${factory}`, ''],
      ['an optional call', `import { ${factory} } from '@proto.ui/core';`, `${factory}?.`, ''],
      [
        'a rebound import',
        `import { ${factory} } from '@proto.ui/core';`,
        factory,
        `function replace() { ${factory} = foreign; }`,
      ],
      [
        'a shadowed import',
        `import { ${factory} } from '@proto.ui/core';`,
        factory,
        `function shadow(${factory}) { return ${factory}; }`,
      ],
    ]) {
      it(`does not infer ${factory} effects from ${name}`, async () => {
        rejected(await observe(`${imports}\nconst holder = ${call}(${argument});\n${tail}`));
      });
    }
  }

  for (const [name, sibling] of [
    ['an unknown context-name value', 'const KEY = createContextKey(unknown);'],
    [
      'a context-name getter read',
      "const input = { get name() { mutateRows(); return 'name'; } }; const KEY = createContextKey(input.name);",
    ],
    ['a mutable context name', "let NAME = 'name'; const KEY = createContextKey(NAME);"],
    [
      'a context name initialized later',
      "const KEY = createContextKey(NAME); const NAME = 'name';",
    ],
    ['a spread context argument', "const KEY = createContextKey(...['name']);"],
    ['an extra context argument', "const KEY = createContextKey('name', ROWS);"],
    [
      'an unrelated top-level getter',
      "const KEY = createContextKey('name'); const extra = unknown.value;",
    ],
    [
      'an unrelated computed-key coercion',
      "const KEY = createContextKey('name'); const extra = { [{ toString() { mutateRows(); return 'x'; } } as any]: 'value' };",
    ],
    [
      'an unrelated destructuring default',
      "const KEY = createContextKey('name'); const { missing = mutateRows() } = {};",
    ],
  ]) {
    it(`keeps ${name} opaque in scanner and collector`, async () => {
      rejected(await observe(`import { createContextKey } from '@proto.ui/core'; ${sibling}`));
    });
  }

  for (const [name, sibling, setupSource] of [
    [
      'a shared config argument',
      "const config = { name: 'row-holder', setup() {} }; const holder = definePrototype(config);",
      '',
    ],
    [
      'a shared modules argument',
      "const holder = definePrototype({ name: 'row-holder', setup() {}, modules: ROWS });",
      '',
    ],
    ['a spread config', "const holder = definePrototype({ name: 'row-holder', ...unknown });", ''],
    [
      'a prototype setter carrier',
      "const holder = definePrototype({ name: 'row-holder', setup() {}, __proto__: unknown });",
      '',
    ],
    [
      'a computed config name',
      "const holder = definePrototype({ [mutateRows()]: 'row-holder', setup() {} });",
      '',
    ],
    [
      'a setup getter',
      "const holder = definePrototype({ name: 'row-holder', get setup() { mutateRows(); return () => {}; } });",
      '',
    ],
    [
      'an unknown setup value',
      "const holder = definePrototype({ name: 'row-holder', setup: unknown });",
      '',
    ],
    [
      'an invoked setup producer',
      "const holder = definePrototype({ name: 'row-holder', setup: createSetup() });",
      '',
    ],
    [
      'a setup member read',
      "const holder = definePrototype({ name: 'row-holder', setup: unknown.setup });",
      '',
    ],
    [
      'a setup initialized later',
      "const holder = definePrototype({ name: 'row-holder', setup }); const setup = () => {};",
      '',
    ],
    [
      'a mutable setup binding',
      "let setup = () => {}; const holder = definePrototype({ name: 'row-holder', setup });",
      '',
    ],
    [
      'a rebound function declaration',
      "function setup() {} function replace() { setup = foreign; } const holder = definePrototype({ name: 'row-holder', setup });",
      '',
    ],
    [
      'an imported unknown setup',
      "import { setup } from './setup'; const holder = definePrototype({ name: 'row-holder', setup });",
      'export const setup = unknown;',
    ],
    [
      'an imported setup getter',
      "import { setup } from './setup'; const holder = definePrototype({ name: 'row-holder', setup });",
      'export const setup = unknown.setup;',
    ],
    [
      'a rebound imported function',
      "import { setup } from './setup'; const holder = definePrototype({ name: 'row-holder', setup });",
      'export function setup() {} function replace() { setup = unknown; }',
    ],
    [
      'an unknown default export',
      "const holder = definePrototype({ name: 'row-holder', setup() {} }); export default unknown;",
      '',
    ],
    [
      'a default-export getter',
      "const holder = definePrototype({ name: 'row-holder', setup() {} }); export default unknown.value;",
      '',
    ],
    [
      'a default-export call',
      "const holder = definePrototype({ name: 'row-holder', setup() {} }); export default mutateRows();",
      '',
    ],
    [
      'a default export initialized later',
      "export default holder; const holder = definePrototype({ name: 'row-holder', setup() {} });",
      '',
    ],
  ]) {
    it(`does not admit ${name} as passive prototype construction`, async () => {
      rejected(
        await observe(
          `import { definePrototype } from '@proto.ui/core'; ${sibling}`,
          setupSource ? { 'setup.ts': setupSource } : {}
        )
      );
    });
  }

  it('classifies the real style-scope context and passive prototype modules as modeled', async () => {
    for (const relative of ['context.ts', 'root.proto.ts']) {
      const file = path.join(ROOT, 'packages/prototypes/shadcn/src/style-scope', relative);
      const text = await readFile(file, 'utf8');
      expect(constantModuleHasUnmodeledEffects(sourceFile(file, text)), relative).toBe(false);
    }
  });

  const profiles = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea', 'new-york-v4'];
  for (const [name, target] of [
    ['direct retained ids module', 'packages/prototypes/shadcn/src/style-scope/ids.ts'],
    ['real public style-scope barrel', 'packages/prototypes/shadcn/src/style-scope/index.ts'],
  ]) {
    it(`collects all nine complete finite profile variants through the ${name}`, async () => {
      const relative = path.relative(directory, path.join(ROOT, target));
      const specifier = relative.startsWith('.') ? relative : './' + relative;
      const source = `
        import { definePrototype, tw } from '@proto.ui/core';
        import { SHADCN_STYLE_IDS as IDS } from ${JSON.stringify(specifier)};
        const TOKENS = ${JSON.stringify(Object.fromEntries(profiles.map((profile, index) => [profile, 'p-' + (index + 1)])))};
        export default definePrototype({ name: 'real-finite-style-ids', setup(def) {
          const selected = def.state.enum('profile', 'vega', { options: ${JSON.stringify(profiles)} });
          def.expose.state('profile', selected);
          for (const profile of IDS) {
            def.rule({ when: w => w.state(selected).eq(profile),
              intent: i => i.feedback.style.use(tw(TOKENS[profile])) });
          }
        } });
      `;
      const file = path.join(directory, 'real-barrel-consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      const tokens = await collectProtoStyleTokensFromFiles([file]);
      const variants = tokens.filter((token) => token.startsWith('data-[profile='));
      const expected = profiles
        .map((profile, index) => `data-[profile=${profile}]:p-${index + 1}`)
        .sort();
      expect(scan.unresolved).toEqual([]);
      expect(variants).toEqual(expected);
    });
  }
});
