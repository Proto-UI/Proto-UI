import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  createFiniteTokenMapPathProof,
  createFiniteTokenMapProof,
} from '../src/services/finite-token-map-proof';
import {
  scanRuleStateReadInventory,
  scanRuleStateReads,
} from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TABLE = `const TABLE = {
  nova: { surface: 'bg-primary p-2', focus: 'ring-2' },
  mira: { surface: 'bg-muted p-3', focus: 'ring-1' },
} as const;`;
const expected = [
  'data-[profile=mira]:bg-muted',
  'data-[profile=mira]:p-3',
  'data-[profile=nova]:bg-primary',
  'data-[profile=nova]:p-2',
].sort();
type Fixture = {
  table?: string;
  imports?: string;
  extras?: string;
  before?: string;
  beforeRule?: string;
  argument?: string;
  afterRule?: string;
  after?: string;
  suffix?: string;
  files?: Readonly<Record<string, string>>;
  paths?: Record<string, string[]>;
};

async function observe({
  table = TABLE,
  imports = '',
  extras = '',
  before = '',
  beforeRule = '',
  argument = 'TABLE[profile].surface',
  afterRule = '',
  after = '',
  suffix = '',
  files = {},
  paths,
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-nested-token-map-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: path.join(ROOT, 'tsconfig.json'),
        ...(paths ? { compilerOptions: { baseUrl: '.', paths } } : {}),
      })
    );
    await writeFile(
      path.join(directory, 'producer.ts'),
      `import {defineAsHook} from '@proto.ui/core';
      export const asProfile = defineAsHook({name:'nested-map-profile',
        setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},
        projectHandle:result=>({profile:result.stateHandles.profile})});`
    );
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `import {definePrototype,tw} from '@proto.ui/core';
      import {asProfile} from './producer';
      ${imports} ${table} ${extras}
      export default definePrototype({name:'nested-map-consumer',setup(def){
        const {profile:active}=asProfile(); ${before}
        for(const profile of ['nova','mira'] as const){
          ${beforeRule}
          def.rule({when:w=>w.state(active).eq(profile),intent:i=>i.feedback.style.use(tw(${argument}))});
          ${afterRule}
        }
        ${after}
      }});
      ${suffix}`;
    await writeFile(file, source);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    let target: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'tw'
      )
        target = node.arguments[0];
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (!target) throw new Error('Missing authored token argument');
    const rows = (loop: ts.ForOfStatement): readonly ts.Expression[] | null => {
      let node: ts.Node = loop.expression;
      while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
      return ts.isArrayLiteralExpression(node)
        ? (node.elements as ts.NodeArray<ts.Expression>)
        : null;
    };
    const flatPrivate = createFiniteTokenMapProof(rows)(target);
    const flatShared = createFiniteTokenMapProof(rows, parsed)(target);
    const pathProof = createFiniteTokenMapPathProof(rows, parsed)(target);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      flatPrivate,
      flatShared,
      pathProof,
      scan: scanRuleStateReads(source, file),
      tokens: tokens.filter((token) => token.startsWith('data-[profile=')),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('entry-bound direct nested token-map paths', () => {
  for (const [name, fixture] of [
    ['private literal tree', {}],
    ['bracket leaf read', { argument: "TABLE[profile]['surface']" }],
    [
      'prior primitive leaf-key alias',
      { beforeRule: "const key='surface';", argument: 'TABLE[profile][key]' },
    ],
    [
      'finite template leaf key',
      { beforeRule: "const tail='face';", argument: 'TABLE[profile][`sur${tail}`]' },
    ],
    [
      'a deeper string-only tree',
      {
        table:
          "const TABLE={nova:{paint:{surface:'bg-primary p-2'}},mira:{paint:{surface:'bg-muted p-3'}}};",
        argument: 'TABLE[profile].paint.surface',
      },
    ],
    [
      'relative shared tree',
      {
        table: '',
        imports: "import {TABLE} from './table';",
        files: { 'table.ts': 'export ' + TABLE },
      },
    ],
    [
      'relative named import alias',
      {
        table: '',
        imports: "import {TABLE as PAINT} from './table';",
        argument: 'PAINT[profile].surface',
        files: { 'table.ts': 'export ' + TABLE },
      },
    ],
    [
      'named re-export tree',
      {
        table: '',
        imports: "import {TABLE} from './barrel';",
        files: { 'table.ts': 'export ' + TABLE, 'barrel.ts': "export {TABLE} from './table';" },
      },
    ],
    [
      'local named forwarding tree',
      {
        table: '',
        imports: "import {TABLE} from './barrel';",
        files: {
          'table.ts': 'export ' + TABLE,
          'barrel.ts': "import {TABLE} from './table'; export {TABLE};",
        },
      },
    ],
    ['same-entry exported tree', { table: 'export ' + TABLE }],
    ['a separate primitive consumer', { after: 'consume(TABLE.nova.surface);' }],
    [
      'a read-only sibling projection',
      { beforeRule: 'const recipe=TABLE[profile]; consume(recipe.focus);' },
    ],
    [
      'a deferred primitive read from a projection',
      { beforeRule: 'const recipe=TABLE[profile]; function read(){return recipe.focus;}' },
    ],
    [
      'an unrelated lexical name',
      { extras: 'function unrelated(TABLE){TABLE.nova.surface=unknown();}' },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('proves ' + name + ' with exact producer profile prefixes', async () => {
      const result = await observe(fixture);
      expect(result.flatPrivate).toBe(false);
      expect(result.flatShared).toBe(false);
      expect(result.pathProof).toBe(true);
      expect(result.scan.unresolved).toEqual([]);
      expect(result.scan.usages).toHaveLength(2);
      expect(result.tokens.sort()).toEqual(expected);
    });
  }

  for (const [name, fixture] of [
    ['unknown child key', { argument: 'TABLE[profile][unknownKey]' }],
    ['missing own child', { argument: 'TABLE[profile].missing' }],
    ['optional parent read', { argument: 'TABLE[profile]?.surface' }],
    ['inherited child key', { argument: 'TABLE[profile].toString' }],
    ['mutable root binding', { table: TABLE.replace('const TABLE', 'let TABLE') }],
    ['unknown root alias', { before: 'const alias=TABLE;', argument: 'alias[profile].surface' }],
    ['unknown child literal', { table: TABLE.replace("focus: 'ring-1'", 'focus: unknown') }],
    ['nullable child literal', { table: TABLE.replace("focus: 'ring-1'", 'focus: null') }],
    [
      'array-valued child literal',
      { table: TABLE.replace("focus: 'ring-1'", "focus: ['ring-1']") },
    ],
    [
      'StyleHandle call instead of a string leaf',
      { table: TABLE.replace("focus: 'ring-1'", "focus: tw('ring-1')") },
    ],
    ['nested getter', { table: TABLE.replace("focus: 'ring-1'", "get focus(){return 'ring-1'}") }],
    ['nested spread', { table: TABLE.replace("focus: 'ring-1'", "focus:'ring-1',...foreign") }],
    ['nested computed property', { table: TABLE.replace("focus: 'ring-1'", "['focus']:'ring-1'") }],
    [
      'nested duplicate property',
      { table: TABLE.replace("focus: 'ring-1'", "focus:'ring-1',focus:'ring-2'") },
    ],
    [
      'prototype-bearing nested property',
      { table: TABLE.replace("focus: 'ring-1'", "constructor:'ring-1'") },
    ],
    ['direct nested write', { beforeRule: 'TABLE[profile].surface=unknown();' }],
    ['unread sibling write', { afterRule: 'TABLE[profile].focus=unknown();' }],
    ['deferred nested write', { extras: 'function later(){TABLE.nova.surface=unknown();}' }],
    ['computed nested write', { after: 'TABLE.nova[unknownKey]=unknown();' }],
    ['nested destructuring assignment', { after: '[TABLE.nova.surface]=[unknown()];' }],
    ['nested deletion', { after: 'delete TABLE.nova.surface;' }],
    ['root escape', { before: 'opaque(TABLE);' }],
    ['subtree escape', { beforeRule: 'opaque(TABLE[profile]);' }],
    ['subtree return', { extras: 'function leak(){return TABLE.nova;}' }],
    [
      'subtree descriptor write',
      { beforeRule: "Object.defineProperty(TABLE[profile],'surface',{value:unknown()});" },
    ],
    [
      'mutable projection binding',
      { beforeRule: 'let recipe=TABLE[profile]; consume(recipe.focus);' },
    ],
    [
      'projection member write',
      { beforeRule: 'const recipe=TABLE[profile]; recipe.surface=unknown();' },
    ],
    [
      'later projection member write',
      { beforeRule: 'const recipe=TABLE[profile];', afterRule: 'recipe.surface=unknown();' },
    ],
    [
      'deferred projection member write',
      { beforeRule: 'const recipe=TABLE[profile]; function later(){recipe.surface=unknown();}' },
    ],
    ['projection escape', { beforeRule: 'const recipe=TABLE[profile]; opaque(recipe);' }],
    [
      'deferred projection escape',
      { beforeRule: 'const recipe=TABLE[profile]; function later(){opaque(recipe);}' },
    ],
    [
      'projection return',
      { beforeRule: 'const recipe=TABLE[profile]; function leak(){return recipe;}' },
    ],
    [
      'projection container escape',
      { beforeRule: 'const recipe=TABLE[profile]; const bag={recipe};' },
    ],
    [
      'second projection alias',
      { beforeRule: 'const recipe=TABLE[profile]; const alias=recipe; consume(alias.focus);' },
    ],
    [
      'projection destructuring alias',
      { beforeRule: 'const {nova:recipe}=TABLE; consume(recipe.focus);' },
    ],
    ['exported projection', { extras: 'const recipe=TABLE.nova; export {recipe};' }],
    ['late table initializer', { table: '', suffix: TABLE }],
    [
      'forward primitive key alias',
      { extras: "const KEY=LATER;const LATER='surface';", argument: 'TABLE[profile][KEY]' },
    ],
    [
      'unregistered data import',
      {
        table: '',
        imports: "import {TABLE} from '@paint/table';",
        files: { 'table.ts': 'export ' + TABLE },
        paths: { '@paint/table': ['./table.ts'] },
      },
    ],
    [
      'loader-invisible extension substitution',
      {
        table: '',
        imports: "import {TABLE} from './table.js';",
        files: { 'table.ts': 'export ' + TABLE },
      },
    ],
    [
      'loader-invisible wildcard forwarding',
      {
        table: '',
        imports: "import {TABLE} from './barrel';",
        files: { 'table.ts': 'export ' + TABLE, 'barrel.ts': "export * from './table';" },
      },
    ],
    [
      'sibling no-argument mutation',
      {
        table: '',
        imports: "import {TABLE} from './table';import {mutate}from'./mutator';",
        before: 'mutate();',
        files: {
          'table.ts': 'export ' + TABLE,
          'mutator.ts':
            "import{TABLE}from'./table';export function mutate(){TABLE.nova.surface=unknown();}",
        },
      },
    ],
    [
      'sibling namespace subtree escape',
      {
        table: '',
        imports: "import {TABLE} from './table';import './mutator';",
        files: {
          'table.ts': 'export ' + TABLE,
          'mutator.ts':
            "import * as maps from './table';export function leak(){opaque(maps.TABLE.nova);}",
        },
      },
    ],
    [
      'unknown sibling module effects',
      {
        table: '',
        imports: "import {TABLE} from './table';import './mutator';",
        files: {
          'table.ts': 'export ' + TABLE,
          'mutator.ts': "import {TABLE} from './table';unknown();",
        },
      },
    ],
    ['dynamic lexical evaluation', { after: "eval('TABLE.nova.surface=unknown()');" }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('keeps unresolved coverage for ' + name, async () => {
      const result = await observe(fixture);
      expect(result.flatPrivate).toBe(false);
      expect(result.flatShared).toBe(false);
      expect(result.pathProof).toBe(false);
      expect(result.scan.unresolved.some((item) => item.reason === 'intent')).toBe(true);
    });
  }

  // The original flat APIs keep rejecting this derived bag. This separately
  // reviewed path-capability expansion now proves its complete private lifetime.
  it('preserves the flat-proof boundary while proving a private subtree projection target', async () => {
    const result = await observe({
      beforeRule: 'const recipe=TABLE[profile];',
      argument: 'recipe.surface',
    });
    expect(result.flatPrivate).toBe(false);
    expect(result.flatShared).toBe(false);
    expect(result.pathProof).toBe(true);
    expect(result.scan.unresolved).toEqual([]);
    expect(result.scan.usages).toHaveLength(2);
    expect(result.tokens.sort()).toEqual(expected);
  });

  it('binds the direct nested proof to an actual imported helper replay and the same producer prefixes', async () => {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-nested-helper-')));
    try {
      await writeFile(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
      );
      await writeFile(
        path.join(directory, 'producer.ts'),
        `import{defineAsHook}from'@proto.ui/core';
        export const asProfile=defineAsHook({name:'nested-helper-profile',setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},projectHandle:r=>({profile:r.stateHandles.profile})});`
      );
      const paint = path.join(directory, 'paint.ts');
      await writeFile(
        paint,
        `import{tw}from'@proto.ui/core';${TABLE}
        export function paint(def,active){for(const profile of ['nova','mira']as const){
          const recipe=TABLE[profile];void recipe.focus;
          def.rule({when:w=>w.state(active).eq(profile),intent:i=>i.feedback.style.use(tw(TABLE[profile].surface))});
        }}`
      );
      const entry = path.join(directory, 'consumer.proto.ts');
      await writeFile(
        entry,
        `import{definePrototype}from'@proto.ui/core';import{asProfile}from'./producer';import{paint}from'./paint';
        export default definePrototype({name:'nested-helper-consumer',setup(def){const{profile:active}=asProfile();paint(def,active);}});`
      );
      const inventory = scanRuleStateReadInventory([entry, paint]);
      const tokens = await collectProtoStyleTokensFromFiles([entry]);
      expect(inventory.evaluated).toHaveLength(2);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
      expect(tokens.filter((token) => token.startsWith('data-[profile=')).sort()).toEqual(expected);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
