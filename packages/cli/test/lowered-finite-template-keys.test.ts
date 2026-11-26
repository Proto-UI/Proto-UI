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
const TABLE =
  "const TOKENS = { 'nova-surface': 'bg-primary p-2', 'mira-surface': 'bg-muted p-3' } as const;";
const expected = [
  'data-[profile=mira]:bg-muted',
  'data-[profile=mira]:p-3',
  'data-[profile=nova]:bg-primary',
  'data-[profile=nova]:p-2',
].sort();
type Fixture = {
  privateOwner?: boolean;
  profiles?: readonly string[];
  table?: string;
  extras?: string;
  beforeLoop?: string;
  inLoop?: string;
  afterLoop?: string;
  argument?: string;
};
async function observe({
  privateOwner = false,
  profiles = ['nova', 'mira'],
  table = TABLE,
  extras = '',
  beforeLoop = '',
  inLoop = '',
  afterLoop = '',
  argument = 'TOKENS[`${profile}-surface`]',
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-template-token-map-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(
      path.join(directory, 'producer.ts'),
      `import { defineAsHook } from '@proto.ui/core';
      export const asProfile = defineAsHook({name:'template-key-profile', setup(def){def.state.enum('profile',${JSON.stringify(profiles[0])},{options:${JSON.stringify(profiles)}});}, projectHandle:result=>({profile:result.stateHandles.profile})});`
    );
    if (!privateOwner) await writeFile(path.join(directory, 'tokens.ts'), 'export ' + table);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `import {definePrototype,tw} from '@proto.ui/core';
      import {asProfile} from './producer';
      ${privateOwner ? table : "import {TOKENS} from './tokens';"}
      ${extras}
      export default definePrototype({name:'template-map-consumer', setup(def){
        const {profile:active}=asProfile();
        ${beforeLoop}
        for(const profile of ${JSON.stringify(profiles)} as const){
          ${inLoop}
          def.rule({when:w=>w.state(active).eq(profile), intent:i=>i.feedback.style.use(tw(${argument}))});
        }
        ${afterLoop}
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
      tokens: tokens.filter((token) => token.startsWith('data-[profile=')).sort(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('finite primitive template keys retain exact production tokens', () => {
  for (const [name, fixture] of [
    ['shared literal suffix', {}],
    ['private literal suffix', { privateOwner: true }],
    [
      'constant primitive interpolation',
      { beforeLoop: "const suffix = '-surface';", argument: 'TOKENS[`${profile}${suffix}`]' },
    ],
    [
      'lexically bound template alias',
      { inLoop: 'const chosen = `${profile}-surface`;', argument: 'TOKENS[chosen]' },
    ],
    ['nested primitive template', { argument: 'TOKENS[`${`${profile}`}-surface`]' }],
    [
      'same-named key in an unrelated function',
      { extras: 'function unrelated(profile){ return profile; }' },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('resolves ' + name, async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe('privateOwner' in fixture && fixture.privateOwner === true);
      expect(result.sharedProof).toBe(true);
      expect(result.scan.unresolved).toEqual([]);
      expect(result.scan.usages).toHaveLength(2);
      expect(result.tokens).toEqual(expected);
    });
  }
  it('resolves every combination of two independent finite loop keys', async () => {
    const result = await observe({
      table:
        "const TOKENS={'nova-surface':'bg-primary p-2','mira-surface':'bg-muted p-3','nova-border':'border-primary','mira-border':'border-muted'};",
      beforeLoop: "for(const part of ['surface','border'] as const){",
      afterLoop: '}',
      argument: 'TOKENS[`${profile}-${part}`]',
    });
    expect(result.privateProof).toBe(false);
    expect(result.sharedProof).toBe(true);
    expect(result.scan.unresolved).toEqual([]);
    expect(result.scan.usages).toHaveLength(4);
    expect(result.tokens).toEqual(
      [...expected, 'data-[profile=mira]:border-muted', 'data-[profile=nova]:border-primary'].sort()
    );
  });
  for (const [name, fixture] of [
    [
      'a mutable primitive key',
      { beforeLoop: "let suffix = '-surface';", argument: 'TOKENS[`${profile}${suffix}`]' },
    ],
    [
      'an opaque interpolation',
      { beforeLoop: 'const suffix = unknown();', argument: 'TOKENS[`${profile}${suffix}`]' },
    ],
    ['authored object coercion', { argument: "TOKENS[`${{toString(){return 'nova-surface';}}}`]" }],
    ['tagged evaluation', { argument: 'TOKENS[tag`${profile}-surface`]' }],
    ['a missing possible own key', { table: "const TOKENS={'nova-surface':'bg-primary p-2'};" }],
    [
      'a later same-owner template write',
      { afterLoop: "TOKENS[`${'nova'}-surface`]='bg-red-500';" },
    ],
    [
      'a deferred same-owner template write',
      { extras: "function later(){ TOKENS[`${'nova'}-surface`]='bg-red-500'; }" },
    ],
    [
      'an unknown same-owner sibling read',
      { extras: 'function read(key){return TOKENS[`${key}-surface`];}' },
    ],
    ['an escaping whole map', { afterLoop: 'mutate(TOKENS);' }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('withholds proof for ' + name, async () => {
      const result = await observe(fixture);
      expect(result.privateProof).toBe(false);
      expect(result.sharedProof).toBe(false);
      expect(result.scan.unresolved.length).toBeGreaterThan(0);
    });
  }
});

it('withholds a 17 by 17 primitive-key cross product above the 256-key bound', async () => {
  const profiles = Array.from({ length: 17 }, (_, index) => `p${index}`);
  const parts = Array.from({ length: 17 }, (_, index) => `k${index}`);
  const table = Object.fromEntries(
    profiles.flatMap((profile) => parts.map((part) => [`${profile}-${part}`, 'p-2']))
  );
  const result = await observe({
    profiles,
    table: `const TOKENS=${JSON.stringify(table)};`,
    beforeLoop: `for(const part of ${JSON.stringify(parts)} as const){`,
    afterLoop: '}',
    argument: 'TOKENS[`${profile}-${part}`]',
  });
  expect(result.privateProof).toBe(false);
  expect(result.sharedProof).toBe(false);
  expect(result.scan.unresolved.length).toBeGreaterThan(0);
});
