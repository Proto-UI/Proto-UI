import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TABLE = "const TABLE = { nova: tw('bg-primary p-2'), mira: tw('bg-muted p-3') };";
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
  body?: string;
  after?: string;
  suffix?: string;
  rows?: string;
  intent?: string;
  call?: string;
  entryPrefix?: string;
  entrySuffix?: string;
  helperSuffix?: string;
  imported?: boolean;
  localHelper?: boolean;
  helperExport?: 'declaration' | 'named' | 'aliased' | 'private';
  directDefaultCall?: boolean;
  privateState?: boolean;
  when?: string;
  exactVisits?: number;
  files?: Readonly<Record<string, string>>;
};

async function observe({
  table = TABLE,
  imports = '',
  extras = '',
  before = '',
  body = '',
  after = '',
  suffix = '',
  rows = "['nova', 'mira'] as const",
  intent = 'i => i.feedback.style.use(TABLE[profile])',
  call = 'paint(def);',
  entryPrefix = '',
  entrySuffix = '',
  helperSuffix = '',
  imported = true,
  localHelper = false,
  helperExport = 'declaration',
  directDefaultCall = false,
  privateState = false,
  when = 'w => w.state(active).eq(profile)',
  files = {},
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-private-style-map-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: path.join(ROOT, 'tsconfig.json'),
      })
    );
    await writeFile(
      path.join(directory, 'producer.ts'),
      `
      import { defineAsHook } from '@proto.ui/core';
      export const asProfile = defineAsHook({name:'private-style-map-profile',
        setup(def){def.state.enum('profile','nova',{options:['nova','mira']});},
        projectHandle: result => ({profile: result.stateHandles.profile})});
    `
    );
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const modulePrefix = `import { definePrototype, tw } from '@proto.ui/core';
      import { asProfile } from './producer'; ${imports} ${table} ${extras}`;
    const state = privateState
      ? "const active=def.state.enum('profile','nova',{options:['nova','mira']});"
      : 'const {profile: active} = asProfile();';
    const paint = `${helperExport === 'declaration' ? 'export ' : ''}function paint(def) {
      ${state} ${before}
      for (const profile of ${rows}) { ${body}
        def.rule({when: ${when}, intent: ${intent}});
      }
      ${after}
    } ${helperSuffix}
      ${helperExport === 'named' ? 'export {paint};' : ''}
      ${helperExport === 'aliased' ? 'export {paint as palette};' : ''}`;
    const file = path.join(directory, 'entry.proto.ts');
    const source = localHelper
      ? `${modulePrefix} ${paint} ${entryPrefix}
          const entry = definePrototype({name:'private-style-map', setup(def){${call}}});
          export default entry; ${entrySuffix} ${suffix}`
      : imported
        ? `import { definePrototype } from '@proto.ui/core'; import { ${helperExport === 'aliased' ? 'palette as paint' : 'paint'} } from './paint';
          ${entryPrefix}
          export default definePrototype({name:'private-style-map', setup(def){${call}}});
          ${entrySuffix}`
        : `${modulePrefix}
          ${directDefaultCall ? 'export default' : 'const entry ='} definePrototype({name:'private-style-map',setup(def){
            ${state} ${before}
            for (const profile of ${rows}) { ${body}
              def.rule({when:${when},intent:${intent}});
            } ${after}
          }}); ${directDefaultCall ? '' : 'export default entry;'} ${suffix}`;
    if (imported && !localHelper)
      await writeFile(path.join(directory, 'paint.ts'), `${modulePrefix} ${paint} ${suffix}`);
    await writeFile(file, source);
    const inventory = scanRuleStateReadInventory([file]);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    return {
      evaluated: inventory.evaluated,
      unresolved: inventory.evaluated.flatMap((row) => row.unresolved),
      tokens: tokens.filter((token) => token.startsWith('data-[profile=')).sort(),
      allTokens: tokens.sort(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('private canonical Core StyleHandle maps', () => {
  for (const [name, fixture] of [
    ['a unique direct native setup consumer', { imported: false }],
    ['one directly imported synchronous native Def helper', {}],
    ['an equivalent helper-local named export', { helperExport: 'named' }],
    ['an equivalent helper-local aliased export', { helperExport: 'aliased' }],
    ['one private helper in the entry module', { localHelper: true, helperExport: 'private' }],
    ['literal dot access', { intent: 'i => i.feedback.style.use(TABLE.nova)' }],
    ['literal bracket access', { intent: "i => i.feedback.style.use(TABLE['nova'])" }],
    ['prior literal row binding', { extras: "const ROWS=['nova','mira'] as const;", rows: 'ROWS' }],
    [
      'named imported literal rows',
      {
        imports: "import {ROWS} from './rows';",
        rows: 'ROWS',
        files: { 'rows.ts': "export const ROWS=['nova','mira'] as const;" },
      },
    ],
    [
      'a same-named unrelated local binding',
      { extras: 'function unrelated(TABLE){TABLE.nova=foreign;}' },
    ],
    [
      'variadic literal Core tw initialization',
      {
        table: TABLE.replace("tw('bg-primary p-2')", "tw('bg-primary', 'p-2')"),
      },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('proves ' + name + ' and retains actual producer prefixes', async () => {
      const result = await observe(fixture);
      expect(result.evaluated).toHaveLength(2);
      expect(result.unresolved).toEqual([]);
      const config: Fixture = fixture;
      const fixed =
        config.intent?.includes('TABLE.nova') || config.intent?.includes("TABLE['nova']");
      expect(result.tokens).toEqual(
        fixed
          ? [
              'data-[profile=mira]:bg-primary',
              'data-[profile=mira]:p-2',
              'data-[profile=nova]:bg-primary',
              'data-[profile=nova]:p-2',
            ].sort()
          : expected
      );
    });
  }

  for (const [name, fixture] of [
    ['a private runtime State', { privateState: true }],
    [
      'a private runtime State beside a real prop predicate',
      {
        privateState: true,
        when: "w => w.all(w.state(active).eq(profile),w.prop('active').eq(true))",
      },
    ],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('collects the imported handles used by ' + name, async () => {
      const result = await observe(fixture);
      expect(result.evaluated).toHaveLength(2);
      expect(result.allTokens).toEqual(['bg-muted', 'bg-primary', 'p-2', 'p-3']);
      expect(result.unresolved).toEqual([]);
      expect(result.tokens).toEqual([]);
    });
  }

  for (const [name, fixture] of [
    ['an unmodeled direct default-export call', { imported: false, directDefaultCall: true }],
    ['a second foreign caller', { entrySuffix: 'paint(foreign);' }],
    ['a second native caller', { call: 'paint(def); paint(def);' }],
    ['an escaped helper', { entrySuffix: 'opaque(paint);' }],
    ['a retained helper alias', { entryPrefix: 'const alias=paint;' }],
    ['a helper in a returned container', { entrySuffix: 'export const methods={paint};' }],
    ['a public helper in the entry module', { localHelper: true }],
    ['an entry-local named helper re-export', { entrySuffix: 'export {paint};' }],
    [
      'a direct named helper re-export',
      { entrySuffix: "export {paint as publicPaint} from './paint';" },
    ],
    ['a wildcard helper re-export', { entrySuffix: "export * from './paint';" }],
    [
      'a reached named helper re-export barrel',
      {
        entryPrefix: "import './barrel';",
        files: { 'barrel.ts': "export {paint as publicPaint} from './paint';" },
      },
    ],
    ['a namespace import exposing the helper', { entryPrefix: "import * as ns from './paint';" }],
    [
      'a namespace barrel exposing the helper',
      {
        entryPrefix: "import './barrel';",
        files: { 'barrel.ts': "export * as ns from './paint';" },
      },
    ],
    [
      'an indirect helper call through a named barrel',
      {
        entryPrefix: "import {paint as forwarded} from './barrel';",
        call: 'forwarded(def);',
        files: { 'barrel.ts': "export {paint} from './paint';" },
      },
    ],
    ['a foreign Def', { call: 'paint(foreign);' }],
    ['a rebound native Def', { call: 'def=foreign; paint(def);' }],
    ['an escaped native Def', { call: 'opaque(def); paint(def);' }],
    ['a replaced native Rule operation', { call: 'def.rule=foreign; paint(def);' }],
    ['a deferred helper call', { call: 'queueMicrotask(()=>paint(def));' }],
    [
      'an opaque dynamic import',
      { entrySuffix: "import('./late');", files: { 'late.ts': 'export {};' } },
    ],
    ['an eval consumer', { before: "eval('TABLE.nova.tokens.push(unknown)');" }],
    ['a second whole-table consumer', { before: 'opaque(TABLE);' }],
    ['a second token-handle read', { before: 'opaque(TABLE.nova);' }],
    ['a retained token-handle alias', { before: 'const handle=TABLE.nova;' }],
    ['a token-array mutation', { before: "TABLE.nova.tokens.push('bg-danger');" }],
    ['a handle token-array replacement', { before: "TABLE.nova.tokens=['bg-danger'];" }],
    ['a handle kind replacement', { before: "TABLE.nova.kind='other';" }],
    ['a deferred table write', { after: 'queueMicrotask(()=>TABLE.nova=foreign);' }],
    ['an exported table', { table: 'export ' + TABLE }],
    ['a separately exported table', { suffix: 'export {TABLE};' }],
    ['a mutable table binding', { table: TABLE.replace('const TABLE', 'let TABLE') }],
    [
      'a nonliteral token constructor input',
      { table: TABLE.replace("tw('bg-primary p-2')", 'tw(unknown)') },
    ],
    [
      'a constructor-spread input',
      { table: TABLE.replace("tw('bg-primary p-2')", "tw(...['bg-primary p-2'])") },
    ],
    [
      'a foreign tw constructor',
      {
        imports: "import {fake as otherTw} from './fake';",
        table: TABLE.replaceAll('tw(', 'otherTw('),
        files: { 'fake.ts': 'export function fake(x){return {kind:"tw",tokens:[x]};}' },
      },
    ],
    [
      'an object-spread table',
      { table: "const TABLE={...unknown,nova:tw('bg-primary p-2'),mira:tw('bg-muted p-3')};" },
    ],
    [
      'a getter table',
      { table: "const TABLE={get nova(){return tw('bg-primary p-2')},mira:tw('bg-muted p-3')};" },
    ],
    ['a duplicate own key', { table: TABLE.replace('nova:', "nova: tw('old'), nova:") }],
    ['a missing own member', { intent: 'i => i.feedback.style.use(TABLE.missing)' }],
    ['an inherited member', { intent: 'i => i.feedback.style.use(TABLE.toString)' }],
    ['an optional member', { intent: 'i => i.feedback.style.use(TABLE?.[profile])' }],
    ['an unknown computed member', { intent: 'i => i.feedback.style.use(TABLE[unknown])' }],
    [
      'escaped local rows shadowing an equal module inventory',
      {
        extras: "const ROWS=['nova','mira'] as const;",
        before: "const ROWS=['nova','mira']; opaque(ROWS);",
        rows: 'ROWS',
        exactVisits: 1,
      },
    ],
    [
      'mutated local rows shadowing an equal module inventory',
      {
        extras: "const ROWS=['nova','mira'] as const;",
        before: "const ROWS=['nova','mira']; ROWS.push('unknown');",
        rows: 'ROWS',
        exactVisits: 1,
      },
    ],
    [
      'a token handle coerced through tw',
      { intent: 'i => i.feedback.style.use(tw(TABLE[profile]))' },
    ],
    [
      'an intent callback that escapes its builder',
      { intent: 'i => { opaque(i); i.feedback.style.use(TABLE[profile]); }' },
    ],
    [
      'an intent callback with a default builder',
      { intent: '(i=foreign) => i.feedback.style.use(TABLE[profile])' },
    ],
    ['an async intent', { intent: 'async i => i.feedback.style.use(TABLE[profile])' }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('keeps ' + name + ' unresolved', async () => {
      const result = await observe(fixture);
      // This must reach the original Rule intent, not pass because an earlier
      // condition or an empty inventory silently removed the observation.
      const config: Fixture = fixture;
      if (config.exactVisits !== undefined) {
        // An unknown local row domain retains its original lexical visit;
        // it cannot borrow two visits from a same-named module inventory.
        expect(result.evaluated).toHaveLength(config.exactVisits);
      } else expect(result.evaluated.length).toBeGreaterThanOrEqual(2);
      expect(
        result.unresolved.some((row) => row.reason === 'intent' && row.expression.includes('TABLE'))
      ).toBe(true);
    });
  }
});
