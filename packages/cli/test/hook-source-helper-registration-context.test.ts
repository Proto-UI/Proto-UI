import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const facts = [
  "import { defineAsHook } from '@proto.ui/core';",
  "export const asFirstFacts = defineAsHook({ name: 'helper-native-first',",
  "  setup(d) { d.state.bool('firstReady', false); },",
  '  projectHandle(r) { return { ready: r.stateHandles.firstReady }; } });',
  "export const asSecondFacts = defineAsHook({ name: 'helper-native-second',",
  "  setup(d) { d.state.bool('secondReady', false); },",
  '  projectHandle(r) { return { ready: r.stateHandles.secondReady }; } });',
  "export const asCompetitor = defineAsHook({ name: 'helper-native-second',",
  "  setup(d) { d.state.bool('competingReady', false); },",
  '  projectHandle(r) { return { ready: r.stateHandles.competingReady }; } });',
].join('\n');

const helper = [
  'function paint(target, held, token) {',
  '  target.rule({ when: w => w.state(held).eq(true),',
  '    intent: i => i.feedback.style.use(tw(token)) });',
  '}',
].join('\n');

function consumer(
  body: readonly string[],
  {
    helperSource = helper,
    parameters = 'owner',
    factory = 'definePrototype',
    afterSetup = '',
    prefix = '',
  }: {
    helperSource?: string;
    parameters?: string;
    factory?: string;
    afterSetup?: string;
    prefix?: string;
  } = {}
): string {
  return [
    "import { definePrototype, definePrototype as make, tw } from '@proto.ui/core';",
    "import { asFirstFacts, asSecondFacts, asCompetitor } from './facts';",
    'declare const opaque: any;',
    'declare const external: (...args: unknown[]) => unknown;',
    prefix,
    helperSource,
    `export default ${factory}({ name: 'helper-native-consumer',`,
    `  setup(${parameters}) {`,
    ...body,
    `  }${afterSetup}`,
    '});',
  ].join('\n');
}

const calls = [
  "    paint(owner, asFirstFacts().ready, 'opacity-50');",
  "    paint(owner, asSecondFacts().ready, 'bg-primary');",
];

async function inspect(sourceText: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-native-context-'));
  try {
    const factsPath = path.join(dir, 'facts.ts');
    const entry = path.join(dir, 'entry.proto.ts');
    await writeFile(factsPath, facts);
    await writeFile(entry, sourceText);
    const source = ts.createSourceFile(entry, sourceText, ts.ScriptTarget.Latest, true);
    const summary = createHookSourceSummaryContext();
    summary.registerSource(source);
    let target: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'asSecondFacts'
      ) {
        expect(target).toBeUndefined();
        target = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(target).toBeDefined();
    expect(summary.isAuthoredProducerCall(target!, source)).toBe(true);
    const member = target!.parent;
    expect(ts.isPropertyAccessExpression(member) && member.name.text === 'ready').toBe(true);
    return {
      resolved: summary.resolve(member, source),
      tokens: await collectProtoStyleTokensFromFiles([factsPath, entry]),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('canonical setup Def context during preceding helper registration replay', () => {
  it('keeps the later producer after a pure helper received the real setup Def', async () => {
    const { resolved, tokens } = await inspect(consumer(calls));
    expect(resolved.matched).toBe(true);
    expect(resolved.value.kind).toBe('state');
    if (resolved.value.kind === 'state')
      expect(resolved.value.state.declaredName).toBe('secondReady');
    expect(tokens.filter((token) => token.startsWith('data-['))).toEqual([
      'data-[first-ready]:opacity-50',
      'data-[second-ready]:bg-primary',
    ]);
  });

  it('uses the canonical factory and declaration identity after every local spelling changes', async () => {
    const source = consumer(calls, { factory: 'make' })
      .replaceAll('owner', 'definition')
      .replaceAll('paint', 'decorate')
      .replaceAll('target', 'receiver')
      .replaceAll('held', 'observed')
      .replaceAll('token', 'utility');
    const { resolved, tokens } = await inspect(source);
    expect(resolved.value.kind).toBe('state');
    if (resolved.value.kind === 'state')
      expect(resolved.value.state.declaredName).toBe('secondReady');
    expect(tokens).toContain('data-[second-ready]:bg-primary');
  });

  for (const fixture of [
    {
      name: 'a rebound setup parameter',
      source: consumer(['    owner = opaque;', ...calls]),
    },
    {
      name: 'a write through the setup capability member',
      source: consumer(['    owner.rule = opaque;', ...calls]),
    },
    {
      name: 'an alias which can mutate the setup capability',
      source: consumer(['    const alias = owner;', '    alias.rule = opaque;', ...calls]),
    },
    {
      name: 'a helper which changes its native parameter member',
      source: consumer(calls, {
        helperSource: helper.replace('  target.rule(', '  target.rule = opaque;\n  target.rule('),
      }),
    },
    {
      name: 'an unknown call within the preceding helper',
      source: consumer(calls, {
        helperSource: helper.replace('  target.rule(', '  external();\n  target.rule('),
      }),
    },
    {
      name: 'a later opaque setup overwrite',
      source: consumer(calls, { afterSetup: ', ...opaque' }),
    },
    {
      name: 'a non-Def second setup parameter',
      source: consumer(calls, { parameters: 'first, owner' }),
    },
    {
      name: 'an unproved local factory with a familiar spelling',
      source: consumer(calls, {
        factory: 'localFactory',
        prefix: 'const localFactory = (value: unknown) => value;',
      }),
    },
    {
      name: 'direct eval which can replace the setup capability',
      source: consumer(["    eval('owner.rule = opaque');", ...calls]),
    },
    {
      name: 'registration hidden in an unknown State metadata getter',
      source: consumer([
        '    const hostile = { get __stateId() { asCompetitor(); return "hostile"; } };',
        "    paint(owner, hostile, 'opacity-50');",
        calls[1],
      ]),
    },
    {
      name: 'registration hidden in the State id coercion performed by the native builder',
      source: consumer([
        '    const hostile = { __stateId: { toString() { asCompetitor(); return "hostile"; } } };',
        "    paint(owner, hostile, 'opacity-50');",
        calls[1],
      ]),
    },
    {
      name: 'a proven State parameter rebound to an unknown builder operand',
      source: consumer(calls, {
        helperSource: helper.replace('  target.rule(', '  held = opaque;\n  target.rule('),
      }),
    },
    {
      name: 'an unknown preceding call when non-Rule Def use prevents a Rule-only seed',
      source: consumer(["    owner.state.bool('unrelated', false);", '    external();', calls[1]]),
    },
    {
      name: 'registration hidden inside a Rule callback',
      source: consumer(calls, {
        helperSource: helper.replace(
          'when: w => w.state(held).eq(true)',
          'when: w => { asCompetitor(); return w.state(held).eq(true); }'
        ),
      }),
    },
  ]) {
    it(`withholds the later producer after ${fixture.name}`, async () => {
      const { resolved, tokens } = await inspect(fixture.source);
      expect(resolved.matched).toBe(true);
      expect(resolved.value.kind).toBe('unknown');
      expect(tokens).not.toContain('data-[second-ready]:bg-primary');
    });
  }
});
