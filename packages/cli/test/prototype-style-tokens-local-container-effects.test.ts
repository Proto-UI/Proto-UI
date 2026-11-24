import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const factsSource = [
  "import { defineAsHook } from '@proto.ui/core';",
  'export const asFirstFacts = defineAsHook({',
  "  name: 'local-container-first',",
  "  setup(def) { def.state.bool('firstReady', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.firstReady }; },',
  '});',
  'export const asSecondFacts = defineAsHook({',
  "  name: 'local-container-second',",
  "  setup(def) { def.state.bool('secondReady', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.secondReady }; },',
  '});',
].join('\n');

const bagHelper = [
  'function paintBag(target, facts, ignored) {',
  '  target.rule({',
  '    when: (w) => w.state(facts.ready).eq(true),',
  "    intent: (i) => i.feedback.style.use(tw('opacity-50')),",
  '  });',
  '}',
].join('\n');

const leafHelper = bagHelper
  .replace('paintBag', 'paintLeaf')
  .replace('(target, facts, ignored)', '(target, held, ignored)')
  .replace('facts.ready', 'held');

const firstOpacity = 'data-[first-ready]:opacity-50';
const secondOpacity = 'data-[second-ready]:opacity-50';

type Fixture = {
  name: string;
  body: readonly string[];
  tokens: readonly string[];
  helper?: string;
};

async function collectFixture(fixture: Fixture): Promise<string[]> {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'local-state-container-')));
  try {
    await writeFile(path.join(directory, 'tsconfig.json'), '{}');
    await writeFile(path.join(directory, 'facts.ts'), factsSource);
    const entry = path.join(directory, 'consumer.proto.ts');
    await writeFile(
      entry,
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asFirstFacts, asSecondFacts } from './facts';",
        'declare const external: (...values: unknown[]) => unknown;',
        'declare const sink: Record<string, unknown>;',
        'declare const choose: boolean;',
        fixture.helper ?? bagHelper,
        'export default definePrototype({',
        "  name: 'local-state-container-consumer',",
        '  setup(def) {',
        ...fixture.body,
        '  },',
        '});',
      ].join('\n')
    );
    return await collectProtoStyleTokensFromFiles([entry, path.join(directory, 'facts.ts')]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const fixtures: readonly Fixture[] = [
  {
    name: 'retains both distinct rule tokens when the same container reaches a pure helper twice',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      "    paintBag(def, facts, 'opacity-50');",
      "    paintBag(def, facts, 'bg-primary');",
    ],
    helper: bagHelper
      .replace('(target, facts, ignored)', '(target, facts, token)')
      .replace("tw('opacity-50')", 'tw(token)'),
    tokens: ['data-[first-ready]:bg-primary', firstOpacity],
  },
  {
    name: 'withdraws a local wrapper after an unknown call receives it',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    external(facts);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'withdraws the same container through a local alias',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const borrowed = facts;',
      '    external(borrowed);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'withdraws a nested container reached through an escaping outer wrapper',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const envelope = { nested: facts };',
      '    external(envelope);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'withdraws the actual unknown-method receiver',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    facts.touch();',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'withdraws an earlier container argument when a later argument escapes it',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    paintBag(def, facts, external(facts));',
    ],
    tokens: [],
  },
  {
    name: 'keeps a captured State leaf when a later argument escapes its former container',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    paintLeaf(def, facts.ready, external(facts));',
    ],
    tokens: [firstOpacity],
    helper: leafHelper,
  },
  {
    name: 'keeps a separately copied State leaf after its original container escapes',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const copy = { ready: facts.ready };',
      '    external(facts);',
      '    paintBag(def, copy);',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'keeps an unrelated container that was not passed to an unknown call',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const other = { ready: asSecondFacts().ready };',
      '    external(other);',
      '    paintBag(def, facts);',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'reads a fresh explicit member write after a previous escape',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const replacement = asSecondFacts().ready;',
      '    external(facts);',
      '    facts.ready = replacement;',
      '    paintBag(def, facts);',
    ],
    tokens: [secondOpacity],
  },
  {
    name: 'keeps an earlier container identity across a later variable rebinding',
    body: [
      '    let facts = { ready: asFirstFacts().ready };',
      '    const replacement = asSecondFacts().ready;',
      '    paintBag(def, facts, facts = { ready: replacement });',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'reads a later member write through an earlier captured container',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const replacement = asSecondFacts().ready;',
      '    paintBag(def, facts, facts.ready = replacement);',
    ],
    tokens: [secondOpacity],
  },
  {
    name: 'withdraws outer members overwritten by an unproved Object.assign source',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    Object.assign(facts, external());',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'withdraws a State member when Object.assign replaces it with a primitive',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      "    Object.assign(facts, { ready: 'not-a-state' });",
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'keeps a State member when Object.assign writes only a different key',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      "    Object.assign(facts, { note: 'ordinary data' });",
      '    paintBag(def, facts);',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'does not mutate an earlier captured child when Object.assign replaces the outer object',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    const envelope = { nested: facts };',
      '    Object.assign(envelope, external());',
      '    paintBag(def, facts);',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'does not execute a private function with no lexical reference',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function dormant() { external(facts); }',
      '    paintBag(def, facts);',
    ],
    tokens: [firstOpacity],
  },
  {
    name: 'withdraws the captured container when that private function is called',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function change() { external(facts); }',
      '    change();',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'does not certify a captured container after its mutator function escapes',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function change() { external(facts); }',
      '    external(change);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'does not infer an unused function when direct eval can call it',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function change() { external(facts); }',
      "    eval('change()');",
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'does not manufacture a State from an assignment in an uncalled body',
    body: [
      '    let held;',
      '    function dormant() { held = asFirstFacts().ready; }',
      '    paintLeaf(def, held);',
    ],
    tokens: [],
    helper: leafHelper,
  },
  {
    name: 'keeps unknown rest-parameter effects conservative despite a known function identity',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function forward(...values) { external(values[0]); }',
      '    forward(facts);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'keeps a stored helper argument escaped for a subsequent unknown call',
    body: [
      '    const facts = { ready: asFirstFacts().ready };',
      '    function store(value) { sink.saved = value; }',
      '    store(facts);',
      '    external();',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
  {
    name: 'tracks a map first installed by a member write through an existing alias',
    body: [
      '    const facts = {};',
      '    const borrowed = facts;',
      '    facts.ready = asFirstFacts().ready;',
      '    external(borrowed);',
      '    paintBag(def, facts);',
    ],
    tokens: [],
  },
];

describe('local State container effects in the real token collector', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const tokens = await collectFixture(fixture);
      expect(tokens.filter((token) => token.startsWith('data-['))).toEqual(fixture.tokens);
      // Withdrawing a State proof must not delete the ordinary token inventory.
      expect(tokens).toContain('opacity-50');
    });
  }
});
