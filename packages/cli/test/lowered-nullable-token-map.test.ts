import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TABLE = `const TABLE = {
  nova: { surface: 'bg-primary p-2' },
  mira: null,
} as const;`;

async function observe({
  table = TABLE,
  projection = 'const recipe = TABLE[profile];',
  before = 'if (recipe) {',
  argument = 'recipe.surface',
  after = '}',
  suffix = '',
}: {
  table?: string;
  projection?: string;
  before?: string;
  argument?: string;
  after?: string;
  suffix?: string;
} = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-nullable-token-map-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    const file = path.join(directory, 'consumer.proto.ts');
    await writeFile(
      file,
      `import {definePrototype,tw} from '@proto.ui/core';
      ${table}
      export default definePrototype({name:'nullable-map-consumer',setup(def){
        const selected=def.state.enum('profile','nova',{options:['nova','mira']});
        def.expose.state('profile',selected);
        for(const profile of ['nova','mira'] as const){
          ${projection}
          ${before}
          def.rule({when:w=>w.state(selected).eq(profile),
            intent:i=>i.feedback.style.use(tw(${argument}))});
          ${after}
        }
      }});
      ${suffix}`
    );
    const inventory = scanRuleStateReadInventory([file]);
    return {
      rows: inventory.evaluated,
      unresolved: inventory.evaluated.flatMap((row) => row.unresolved),
      tokens: (await collectProtoStyleTokensFromFiles([file])).filter((token) =>
        token.startsWith('data-[profile=')
      ),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('private nullable token-map projection', () => {
  it('retains the finite own string leaves of a const projection inside its truthy branch', async () => {
    const result = await observe();
    expect(result.rows).toHaveLength(2);
    expect(result.unresolved).toEqual([]);
    expect(result.tokens).toEqual(['data-[profile=nova]:bg-primary', 'data-[profile=nova]:p-2']);
  });

  it('keeps the same lexical guard through type-only wrappers', async () => {
    const result = await observe({ before: 'if (((recipe as unknown))) {' });
    expect(result.unresolved).toEqual([]);
    expect(result.tokens).toEqual(['data-[profile=nova]:bg-primary', 'data-[profile=nova]:p-2']);
  });

  it.each([
    ['unguarded read', { before: '', after: '' }],
    ['false branch', { before: 'if(recipe) {} else {' }],
    ['inverted condition', { before: 'if(!recipe) {' }],
    ['unrelated guard', { before: 'if(unknownCondition) {' }],
    [
      'same-spelled shadow guard',
      { before: 'function invoke(recipe){if(recipe){', after: '}} invoke(unknownValue);' },
    ],
    ['mutable projection', { projection: 'let recipe = TABLE[profile];' }],
    [
      'reassigned projection',
      { projection: 'const recipe = TABLE[profile]; recipe=unknownValue;' },
    ],
    ['unknown projection consumer', { before: 'opaque(recipe); if(recipe){' }],
    ['retained child mutation', { before: "if(recipe){recipe.surface='changed';" }],
    ['owner export', { table: TABLE.replace('const TABLE', 'export const TABLE') }],
    ['owner exported by alias', { suffix: 'export {TABLE as publicTable};' }],
    ['owner escape', { suffix: 'opaque(TABLE);' }],
    [
      'getter child',
      { table: "const TABLE={nova:{get surface(){return 'bg-primary';}},mira:null};" },
    ],
    [
      'missing own leaf',
      { table: "const TABLE={nova:{surface:'bg-primary'},mira:{other:'p-2'}};" },
    ],
  ] as const)('keeps %s unresolved', async (_name, fixture) => {
    const result = await observe(fixture);
    expect(result.unresolved).toContainEqual(
      expect.objectContaining({
        expression: expect.stringContaining('tw(recipe.surface)'),
        reason: 'intent',
      })
    );
  });
});
