import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';

const producer = `import { defineAsHook } from '@proto.ui/core';
export const asFacts = defineAsHook({ name: 'facts', setup(def) {
  def.state.bool('alpha', false); def.state.bool('beta', false);
}, projectHandle(result) {
  return { ready: result.stateHandles.alpha, backup: result.stateHandles.beta };
} });`;

const rule = (subject: string, tokenArgument: string) =>
  `def.rule({ when: (w) => w.state(${subject}).eq(true), intent: (i) => i.feedback.style.use(tw(${tokenArgument})) });`;

async function analyze(statements: string[], subjects: string[], tokenArgument = "'bg-primary'") {
  return analyzeSource(
    [
      "import { asFacts } from './producer';",
      'const bag = asFacts();',
      ...statements,
      ...subjects.map((subject) => rule(subject, tokenArgument)),
    ].join('\n')
  );
}

async function analyzeSource(source: string, producerSource = producer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-wrapper-reference-'));
  try {
    await writeFile(path.join(dir, 'producer.ts'), producerSource);
    const file = path.join(dir, 'consumer.proto.ts');
    await writeFile(file, source);
    return {
      scan: scanRuleStateReads(source, file, createHookSourceSummaryContext()),
      tokens: await collectProtoStyleTokens(dir),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function semanticTokens(tokens: readonly unknown[]): string[] {
  return tokens
    .filter((token): token is string => typeof token === 'string')
    .filter((token) => /^data-\[/.test(token))
    .sort();
}

// These are consumer scans and emitted selector tokens, not summary-shape tests.
describe('local wrappers retain hook source references', () => {
  it.each(['{ controls }', '[controls]'])(
    'retains nested object identity beside token proof through %s',
    async (wrapper) => {
      for (const mutation of ['', 'alias.ready = bag.backup;', 'unknownConsumer(alias);']) {
        const { scan, tokens } = await analyze(
          [
            "const controls = { ready: bag.ready, className: 'bg-primary' };",
            `const wrapper = ${wrapper};`,
            `const alias = wrapper${wrapper.startsWith('[') ? '[0]' : '.controls'};`,
            mutation,
          ],
          ['controls.ready']
        );
        const escaped = mutation.startsWith('unknownConsumer');
        expect(scan.unresolved.map(({ reason }) => reason)).toEqual(escaped ? ['subject'] : []);
        expect(scan.usages.map(({ state }) => state)).toEqual(
          escaped ? [] : [mutation ? 'beta' : 'alpha']
        );
        expect(semanticTokens(tokens)).toEqual(
          escaped ? [] : [`data-[${mutation ? 'beta' : 'alpha'}]:bg-primary`]
        );
      }
    }
  );

  it.each(['controls.local', 'captured'])(
    'joins every ternary local member for %s',
    async (subject) => {
      const { scan, tokens } = await analyze(
        [
          "const a = def.state.bool('a', false); const b = def.state.bool('b', false);",
          "def.expose.state('a', a); def.expose.state('b', b);",
          'const controls = condition ? { borrowed: bag.ready, local: a } : { borrowed: bag.backup, local: b };',
          'const captured = controls.local;',
        ],
        [subject]
      );
      expect(scan.unresolved).toEqual([]);
      expect(new Set(scan.exposedLocals.map(({ attribute }) => attribute))).toEqual(
        new Set(['a', 'b'])
      );
      expect(semanticTokens(tokens)).toEqual(['data-[a]:bg-primary', 'data-[b]:bg-primary']);
    }
  );

  it('retains token metadata and source identity on the same nested alias', async () => {
    const { scan, tokens } = await analyze(
      [
        "const controls = { ready: bag.ready, className: 'bg-primary' };",
        'const wrapper = { controls }; const alias = wrapper.controls;',
        'alias.ready = bag.backup;',
      ],
      ['controls.ready'],
      'alias.className'
    );
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta']);
    expect(semanticTokens(tokens)).toEqual(['data-[beta]:bg-primary']);
  });

  it.each(['controls.local', 'captured'])(
    'keeps both local and borrowed alternatives after a conditional member write: %s',
    async (subject) => {
      const { scan, tokens } = await analyze(
        [
          "const flag = def.state.bool('localFlag', false); def.expose.state('localFlag', flag);",
          'const controls = { borrowed: bag.ready, local: flag };',
          'if (condition) controls.local = bag.backup;',
          'const captured = controls.local;',
        ],
        [subject]
      );
      expect(scan.unresolved).toEqual([]);
      expect(new Set(scan.usages.map(({ state }) => state))).toEqual(new Set(['beta']));
      expect(new Set(scan.exposedLocals.map(({ attribute }) => attribute))).toEqual(
        new Set(['local-flag'])
      );
      expect(semanticTokens(tokens)).toEqual([
        'data-[beta]:bg-primary',
        'data-[local-flag]:bg-primary',
      ]);
    }
  );

  it.each([false, true])(
    'captures a conditional source member only when the earlier branch is proven (unknown: %s)',
    async (unknown) => {
      const { scan, tokens } = await analyze(
        [
          "const flag = def.state.bool('localFlag', false); def.expose.state('localFlag', flag);",
          `let controls = { borrowed: bag.ready, local: ${unknown ? 'externalState' : 'flag'} };`,
          'if (condition) controls = { borrowed: bag.backup, local: bag.backup };',
          'const captured = controls.local; const alias = captured;',
        ],
        ['alias']
      );
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(unknown ? ['subject'] : []);
      expect(new Set(scan.usages.map(({ state }) => state))).toEqual(
        new Set(unknown ? [] : ['beta'])
      );
      expect(new Set(scan.exposedLocals.map(({ attribute }) => attribute))).toEqual(
        new Set(unknown ? [] : ['local-flag'])
      );
      expect(semanticTokens(tokens)).toEqual(
        unknown ? [] : ['data-[beta]:bg-primary', 'data-[local-flag]:bg-primary']
      );
    }
  );

  it.each([false, true])('checks both ternary token branches (unknown: %s)', async (unknown) => {
    const { scan, tokens } = await analyze(
      [
        `const controls = condition ? { ready: bag.ready, className: 'bg-primary' } : { ready: bag.ready, className: ${unknown ? 'runtimeTokens()' : "'bg-primary'"} };`,
      ],
      ['controls.ready'],
      'controls["className"]'
    );
    expect(scan.unresolved.map(({ reason }) => reason)).toEqual(unknown ? ['intent'] : []);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });

  it.each(['controls.local', 'captured'])(
    'snapshots a local member before its initializer name is rebound: %s',
    async (subject) => {
      const { scan, tokens } = await analyze(
        [
          "const a = def.state.bool('a', false); const b = def.state.bool('b', false);",
          "def.expose.state('a', a); def.expose.state('b', b);",
          'let current = a; const controls = { borrowed: bag.ready, local: current };',
          'current = b; const captured = controls.local;',
        ],
        [subject]
      );
      expect(scan.unresolved).toEqual([]);
      expect(new Set(scan.exposedLocals.map(({ attribute }) => attribute))).toEqual(new Set(['a']));
      expect(semanticTokens(tokens)).toEqual(['data-[a]:bg-primary']);
    }
  );

  it.each(['controls.local', 'captured'])(
    'retains every known local wrapper alternative: %s',
    async (subject) => {
      const { scan, tokens } = await analyze(
        [
          "const a = def.state.bool('a', false); const b = def.state.bool('b', false);",
          "def.expose.state('a', a); def.expose.state('b', b);",
          'let controls = { borrowed: bag.ready, local: a };',
          'if (condition) controls = { borrowed: bag.backup, local: b };',
          'const captured = controls.local;',
        ],
        [subject]
      );
      expect(scan.unresolved).toEqual([]);
      expect(new Set(scan.exposedLocals.map(({ attribute }) => attribute))).toEqual(
        new Set(['a', 'b'])
      );
      expect(semanticTokens(tokens)).toEqual(['data-[a]:bg-primary', 'data-[b]:bg-primary']);
    }
  );

  it('advances independent local proof when a nested borrowed bag changes', async () => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false); def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag, local: flag };',
        'bag.ready = bag.backup;',
      ],
      ['controls.local', 'controls.borrowed.ready']
    );
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual([
      'data-[beta]:bg-primary',
      'data-[local-flag]:bg-primary',
    ]);
  });

  it.each(['controls.local', 'captured'])(
    'does not certify an unknown local wrapper alternative: %s',
    async (subject) => {
      const { scan } = await analyze(
        [
          "const a = def.state.bool('a', false); def.expose.state('a', a);",
          'let controls = { borrowed: bag.ready, local: a };',
          'if (condition) controls = { borrowed: bag.backup, local: externalState };',
          'const captured = controls.local;',
        ],
        [subject]
      );
      expect(scan.usages).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['subject']);
    }
  );

  it.each(['', 'controls.className = runtimeTokens();', 'unknownConsumer(controls);'])(
    'captures only fresh mixed-literal token metadata: %s',
    async (mutation) => {
      const { scan, tokens } = await analyze(
        [
          "const controls = { ready: bag.ready, className: 'bg-primary' };",
          'const ready = controls.ready;',
          mutation,
          'const paint = controls["className"];',
        ],
        ['ready'],
        'paint'
      );
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(mutation ? ['intent'] : []);
      expect(semanticTokens(tokens)).toEqual(mutation ? [] : ['data-[alpha]:bg-primary']);
    }
  );

  it('resolves a mixed literal token member inside the borrowed State Rule', async () => {
    const { scan, tokens } = await analyze(
      ["const controls = { ready: bag.ready, className: 'bg-primary' };"],
      ['controls.ready'],
      'controls["className"]'
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha']);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });

  it('retains an ordinary exposed local State beside a borrowed handle', async () => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false);",
        "def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag.ready, local: flag };',
      ],
      ['controls.local', 'controls.borrowed']
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha']);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual([
      'data-[alpha]:bg-primary',
      'data-[local-flag]:bg-primary',
    ]);
  });

  it.each(['controls', 'alias'])(
    'checks every reachable token alternative through %s',
    async (owner) => {
      const { scan, tokens } = await analyze(
        [
          'let controls = { ready: bag.ready, className: runtimeTokens() };',
          "if (condition) controls = { ready: bag.ready, className: 'bg-primary' };",
          ...(owner === 'alias' ? ['const alias = controls;'] : []),
        ],
        [`${owner}.ready`],
        `${owner}["className"]`
      );
      expect(scan.usages).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['intent']);
      expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
    }
  );

  it('retains captured token metadata through a source-backed alias', async () => {
    const { scan, tokens } = await analyze(
      [
        "const controls = { ready: bag.ready, className: 'bg-primary' };",
        'const alias = controls;',
      ],
      ['alias.ready'],
      'alias["className"]'
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha']);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });

  it('accepts token alternatives only when every retained literal is known', async () => {
    const { scan, tokens } = await analyze(
      [
        "let controls = { ready: bag.ready, className: 'bg-primary' };",
        "if (condition) controls = { ready: bag.ready, className: 'bg-primary' };",
        'const alias = controls;',
      ],
      ['alias.ready'],
      'alias["className"]'
    );
    expect(new Set(scan.usages.map(({ state }) => state))).toEqual(new Set(['alpha']));
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });

  it.each([
    ['direct', ['controls.borrowed = bag.backup;'], 'controls.local'],
    ['captured', ['const captured = controls.local;'], 'captured'],
    [
      'captured after unrelated write',
      ['controls.borrowed = bag.backup;', 'const captured = controls.local;'],
      'captured',
    ],
  ])('retains %s local State proof', async (_name, statements, subject) => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false);",
        "def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag.ready, local: flag };',
        ...statements,
      ],
      [subject]
    );
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[local-flag]:bg-primary']);
  });

  it.each([
    ['member write', 'controls.local = externalState;'],
    ['dynamic write', 'controls[key] = externalState;'],
    ['escape', 'unknownConsumer(controls);'],
  ])('does not capture revoked local State proof after %s', async (_name, mutation) => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false);",
        "def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag.ready, local: flag };',
        mutation,
        'const captured = controls.local;',
      ],
      ['captured']
    );
    expect(scan.usages).toEqual([]);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['subject']);
    expect(semanticTokens(tokens)).toEqual([]);
  });

  it('keeps a local State captured before the wrapper escapes', async () => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false);",
        "def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag.ready, local: flag };',
        'const captured = controls.local;',
        'unknownConsumer(controls);',
      ],
      ['controls.local', 'captured']
    );
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['subject']);
    expect(semanticTokens(tokens)).toEqual(['data-[local-flag]:bg-primary']);
  });

  it.each([
    ['member write', 'controls.local = externalState;'],
    ['dynamic write', 'controls[key] = externalState;'],
    ['escape', 'unknownConsumer(controls);'],
  ])('revokes mixed local State initialization proof after %s', async (_name, mutation) => {
    const { scan, tokens } = await analyze(
      [
        "const flag = def.state.bool('localFlag', false);",
        "def.expose.state('localFlag', flag);",
        'const controls = { borrowed: bag.ready, local: flag };',
        mutation,
      ],
      ['controls.local']
    );
    expect(scan.usages).toEqual([]);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['subject']);
    expect(semanticTokens(tokens)).toEqual([]);
  });

  it.each([
    ['object', ['const wrapper = { bag };', 'wrapper.bag.ready = bag.backup;']],
    ['array', ['const wrapper = [bag];', 'wrapper[0].ready = bag.backup;']],
    [
      'nested alias',
      [
        'const wrapper = { nested: { bag } };',
        'const alias = wrapper.nested;',
        'alias.bag.ready = bag.backup;',
      ],
    ],
    [
      'shared references',
      [
        'const wrapper = { first: bag, second: bag };',
        'wrapper.first.ready = wrapper.second.backup;',
      ],
    ],
  ])('propagates %s writes to the original result', async (_name, statements) => {
    const { scan, tokens } = await analyze(statements, ['bag.ready']);
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta']);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[beta]:bg-primary']);
  });

  it.each([
    ['object', 'const wrapper = { bag };'],
    ['array', 'const wrapper = [bag];'],
    ['nested object', 'const wrapper = { nested: { bag } };'],
  ])('revokes reachable proof after an unknown %s escape', async (_name, wrapper) => {
    const { scan, tokens } = await analyze(
      ['const captured = bag.ready;', wrapper, 'unknownConsumer(wrapper);'],
      ['bag.ready', 'captured']
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha']);
    expect(scan.unresolved).toEqual([{ expression: 'bag.ready', reason: 'subject' }]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });

  it('preserves reads, immutable captures and independent containers', async () => {
    const { scan, tokens } = await analyze(
      [
        'const captured = bag.ready;',
        'const independent = { ready: bag.ready };',
        'const wrapper = { bag, className: "text-primary" };',
        'const alias = wrapper.bag;',
        'const read = alias.ready;',
        'wrapper.bag.ready = bag.backup;',
        'tw(wrapper.className);',
      ],
      ['bag.ready', 'captured', 'independent.ready', 'read']
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta', 'alpha', 'alpha', 'alpha']);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary', 'data-[beta]:bg-primary']);
    expect(tokens).toContain('text-primary');
  });

  it('keeps a non-mutating wrapper read on the original state', async () => {
    const { scan, tokens } = await analyze(
      ['const wrapper = [{ nested: { bag } }];', 'const alias = wrapper[0].nested.bag;'],
      ['alias.ready']
    );
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha']);
    expect(scan.unresolved).toEqual([]);
    expect(semanticTokens(tokens)).toEqual(['data-[alpha]:bg-primary']);
  });
});

const bindingRouteProducer =
  "import { defineAsHook } from '@proto.ui/core';\nexport const asFacts = defineAsHook({ name: 'facts', setup(def) {\n  def.state.bool('alpha', false); def.state.bool('beta', false);\n}, projectHandle(result) {\n  return { ready: result.stateHandles.alpha, backup: result.stateHandles.beta };\n} });";

describe('source-backed wrapper binding and copy routes', () => {
  it.each([
    {
      'name': 'pattern-all-known-alternatives',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nlet controls={borrowed:bag.ready,local:flag};\nif(condition)controls={borrowed:bag.ready,local:bag.backup};\nconst {local}=controls;\ndef.rule({when:w=>w.state(local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': ['beta'],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[beta]:bg-primary', 'data-[local-flag]:bg-primary'],
      },
    },
    {
      'name': 'pattern-unproved-earlier-alternative',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nlet controls={borrowed:bag.ready,local:externalState};\nif(condition)controls={borrowed:bag.ready,local:bag.backup};\nconst {local}=controls;\ndef.rule({when:w=>w.state(local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': [],
        'unresolvedReasons': ['subject'],
        'semanticTokens': [],
      },
    },
    {
      'name': 'object-pattern-alias-write',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst controls={ready:bag.ready};\nconst {alias}={alias:controls};\nalias.ready=bag.backup;\ndef.rule({when:w=>w.state(controls.ready).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': ['beta'],
        'exposedLocalAttributes': [],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[beta]:bg-primary'],
      },
    },
    {
      'name': 'array-pattern-alias-write',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst controls={ready:bag.ready};\nconst [alias]=[controls];\nalias.ready=bag.backup;\ndef.rule({when:w=>w.state(controls.ready).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': ['beta'],
        'exposedLocalAttributes': [],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[beta]:bg-primary'],
      },
    },
    {
      'name': 'pattern-alias-unknown-escape',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst controls={ready:bag.ready};\nconst {alias}={alias:controls};\nunknownConsumer(alias);\ndef.rule({when:w=>w.state(controls.ready).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': [],
        'unresolvedReasons': ['subject'],
        'semanticTokens': [],
      },
    },
    {
      'name': 'inline-pattern-local',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst {local}={borrowed:bag.ready,local:flag};\ndef.rule({when:w=>w.state(local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[local-flag]:bg-primary'],
      },
    },
    {
      'name': 'inline-array-pattern-local',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst [borrowed,local]=[bag.ready,flag];\ndef.rule({when:w=>w.state(local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[local-flag]:bg-primary'],
      },
    },
    {
      'name': 'conditional-capture-preserves-local',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst controls={ready:bag.ready};\nlet selected=flag;\nif(condition)selected=controls.ready;\ndef.rule({when:w=>w.state(selected).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': ['alpha'],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[alpha]:bg-primary', 'data-[local-flag]:bg-primary'],
      },
    },
    {
      'name': 'conditional-capture-preserves-unknown',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst controls={ready:bag.ready};\nlet selected=externalState;\nif(condition)selected=controls.ready;\ndef.rule({when:w=>w.state(selected).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': [],
        'unresolvedReasons': ['subject'],
        'semanticTokens': [],
      },
    },
    {
      'name': 'proven-copy-untouched-local',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst controls={borrowed:bag.ready,local:flag};\nObject.assign(controls,{borrowed:bag.backup});\ndef.rule({when:w=>w.state(controls.local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[local-flag]:bg-primary'],
      },
    },
    {
      'name': 'proven-copy-written-member-control',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst controls={borrowed:bag.ready,local:flag};\nObject.assign(controls,{local:bag.backup});\ndef.rule({when:w=>w.state(controls.local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': ['beta'],
        'exposedLocalAttributes': [],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[beta]:bg-primary'],
      },
    },
    {
      'name': 'inline-member-local-control',
      'consumer':
        "import {asFacts} from './producer';\nfunction setup(def){const bag=asFacts();\nconst flag=def.state.bool('localFlag',false);def.expose.state('localFlag',flag);\nconst controls={borrowed:bag.ready,local:flag};\ndef.rule({when:w=>w.state(controls.local).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});}\nsetup(def);",
      'expected': {
        'states': [],
        'exposedLocalAttributes': ['local-flag'],
        'unresolvedReasons': [],
        'semanticTokens': ['data-[local-flag]:bg-primary'],
      },
    },
  ])('$name', async ({ consumer, expected }) => {
    const { scan, tokens } = await analyzeSource(consumer, bindingRouteProducer);
    expect([...new Set(scan.usages.map(({ state }) => state))].sort()).toEqual(expected.states);
    expect([...new Set(scan.exposedLocals.map(({ attribute }) => attribute))].sort()).toEqual(
      expected.exposedLocalAttributes
    );
    expect([...new Set(scan.unresolved.map(({ reason }) => reason))].sort()).toEqual(
      expected.unresolvedReasons
    );
    expect(semanticTokens(tokens)).toEqual(expected.semanticTokens);
  });
});
