import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rows = "export const ROWS = ['nova', 'mira'] as const;";
const state = `const active = def.state.enum('profile', 'nova', { options: ['nova', 'mira'] });
  def.expose.state('profile', active);`;
const table = "const TOKENS = { nova: 'bg-primary', mira: 'bg-muted' };";
const rule = (map: boolean) => `for (const profile of ALIAS) {
  def.rule({ when: w => w.state(active).eq(profile),
    intent: i => i.feedback.style.use(tw(${map ? 'TOKENS[profile]' : "'bg-primary'"})) });
}`;

type Fixture = {
  map?: boolean;
  helper?: boolean;
  imports?: string;
  rowImport?: string;
  before?: string;
  files?: Record<string, string>;
};

async function observe({
  map = false,
  helper = false,
  imports = '',
  rowImport = './rows',
  before = '',
  files = {},
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-shared-row-lifetime-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    const visual = `import { tw } from '@proto.ui/core'; import { ROWS } from ${JSON.stringify(rowImport)};
      const ALIAS = ROWS; ${table}
      export function paint(def) { ${state} ${rule(map)} }`;
    const entry = helper
      ? `import { definePrototype } from '@proto.ui/core'; import { paint } from './visual';
        ${imports}
        export default definePrototype({ name: 'shared-rows', setup(def) { ${before} paint(def); } });`
      : `import { definePrototype, tw } from '@proto.ui/core'; import { ROWS } from ${JSON.stringify(rowImport)};
        ${imports}
        const ALIAS = ROWS; ${table}
        export default definePrototype({ name: 'shared-rows', setup(def) {
          ${state} ${before} ${rule(map)}
        } });`;
    const texts = { 'rows.ts': rows, 'visual.ts': visual, 'entry.proto.ts': entry, ...files };
    for (const [name, content] of Object.entries(texts))
      await writeFile(path.join(directory, name), content);
    const file = path.join(directory, 'entry.proto.ts');
    const inventory = scanRuleStateReadInventory([file]);
    const evaluated = inventory.evaluated.filter(
      (item) => item.entryFile === file && !item.declarationOnly
    );
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      evaluated,
      unresolved: evaluated.flatMap((item) => item.unresolved),
      variants: tokens.filter((token) => token.startsWith('data-[profile=')).sort(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('shared finite rows retain their actual entry lifetime', () => {
  for (const helper of [false, true])
    for (const map of [false, true]) {
      const name = `${helper ? 'helper replay' : 'direct entry'} / ${map ? 'private map' : 'literal intent'}`;
      it(`keeps exact production selectors for unmodified rows: ${name}`, async () => {
        const result = await observe({ helper, map });
        expect(result.unresolved).toEqual([]);
        expect(result.evaluated).toHaveLength(2);
        expect(result.variants).toEqual([
          `data-[profile=mira]:${map ? 'bg-muted' : 'bg-primary'}`,
          'data-[profile=nova]:bg-primary',
        ]);
      });
      it(`rejects a zero-argument imported row writer: ${name}`, async () => {
        const result = await observe({
          helper,
          map,
          imports: "import { mutateRows } from './mutator';",
          before: 'mutateRows();',
          files: {
            'mutator.ts':
              "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
          },
        });
        expect(
          result.unresolved.some((item) => item.reason === (map ? 'intent' : 'comparison'))
        ).toBe(true);
        expect(result.variants).toEqual([]);
      });
    }

  for (const [name, mutator, extra] of [
    [
      'a const alias writer',
      "import { ROWS } from './rows'; const ALIAS = ROWS; export function mutateRows() { ALIAS[0] = unknown(); }",
      {},
    ],
    [
      'a namespace member writer',
      "import * as ids from './rows'; export function mutateRows() { ids.ROWS[0] = unknown(); }",
      {},
    ],
    [
      'an unknown array method',
      "import { ROWS } from './rows'; export function mutateRows() { ROWS.splice(0, 1, unknown()); }",
      {},
    ],
    [
      'an opaque array escape',
      "import { ROWS } from './rows'; export function mutateRows() { opaque(ROWS); }",
      {},
    ],
    [
      'a container escape',
      "import { ROWS } from './rows'; export function mutateRows() { opaque({ options: ROWS }); }",
      {},
    ],
    [
      'a namespace escape',
      "import * as ids from './rows'; export function mutateRows() { opaque(ids); }",
      {},
    ],
    [
      'a forwarded namespace escape',
      "import * as ids from './barrel'; export function mutateRows() { opaque(ids); }",
      { 'barrel.ts': "export * as nested from './rows';" },
    ],
    [
      'a nested namespace member escape',
      "import * as ids from './barrel'; export function mutateRows() { opaque(ids.nested); }",
      { 'barrel.ts': "export * as nested from './rows';" },
    ],
    [
      'a nested namespace alias escape',
      "import * as ids from './barrel'; const alias = ids.nested; export function mutateRows() { opaque(alias); }",
      { 'barrel.ts': "export * as nested from './rows';" },
    ],
    [
      'a named namespace import escape',
      "import { nested } from './barrel'; export function mutateRows() { opaque(nested); }",
      { 'barrel.ts': "export * as nested from './rows';" },
    ],
    [
      'a returned array escape',
      "import { ROWS } from './rows'; export function mutateRows() { return ROWS; }",
      {},
    ],
    [
      'an unresolved dynamic import',
      'export function mutateRows() { return import(unknownSpecifier); }',
      {},
    ],
  ] satisfies readonly (readonly [string, string, Record<string, string>])[]) {
    it(`retains an unresolved comparison and rejects stale prefixes after ${name}`, async () => {
      const result = await observe({
        helper: true,
        imports: "import { mutateRows } from './mutator';",
        before: 'mutateRows();',
        files: { 'mutator.ts': mutator, ...extra },
      });
      expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
      expect(result.variants).toEqual([]);
    });
  }

  for (const imports of [
    "import './mutator';",
    "import {} from './mutator';",
    "export {} from './mutator';",
  ]) {
    it(`includes the runtime side-effect edge ${imports}`, async () => {
      const result = await observe({
        imports,
        files: { 'mutator.ts': "import { ROWS } from './rows'; ROWS[0] = unknown();" },
      });
      expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
      expect(result.variants).toEqual([]);
    });
  }

  it('distinguishes a same-named parameter from the actual exported array', async () => {
    const result = await observe({
      helper: true,
      imports: "import { mutateRows } from './mutator';",
      before: 'mutateRows(foreign);',
      files: { 'mutator.ts': 'export function mutateRows(ROWS) { ROWS[0] = unknown(); }' },
    });
    expect(result.unresolved).toEqual([]);
    expect(result.variants).toEqual([
      'data-[profile=mira]:bg-primary',
      'data-[profile=nova]:bg-primary',
    ]);
  });

  it('allows scalar membership reads and a fresh copied array passed to unknown code', async () => {
    const result = await observe({
      imports: "import { readRows } from './reader';",
      before: 'readRows();',
      files: {
        'reader.ts':
          "import { ROWS } from './rows'; export function readRows() { ROWS.includes('nova'); opaque([...ROWS]); }",
      },
    });
    expect(result.unresolved).toEqual([]);
    expect(result.variants).toEqual([
      'data-[profile=mira]:bg-primary',
      'data-[profile=nova]:bg-primary',
    ]);
  });

  it('keeps an unresolvable runtime dependency outside the finite proof', async () => {
    const result = await observe({
      imports: "import { opaque } from './missing';",
      before: 'opaque();',
    });
    expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
    expect(result.variants).toEqual([]);
  });
  for (const helper of [false, true])
    for (const effectful of [false, true]) {
      it(`${effectful ? 'rejects' : 'preserves'} a sibling setup module's creation effects through ${helper ? 'helper replay' : 'a direct entry'}`, async () => {
        const result = await observe({
          helper,
          rowImport: './barrel',
          files: {
            'barrel.ts':
              "export { ROWS } from './rows'; export { default as scope } from './scope';",
            'scope.ts':
              "import { definePrototype } from '@proto.ui/core'; import { setup } from './setup'; const scope = definePrototype({ name: 'row-scope', setup }); export default scope;",
            'setup.ts': `import { ROWS } from './rows'; export const SIBLING = ${effectful ? 'unknown()' : "'passive'"}; export function setup() {}`,
          },
        });
        if (effectful) {
          expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
          expect(result.variants).toEqual([]);
        } else {
          expect(result.unresolved).toEqual([]);
          expect(result.variants).toEqual([
            'data-[profile=mira]:bg-primary',
            'data-[profile=nova]:bg-primary',
          ]);
        }
      });
    }
});

const snapshotRule = (
  iterable: string,
  tuple = false
) => `for (const ${tuple ? '[profile, token]' : 'profile'} of ${iterable}) {
  def.rule({ when: w => w.state(active).eq(profile),
    intent: i => i.feedback.style.use(tw(${tuple ? 'token' : "'bg-primary'"})) });
}`;

describe.sequential('native membership proof retains authored intrinsic identity', () => {
  const replacement = 'function () { this[0] = unknown(); return false; }';
  const overrides = [
    ['the global Array prototype', `Array.prototype.includes = ${replacement};`],
    ['a global namespace member', `globalThis['Array'].prototype.includes = ${replacement};`],
    [
      'a constructor alias',
      `const NativeArray = Array; NativeArray.prototype.includes = ${replacement};`,
    ],
    [
      'a global namespace alias',
      `const globals = globalThis; globals.Array.prototype.includes = ${replacement};`,
    ],
    [
      'a native property definition',
      `Object.defineProperty(Array.prototype, 'includes', { value: ${replacement} });`,
    ],
    [
      'a reflected native array prototype',
      `const prototype = Object.getPrototypeOf([]); prototype.includes = ${replacement};`,
    ],
    ['a native array constructor member', `[].constructor.prototype.includes = ${replacement};`],
    [
      'a native array alias member',
      `const native = []; native['constructor'].prototype.includes = ${replacement};`,
    ],
    [
      'a computed native array member',
      `const key = 'constructor'; const native = []; native[key].prototype.includes = ${replacement};`,
    ],
    [
      'a prototype returned from an unknown call',
      `function array() { return []; } const prototype = Object.getPrototypeOf(array()); prototype.includes = ${replacement};`,
    ],
    [
      'an inherited Function constructor',
      `const F = (function () {}).constructor; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a computed inherited Function constructor',
      `const key = 'constructor'; const F = (() => {})[key]; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a dynamically selected Function member',
      `const key = unknown(); const F = (() => {})[key]; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an inherited Object constructor',
      `const F = Object.constructor; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an unknown reflected property',
      `const F = Reflect.get(function () {}, 'constructor'); const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an unknown reflected descriptor',
      `const descriptor = Object.getOwnPropertyDescriptor(unknown(), 'constructor'); const A = descriptor.value('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a changed business constructor property',
      `const business = { constructor: {} }; business.constructor = unknown(); const A = business.constructor('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an escaped business constructor owner',
      `const business = { constructor: {} }; opaque(business); const A = business.constructor('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a binding-pattern constructor',
      `const { constructor: F } = function () {}; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a computed binding-pattern constructor',
      `const key = 'constructor'; const { [key]: F } = () => {}; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an assignment-pattern constructor',
      `let F; ({ constructor: F } = function () {}); const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a parameter-pattern constructor',
      `function patch({ constructor: F }) { const A = F('return Array')(); A.prototype.includes = ${replacement}; } patch(function () {});`,
    ],
    [
      'a for-of binding-pattern constructor',
      `for (const { constructor: F } of [function () {}]) { const A = F('return Array')(); A.prototype.includes = ${replacement}; }`,
    ],
    [
      'a for-of assignment-pattern constructor',
      `let F; for ({ constructor: F } of [function () {}]) { const A = F('return Array')(); A.prototype.includes = ${replacement}; }`,
    ],
    [
      'a nested array binding-pattern constructor',
      `const [{ constructor: F }] = [function () {}]; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'a nested array assignment-pattern constructor',
      `let F; ([{ constructor: F }] = [function () {}]); const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
    [
      'an unknown computed binding key',
      `const key = unknown(); const { [key]: F } = () => {}; const A = F('return Array')(); A.prototype.includes = ${replacement};`,
    ],
  ] as const;
  for (const helper of [false, true])
    for (const [name, mutation] of overrides)
      it(`withdraws membership after ${name} in ${helper ? 'helper replay' : 'a direct entry'}`, async () => {
        const result = await observe({
          helper,
          imports: "import { ROWS as methodRows } from './rows';",
          before: `${mutation} methodRows.includes('nova');`,
        });
        expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
        expect(result.variants).toEqual([]);
      });

  it('checks a sibling closure even when it never imports the shared row owner', async () => {
    const result = await observe({
      helper: true,
      imports:
        "import { ROWS as methodRows } from './rows'; import { patchArray } from './intrinsic';",
      before: "patchArray(); methodRows.includes('nova');",
      files: {
        'intrinsic.ts': `export function patchArray() { Array.prototype.includes = ${replacement}; }`,
      },
    });
    expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
    expect(result.variants).toEqual([]);
  });

  for (const [name, body] of [
    [
      'a lexically shadowed Array parameter',
      `function change(Array) { Array.prototype.includes = ${replacement}; } change({ prototype: {} });`,
    ],
    [
      'a private object named Array',
      `const Array = { prototype: {} }; Array.prototype.includes = ${replacement};`,
    ],
    [
      'a business constructor and membership method',
      `const business = { constructor: { prototype: {} }, includes() { return false; } }; business.constructor.prototype.includes = ${replacement}; business.includes();`,
    ],
    ['a direct native Array type predicate', 'Array.isArray([]);'],
    [
      'ordinary reflection on a business object',
      "const business = { constructor: 'owned' }; Object.getPrototypeOf(business);",
    ],
    [
      'an own business constructor method',
      'const business = { constructor() { return false; } }; business.constructor();',
    ],
    [
      'an own business constructor string',
      "const business = { constructor: 'owned' }; const value = business.constructor; opaque(value);",
    ],
    [
      'an own business constructor binding copy',
      "const business = { constructor: 'owned' }; const { constructor: value } = business; opaque(value);",
    ],
    [
      'an own business constructor assignment copy',
      "const business = { constructor: 'owned' }; let value; ({ constructor: value } = business); opaque(value);",
    ],
    [
      'an own business constructor computed binding copy',
      "const business = { constructor: 'owned' }; const key = 'constructor'; const { [key]: value } = business; opaque(value);",
    ],
  ])
    it(`preserves exact selectors beside ${name}`, async () => {
      const result = await observe({
        imports: "import { ROWS as methodRows } from './rows';",
        before: `${body} methodRows.includes('nova');`,
      });
      expect(result.unresolved).toEqual([]);
      expect(result.variants).toEqual([
        'data-[profile=mira]:bg-primary',
        'data-[profile=nova]:bg-primary',
      ]);
    });

  it('retains all nine selectors through the real public style-scope graph and copied State options', async () => {
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), 'pui-membership-style-scope-'))
    );
    try {
      await writeFile(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
      );
      const actual = path.relative(
        directory,
        path.join(ROOT, 'packages/prototypes/shadcn/src/style-scope/index.ts')
      );
      const specifier = actual.startsWith('.') ? actual : './' + actual;
      const profiles = [
        'vega',
        'nova',
        'maia',
        'lyra',
        'mira',
        'luma',
        'sera',
        'rhea',
        'new-york-v4',
      ];
      const file = path.join(directory, 'consumer.proto.ts');
      await writeFile(
        file,
        `import { definePrototype, tw } from '@proto.ui/core';
        import { SHADCN_STYLE_IDS as IDS } from ${JSON.stringify(specifier)};
        export default definePrototype({ name: 'actual-membership-scope', setup(def) {
          const selected = def.state.enum('profile', 'vega', { options: [...IDS] });
          def.expose.state('profile', selected);
          IDS.includes('vega');
          for (const profile of IDS) def.rule({ when: w => w.state(selected).eq(profile),
            intent: i => i.feedback.style.use(tw('bg-primary')) });
        } });`
      );
      const result = scanRuleStateReadInventory([file]);
      expect(
        result.evaluated
          .filter((item) => item.entryFile === file && !item.declarationOnly)
          .flatMap((item) => item.unresolved)
      ).toEqual([]);
      const tokens = await collectProtoStyleTokensFromFiles([file]);
      expect(tokens.filter((token) => token.startsWith('data-[profile=')).sort()).toEqual(
        profiles.map((profile) => `data-[profile=${profile}]:bg-primary`).sort()
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

const snapshotForms = [
  { name: 'direct array members', before: '', iterable: '[ROWS[0], ROWS[1]]' },
  {
    name: 'local scalar aliases',
    before: 'const first = ROWS[0]; const second = ROWS[1];',
    iterable: '[first, second]',
  },
  {
    name: 'fixed array destructuring',
    before: 'const [first, second] = ROWS;',
    iterable: '[first, second]',
  },
  {
    name: 'template substitutions',
    before: '',
    iterable: '[`${ROWS[0]}`, `${ROWS[1]}`]',
  },
  {
    name: 'deduplicated scalar unions',
    before: 'const first = choice ? ROWS[0] : ROWS[0]; const second = choice ? ROWS[1] : ROWS[1];',
    iterable: '[first, second]',
  },
  {
    name: 'a fresh array spread',
    before: 'const copied = [...ROWS];',
    iterable: '[copied[0], copied[1]]',
  },
  {
    name: 'an object holding scalar copies',
    before: 'const copies = { first: ROWS[0], second: ROWS[1] };',
    iterable: '[copies.first, copies.second]',
  },
  {
    name: 'literal tuple members',
    before: '',
    iterable: "[[ROWS[0], 'bg-primary'], [ROWS[1], 'bg-primary']]",
    tuple: true,
  },
  { name: 'actual helper scalar arguments', before: '', iterable: '[first, second]', helper: true },
  {
    name: 'computed member keys',
    before: '',
    iterable:
      "[({ nova: 'nova', mira: 'mira' })[ROWS[0]], ({ nova: 'nova', mira: 'mira' })[ROWS[1]]]",
  },
  {
    name: 'computed property names',
    before: '',
    iterable: "[({ [ROWS[0]]: 'nova' }).nova, ({ [ROWS[1]]: 'mira' }).mira]",
  },
  {
    name: 'an object spread with computed keys',
    before: "const source = { [ROWS[0]]: 'nova', [ROWS[1]]: 'mira' }; const copy = { ...source };",
    iterable: '[copy.nova, copy.mira]',
  },
  {
    name: 'computed member writes',
    before: "const copy = {}; copy[ROWS[0]] = 'nova'; copy[ROWS[1]] = 'mira';",
    iterable: '[copy.nova, copy.mira]',
  },
  {
    name: 'computed destructuring keys',
    before: "const { [ROWS[0]]: first, [ROWS[1]]: second } = { nova: 'nova', mira: 'mira' };",
    iterable: '[first, second]',
  },
  {
    name: 'Object.assign with computed source keys',
    before:
      "const source = { [ROWS[0]]: 'nova', [ROWS[1]]: 'mira' }; const copy = {}; Object.assign(copy, source);",
    iterable: '[copy.nova, copy.mira]',
  },
] satisfies readonly {
  name: string;
  before: string;
  iterable: string;
  tuple?: boolean;
  helper?: boolean;
}[];

describe.sequential('literal row snapshots retain their shared-array read origins', () => {
  for (const borrowed of [false, true])
    it(`${borrowed ? 'rejects shared' : 'preserves fresh literal'} array helper arguments after an unrelated row writer`, async () => {
      const result = await observe({
        files: {
          'entry.proto.ts': `import { definePrototype } from '@proto.ui/core'; import { ROWS } from './rows';
            import { mutateRows } from './mutator'; import { paint } from './visual';
            export default definePrototype({ name: 'helper-array', setup(def) {
              mutateRows(); paint(def, ${borrowed ? 'ROWS' : "['nova', 'mira']"});
            } });`,
          'visual.ts': `import { tw } from '@proto.ui/core'; export function paint(def, rows) {
            ${state} ${snapshotRule('[rows[0], rows[1]]')}
          }`,
          'mutator.ts':
            "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
        },
      });
      if (borrowed)
        expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
      expect(result.variants).toEqual(
        borrowed ? [] : ['data-[profile=mira]:bg-primary', 'data-[profile=nova]:bg-primary']
      );
    });

  for (const [name, extraParameter, effect] of [
    ['array escape', '', 'opaque(rows);'],
    ['arguments alias escape', '', 'opaque(arguments[1]);'],
    ['parameter rebind', '', 'rows = unknown();'],
    ['an omitted default initializer', ', extra = poison(rows)', ''],
  ])
    it(`does not admit a fresh array parameter after ${name}`, async () => {
      const result = await observe({
        files: {
          'entry.proto.ts': `import { definePrototype } from '@proto.ui/core'; import { paint } from './visual';
            export default definePrototype({ name: 'unsafe-helper-array', setup(def) { paint(def, ['nova', 'mira']); } });`,
          'visual.ts': `import { tw } from '@proto.ui/core';
            function poison(rows) { rows[0] = unknown(); }
            export function paint(def, rows${extraParameter}) {
              ${state} ${effect} ${snapshotRule('[rows[0], rows[1]]')}
            }`,
        },
      });
      expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
      expect(result.variants).toEqual([]);
    });

  it('rejects a shared inner array borrowed through a fresh outer literal', async () => {
    const result = await observe({
      files: {
        'entry.proto.ts': `import { definePrototype, tw } from '@proto.ui/core';
          import { ROWS } from './rows'; import { mutateRows } from './mutator';
          export default definePrototype({ name: 'borrowed-inner-array', setup(def) {
            ${state} mutateRows(); ${snapshotRule('[[ROWS][0][0], [ROWS][0][1]]')}
          } });`,
        'mutator.ts':
          "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
      },
    });
    expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
    expect(result.variants).toEqual([]);
  });

  it('preserves indexed nested literal arrays after an unrelated mutation', async () => {
    const result = await observe({
      files: {
        'entry.proto.ts': `import { definePrototype, tw } from '@proto.ui/core'; import { mutateRows } from './mutator';
          export default definePrototype({ name: 'owned-inner-array', setup(def) {
            ${state} mutateRows(); ${snapshotRule("[[['nova', 'mira']][0][0], [['nova', 'mira']][0][1]]")}
          } });`,
        'mutator.ts':
          "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
      },
    });
    expect(result.variants).toEqual([
      'data-[profile=mira]:bg-primary',
      'data-[profile=nova]:bg-primary',
    ]);
  });

  for (const form of snapshotForms)
    for (const mutated of [false, true]) {
      it(`${mutated ? 'withdraws stale' : 'preserves read-only'} production prefixes through ${form.name}`, async () => {
        const helper = 'helper' in form && form.helper;
        const tuple = 'tuple' in form && form.tuple;
        const body = `${state} ${snapshotRule(form.iterable, tuple)}`;
        const imports = mutated ? "import { mutateRows } from './mutator';" : '';
        const before = `${mutated ? 'mutateRows();' : ''} ${form.before}`;
        const entry = `import { definePrototype, tw } from '@proto.ui/core';
          import { ROWS } from './rows'; ${imports}
          ${helper ? "import { paint } from './visual';" : ''}
          export default definePrototype({ name: 'row-snapshot', setup(def) {
            ${before} ${helper ? 'paint(def, ROWS[0], ROWS[1]);' : body}
          } });`;
        const result = await observe({
          files: {
            'entry.proto.ts': entry,
            'visual.ts': `import { tw } from '@proto.ui/core'; export function paint(def, first, second) { ${body} }`,
            'mutator.ts':
              "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
          },
        });
        if (mutated) {
          expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
          expect(result.variants).toEqual([]);
        } else {
          // These member/alias expressions need not be an admitted scanner
          // domain. The existing producer must still retain their exact CSS.
          expect(result.variants).toEqual([
            'data-[profile=mira]:bg-primary',
            'data-[profile=nova]:bg-primary',
          ]);
        }
      });
    }

  it('does not lose an unresolved read origin in a destructured helper parameter', async () => {
    const result = await observe({
      files: {
        'entry.proto.ts': `import { definePrototype } from '@proto.ui/core';
          import { ROWS } from './rows'; import { mutateRows } from './mutator'; import { paint } from './visual';
          export default definePrototype({ name: 'row-pattern', setup(def) { mutateRows(); paint(def, ROWS); } });`,
        'visual.ts': `import { tw } from '@proto.ui/core'; export function paint(def, [first, second]) {
          ${state} ${snapshotRule('[first, second]')}
        }`,
        'mutator.ts':
          "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
      },
    });
    expect(result.unresolved.some((item) => item.reason === 'comparison')).toBe(true);
    expect(result.variants).toEqual([]);
  });

  for (const tuple of [false, true])
    it(`keeps independent literal ${tuple ? 'tuple' : 'scalar'} rows after an unrelated imported mutation`, async () => {
      const result = await observe({
        files: {
          'entry.proto.ts': `import { definePrototype, tw } from '@proto.ui/core'; import { mutateRows } from './mutator';
            export default definePrototype({ name: 'independent-rows', setup(def) {
              ${state} mutateRows();
              ${snapshotRule(tuple ? "[['nova', 'bg-primary'], ['mira', 'bg-muted']]" : "['nova', 'mira']", tuple)}
            } });`,
          'mutator.ts':
            "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
        },
      });
      expect(result.unresolved).toEqual([]);
      expect(result.variants).toEqual([
        `data-[profile=mira]:${tuple ? 'bg-muted' : 'bg-primary'}`,
        'data-[profile=nova]:bg-primary',
      ]);
    });

  it('checks cached helper snapshots against each collecting entry without caching a verdict', async () => {
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), 'pui-row-entry-isolation-'))
    );
    try {
      await writeFile(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
      );
      const texts = {
        'rows.ts': rows,
        'mutator.ts':
          "import { ROWS } from './rows'; export function mutateRows() { ROWS[0] = unknown(); }",
        'visual.ts': `import { tw } from '@proto.ui/core'; import { ROWS } from './rows';
          export function paint(def, token) { ${state}
            for (const profile of [ROWS[0], ROWS[1]]) {
              def.rule({ when: w => w.state(active).eq(profile), intent: i => i.feedback.style.use(tw(token)) });
            }
          }`,
        'safe.proto.ts': `import { definePrototype } from '@proto.ui/core'; import { paint } from './visual';
          export default definePrototype({ name: 'safe-rows', setup(def) { paint(def, 'bg-primary'); } });`,
        'unsafe.proto.ts': `import { definePrototype } from '@proto.ui/core'; import { paint } from './visual';
          import { mutateRows } from './mutator';
          export default definePrototype({ name: 'unsafe-rows', setup(def) { mutateRows(); paint(def, 'bg-muted'); } });`,
      };
      for (const [name, content] of Object.entries(texts))
        await writeFile(path.join(directory, name), content);
      const safe = path.join(directory, 'safe.proto.ts');
      const unsafe = path.join(directory, 'unsafe.proto.ts');
      for (const entries of [
        [unsafe, safe],
        [safe, unsafe],
      ]) {
        const tokens = await collectProtoStyleTokensFromFiles(entries);
        expect(tokens.filter((token) => token.startsWith('data-[profile=')).sort()).toEqual([
          'data-[profile=mira]:bg-primary',
          'data-[profile=nova]:bg-primary',
        ]);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
