import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createFiniteTokenMapProof } from '../src/services/finite-token-map-proof';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TABLE = "const TOKENS = { nova: 'bg-primary p-2', mira: 'bg-muted p-3' } as const;";
const expected = [
  'data-[profile=mira]:bg-muted',
  'data-[profile=mira]:p-3',
  'data-[profile=nova]:bg-primary',
  'data-[profile=nova]:p-2',
].sort();
type Fixture = {
  imports?: string;
  table?: string;
  extras?: string;
  before?: string;
  after?: string;
  argument?: string;
  files?: Record<string, string>;
  paths?: Record<string, string[]>;
};
async function observe({
  imports = "import { TOKENS } from './tokens';",
  table = '',
  extras = '',
  before = '',
  after = '',
  argument = 'TOKENS[profile]',
  files = { 'tokens.ts': 'export ' + TABLE },
  paths,
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-shared-token-map-')));
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
      `import { defineAsHook } from '@proto.ui/core';
      export const asProfile = defineAsHook({name:'shared-map-profile',setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},projectHandle:result=>({profile:result.stateHandles.profile})});`
    );
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `import {definePrototype,tw} from '@proto.ui/core';
      import {asProfile} from './producer';
      ${imports} ${table} ${extras}
      export default definePrototype({name:'shared-map-consumer',setup(def){
        const {profile:active}=asProfile(); ${before}
        for(const profile of ['nova','mira'] as const) {
          def.rule({when:w=>w.state(active).eq(profile),intent:i=>i.feedback.style.use(tw(${argument}))});
        }
        ${after}
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
    if (!target) throw new Error('Missing actual token argument');
    const rows = (loop: ts.ForOfStatement) => {
      let node: ts.Node = loop.expression;
      while (ts.isAsExpression(node)) node = node.expression;
      return ts.isArrayLiteralExpression(node)
        ? (node.elements as ts.NodeArray<ts.Expression>)
        : null;
    };
    const privateProof = createFiniteTokenMapProof(rows)(target);
    const sharedProof = createFiniteTokenMapProof(rows, parsed)(target);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      privateProof,
      sharedProof,
      scan: scanRuleStateReads(source, file),
      tokens: tokens.filter((token) => token.startsWith('data-[profile=')),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('entry-bound shared own-string token maps', () => {
  for (const [name, fixture] of [
    ['ordinary relative named import', {}],
    [
      'named import alias',
      { imports: "import {TOKENS as PAINT} from './tokens';", argument: 'PAINT[profile]' },
    ],
    [
      'named relative re-export',
      {
        imports: "import {PAINT as TOKENS} from './barrel';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'barrel.ts': "export {TOKENS as PAINT} from './tokens';",
        },
      },
    ],
    [
      'module-local named forwarding',
      {
        imports: "import {TOKENS} from './barrel';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'barrel.ts': "import {TOKENS} from './tokens'; export {TOKENS};",
        },
      },
    ],
    ['same-entry exported data', { imports: '', table: 'export ' + TABLE, files: {} }],
    [
      'same-entry named export',
      { imports: '', table: TABLE, extras: 'export {TOKENS as sharedPaint};', files: {} },
    ],
    [
      'unrelated lexical owner with the same name',
      { extras: 'function unrelated(TOKENS){TOKENS.nova=unknown();}' },
    ],
    ['primitive leaves passed to a consumer', { after: 'consume(TOKENS.nova);' }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('proves ' + name + ' while retaining the private-proof boundary', async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe(false);
      expect(result.sharedProof).toBe(true);
      expect(result.scan.unresolved).toEqual([]);
      expect(result.scan.usages).toHaveLength(2);
      expect(result.tokens.sort()).toEqual(expected);
    });
  }
  for (const [name, fixture] of [
    [
      'mutation in the defining module',
      { files: { 'tokens.ts': 'export ' + TABLE + ' TOKENS.nova=unknown();' } },
    ],
    [
      'deferred mutation in the defining module',
      { files: { 'tokens.ts': 'export ' + TABLE + ' function later(){TOKENS.mira=unknown();}' } },
    ],
    ['entry mutation before the rule', { before: 'TOKENS.nova=unknown();' }],
    ['entry mutation after the rule', { after: 'TOKENS.mira=unknown();' }],
    ['computed entry mutation', { after: 'TOKENS[unknownKey]=unknown();' }],
    ['destructuring assignment', { after: '[TOKENS.nova]=[unknown()];' }],
    ['deletion', { after: 'delete TOKENS.nova;' }],
    ['deferred entry mutation', { extras: 'function later(){TOKENS.nova=unknown();}' }],
    ['opaque owner escape', { before: 'mutate(TOKENS);' }],
    ['later opaque owner escape', { after: 'mutate(TOKENS);' }],
    ['const alias escape', { after: 'const alias=TOKENS; mutate(alias);' }],
    ['returned owner', { extras: 'function leak(){return TOKENS;}' }],
    [
      'member descriptor write',
      { after: "Object.defineProperty(TOKENS,'nova',{value:unknown()});" },
    ],
    [
      'mutation in a runtime sibling',
      {
        imports: "import {TOKENS} from './tokens'; import './sibling';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'sibling.ts':
            "import {TOKENS} from './tokens'; export function later(){TOKENS.nova=unknown();}",
        },
      },
    ],
    [
      'namespace escape in a runtime sibling',
      {
        imports: "import {TOKENS} from './tokens'; import './sibling';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'sibling.ts': "import * as all from './tokens'; export function later(){mutate(all);}",
        },
      },
    ],
    [
      'unmodeled barrel initializer',
      {
        imports: "import {TOKENS} from './barrel';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'barrel.ts': "export {TOKENS} from './tokens'; unknown();",
        },
      },
    ],
    [
      'producer-invisible wildcard forwarding',
      {
        imports: "import {TOKENS} from './barrel';",
        files: { 'tokens.ts': 'export ' + TABLE, 'barrel.ts': "export * from './tokens';" },
      },
    ],
    [
      'producer-invisible default import',
      {
        imports: "import TOKENS from './tokens';",
        files: { 'tokens.ts': TABLE + ' export default TOKENS;' },
      },
    ],
    [
      'producer-invisible extension substitution',
      { imports: "import {TOKENS} from './tokens.js';" },
    ],
    [
      'producer-unregistered alias import',
      {
        imports: "import {TOKENS} from '@paint/tokens';",
        paths: { '@paint/tokens': ['./tokens.ts'] },
      },
    ],
    [
      'producer-unregistered alias forwarding',
      {
        imports: "import {TOKENS} from './barrel';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'barrel.ts': "export {TOKENS} from '@paint/tokens';",
        },
        paths: { '@paint/tokens': ['./tokens.ts'] },
      },
    ],
    [
      'producer-unregistered local import forwarding',
      {
        imports: "import {TOKENS} from './barrel';",
        files: {
          'tokens.ts': 'export ' + TABLE,
          'barrel.ts': "import {TOKENS} from '@paint/tokens'; export {TOKENS};",
        },
        paths: { '@paint/tokens': ['./tokens.ts'] },
      },
    ],
    ['unknown sibling member access', { extras: 'function read(key){return TOKENS[key];}' }],
    [
      'getters',
      {
        files: {
          'tokens.ts': "export const TOKENS={nova:'bg-primary',get mira(){return 'bg-muted'}};",
        },
      },
    ],
    [
      'object spreads',
      {
        files: {
          'tokens.ts': "export const TOKENS={nova:'bg-primary',mira:'bg-muted',...foreign};",
        },
      },
    ],
    [
      'non-string siblings',
      {
        files: {
          'tokens.ts': "export const TOKENS={nova:'bg-primary',mira:'bg-muted',extra:foreign};",
        },
      },
    ],
    [
      'prototype-bearing members',
      {
        files: {
          'tokens.ts':
            "export const TOKENS={nova:'bg-primary',mira:'bg-muted',constructor:'bg-red'};",
        },
      },
    ],
    ['dynamic lexical evaluation', { after: "eval('TOKENS.nova=unknown()');" }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('withholds shared proof for ' + name, async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe(false);
      expect(result.sharedProof).toBe(false);
      expect(result.scan.unresolved.length).toBeGreaterThan(0);
    });
  }
});
