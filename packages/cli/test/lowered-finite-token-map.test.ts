import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
  createFiniteTokenMapProof,
  createFiniteTokenMapPathProof,
} from '../src/services/finite-token-map-proof';
import { createHookSourceModuleContext } from '../src/services/hook-source-module';

import {
  scanRuleStateReadInventory,
  scanRuleStateReads,
} from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TABLE = "const TOKENS = { nova: 'bg-primary p-2', mira: 'bg-muted p-3' } as const;";
const IDS = "const IDS = ['nova', 'mira'] as const;";
const expected = [
  'data-[profile=mira]:bg-muted',
  'data-[profile=mira]:p-3',
  'data-[profile=nova]:bg-primary',
  'data-[profile=nova]:p-2',
].sort();

type Fixture = {
  sharedBoundary?: boolean;
  pathBoundary?: boolean;
  table?: string;
  ids?: string;
  imports?: string;
  extras?: string;
  before?: string;
  binding?: string;
  iterable?: string;
  beforeRule?: string;
  afterRule?: string;
  argument?: string;
  after?: string;
  suffix?: string;
  files?: Readonly<Record<string, string>>;
};

async function observe({
  table = TABLE,
  ids = IDS,
  imports = '',
  extras = '',
  before = '',
  binding = 'const profile',
  iterable = 'IDS',
  beforeRule = '',
  afterRule = '',
  argument = 'TOKENS[profile]',
  after = '',
  suffix = '',
  files = {},
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-finite-token-map-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(
      path.join(directory, 'producer.ts'),
      `import { defineAsHook } from '@proto.ui/core';
       export const asProfile = defineAsHook({ name: 'finite-profile',
         setup(def) { def.state.enum('profile', 'nova', { options: ['nova', 'mira'] }); },
         projectHandle: result => ({ profile: result.stateHandles.profile })
       });`
    );
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `
      import { definePrototype, tw } from '@proto.ui/core';
      import { asProfile } from './producer';
      ${imports}
      ${table}
      ${ids}
      ${extras}
      export default definePrototype({ name: 'finite-token-map', setup(def) {
        const { profile: active } = asProfile();
        ${before}
        for (${binding} of ${iterable}) {
          ${beforeRule}
          def.rule({ when: w => w.state(active).eq(profile),
            intent: i => i.feedback.style.use(tw(${argument})) });
          ${afterRule}
        }
        ${after}
      } });
      ${suffix}
    `;
    await writeFile(file, source);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const modules = createHookSourceModuleContext();
    modules.registerSource(parsed);
    const literalRows = (
      node: ts.Node,
      seen = new Set<ts.Node>()
    ): readonly ts.Expression[] | null => {
      while (
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isParenthesizedExpression(node)
      )
        node = node.expression;
      if (ts.isArrayLiteralExpression(node)) return node.elements as ts.NodeArray<ts.Expression>;
      if (!ts.isIdentifier(node)) return null;
      const declaration = modules.resolveReference(
        node,
        modules.moduleForSource(node.getSourceFile())
      )?.declaration;
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        !declaration.initializer ||
        seen.has(declaration)
      )
        return null;
      return literalRows(declaration.initializer, new Set(seen).add(declaration));
    };
    let argumentNode: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'tw'
      )
        argumentNode = node.arguments[0];
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (!argumentNode) throw new Error('Missing actual token argument');
    const privateProof = createFiniteTokenMapProof((loop) => literalRows(loop.expression))(
      argumentNode
    );
    const sharedFlatProof = createFiniteTokenMapProof(
      (loop) => literalRows(loop.expression),
      parsed
    )(argumentNode);
    const pathProof = createFiniteTokenMapPathProof(
      (loop) => literalRows(loop.expression),
      parsed
    )(argumentNode);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      privateProof,
      sharedFlatProof,
      pathProof,
      scan: scanRuleStateReads(source, file),
      tokens: tokens.filter((token) => token.startsWith('data-[profile=')),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('finite private token-map reads match production collection', () => {
  for (const [name, fixture] of [
    ['a private module list', {}],
    ['an inline loop list', { ids: '', iterable: "['nova', 'mira'] as const" }],
    [
      'a relative named list through a pure barrel',
      {
        ids: '',
        imports: "import { PROFILES as IDS } from './barrel';",
        files: {
          'profiles.ts': "export const VALUES = ['nova', 'mira'] as const;",
          'barrel.ts': "export { VALUES as PROFILES } from './profiles';",
        },
      },
    ],
    [
      'a const alias of the actual loop key',
      { beforeRule: 'const chosen = profile;', argument: 'TOKENS[chosen]' },
    ],
    [
      'a same-named parameter on an unrelated owner',
      { extras: 'function other(TOKENS, key) { TOKENS[key] = unknown(); }' },
    ],
    [
      'primitive token leaves passed to an unrelated consumer',
      { after: "observeToken(TOKENS['nova']);" },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it(name, async () => {
      const { scan, tokens, privateProof } = await observe(fixture);
      expect(privateProof).toBe(true);
      // Prefix membership is the production contract: plain token inventory
      // cannot certify a wrong profile or a missing variant.
      expect(tokens.sort()).toEqual(expected);
      expect(scan.unresolved).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asProfile', state: 'profile' },
        { hook: 'asProfile', state: 'profile' },
      ]);
    });
  }

  for (const [name, fixture] of [
    ['a mutable table binding', { table: TABLE.replace('const TOKENS', 'let TOKENS') }],
    ['a mutable loop key', { binding: 'let profile' }],
    ['an unknown key', { argument: 'TOKENS[unknownKey]' }],
    ['a mutable key alias', { beforeRule: 'let chosen = profile;', argument: 'TOKENS[chosen]' }],
    [
      'a function-local list shadowing a finite module list',
      { before: 'const IDS = getProfiles();' },
    ],
    ['a key from an opaque iterable', { ids: '', iterable: 'getProfiles()' }],
    ['an inherited prototype member', { ids: "const IDS = ['nova', 'toString'] as const;" }],
    ['a missing own member', { ids: "const IDS = ['nova', 'other'] as const;" }],
    [
      'a getter in the table',
      { table: "const TOKENS = { nova: 'bg-primary', get mira() { return 'bg-muted'; } };" },
    ],
    [
      'a spread in the table',
      { table: "const TOKENS = { nova: 'bg-primary', mira: 'bg-muted', ...foreign };" },
    ],
    [
      'a non-string sibling',
      { table: "const TOKENS = { nova: 'bg-primary', mira: 'bg-muted', extra: foreign };" },
    ],
    ['a direct later write', { after: 'TOKENS.nova = unknown();' }],
    ['a deferred write', { extras: 'function mutate() { TOKENS.mira = unknown(); }' }],
    ['a destructuring write', { after: '[TOKENS.nova] = [unknown()];' }],
    ['a delete', { after: 'delete TOKENS.mira;' }],
    ['an opaque owner escape', { beforeRule: 'mutate(TOKENS);' }],
    ['a later opaque owner escape', { after: 'mutate(TOKENS);' }],
    ['an owner alias escape', { after: 'const alias = TOKENS; mutate(alias);' }],
    ['an exported owner', { table: 'export ' + TABLE, sharedBoundary: true }],
    [
      'a named owner export',
      { extras: 'export { TOKENS as sharedTokens };', sharedBoundary: true },
    ],
    [
      'an imported owner',
      {
        table: '',
        imports: "import { TOKENS } from './tokens';",
        files: { 'tokens.ts': 'export ' + TABLE },
        sharedBoundary: true,
      },
    ],
    [
      'an effectful imported list',
      {
        ids: '',
        imports: "import { IDS } from './profiles';",
        files: { 'profiles.ts': "export const IDS = ['nova', 'mira']; mutate(IDS);" },
      },
    ],
    [
      'an unknown sibling read of the same owner',
      { extras: 'function read(key) { return TOKENS[key]; }' },
    ],
    ['dynamic lexical evaluation', { after: "eval('TOKENS.nova = unknown()');" }],
    [
      'a derived bag outside this proof',
      {
        table: "const TOKENS = { nova: { color: 'bg-primary' }, mira: { color: 'bg-muted' } };",
        beforeRule: 'const recipe = TOKENS[profile];',
        argument: 'recipe.color',
        pathBoundary: true,
      },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it(
      (('sharedBoundary' in fixture && fixture.sharedBoundary) ||
      ('pathBoundary' in fixture && fixture.pathBoundary)
        ? 'preserves the private-proof boundary for '
        : 'retains unresolved coverage for ') + name,
      async () => {
        const { scan, privateProof, sharedFlatProof, pathProof, tokens } = await observe(fixture);
        if (
          ('sharedBoundary' in fixture && fixture.sharedBoundary) ||
          ('pathBoundary' in fixture && fixture.pathBoundary)
        ) {
          // The derived-bag case is now an explicit path-capability boundary:
          // its old flat proof still rejects, while the separately closed subtree
          // proof must agree with actual producer prefixes before scanner closure.
          if ('pathBoundary' in fixture && fixture.pathBoundary) {
            expect(sharedFlatProof).toBe(false);
            expect(pathProof).toBe(true);
          }
          // These three old capability boundaries remain negative controls for
          // the original private proof. The separately entry-bound shared proof
          // now also has to match the producer's exact two-profile CSS output.
          expect(privateProof).toBe(false);
          expect(scan.unresolved).toEqual([]);
          // This original derived-bag fixture has only color leaves, so retain
          // its exact two prefixes rather than adding the flat table's padding.
          expect(tokens.sort()).toEqual(
            'pathBoundary' in fixture && fixture.pathBoundary
              ? ['data-[profile=mira]:bg-muted', 'data-[profile=nova]:bg-primary']
              : expected
          );
          expect(scan.usages).toHaveLength(2);
        } else {
          expect(scan.unresolved.some(({ reason }) => reason === 'intent')).toBe(true);
          expect(scan.usages).toEqual([]);
        }
      }
    );
  }

  for (const [name, fixture] of [
    ['a table after the prototype registration', { table: '', suffix: TABLE }],
    ['a row list after the prototype registration', { ids: '', suffix: IDS }],
    [
      'a row alias initialized before its target list',
      { ids: "const IDS = LATER; const LATER = ['nova', 'mira'] as const;" },
    ],
    [
      'a key alias after its Rule',
      { argument: 'TOKENS[chosen]', afterRule: 'const chosen = profile;' },
    ],
    [
      'an imported primitive key from an effectful module',
      {
        imports: "import { KEY } from './key';",
        argument: 'TOKENS[KEY]',
        files: { 'key.ts': "export const KEY = 'nova'; sideEffect();" },
      },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('does not borrow collector-invisible values from ' + name, async () => {
      const { scan, tokens } = await observe(fixture);
      // The collector has no exact profile/table pair at these reads. A future
      // or imported AST declaration must not turn incomplete output green.
      expect(tokens.sort()).not.toEqual(expected);
      expect(scan.unresolved.some(({ reason }) => reason === 'intent')).toBe(true);
      expect(scan.usages).toEqual([]);
    });
  }

  it('recognizes the actual six OTP profile tables without removing any Rule observations', () => {
    const file = path.join(ROOT, 'packages/prototypes/shadcn/src/input-otp/slot.proto.ts');
    const inventory = scanRuleStateReadInventory([file]);
    const rows = inventory.evaluated.filter((row) => row.entryFile === file);
    expect(rows.length).toBeGreaterThanOrEqual(54);
    expect(
      rows.flatMap((row) => row.unresolved).filter(({ reason }) => reason === 'intent')
    ).toEqual([]);
  });
});
