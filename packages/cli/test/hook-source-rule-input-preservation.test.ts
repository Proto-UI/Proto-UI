import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

const factsSource = [
  "import { defineAsHook } from '@proto.ui/core';",
  'export const asFacts = defineAsHook({',
  "  name: 'rule-input-preservation-facts',",
  "  setup(owner) { owner.state.bool('ready', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.ready }; },',
  '});',
].join('\n');

const helperSource = [
  'function paint(target, facts, token) {',
  '  target.rule({',
  '    when: (w) => w.state(facts.ready).eq(true),',
  '    intent: (i) => i.feedback.style.use(tw(token)),',
  '  });',
  '}',
].join('\n');

type Fixture = {
  body: readonly string[];
  helper?: string;
  facts?: string;
  imports?: string;
  extra?: string;
};

function entryText(fixture: Fixture): string {
  return [
    fixture.imports ?? "import { definePrototype, tw } from '@proto.ui/core';",
    "import { asFacts } from './facts';",
    'declare const external: (...values: unknown[]) => unknown;',
    fixture.extra ?? '',
    fixture.helper ?? helperSource,
    'export default definePrototype({',
    "  name: 'rule-input-preservation-consumer',",
    '  setup(def) {',
    ...fixture.body,
    '  },',
    '});',
  ].join('\n');
}

async function withFixture(
  fixture: Fixture,
  check: (
    context: ReturnType<typeof createHookSourceSummaryContext>,
    source: ts.SourceFile,
    calls: readonly ts.CallExpression[]
  ) => void
): Promise<void> {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'rule-input-proof-')));
  try {
    await writeFile(path.join(directory, 'tsconfig.json'), '{}');
    const factsPath = path.join(directory, 'facts.ts');
    const entryPath = path.join(directory, 'consumer.proto.ts');
    const factsText = fixture.facts ?? factsSource;
    const text = entryText(fixture);
    await writeFile(factsPath, factsText);
    await writeFile(entryPath, text);
    const context = createHookSourceSummaryContext();
    const facts = ts.createSourceFile(factsPath, factsText, ts.ScriptTarget.Latest, true);
    const source = ts.createSourceFile(entryPath, text, ts.ScriptTarget.Latest, true);
    context.registerSource(facts);
    context.registerSource(source);
    const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'paint'
      )
        calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(calls.length).toBeGreaterThan(0);
    check(context, source, calls);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const declaration = '    const facts = { ready: asFacts().ready };';
const first = "    paint(def, facts, 'opacity-50');";
const second = "    paint(def, facts, 'bg-primary');";

describe('exact Rule helper input preservation proof', () => {
  it('keeps actual State identity and issues a fresh receipt for each call', async () => {
    await withFixture({ body: [declaration, first, second] }, (context, source, calls) => {
      expect(calls).toHaveLength(2);
      const firstProof = context.proveRuleOnlyInvocation(calls[0], source);
      const secondProof = context.proveRuleOnlyInvocation(calls[1], source);
      expect(firstProof).not.toBeNull();
      expect(secondProof).not.toBeNull();
      expect(secondProof).not.toBe(firstProof);
      expect(firstProof?.call).toBe(calls[0]);
      expect(secondProof?.call).toBe(calls[1]);
      expect(firstProof?.source).toBe(source);
      expect(secondProof?.helper).toBe(firstProof?.helper);
      expect(firstProof?.inputs[0].nativeDef).toBe(true);
      expect(firstProof?.inputs[2].literal).toBe('opacity-50');
      expect(secondProof?.inputs[2].literal).toBe('bg-primary');
      const bag = firstProof?.inputs[1].sourceValue;
      expect(bag?.kind).toBe('object');
      if (bag?.kind !== 'object') throw new Error('expected captured own-data bag');
      const ready = bag.members.get('ready');
      expect(ready?.kind).toBe('state');
      if (ready?.kind !== 'state') throw new Error('expected actual source State');
      expect(ready.state.declaredName).toBe('ready');
      expect(ready.state.owner.file).toBe(path.join(path.dirname(source.fileName), 'facts.ts'));
      expect(firstProof?.rules).toHaveLength(1);
    });
  });

  it('uses declaration identities after parameter and Core import renaming', async () => {
    await withFixture(
      {
        imports: "import { definePrototype as prototype, tw as classes } from '@proto.ui/core';",
        extra: 'const definePrototype = prototype;',
        helper: helperSource
          .replaceAll('target', 'host')
          .replaceAll('facts', 'inputs')
          .replaceAll('token', 'className')
          .replace('tw(className)', 'classes(className)'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).not.toBeNull();
      }
    );
  });

  it('proves every Rule expression in the complete helper body', async () => {
    await withFixture(
      {
        helper: helperSource.replace(
          '\n}',
          '\n  target.rule({ when: w => w.state(facts.ready).eq(false), ' +
            "intent: i => i.feedback.style.use(tw('border-black')) });\n}"
        ),
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)?.rules).toHaveLength(2);
      }
    );
  });

  it('does not reuse an earlier native-Def success for a foreign argument', async () => {
    await withFixture(
      {
        body: [declaration, first, "    paint(asFacts(), facts, 'bg-primary');"],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).not.toBeNull();
        expect(context.proveRuleOnlyInvocation(calls[1], source)).toBeNull();
      }
    );
  });

  const refusals: readonly (Fixture & { name: string })[] = [
    {
      name: 'unknown call receives the container before the helper',
      body: [declaration, '    external(facts);', first],
    },
    {
      name: 'unknown no-argument prefix can still reach active owner state',
      body: [declaration, '    external();', first],
    },
    {
      name: 'a later argument can have effects before helper entry',
      body: [declaration, '    paint(def, facts, external());'],
    },
    {
      name: 'a State alias can replace metadata before native builder reads',
      body: [
        declaration,
        '    const held = facts.ready;',
        "    held.__stateId = 'changed';",
        first,
      ],
    },
    {
      name: 'a State metadata getter is not an ordinary source State',
      body: [
        "    const held = { get __stateId() { external(); return 'hostile'; } };",
        '    const facts = { ready: held };',
        first,
      ],
    },
    {
      name: 'a State identifier cannot hide native String coercion',
      body: [
        "    const id = { toString() { external(); return 'hostile'; } };",
        '    const held = { __stateId: id };',
        '    const facts = { ready: held };',
        first,
      ],
    },
    {
      name: 'a same-named arbitrary receiver is not the native Def',
      body: [
        declaration,
        '    const foreign = { rule(spec) { external(facts); } };',
        "    paint(foreign, facts, 'opacity-50');",
      ],
    },
    {
      name: 'a helper statement after a Rule can mutate captured inputs',
      helper: helperSource.replace('\n}', '\n  external(facts);\n}'),
      body: [declaration, first],
    },
    {
      name: 'the intent callback can hide an authored effect',
      helper: helperSource.replace(
        'intent: (i) => i.feedback.style.use(tw(token)),',
        'intent: (i) => { external(facts); return i.feedback.style.use(tw(token)); },'
      ),
      body: [declaration, first],
    },
    {
      name: 'a callback coercion is outside the admitted native DSL',
      helper: helperSource.replace('.eq(true)', '.eq(+token)'),
      body: [declaration, first],
    },
    {
      name: 'the State producer itself can have an unknown setup effect',
      facts: factsSource.replace(
        "owner.state.bool('ready', false);",
        "owner.state.bool('ready', false); external();"
      ),
      body: [declaration, first],
    },
    {
      name: 'a public projection can have an unknown effect',
      facts: factsSource.replace(
        'projectHandle(result) { return',
        'projectHandle(result) { external(); return'
      ),
      body: [declaration, first],
    },
    {
      name: 'helper defaults are not assumed to have already run',
      helper: helperSource.replace('facts, token)', 'facts, token = external())'),
      body: [declaration, first],
    },
    {
      name: 'rest bindings have no complete parameter proof',
      helper: helperSource
        .replace('facts, token)', 'facts, ...tokens)')
        .replace('tw(token)', 'tw(tokens[0])'),
      body: [declaration, first],
    },
    {
      name: 'destructuring may execute an accessor during binding',
      helper: helperSource
        .replace('target, facts, token', 'target, { ready }, token')
        .replace('facts.ready', 'ready'),
      body: [declaration, first],
    },
    {
      name: 'object spreading is not a proven own-data creation in this slice',
      body: ['    const facts = { ...asFacts() };', first],
    },
    {
      name: 'a local function named tw is not the canonical Core handle factory',
      imports: "import { definePrototype, tw as coreTw } from '@proto.ui/core';",
      extra: 'function tw(value) { return coreTw(value); }',
      body: [declaration, first],
    },
    {
      name: 'a nested uninvoked function is not the actual prototype entry',
      body: [declaration, "    function later() { paint(def, facts, 'opacity-50'); }"],
    },
    {
      name: 'a callee alias is outside the direct-declaration proof',
      helper:
        helperSource.replace('function paint(', 'function original(') + '\nconst paint = original;',
      body: [declaration, first],
    },
    {
      name: 'native Def member writes cannot be hidden by the parameter name',
      body: [declaration, '    def.rule = external;', first],
    },
  ];

  for (const fixture of refusals) {
    it('refuses when ' + fixture.name, async () => {
      await withFixture(fixture, (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[calls.length - 1], source)).toBeNull();
      });
    });
  }

  it('does not reuse a proof after the same path acquires a new immutable source', async () => {
    await withFixture({ body: [declaration, first] }, (context, source, calls) => {
      expect(context.proveRuleOnlyInvocation(calls[0], source)).not.toBeNull();
      const changed = source.text.replace(
        '    paint(def, facts,',
        '    external(facts);\n    paint(def, facts,'
      );
      const replacement = ts.createSourceFile(
        source.fileName,
        changed,
        ts.ScriptTarget.Latest,
        true
      );
      context.registerSource(replacement);
      let newCall: ts.CallExpression | undefined;
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'paint'
        )
          newCall = node;
        ts.forEachChild(node, visit);
      };
      visit(replacement);
      expect(newCall).toBeDefined();
      expect(context.proveRuleOnlyInvocation(newCall!, replacement)).toBeNull();
      expect(context.proveRuleOnlyInvocation(calls[0], replacement)).toBeNull();
    });
  });
});

describe('Rule input proof rejects mutable producer definition effects', () => {
  it('refuses a replaced projection whose returned State metadata getter is consumed by Rule', async () => {
    await withFixture(
      {
        facts:
          factsSource +
          [
            '',
            '// Creating this getter is not the effect: native w.state reads __stateId.',
            'asFacts.definition.projectHandle = () => ({',
            '  ready: { get __stateId() { external(); return "hostile-state"; } },',
            '});',
          ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });

  it('refuses a projection replacement through an alias of the public definition', async () => {
    await withFixture(
      {
        facts:
          factsSource +
          [
            '',
            'const heldDefinition = asFacts.definition;',
            'heldDefinition.projectHandle = () => ({',
            '  ready: { get __stateId() { external(); return "aliased-hostile-state"; } },',
            '});',
          ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });

  it('refuses a producer definition passed to an unknown module-level mutator', async () => {
    await withFixture(
      {
        facts:
          factsSource +
          [
            '',
            'declare const mutateDefinition: (definition: unknown) => void;',
            'mutateDefinition(asFacts.definition);',
          ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });
});

describe('producer lifetime through a module namespace', () => {
  it('keeps a namespace member call with no namespace escape', async () => {
    await withFixture(
      {
        extra: "import * as factsNamespace from './facts';",
        body: ['    const facts = { ready: factsNamespace.asFacts().ready };', first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).not.toBeNull();
      }
    );
  });

  it('refuses a namespace carried to unknown code by another canonical entry', async () => {
    await withFixture(
      {
        extra: [
          "import * as factsNamespace from './facts';",
          'export const mutatingOwner = definePrototype({',
          "  name: 'rule-input-preservation-mutating-owner',",
          '  setup(def) { external(factsNamespace); },',
          '});',
        ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        // The namespace contains the actual caller whose public definition is
        // mutable. An independent real entry can expose it without spelling the
        // producer's local identifier or reading .definition in this source.
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });
});

describe('namespace member resolution boundaries', () => {
  it('refuses a producer carried through an unmodeled wrapped element key', async () => {
    await withFixture(
      {
        extra: [
          "import * as factsNamespace from './facts';",
          'export const mutatingOwner = definePrototype({',
          "  name: 'wrapped-member-mutating-owner',",
          "  setup(def) { external(factsNamespace[('asFacts' as const)]); },",
          '});',
        ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        // The transparent TypeScript assertion still selects the same mutable
        // caller at runtime. An unmodeled member lookup cannot certify its escape.
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });
});

describe('dynamic namespace producer lifetime', () => {
  it('does not treat an import type query as runtime module execution', async () => {
    await withFixture(
      {
        extra: "type FactsNamespace = typeof import('./facts');",
        body: [declaration, first],
      },
      (context, source, calls) => {
        expect(context.proveRuleOnlyInvocation(calls[0], source)).not.toBeNull();
      }
    );
  });

  it('refuses an unmodeled dynamic namespace escape in another canonical entry', async () => {
    await withFixture(
      {
        extra: [
          'export const mutatingOwner = definePrototype({',
          "  name: 'dynamic-namespace-mutating-owner',",
          '  async setup(def) {',
          "    const namespace = await import('./facts');",
          '    external(namespace);',
          '  },',
          '});',
        ].join('\n'),
        body: [declaration, first],
      },
      (context, source, calls) => {
        // This is an executable import expression in a real second entry, not
        // a type query. Its namespace can carry the mutable caller definition.
        // A deferred path that this lifetime proof does not model stays unknown.
        expect(context.proveRuleOnlyInvocation(calls[0], source)).toBeNull();
      }
    );
  });
});
