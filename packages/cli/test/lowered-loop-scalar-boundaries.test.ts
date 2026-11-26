import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rule = (condition = 'selected', builder = 'w', async = '') => `
  def.rule({ when: ${async}${builder} => ${condition}
    ? ${builder}.state(ready).eq(true)
    : ${builder}.all(${builder}.state(ready).eq(true), ${builder}.state(secondary).eq(true)),
    intent: i => i.feedback.style.use(tw('bg-primary')) });
`;
const entry = (body: string, prefix = '', setup = 'setup') => `
  import { definePrototype, tw } from '@proto.ui/core';
  export default definePrototype({ name: 'literal-iteration-scalar', ${setup}(def) {
    const ready = def.state.bool('ready', false);
    const secondary = def.state.bool('secondary', false);
    def.expose.state('ready', ready);
    def.expose.state('secondary', secondary);
    ${prefix}
    ${body}
  } });
`;
const loop = (body = rule(), rows = '[false, true]', binding = 'const selected') =>
  `for (${binding} of ${rows}) { ${body} }`;
const exactTokens = [
  'bg-primary',
  'data-[ready]:bg-primary',
  'data-[ready]:data-[secondary]:bg-primary',
];

describe('literal iteration scalars stay separate from source and container authority', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-iteration-scalar-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const observe = async (source: string) => {
    const file = path.join(directory, 'entry.proto.ts');
    await writeFile(file, source);
    const inventory = scanRuleStateReadInventory([file]);
    expect(inventory.files).toEqual([file]);
    return {
      rows: inventory.evaluated.filter((row) => row.entryFile === file),
      tokens: await collectProtoStyleTokensFromFiles([file]),
    };
  };

  it.each([
    ['direct rows', entry(loop())],
    [
      'immutable local scalar aliases',
      entry(loop(`const alias = selected; const condition = alias === true; ${rule('condition')}`)),
    ],
    [
      'an unrelated same-named parameter write',
      entry(loop(`const unrelated = (selected) => { selected = external; }; ${rule()}`)),
    ],
    ['zero and positive numeric rows', entry(loop(rule(), '[0, +1]'))],
    ['null and literal string rows', entry(loop(rule(), '[null, "ready"]'))],
  ])('keeps both actual row visits and exact branches for %s', async (_label, source) => {
    const { rows, tokens } = await observe(source);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.rule.start)).size).toBe(1);
    expect(rows.map((row) => row.declarationOnly)).toEqual([false, false]);
    expect(rows.map((row) => row.unresolved)).toEqual([[], []]);
    expect(rows.map((row) => row.exposedLocals.length)).toEqual([2, 1]);
    expect(tokens).toEqual(exactTokens);
  });

  it('keeps a nested same-spelled induction binding separate from its outer row', async () => {
    const { rows, tokens } = await observe(
      entry(loop(`for (const selected of [false, true]) { ${rule()} }`, '["outer"]'))
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.unresolved)).toEqual([[], []]);
    expect(rows.map((row) => row.exposedLocals.length)).toEqual([2, 1]);
    expect(tokens).toEqual(exactTokens);
  });

  it.each([
    ['let induction binding', entry(loop(rule(), '[false, true]', 'let selected')), 2],
    ['var induction binding', entry(loop(rule(), '[false, true]', 'var selected')), 2],
    ['direct induction write', entry(loop(`selected = external; ${rule()}`)), 2],
    [
      'deferred induction write',
      entry(loop(`defer(() => { selected = external; }); ${rule()}`)),
      2,
    ],
    ['destructured object write', entry(loop(`({ value: selected } = external); ${rule()}`)), 2],
    ['destructured tuple write', entry(loop(`[selected] = external; ${rule()}`)), 2],
    ['nested assignment loop', entry(loop(`for (selected of external) {} ${rule()}`)), 2],
    ['mutable scalar alias', entry(loop(`let alias = selected; ${rule('alias')}`)), 2],
    [
      'rewritten scalar alias',
      entry(loop(`const alias = selected; defer(() => { alias = external; }); ${rule('alias')}`)),
      2,
    ],
    ['unknown lexical shadow', entry(loop(`{ const selected = external; ${rule()} }`)), 2],
    ['same-named builder parameter', entry(loop(rule('selected', 'selected'))), 2],
    ['opaque scalar predicate', entry(loop(rule('opaque(selected)'))), 2],
    ['async When callback', entry(loop(rule('selected', 'w', 'async '))), 2],
    ['async setup activation', entry(loop(), '', 'async setup'), 2],
    ['for-await activation', entry(loop().replace('for (', 'for await ('), '', 'async setup'), 2],
    ['escaped callback activation', entry(loop(`defer(() => { ${rule()} });`)), 2, true],
    [
      'alias in escaped callback activation',
      entry(loop(`const alias = selected; defer(() => { ${rule('alias')} });`)),
      2,
      true,
    ],
    [
      'nested when-shaped escaped callback',
      entry(loop(`external({ when: () => { ${rule()} } });`)),
      2,
      true,
    ],
    ['unknown iterable', entry(loop(rule(), 'externalRows')), 1],
    [
      'bound iterable without this capability',
      entry(loop(rule(), 'rows'), 'const rows = [false, true];'),
      2,
    ],
    [
      'shared compound row read',
      entry(loop(rule(), '[row.value, true]'), 'const row = {value: false};'),
      2,
    ],
    ['unknown inline row', entry(loop(rule(), '[external, true]')), 2],
    ['spread inline rows', entry(loop(rule(), '[...[false, true]]')), 1],
    ['direct eval', entry(loop(`eval('selected = external'); ${rule()}`)), 2],
  ] as const)(
    'retains the condition gap and all authored visits for %s',
    async (_label, source, count, declarationOnly: boolean = false) => {
      const { rows, tokens } = await observe(source);
      expect(rows).toHaveLength(count);
      expect(rows.map((row) => row.declarationOnly)).toEqual(Array(count).fill(declarationOnly));
      expect(rows.every((row) => row.unresolved.some((miss) => miss.reason === 'condition'))).toBe(
        true
      );
      expect(tokens).toEqual(['bg-primary']);
    }
  );

  it.each([
    ['tuple', `const rows = [['owned', 'h-8'], ['other', 'h-9']];`, '[name, token]'],
    [
      'object',
      `const rows = [{name: 'owned', token: 'h-8'}, {name: 'other', token: 'h-9'}];`,
      '{name, token}',
    ],
  ])(
    'keeps %s raw tokens without certifying a State name or a condition',
    async (_label, prefix, pattern) => {
      const { rows, tokens } = await observe(
        entry(
          `
      for (const ${pattern} of rows) {
        const state = def.state.string(name, 'rest');
        def.expose.state('visible', state);
        def.rule({ when: w => name === 'owned' ? w.state(state).eq('hot') : w.state(ready).eq(true),
          intent: i => i.feedback.style.use(tw(token)) });
      }
    `,
          prefix
        )
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
      expect(tokens).toEqual(['h-8', 'h-9']);
    }
  );

  it('keeps a finite inventory when a compound loop deletes and reinserts its row', async () => {
    const { tokens } = await observe(
      entry(`
      const rows = [{token: 'h-8'}];
      for (const {token} of rows) {
        delete rows[0];
        rows[0] = {token: 'h-9'};
        tw(token);
      }
    `)
    );
    // Destructuring copied h-8 before the array slot changed. Reinserting that
    // same slot does not add a second iteration to JavaScript's array iterator.
    const runtimeRows = [{ token: 'h-8' }];
    const runtimeTokens: string[] = [];
    for (const { token } of runtimeRows) {
      delete runtimeRows[0];
      runtimeRows[0] = { token: 'h-9' };
      runtimeTokens.push(token);
    }
    expect(runtimeTokens).toEqual(['h-8']);
    expect(tokens).toEqual(runtimeTokens);
  });

  it.each([
    ['own member mutation', `const rows = [{token: 'h-8'}]; rows[0].token = 'h-9';`, ['h-9']],
    [
      'nested container alias',
      `const rows = [{token: 'h-8'}]; const alias = rows[0]; alias.token = 'h-9';`,
      ['h-9'],
    ],
    ['partial leaf', `const rows = [{token: choose ? 'h-8' : external}];`, ['h-8']],
    ['escaped compound container', `const rows = [{token: 'h-8'}]; external(rows[0]);`, ['h-8']],
  ] as const)('retains the remaining raw inventory after %s', async (_label, prefix, expected) => {
    const { tokens } = await observe(entry('for (const {token} of rows) tw(token);', prefix));
    expect(tokens).toEqual(expected);
  });
});
