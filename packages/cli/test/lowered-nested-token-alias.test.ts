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
const TABLE =
  "const TABLE={nova:{surface:'bg-primary p-2',focus:'ring-2'},mira:{surface:'bg-muted p-3',focus:'ring-1'}} as const;";
const expected = [
  'data-[profile=mira]:bg-muted',
  'data-[profile=mira]:p-3',
  'data-[profile=nova]:bg-primary',
  'data-[profile=nova]:p-2',
].sort();
type Fixture = {
  table?: string;
  imports?: string;
  beforeRule?: string;
  argument?: string;
  afterRule?: string;
  extras?: string;
  files?: Record<string, string>;
};

async function observe({
  table = TABLE,
  imports = '',
  beforeRule = 'const recipe=TABLE[profile];',
  argument = 'recipe.surface',
  afterRule = '',
  extras = '',
  files = {},
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-nested-token-alias-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(
      path.join(directory, 'producer.ts'),
      `import{defineAsHook}from'@proto.ui/core';
      export const asProfile=defineAsHook({name:'nested-alias-profile',setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},projectHandle:r=>({profile:r.stateHandles.profile})});`
    );
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `import{definePrototype,tw}from'@proto.ui/core';import{asProfile}from'./producer';
      ${imports}${table}${extras}
      export default definePrototype({name:'nested-alias-consumer',setup(def){const{profile:active}=asProfile();
        for(const profile of ['nova','mira']as const){${beforeRule}
          def.rule({when:w=>w.state(active).eq(profile),intent:i=>i.feedback.style.use(tw(${argument}))});
          ${afterRule}
        }
      }});`;
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
      while (ts.isAsExpression(node)) node = node.expression;
      return ts.isArrayLiteralExpression(node)
        ? (node.elements as ts.NodeArray<ts.Expression>)
        : null;
    };
    const privateProof = createFiniteTokenMapProof(rows)(target);
    const sharedFlatProof = createFiniteTokenMapProof(rows, parsed)(target);
    const pathProof = createFiniteTokenMapPathProof(rows, parsed)(target);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      privateProof,
      sharedFlatProof,
      pathProof,
      scan: scanRuleStateReads(source, file),
      tokens: tokens.filter((t) => t.startsWith('data-[profile=')),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('one closed private const subtree projection', () => {
  for (const [name, fixture] of [
    ['private nested strings', {}],
    [
      'a relative imported owner',
      {
        table: '',
        imports: "import{TABLE}from'./table';",
        files: { 'table.ts': 'export ' + TABLE },
      },
    ],
    [
      'named relative forwarding',
      {
        table: '',
        imports: "import{TABLE}from'./barrel';",
        files: { 'table.ts': 'export ' + TABLE, 'barrel.ts': "export{TABLE}from'./table';" },
      },
    ],
    ['a bracket own-leaf read', { argument: "recipe['surface']" }],
    [
      'a prior primitive leaf-key alias',
      { beforeRule: "const recipe=TABLE[profile];const leaf='surface';", argument: 'recipe[leaf]' },
    ],
    [
      'a deeper direct subtree projection',
      {
        table:
          "const TABLE={nova:{paint:{surface:'bg-primary p-2'}},mira:{paint:{surface:'bg-muted p-3'}}};",
        beforeRule: 'const recipe=TABLE[profile].paint;',
      },
    ],
    ['unrelated same-named consumer', { extras: 'function unrelated(recipe){opaque(recipe);}' }],
    [
      'a primitive consumer of the same subtree',
      { beforeRule: 'const recipe=TABLE[profile];consume(recipe.focus);' },
    ],
    [
      'deferred primitive-only reads',
      { beforeRule: 'const recipe=TABLE[profile];function read(){return recipe.focus;}' },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('proves ' + name + ' without changing the two flat APIs', async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe(false);
      expect(result.sharedFlatProof).toBe(false);
      expect(result.pathProof).toBe(true);
      expect(result.scan.unresolved).toEqual([]);
      expect(result.scan.usages).toHaveLength(2);
      expect(result.tokens.sort()).toEqual(expected);
    });
  }
  for (const [name, fixture] of [
    ['mutable alias', { beforeRule: 'let recipe=TABLE[profile];' }],
    [
      'root alias instead of a subtree',
      { beforeRule: 'const recipe=TABLE;', argument: 'recipe[profile].surface' },
    ],
    ['second alias', { beforeRule: 'const first=TABLE[profile];const recipe=first;' }],
    ['conditional initializer', { beforeRule: 'const recipe=flag?TABLE[profile]:TABLE.nova;' }],
    ['call initializer', { beforeRule: 'const recipe=choose(TABLE[profile]);' }],
    ['foreign initializer', { beforeRule: 'const recipe=foreign;' }],
    ['late initializer', { beforeRule: '', afterRule: 'const recipe=TABLE[profile];' }],
    [
      'module-level projection outside the invocation',
      { beforeRule: '', extras: 'const recipe=TABLE.nova;' },
    ],
    ['unknown leaf key', { argument: 'recipe[unknownKey]' }],
    ['missing own leaf', { argument: 'recipe.missing' }],
    ['optional alias read', { argument: 'recipe?.surface' }],
    [
      'member write before the rule',
      { beforeRule: 'const recipe=TABLE[profile];recipe.surface=unknown();' },
    ],
    ['member write after the rule', { afterRule: 'recipe.surface=unknown();' }],
    ['alias reassignment', { afterRule: 'recipe=foreign;' }],
    [
      'deferred member write',
      { beforeRule: 'const recipe=TABLE[profile];function later(){recipe.surface=unknown();}' },
    ],
    ['delete', { afterRule: 'delete recipe.surface;' }],
    ['destructuring write', { afterRule: '[recipe.surface]=[unknown()];' }],
    [
      'descriptor write',
      {
        beforeRule:
          "const recipe=TABLE[profile];Object.defineProperty(recipe,'surface',{value:unknown()});",
      },
    ],
    ['opaque call before the rule', { beforeRule: 'const recipe=TABLE[profile];opaque(recipe);' }],
    ['opaque call after the rule', { afterRule: 'opaque(recipe);' }],
    [
      'deferred opaque call',
      { beforeRule: 'const recipe=TABLE[profile];function later(){opaque(recipe);}' },
    ],
    [
      'returned child',
      { beforeRule: 'const recipe=TABLE[profile];function leak(){return recipe;}' },
    ],
    ['container escape', { afterRule: 'const box={recipe};' }],
    ['array escape', { afterRule: 'const box=[recipe];' }],
    ['spread of a child', { afterRule: 'const clone={...recipe};' }],
    ['second destructured alias', { afterRule: 'const {surface}=recipe;' }],
    ['unknown sibling leaf', { table: TABLE.replace("focus:'ring-1'", 'focus:foreign') }],
    ['getter sibling', { table: TABLE.replace("focus:'ring-1'", "get focus(){return 'ring-1'}") }],
    [
      'side module mutation of the same child',
      {
        table: '',
        imports: "import{TABLE}from'./table';import'./mutator';",
        files: {
          'table.ts': 'export ' + TABLE,
          'mutator.ts':
            "import{TABLE}from'./table';export function mutate(){TABLE.nova.surface=unknown();}",
        },
      },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('keeps the alias unproved for ' + name, async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe(false);
      expect(result.sharedFlatProof).toBe(false);
      expect(result.pathProof).toBe(false);
      expect(result.scan.unresolved.some((row) => row.reason === 'intent')).toBe(true);
    });
  }
  it('preserves exact profile selection through an actual imported helper replay', async () => {
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), 'pui-nested-alias-helper-'))
    );
    try {
      await writeFile(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
      );
      await writeFile(
        path.join(directory, 'producer.ts'),
        `import{defineAsHook}from'@proto.ui/core';export const asProfile=defineAsHook({name:'nested-alias-helper-profile',setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},projectHandle:r=>({profile:r.stateHandles.profile})});`
      );
      const paint = path.join(directory, 'paint.ts');
      await writeFile(
        paint,
        `import{tw}from'@proto.ui/core';${TABLE}
        export function paint(def,active){for(const profile of ['nova','mira']as const){const recipe=TABLE[profile];def.rule({when:w=>w.state(active).eq(profile),intent:i=>i.feedback.style.use(tw(recipe.surface))});}}`
      );
      const entry = path.join(directory, 'consumer.proto.ts');
      await writeFile(
        entry,
        `import{definePrototype}from'@proto.ui/core';import{asProfile}from'./producer';import{paint}from'./paint';export default definePrototype({name:'nested-alias-helper',setup(def){const{profile:active}=asProfile();paint(def,active);}});`
      );
      const inventory = scanRuleStateReadInventory([entry, paint]);
      const tokens = await collectProtoStyleTokensFromFiles([entry]);
      expect(inventory.evaluated).toHaveLength(2);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
      expect(tokens.filter((t) => t.startsWith('data-[profile=')).sort()).toEqual(expected);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
