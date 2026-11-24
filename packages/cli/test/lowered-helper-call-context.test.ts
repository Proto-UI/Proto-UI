import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReadsWithSites } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

/**
 * The collector's conditional tokens and the independent declaration inventory
 * are separate observations. Production scanning can replay a closed helper,
 * so its result is not the raw declaration inventory. The explicit raw pass
 * keeps every original assertion below, independently of that production pass.
 *
 * A token contributed by one known rule cannot prove another rule's unknown
 * context. This test does not create or infer runtime graph entries.
 */
const factsSource = [
  "import { defineAsHook } from '@proto.ui/core';",
  'export const asFirstFacts = defineAsHook({',
  "  name: 'helper-context-first',",
  "  setup(def) { def.state.bool('firstReady', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.firstReady }; },',
  '});',
  'export const asSecondFacts = defineAsHook({',
  "  name: 'helper-context-second',",
  "  setup(def) { def.state.bool('secondReady', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.secondReady }; },',
  '});',
].join('\n');

const imports = [
  "import { definePrototype, tw } from '@proto.ui/core';",
  "import { asFirstFacts, asSecondFacts } from './facts';",
  'declare const external: (...values: unknown[]) => unknown;',
].join('\n');

const leafHelper = [
  'function paintLeaf(target, held) {',
  '  target.rule({',
  '    when: (w) => w.state(held).eq(true),',
  "    intent: (i) => i.feedback.style.use(tw('opacity-50')),",
  '  });',
  '}',
].join('\n');

const bagHelper = [
  'function paintBag(target, facts) {',
  '  target.rule({',
  '    when: (w) => w.state(facts.ready).eq(true),',
  "    intent: (i) => i.feedback.style.use(tw('opacity-50')),",
  '  });',
  '}',
].join('\n');

const leafEffectHelper = leafHelper.replace('(target, held)', '(target, held, ignored)');
const bagEffectHelper = bagHelper.replace('(target, facts)', '(target, facts, ignored)');

const tokenHelper = [
  'function paintToken(target, held, paint) {',
  '  target.rule({',
  '    when: (w) => w.state(held).eq(true),',
  '    intent: (i) => i.feedback.style.use(tw(paint)),',
  '  });',
  '}',
].join('\n');

function consumer(body: readonly string[], helper = leafHelper): string {
  return [
    imports,
    helper,
    'export default definePrototype({',
    "  name: 'helper-context-consumer',",
    '  setup(def) {',
    ...body,
    '  },',
    '});',
  ].join('\n');
}

type Fixture = {
  name: string;
  source: string;
  tokens: readonly string[];
  reasons?: readonly ('subject' | 'intent')[];
  usageCount?: number;
  files?: Readonly<Record<string, string>>;
};

const firstOpacity = 'data-[first-ready]:opacity-50';
const secondOpacity = 'data-[second-ready]:opacity-50';

async function observeFixture(fixture: Fixture) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'lowered-helper-context-')));
  try {
    await writeFile(path.join(directory, 'tsconfig.json'), '{}');
    const files = {
      'facts.ts': factsSource,
      'consumer.proto.ts': fixture.source,
      ...fixture.files,
    };
    const sources = Object.entries(files).sort(([left], [right]) => left.localeCompare(right));
    for (const [name, text] of sources) await writeFile(path.join(directory, name), text);
    const paths = sources.map(([name]) => path.join(directory, name));

    // Use actual files and the same complete fixture enumeration on both paths.
    // Each path owns its analysis context; raw inventory never seeds collection.
    const tokens = (await collectProtoStyleTokensFromFiles(paths)).filter((token) =>
      token.startsWith('data-[')
    );
    const summary = createHookSourceSummaryContext();
    const scans = sources.map(([name, source]) => ({
      file: path.join(directory, name),
      scan: scanRuleStateReadsWithSites(source, path.join(directory, name), summary).raw,
    }));
    return {
      tokens,
      misses: scans.flatMap(({ file, scan }) => scan.unresolved.map((miss) => ({ file, ...miss }))),
      // Provenance is intentionally non-enumerable on the public raw usage.
      usages: scans.flatMap(({ file, scan }) =>
        scan.usages.map((usage) => ({
          file,
          hook: usage.hook,
          state: usage.state,
          provenance: usage.provenance,
        }))
      ),
      exposedLocals: scans.flatMap(({ scan }) => scan.exposedLocals),
      producer: path.join(directory, 'facts.ts'),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const fixtures: readonly Fixture[] = [
  {
    name: 'observes a real State selector through a same-source helper and retains its raw subject gap',
    source: consumer(['    paintLeaf(def, asFirstFacts().ready);']),
    tokens: [firstOpacity],
  },
  {
    name: 'keeps the same observations when the helper and its formals are renamed',
    source: consumer(
      ['    decorate(owner, asFirstFacts().ready);'],
      leafHelper
        .replaceAll('paintLeaf', 'decorate')
        .replaceAll('target', 'receiver')
        .replaceAll('held', 'subject')
    ).replace('setup(def)', 'setup(owner)'),
    tokens: [firstOpacity],
  },
  {
    name: 'collects an exported helper at its real known call without proving the raw parameter',
    source: consumer(
      ['    paintLeaf(def, asFirstFacts().ready);'],
      leafHelper.replace('function paintLeaf', 'export function paintLeaf')
    ),
    tokens: [firstOpacity],
  },
  {
    name: 'keeps distinct State and token arguments at two calls of one helper',
    source: consumer(
      [
        "    paintToken(def, asFirstFacts().ready, 'opacity-50');",
        "    paintToken(def, asSecondFacts().ready, 'bg-primary');",
      ],
      tokenHelper
    ),
    tokens: [firstOpacity, 'data-[second-ready]:bg-primary'],
    reasons: ['intent'],
  },
  {
    name: 'reads a proven own-data State container at the actual helper call',
    source: consumer(
      ['    const facts = { ready: asFirstFacts().ready };', '    paintBag(def, facts);'],
      bagHelper
    ),
    tokens: [firstOpacity],
  },
  {
    name: 'retains the raw helper gap when one call is known and another argument is unknown',
    source: consumer([
      '    paintLeaf(def, asFirstFacts().ready);',
      '    paintLeaf(def, external());',
    ]),
    tokens: [firstOpacity],
  },
  {
    name: 'does not obtain a conditional selector from an entirely unknown State argument',
    source: consumer(['    paintLeaf(def, external());']),
    tokens: [],
  },
  {
    name: 'keeps an uninvoked rule-bearing helper visible to raw inventory',
    source: [imports, leafHelper].join('\n'),
    tokens: [],
  },
  {
    name: 'does not invoke a same-spelled helper after a nearer binding shadows it',
    source: consumer([
      '    const paintLeaf = external;',
      '    paintLeaf(def, asFirstFacts().ready);',
    ]),
    tokens: [],
  },
  {
    name: 'withholds the conditional selector after a container escapes to an unknown call',
    source: consumer(
      [
        '    const facts = { ready: asFirstFacts().ready };',
        '    external(facts);',
        '    paintBag(def, facts);',
      ],
      bagHelper
    ),
    tokens: [],
  },
  {
    name: 'withholds a captured container member after a later argument can mutate it',
    source: consumer(
      [
        '    const facts = { ready: asFirstFacts().ready };',
        '    paintBag(def, facts, external(facts));',
      ],
      bagEffectHelper
    ),
    tokens: [],
  },
  {
    name: 'captures an early State leaf before a later argument replaces its former member',
    source: consumer(
      [
        '    const facts = { ready: asFirstFacts().ready };',
        '    paintLeaf(def, facts.ready, (facts.ready = asSecondFacts().ready));',
      ],
      leafEffectHelper
    ),
    tokens: [firstOpacity],
  },
  {
    name: 'reads the current member of an early container after a later argument writes it',
    source: consumer(
      [
        '    const facts = { ready: asFirstFacts().ready };',
        '    paintBag(def, facts, (facts.ready = asSecondFacts().ready));',
      ],
      bagEffectHelper
    ),
    tokens: [secondOpacity],
  },
  {
    name: 'keeps the captured container when a later argument rebinds its original variable',
    source: consumer(
      [
        '    let facts = { ready: asFirstFacts().ready };',
        '    paintBag(def, facts, (facts = { ready: asSecondFacts().ready }));',
      ],
      bagEffectHelper
    ),
    tokens: [firstOpacity],
  },
  {
    name: 'does not manufacture a State from an assignment inside an uncalled function',
    source: consumer([
      '    let held;',
      '    function dormant() { held = asFirstFacts().ready; }',
      '    paintLeaf(def, held);',
    ]),
    tokens: [],
  },
  {
    // This is a semantic positive, not an assertion that the existing collector
    // already passes. If its lexical walk taints facts here, retain that real
    // collector failure as a separate blocker; do not erase the selector oracle.
    name: 'does not execute an uncalled function that names a captured container',
    source: consumer(
      [
        '    const facts = { ready: asFirstFacts().ready };',
        '    function dormant() { external(facts); }',
        '    paintBag(def, facts);',
      ],
      bagHelper
    ),
    tokens: [firstOpacity],
  },
  {
    name: 'keeps a shared setup declaration and both factory calls in the actual source fixture',
    source: [
      imports,
      leafHelper,
      'function sharedSetup(def) { paintLeaf(def, asFirstFacts().ready); }',
      "export const First = definePrototype({ name: 'first-entry', setup: sharedSetup });",
      "export const Second = definePrototype({ name: 'second-entry', setup: sharedSetup });",
    ].join('\n'),
    tokens: [firstOpacity],
  },
  {
    // The old collector walks this syntax. Its token Set alone is not proof
    // that construct() ran or that a graph session may invent its entry store.
    name: 'does not mistake aggregate collection from an uncalled factory for entry proof',
    source: [
      imports,
      leafHelper,
      'function construct() {',
      "  return definePrototype({ name: 'uninstantiated-entry', setup(def) {",
      '    paintLeaf(def, asFirstFacts().ready);',
      '  }});',
      '}',
    ].join('\n'),
    tokens: [firstOpacity],
  },
  {
    name: 'collects an imported setup in its defining source while raw helper sites remain inventoried',
    source: [
      "import { definePrototype } from '@proto.ui/core';",
      "import { setup } from './setup';",
      "export default definePrototype({ name: 'imported-setup-entry', setup });",
    ].join('\n'),
    files: {
      'setup.ts': [
        imports,
        leafHelper,
        'export function setup(def) { paintLeaf(def, asFirstFacts().ready); }',
      ].join('\n'),
    },
    tokens: [firstOpacity],
  },
  {
    name: 'does not use a known rule token to discharge an unrelated unknown helper site',
    source: consumer([
      '    const known = asFirstFacts().ready;',
      '    def.rule({',
      '      when: (w) => w.state(known).eq(true),',
      "      intent: (i) => i.feedback.style.use(tw('opacity-50')),",
      '    });',
      '    paintLeaf(def, external());',
    ]),
    tokens: [firstOpacity],
    usageCount: 1,
  },
];

describe.sequential('helper call collection and standalone rule inventory', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const observed = await observeFixture(fixture);
      // Exact conditional output is independent of the standalone gap below.
      expect(observed.tokens).toEqual([...fixture.tokens].sort());
      expect(observed.misses.map(({ reason }) => reason)).toEqual(fixture.reasons ?? ['subject']);
      expect(observed.misses.every(({ expression }) => expression.length > 0)).toBe(true);
      expect(observed.exposedLocals).toEqual([]);
      expect(observed.usages).toHaveLength(fixture.usageCount ?? 0);
      for (const usage of observed.usages) {
        expect(usage.provenance?.owner.file).toBe(observed.producer);
        expect(usage.provenance?.declaration.file).toBe(observed.producer);
        expect(usage.provenance?.declaredName).toBe('firstReady');
      }
    });
  }
});
