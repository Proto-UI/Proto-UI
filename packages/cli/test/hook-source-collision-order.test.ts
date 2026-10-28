import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

/**
 * Two producers that share one configured name but project different states.
 * The runtime registers a `once` hook by configured name and the first
 * registration wins, so two calls in one setup chain cannot both own their own
 * producer's state.
 */
const PRODUCERS = [
  "import { defineAsHook } from '@proto.ui/core';",
  'export const asA = defineAsHook({',
  "  name: 'shared',",
  "  setup(d) { d.state.bool('alpha', false); },",
  '  projectHandle(r) { return { ready: r.stateHandles.alpha }; },',
  '});',
  'export const asB = defineAsHook({',
  "  name: 'shared',",
  "  setup(d) { d.state.bool('beta', false); },",
  '  projectHandle(r) { return { ready: r.stateHandles.beta }; },',
  '});',
].join('\n');

/** A real rule the coverage scan reads. */
const rule = (condition: string) =>
  `def.rule({ when: (w) => ${condition}, intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

const scanExtra = async (producerSource: string, consumerLines: string[]) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-extra-'));
  try {
    const producerFile = path.join(dir, 'producers.ts');
    await writeFile(producerFile, producerSource);
    const consumerFile = path.join(dir, 'consumer.proto.ts');
    const source = consumerLines.join('\n');
    await writeFile(consumerFile, source);
    return {
      producerFile,
      scan: scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext()),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('hook source collision order', () => {
  it.each([
    [
      'forked captured scalar',
      'let enabled: boolean; const asMutator = defineAsHook({ name: "mutator", setup() { enabled = true; } }); function install({ child }) { if (child) asA(); }',
      'enabled = false; if (enabled === false) { asMutator(); install({ child: enabled }); }',
      'alpha',
      true,
    ],
    [
      'parameter initialization captured scalar',
      'let enabled: boolean; const asMutator = defineAsHook({ name: "mutator", setup() { enabled = true; } }); function install(ignored = asMutator(), { child } = { child: enabled }) { if (child) asA(); }',
      'enabled = false; install();',
      'alpha',
      true,
    ],
    [
      'getter consumption in assignment',
      'function install({ child }) { if (child) asA(); }',
      'const source = { get child() { asA(); return false; } }; let child; ({ child } = source); install({ child: false });',
      'alpha',
      true,
    ],
    [
      'object-valued computed method key',
      'function install({ child = asA() }, ignored) {}',
      'const key = { toString() { asB(); return "key"; } }; install({ child: undefined }, { [key as unknown as string]() {} });',
      'beta',
      true,
    ],
    [
      'primitive computed method key',
      'function install({ child = asA() }, ignored) {}',
      'const key = "key"; install({ child: undefined }, { [key]() { asB(); } });',
      'alpha',
      false,
    ],
    [
      'returning effect branch',
      'function prime(flag) { if (flag) { new Unknown(); return; } } function install({ child = asA() }) {}',
      'prime(externalFlag); install({ child: undefined });',
      'alpha',
      true,
    ],
    [
      'caught throwing effect branch',
      'function prime(flag) { try { if (flag) { new Unknown(); throw null; } } catch {} } function install({ child = asA() }) {}',
      'prime(externalFlag); install({ child: undefined });',
      'alpha',
      true,
    ],
    [
      'recursive identifier assignment',
      'function install({ child }) { if (child) asA(); }',
      'let arg = { child: false }; [arg] = [{ child: true }]; install(arg);',
      'alpha',
      true,
    ],
    [
      'unchanged identifier',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; install(arg);',
      'beta',
      false,
    ],
    [
      'captured scalar producer write',
      'let enabled: boolean; const asMutator = defineAsHook({ name: "mutator", setup() { enabled = true; } }); function install({ child }) { if (child) asA(); }',
      'enabled = false; asMutator(); install({ child: enabled });',
      'alpha',
      true,
    ],
    [
      'unchanged captured scalar',
      'let enabled: boolean; function install({ child }) { if (child) asA(); }',
      'enabled = false; install({ child: enabled });',
      'beta',
      false,
    ],
    [
      'replaced array iterator',
      'function install([child = asA()]) {}',
      'const previous = Array.prototype[Symbol.iterator]; Array.prototype[Symbol.iterator] = function* () { yield null; }; install([undefined]); Array.prototype[Symbol.iterator] = previous;',
      'beta',
      true,
    ],
    [
      'pristine array iterator',
      'function install([child = asA()]) {}',
      'install([undefined]);',
      'alpha',
      false,
    ],
    [
      'inherited array hole',
      'function install({ 0: child = asA() }) {}',
      'Array.prototype[0] = null; install([,]); delete Array.prototype[0];',
      'beta',
      true,
    ],
    [
      'own undefined shadows inherited index',
      'function install({ 0: child = asA() }) {}',
      'Array.prototype[0] = null; install([undefined]); delete Array.prototype[0];',
      'alpha',
      false,
    ],
    [
      'own null shadows inherited index',
      'function install({ 0: child = asA() }) {}',
      'Array.prototype[0] = null; install([null]); delete Array.prototype[0];',
      'beta',
      false,
    ],
    [
      'pristine absent array index',
      'function install({ 0: child = asA() }) {}',
      'install([,]);',
      'alpha',
      false,
    ],
    [
      'nested getter before default',
      'function install({ nested: { ignored }, child = asA() }) {}',
      'install({ nested: { get ignored() { asB(); return false; } }, child: undefined });',
      'beta',
      true,
    ],
    [
      'nested own data before default',
      'function install({ nested: { ignored }, child = asA() }) {}',
      'install({ nested: { ignored: false }, child: undefined });',
      'alpha',
      false,
    ],
    [
      'eager computed method key',
      'function prime() { asB(); return "key"; } function install({ child = asA(), ignored }) {}',
      'install({ child: undefined, ignored: { [prime()]() {} } });',
      'beta',
      true,
    ],
    [
      'eager computed accessor key',
      'function prime() { asB(); return "key"; } function install({ child = asA(), ignored }) {}',
      'install({ child: undefined, ignored: { get [prime()]() { return false; } } });',
      'beta',
      true,
    ],
    [
      'deferred method body',
      'function install({ child = asA(), ignored }) {}',
      'install({ child: undefined, ignored: { key() { asB(); } } });',
      'alpha',
      false,
    ],
  ])(
    'preserves default registration provenance across %s',
    async (_label, declaration, body, winner, allowUnknown) => {
      const { scan } = await scanExtra(
        [
          PRODUCERS,
          declaration,
          `export const asParent = defineAsHook({ name: 'parent', setup() { ${body} } });`,
        ].join('\n'),
        [
          "import { asParent, asB } from './producers';",
          'function setup(def) {',
          'asParent(); const bag = asB();',
          rule('w.state(bag.ready).eq(true)'),
          '}',
          'setup(def);',
        ]
      );
      if (allowUnknown && scan.unresolved.length > 0) {
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
      } else {
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: winner === 'alpha' ? 'asA' : 'asB', state: winner },
        ]);
        expect(scan.unresolved).toEqual([]);
      }
    }
  );

  it.each([
    ['uncaught throw alternative', 'if (externalFlag) { throw new Unknown(); }', false],
    [
      'pre-existing effect before throw alternative',
      'new Unknown(); if (externalFlag) { throw new Unknown(); }',
      true,
    ],
    ['nonthrowing constructor alternative', 'if (externalFlag) { new Unknown(); }', true],
    ['returning constructor alternative', 'if (externalFlag) { new Unknown(); return {}; }', true],
    [
      'mixed returning and throwing alternatives',
      'if (externalFlag) { if (otherFlag) { new Unknown(); return {}; } throw null; }',
      true,
    ],
    [
      'caught throwing constructor alternative',
      'try { if (externalFlag) { throw new Unknown(); } } catch {}',
      true,
    ],
    ['known skipped constructor alternative', 'if (false) { new Unknown(); }', false],
  ])('keeps continuing registration effects honest: %s', async (_label, guard, unknown) => {
    const { scan } = await scanExtra(
      [
        PRODUCERS,
        `const asGuard = defineAsHook({ name: 'guard', setup() {}, projectHandle(r) { ${guard} return {}; } });`,
        'export const asParent = defineAsHook({ name: "parent", setup() { asGuard(); } });',
      ].join('\n'),
      [
        "import { asParent, asA } from './producers';",
        'function setup(def) {',
        'asParent(); const bag = asA();',
        rule('w.state(bag.ready).eq(true)'),
        '}',
        'setup(def);',
      ]
    );
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual(
      unknown ? [] : [{ hook: 'asA', state: 'alpha' }]
    );
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(
      unknown ? ['bag.ready'] : []
    );
  });

  it.each([
    ['omitted object', 'function install({ child = asA() } = {}) {}', 'install()', false],
    [
      'undefined object',
      'function install({ child = asA() } = {}) {}',
      'install(undefined)',
      false,
    ],
    ['missing member', 'function install({ child = asA() } = {}) {}', 'install({})', false],
    [
      'undefined member',
      'function install({ child = asA() } = {}) {}',
      'install({ child: undefined })',
      false,
    ],
    [
      'supplied null',
      'function install({ child = asA() } = {}) {}',
      'install({ child: null })',
      true,
    ],
    [
      'supplied false',
      'function install({ child = asA() } = {}) {}',
      'install({ child: false })',
      true,
    ],
    [
      'unknown member',
      'function install({ child = asA() } = {}) {}',
      'install({ child: opaque })',
      'unknown',
    ],
    ['unknown object', 'function install({ child = asA() } = {}) {}', 'install(opaque)', 'unknown'],
    [
      'unknown nested object',
      'function install({ nested: { child = asA() } = {} } = {}) {}',
      'install({ nested: opaque })',
      'unknown',
    ],
    [
      'nested missing',
      'function install({ nested: { child = asA() } = {} } = {}) {}',
      'install()',
      false,
    ],
    [
      'nested supplied',
      'function install({ nested: { child = asA() } = {} } = {}) {}',
      'install({ nested: { child: null } })',
      true,
    ],
    ['array hole', 'function install([child = asA()] = []) {}', 'install([,])', false],
    ['array undefined', 'function install([child = asA()] = []) {}', 'install([undefined])', false],
    ['array supplied', 'function install([child = asA()] = []) {}', 'install([null])', true],
    ['array unknown', 'function install([child = asA()] = []) {}', 'install([opaque])', 'unknown'],
    [
      'object first default wins',
      'function install({ first = asA(), second = asB() } = {}) {}',
      'install()',
      false,
    ],
    [
      'object reversed defaults',
      'function install({ first = asB(), second = asA() } = {}) {}',
      'install()',
      true,
    ],
    [
      'array first default wins',
      'function install([first = asA(), second = asB()] = []) {}',
      'install()',
      false,
    ],
    [
      'array reversed defaults',
      'function install([first = asB(), second = asA()] = []) {}',
      'install()',
      true,
    ],
    [
      'earlier binding feeds later default',
      'function install({ first = true, child = first ? asA() : asB() } = {}) {}',
      'install()',
      false,
    ],
    [
      'supplied binding feeds later default',
      'function install({ first = true, child = first ? asA() : asB() } = {}) {}',
      'install({ first: false })',
      true,
    ],
  ])('replays reached destructured defaults: %s', async (_label, declaration, call, beta) => {
    const { scan } = await scanExtra(
      [
        PRODUCERS,
        declaration,
        `export const asParent = defineAsHook({ name: 'parent', setup() { ${call}; } });`,
      ].join('\n'),
      [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );
    const uncertain = beta === 'unknown';
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual(
      uncertain ? [] : beta ? [{ hook: 'asB', state: 'beta' }] : [{ hook: 'asA', state: 'alpha' }]
    );
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(
      uncertain ? ['bag.ready'] : []
    );
  });

  it.each([
    [
      'deleted member',
      'function install({ child }) { if (child) asB(); else asA(); }',
      'const arg: { child?: boolean } = { child: true }; delete arg.child; install(arg);',
      'unknown',
    ],
    [
      'incremented member',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: 0 }; arg.child++; install(arg);',
      'unknown',
    ],
    [
      'decremented member',
      'function install({ child }) { if (child) asB(); else asA(); }',
      'const arg = { child: 1 }; --arg.child; install(arg);',
      'unknown',
    ],
    [
      'unchanged member',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; install(arg);',
      'beta',
    ],
    [
      'nonempty array length',
      'function install({ length }) { if (length) asA(); }',
      'install([null]);',
      'alpha',
    ],
    [
      'empty array length',
      'function install({ length }) { if (length) asA(); }',
      'install([]);',
      'beta',
    ],
    [
      'inherited object method',
      'function install({ toString }) { if (toString) asA(); }',
      'install({});',
      'unknown',
    ],
    [
      'own method shadow',
      'function install({ toString }) { if (toString) asA(); }',
      'install({ toString: false });',
      'beta',
    ],
    [
      'source prototype setter',
      'function install({ child }) { if (child) asA(); }',
      'install({ __proto__: { child: true } });',
      'unknown',
    ],
    [
      'computed own prototype key',
      'function install({ ["__proto__"]: child }) { if (child) asA(); }',
      'install({ ["__proto__"]: false });',
      'beta',
    ],
    [
      'computed own prototype value',
      'function install({ ["__proto__"]: child }) { if (child) asA(); }',
      'install({ ["__proto__"]: true });',
      'alpha',
    ],
    [
      'positional argument after spread',
      'function install(first, { child }, ...rest) { if (child) asA(); }',
      'install(...([null, { child: true }] as const), { child: false });',
      'unknown',
    ],
    [
      'possibly supplied default after spread',
      'function install(first, child = asA()) {}',
      'install(...([null, null] as const));',
      'unknown',
    ],
    [
      'fixed positional control',
      'function install(first, { child }, ...rest) { if (child) asA(); }',
      'install(null, { child: false });',
      'beta',
    ],
    // Consuming an unknown iterator can install a name before the helper runs.
    [
      'fixed argument before unknown spread',
      'function install({ child }, ...rest) { if (child) asA(); }',
      'install({ child: true }, ...opaque);',
      'unknown',
    ],
    [
      'fixed argument before effect-proven spread',
      'function install({ child }, ...rest) { if (child) asA(); }',
      'install({ child: true }, ...[]);',
      'alpha',
    ],
    [
      'array assignment member target',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; [arg.child] = [true]; install(arg);',
      'unknown',
    ],
    [
      'object assignment member target',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; ({ value: arg.child } = { value: true }); install(arg);',
      'unknown',
    ],
    [
      'nested assignment member target',
      'function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; ({ value: [arg.child] } = { value: [true] }); install(arg);',
      'unknown',
    ],
    [
      'nested producer captured module aggregate',
      'let arg: { child: boolean }; const asMutator = defineAsHook({ name: "mutator", setup() { arg.child = true; } }); function install({ child }) { if (child) asA(); }',
      'arg = { child: false }; asMutator(); install(arg);',
      'unknown',
    ],
    [
      'nested producer unchanged aggregate control',
      'let arg: { child: boolean }; const asMutator = defineAsHook({ name: "mutator", setup() {} }); function install({ child }) { if (child) asA(); }',
      'arg = { child: false }; asMutator(); install(arg);',
      'beta',
    ],
    [
      'generator iteration before fixed parameter',
      'const more = function* () { asB(); }; function install({ child }, ...rest) { if (child) asA(); }',
      'install({ child: true }, ...more());',
      'unknown',
    ],
    [
      'unconsumed generator control',
      'const more = function* () { asB(); }; function install({ child }) { if (child) asA(); }',
      'more(); install({ child: true });',
      'alpha',
    ],
    [
      'prototype write before fresh aggregate',
      'function install({ child }) { if (child) asA(); }',
      '(Object.prototype as { child?: boolean }).child = true; install({}); delete (Object.prototype as { child?: boolean }).child;',
      'unknown',
    ],
    [
      'prototype write before fresh nested aggregate',
      'function install({ nested: { child } }) { if (child) asA(); }',
      '(Object.prototype as { child?: boolean }).child = true; install({ nested: {} }); delete (Object.prototype as { child?: boolean }).child;',
      'unknown',
    ],
    [
      'fresh own member after prototype write control',
      'function install({ child }) { if (child) asA(); }',
      '(Object.prototype as { child?: boolean }).child = true; install({ child: false }); delete (Object.prototype as { child?: boolean }).child;',
      'beta',
    ],
    [
      'standalone constructor aggregate escape',
      'class Mutator { constructor(arg: { child: boolean }) { arg.child = true; } } function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; new Mutator(arg); install(arg);',
      'unknown',
    ],
    [
      'standalone constructor name installation',
      'class Mutator { constructor() { asB(); } } function install({ child }) { if (child) asA(); }',
      'new Mutator(); install({ child: true });',
      'unknown',
    ],
    [
      'uninvoked constructor control',
      'class Mutator { constructor(arg: { child: boolean }) { arg.child = true; } } function install({ child }) { if (child) asA(); }',
      'const arg = { child: false }; install(arg);',
      'beta',
    ],
    [
      'cached winner before constructor control',
      'class Mutator { constructor() { asB(); } } function install({ child }) { if (child) asA(); }',
      'asA(); new Mutator(); install({ child: true });',
      'alpha',
    ],
    [
      'cached winner before iterator control',
      'const more = function* () { asB(); }; function install({ child }, ...rest) { if (child) asA(); }',
      'asA(); install({ child: true }, ...more());',
      'alpha',
    ],
  ])(
    'preserves aggregate and argument certainty: %s',
    async (_label, declaration, body, outcome) => {
      const { scan } = await scanExtra(
        [
          PRODUCERS,
          declaration,
          `export const asParent = defineAsHook({ name: 'parent', setup() { ${body} } });`,
        ].join('\n'),
        [
          "import { asParent, asB } from './producers';",
          'function setup(def) {',
          '  asParent();',
          '  const bag = asB();',
          `  ${rule('w.state(bag.ready).eq(true)')}`,
          '}',
          'setup(def);',
        ]
      );
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual(
        outcome === 'unknown'
          ? []
          : outcome === 'alpha'
            ? [{ hook: 'asA', state: 'alpha' }]
            : [{ hook: 'asB', state: 'beta' }]
      );
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(
        outcome === 'unknown' ? ['bag.ready'] : []
      );
    }
  );

  it('retires an exposed callable proof when its binding is reassigned', async () => {
    const { scan } = await scanExtra(
      [
        PRODUCERS,
        "const asInstaller = defineAsHook({ name: 'installer', setup(d) { d.expose.method('prime', () => asA()); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { const result = asInstaller(); let prime = result.getMethod!('prime') as () => void; prime = () => { asB(); }; prime(); } });",
      ].join('\n'),
      [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );
    expect([
      { usages: [{ hook: 'asB', state: 'beta' }], unresolved: [] },
      { usages: [], unresolved: ['bag.ready'] },
    ]).toContainEqual({
      usages: scan.usages.map(({ hook, state }) => ({ hook, state })),
      unresolved: scan.unresolved.map(({ expression }) => expression),
    });
  });

  it('withholds registration proof for detached authored raw-result methods', async () => {
    const { scan } = await scanExtra(
      [
        PRODUCERS,
        "const asInstaller = defineAsHook({ name: 'installer', setup(d) { d.expose.method('prime', () => asB()); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { const result = asInstaller(); const prime = result.methods!.prime as () => void; prime(); asA(); } });",
      ].join('\n'),
      [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
  });

  it('withholds a nested producer when an enclosing producer registered in an earlier iteration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-repeated-enclosing-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  let bag = null;',
        '  for (let i = 0; i < 2; i++) asB(i === 0 ? undefined : (bag = asA()));',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('certifies the first registration of one statement and withholds the later one', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-order-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(producerFile, PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  const first = asA(), second = asB();',
        `  ${rule('w.state(first.ready).eq(true)')}`,
        `  ${rule('w.state(second.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The statement evaluates left to right, so `asA()` registers `shared`
      // first and `first` is that producer's own handle.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      // `asB()` runs after that registration, so it cannot own `beta`. The
      // summary refuses the later collision instead of certifying either state.
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['second.ready']);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).not.toContainEqual({
        hook: 'asB',
        state: 'beta',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps a nested earlier registration as an earlier registration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-nested-earlier-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  const bag = asB(asA());',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The argument is evaluated before the call it is passed to, so the
      // nested `asA()` is an earlier registration of `shared`.
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not treat the enclosing later call as an earlier registration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-nested-later-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  const bag = asB(asA());',
        `  ${rule('w.state(asA().ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The enclosing `asB()` call runs after the argument it is given, so it
      // cannot have registered `shared` before the nested `asA()` call.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps refusing a later registration from an earlier statement', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-earlier-statement-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  asA();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves a later same-name call through an earlier parent child registration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-parent-child-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          PRODUCERS,
          'export const asParent = defineAsHook({',
          "  name: 'parent',",
          '  setup() { asA(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // `asParent()` runs its setup before `asB()`, so its nested `asA()` is
      // the first registration of `shared`. The later `asB()` call reuses
      // asA's cached projected handle rather than projecting `beta`.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps later proof when an earlier parent registers only a different-name child', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-parent-different-child-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          PRODUCERS,
          'export const asOther = defineAsHook({',
          "  name: 'other',",
          "  setup(d) { d.state.bool('other', false); },",
          '  projectHandle(r) { return { ready: r.stateHandles.other }; },',
          '});',
          'export const asParent = defineAsHook({',
          "  name: 'parent',",
          '  setup() { asOther(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The nested registration is named `other`, not `shared`, so it does
      // not skip `asB()` or replace its own `beta` projection.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('terminates mutual parent registration queries', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-mutual-parents-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          "import { defineAsHook } from '@proto.ui/core';",
          'export const asLeft = defineAsHook({',
          "  name: 'left',",
          '  setup() { asRight(); },',
          '});',
          'export const asRight = defineAsHook({',
          "  name: 'right',",
          '  setup() { asLeft(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asLeft, asRight } from './producers';",
        'function setup(def) {',
        '  const { ready: left } = asLeft(), { ready: right } = asRight();',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not register a child on a short-circuited setup path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-short-circuit-child-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          PRODUCERS,
          'export const asParent = defineAsHook({',
          "  name: 'parent',",
          '  setup() { false && asA(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not descend into a child setup skipped by its ancestor name', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-skipped-descendant-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          PRODUCERS,
          'export const asSkipped = defineAsHook({',
          "  name: 'parent',",
          '  setup() { asA(); },',
          '});',
          'export const asParent = defineAsHook({',
          "  name: 'parent',",
          '  setup() { asSkipped(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('attributes a cached parent child projection to the winning producer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-winning-attribution-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(
        producerFile,
        [
          PRODUCERS,
          'export const asParent = defineAsHook({',
          "  name: 'parent',",
          '  setup() { asA(); },',
          '});',
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const { ready } = asB();',
        `  ${rule('w.state(ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('terminates prior-registration queries between distinct acyclic producers', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-acyclic-queries-'));
    try {
      await writeFile(
        path.join(dir, 'producers.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          'const asRightLeaf = defineAsHook({',
          "  name: 'right',",
          "  setup(d) { d.state.bool('rightLeaf', false); },",
          '  projectHandle(r) { return { ready: r.stateHandles.rightLeaf }; },',
          '});',
          'const asLeftLeaf = defineAsHook({',
          "  name: 'left',",
          "  setup(d) { d.state.bool('leftLeaf', false); },",
          '  projectHandle(r) { return { ready: r.stateHandles.leftLeaf }; },',
          '});',
          "export const asLeft = defineAsHook({ name: 'left', setup() { asRightLeaf(); } });",
          "export const asRight = defineAsHook({ name: 'right', setup() { asLeftLeaf(); } });",
        ].join('\n')
      );
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asLeft, asRight } from './producers';",
        'function setup(def) {',
        '  const { ready: left } = asLeft(), { ready: right } = asRight();',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each([
    {
      label: 'a gate registered before the parent',
      declarations: [
        "export const asBlocker = defineAsHook({ name: 'gate', setup() {} });",
        "const asGate = defineAsHook({ name: 'gate', setup() { asA(); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { asGate(); } });",
      ],
      before: 'asBlocker();',
    },
    {
      label: 'a falsy logical-and assignment',
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { let slot: unknown = false; slot &&= asA(); } });",
      ],
      before: '',
    },
    {
      label: 'a truthy logical-or assignment',
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { let slot: unknown = true; slot ||= asA(); } });",
      ],
      before: '',
    },
    {
      label: 'a non-nullish logical-nullish assignment',
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { let slot: unknown = false; slot ??= asA(); } });",
      ],
      before: '',
    },
    {
      label: 'a synchronous helper without a Def argument',
      declarations: [
        'function prime() { asB(); }',
        "export const asParent = defineAsHook({ name: 'parent', setup() { prime(); asA(); } });",
      ],
      before: '',
    },
    {
      label: 'an outer helper primes the gate',
      declarations: [
        "export const asBlocker = defineAsHook({ name: 'gate', setup() {} });",
        "const asGate = defineAsHook({ name: 'gate', setup() { asA(); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { asGate(); } });",
      ],
      before: 'function prime() { asBlocker(); }\n  prime();',
    },
    {
      label: 'a compound assignment changes reachability',
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { let slot = 1; slot -= 1; slot && asA(); } });",
      ],
      before: '',
    },
    {
      label: 'later argument assignments cannot rewrite captured values',
      declarations: [
        'function prime(first, ignored) { if (first) asA(); else asB(); }',
        "export const asParent = defineAsHook({ name: 'parent', setup() { let enabled = false; prime(enabled, enabled = true); asA(); } });",
      ],
      before: '',
    },
    {
      label: 'an exposed authored callback runs',
      declarations: [
        "export const asInstaller = defineAsHook({ name: 'installer', setup(d) { d.expose.method('prime', () => asB()); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { const result = asInstaller(); const prime = result.getMethod!('prime') as () => void; prime(); asA(); } });",
      ],
      before: '',
    },
    {
      label: 'a deferred generator body',
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { const make = function* () { asA(); }; make(); } });",
      ],
      before: '',
    },
  ])('preserves beta after $label', async ({ declarations, before }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-ordered-effects-'));
    try {
      const producerFile = path.join(dir, 'producers.ts');
      await writeFile(producerFile, [PRODUCERS, ...declarations].join('\n'));
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        `import { asParent, asB${before ? ', asBlocker' : ''} } from './producers';`,
        'function setup(def) {',
        `  ${before}`,
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves canonical cached handle identity across repeated skipped calls', async () => {
    const producerSource = [
      "import { defineAsHook } from '@proto.ui/core';",
      'export const asA = defineAsHook({',
      "  name: 'shared',",
      "  setup(d) { d.state.bool('alpha', false); },",
      '  projectHandle(r) { return { nested: { ready: r.stateHandles.alpha } }; },',
      '});',
      'export const asB = defineAsHook({',
      "  name: 'shared',",
      "  setup(d) { d.state.bool('beta', false); },",
      '  projectHandle(r) { return { nested: { ready: r.stateHandles.beta } }; },',
      '});',
      "export const asParent = defineAsHook({ name: 'parent', setup() { asA(); } });",
    ].join('\n');
    const { scan } = await scanExtra(producerSource, [
      "import { asParent, asB } from './producers';",
      'function setup(def) {',
      '  asParent();',
      '  const first = asB(), second = asB();',
      '  mutate(first);',
      `  ${rule('w.state(second.nested.ready).eq(true)')}`,
      '}',
      'setup(def);',
    ]);

    // Runtime returns the same cached handle for both skipped calls, so the
    // mutation must also withdraw the second reference's proof.
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['second.nested.ready']);
  });

  it('withholds proof when a possible empty gate could precede an installing gate', async () => {
    const { scan } = await scanExtra(
      [
        PRODUCERS,
        "export const asEmptyGate = defineAsHook({ name: 'gate', setup() {} });",
        "export const asInstallingGate = defineAsHook({ name: 'gate', setup() { asB(); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { if (choose) asEmptyGate(); else asInstallingGate(); asA(); } });",
      ].join('\n'),
      [
        "import { asParent, asB } from './producers';",
        'function setup(def) {',
        '  asParent();',
        '  const bag = asB();',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );

    // `choose === false` installs beta before `asA()` is skipped, so an alpha
    // proof is not valid for every execution path.
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
  });

  it('preserves beta after reached helper parameter defaults', async () => {
    for (const invocation of ['prime()', 'prime(undefined)']) {
      const { scan, producerFile } = await scanExtra(
        [
          PRODUCERS,
          'function prime(unused = asB()) {}',
          `export const asParent = defineAsHook({ name: 'parent', setup() { ${invocation}; asA(); } });`,
        ].join('\n'),
        [
          "import { asParent, asB } from './producers';",
          'function setup(def) {',
          '  asParent();',
          '  const bag = asB();',
          `  ${rule('w.state(bag.ready).eq(true)')}`,
          '}',
          'setup(def);',
        ]
      );

      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([producerFile]);
      expect(scan.unresolved).toEqual([]);
    }
  });

  it('withdraws one canonical handle shared by winning and skipped callers', async () => {
    const { scan } = await scanExtra(
      [
        "import { defineAsHook } from '@proto.ui/core';",
        "export const asA = defineAsHook({ name: 'shared', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { nested: { ready: r.stateHandles.alpha } }; } });",
        "export const asB = defineAsHook({ name: 'shared', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { nested: { ready: r.stateHandles.beta } }; } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { asA(); } });",
        "export const asIndependent = defineAsHook({ name: 'independent', setup(d) { d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.stable }; } });",
      ].join('\n'),
      [
        "import { asParent, asA, asB, asIndependent } from './producers';",
        'function setup(def) {',
        '  const independent = asIndependent();',
        '  asParent();',
        '  const first = asA();',
        '  const second = asB();',
        '  mutate(first);',
        `  ${rule('w.state(second.nested.ready).eq(true)')}`,
        `  ${rule('w.state(independent.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asIndependent', state: 'stable' },
    ]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['second.nested.ready']);
  });

  it.each([
    {
      label: 'outer helper reachability',
      variants: [
        { before: 'if (false) prime();', outcome: 'alpha' },
        { before: 'if (choose) prime();', outcome: 'unknown' },
      ],
      declarations: [
        "export const asBlocker = defineAsHook({ name: 'gate', setup() {} });",
        "const asGate = defineAsHook({ name: 'gate', setup() { asA(); } });",
        'export function prime() { asBlocker(); }',
        "export const asParent = defineAsHook({ name: 'parent', setup() { asGate(); } });",
      ],
    },
    {
      label: 'possibly undefined helper arguments',
      variants: [{ before: '', outcome: 'unknown' }],
      declarations: [
        'function prime(value = asB()) {}',
        "export const asParent = defineAsHook({ name: 'parent', setup() { prime(input); asA(); } });",
      ],
    },
    {
      label: 'async helper synchronous effects',
      variants: [{ before: '', outcome: 'beta-or-unknown' }],
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { const prime = async () => { asB(); }; prime(); asA(); } });",
      ],
    },
    {
      label: 'uncertain exposed method alternatives',
      variants: [{ before: '', outcome: 'unknown' }],
      declarations: [
        "const asInstaller = defineAsHook({ name: 'installer', setup(d) { if (choose) d.expose.method('prime', () => asA()); else d.expose.method('prime', () => asB()); } });",
        "export const asParent = defineAsHook({ name: 'parent', setup() { const result = asInstaller(); const prime = result.getMethod!('prime') as () => void; prime(); } });",
      ],
    },
    {
      label: 'conditional var capability-origin joins',
      variants: [{ before: '', outcome: 'unknown' }],
      declarations: [
        'const foreignFacade = { state: { bool() { asB(); } } };',
        "export const asParent = defineAsHook({ name: 'parent', setup(d) { var facade = foreignFacade; if (choose) var facade = d; facade.state.bool('ignored', false); asA(); } });",
      ],
    },
    {
      label: 'increment and decrement reachability facts',
      variants: [{ before: '', outcome: 'beta-or-unknown' }],
      declarations: [
        "export const asParent = defineAsHook({ name: 'parent', setup() { let slot = 0; slot++; slot || asA(); let other = 2; --other; other || asA(); } });",
      ],
    },
  ])('preserves registration evidence across $label', async ({ declarations, variants }) => {
    for (const { before, outcome } of variants) {
      const { scan } = await scanExtra(
        [
          PRODUCERS,
          ...declarations,
          "export const asIndependent = defineAsHook({ name: 'independent', setup(d) { d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.stable }; } });",
        ].join('\n'),
        [
          `import { asParent, asB, asIndependent${before ? ', prime' : ''} } from './producers';`,
          'function setup(def) {',
          '  const independent = asIndependent();',
          `  ${before}`,
          '  asParent();',
          '  const bag = asB();',
          `  ${rule('w.state(bag.ready).eq(true)')}`,
          `  ${rule('w.state(independent.ready).eq(true)')}`,
          '}',
          'setup(def);',
        ]
      );
      const observed = {
        usages: scan.usages.map(({ hook, state }) => ({ hook, state })),
        unresolved: scan.unresolved.map(({ expression }) => expression),
      };
      const stable = { hook: 'asIndependent', state: 'stable' };
      if (outcome === 'alpha') {
        expect(observed).toEqual({
          usages: [{ hook: 'asA', state: 'alpha' }, stable],
          unresolved: [],
        });
      } else if (outcome === 'unknown') {
        expect(observed).toEqual({ usages: [stable], unresolved: ['bag.ready'] });
      } else {
        // A supported synchronous/update prefix proves beta. An unsupported
        // effect must instead withhold it, never invent an alpha winner.
        expect([
          { usages: [{ hook: 'asB', state: 'beta' }, stable], unresolved: [] },
          { usages: [stable], unresolved: ['bag.ready'] },
        ]).toContainEqual(observed);
      }
    }
  });

  it('shares the initial non-leaf handle with repeated calls during withdrawal', async () => {
    const { scan } = await scanExtra(
      [
        "import { defineAsHook } from '@proto.ui/core';",
        "const asChild = defineAsHook({ name: 'child', setup() {} });",
        "export const asA = defineAsHook({ name: 'shared', setup(d) { asChild(); d.state.bool('alpha', false); }, projectHandle(r) { return { nested: { ready: r.stateHandles.alpha } }; } });",
        "export const asIndependent = defineAsHook({ name: 'independent', setup(d) { d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.stable }; } });",
      ].join('\n'),
      [
        "import { asA, asIndependent } from './producers';",
        'function setup(def) {',
        '  const independent = asIndependent();',
        '  const first = asA();',
        '  const second = asA();',
        '  mutate(first);',
        `  ${rule('w.state(second.nested.ready).eq(true)')}`,
        `  ${rule('w.state(independent.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ]
    );
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asIndependent', state: 'stable' },
    ]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['second.nested.ready']);
  });

  it('respects outer logical and conditional helper reachability', async () => {
    for (const before of [
      'false && prime();',
      'true || prime();',
      'false ?? prime();',
      'false ? prime() : undefined;',
      'true ? undefined : prime();',
    ]) {
      const { scan } = await scanExtra(
        [
          PRODUCERS,
          'export function prime() { asA(); }',
          "export const asParent = defineAsHook({ name: 'parent', setup() {} });",
          "export const asIndependent = defineAsHook({ name: 'independent', setup(d) { d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.stable }; } });",
        ].join('\n'),
        [
          "import { asParent, asB, prime, asIndependent } from './producers';",
          'function setup(def) {',
          '  const independent = asIndependent();',
          `  ${before}`,
          '  asParent();',
          '  const bag = asB();',
          `  ${rule('w.state(bag.ready).eq(true)')}`,
          `  ${rule('w.state(independent.ready).eq(true)')}`,
          '}',
          'setup(def);',
        ]
      );
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asB', state: 'beta' },
        { hook: 'asIndependent', state: 'stable' },
      ]);
      expect(scan.unresolved).toEqual([]);
    }
  });

  it('keeps refusing a registration a switch selector made before the body', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-switch-selector-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  switch (0) {',
        '    default: {',
        '      const bag = asA();',
        `      ${rule('w.state(bag.ready).eq(true)')}`,
        '      break;',
        '    }',
        '    case (asB(), 1): break;',
        '  }',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The runtime evaluates the case expression before it enters the
      // default body, so `asB()` registered `shared` first and the body's
      // `asA()` cannot own it. The source order of the nodes does not show
      // that, because the case clause is written after the body.
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps refusing it when the switch selector is written first', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-switch-selector-first-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  switch (0) {',
        '    case (asB(), 1): break;',
        '    default: {',
        '      const bag = asA();',
        `      ${rule('w.state(bag.ready).eq(true)')}`,
        '      break;',
        '    }',
        '  }',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The case expression still selects the clause before the body runs,
      // so the refusal does not depend on where the case clause is written.
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps a switch selector that calls the same producer as one registration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-switch-selector-same-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA } from './producers';",
        'function setup(def) {',
        '  switch (0) {',
        '    default: {',
        '      const bag = asA();',
        `      ${rule('w.state(bag.ready).eq(true)')}`,
        '      break;',
        '    }',
        '    case (asA(), 1): break;',
        '  }',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // One producer called twice is one registration, so the selector and
      // the body share the producer and the body still owns `alpha`.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps refusing a registration a binding default made after the initializer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-destructuring-default-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  let bag;',
        '  const { unused = (bag = asA()) } = (asB(), {});',
        `  ${rule('w.state(bag.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The runtime evaluates the initializer before the binding default, so
      // `asB()` registered `shared` first and the default's `asA()` cannot
      // own it. The binding default comes first in the source, so the source
      // order of the nodes does not show that.
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps an outer switch selector out of an inner setup', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-inner-setup-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA, asB } from './producers';",
        'function setup(def) {',
        '  switch (0) {',
        '    case (asB(), 1): break;',
        '    default: {',
        '      function inner(def) {',
        '        const bag = asA();',
        `        ${rule('w.state(bag.ready).eq(true)')}`,
        '      }',
        '      inner(def);',
        '      break;',
        '    }',
        '  }',
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // The inner setup is its own runtime cache, so the outer switch's
      // `asB()` cannot have registered `shared` before the inner `asA()`.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the provenance of a producer that is called twice', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-collision-repeated-'));
    try {
      await writeFile(path.join(dir, 'producers.ts'), PRODUCERS);
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const consumer = [
        "import { asA } from './producers';",
        'function setup(def) {',
        '  const first = asA(), second = asA();',
        `  ${rule('w.state(first.ready).eq(true)')}`,
        `  ${rule('w.state(second.ready).eq(true)')}`,
        '}',
        'setup(def);',
      ].join('\n');
      await writeFile(consumerFile, consumer);
      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());

      // One producer called twice is one registration, not a collision.
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asA', state: 'alpha' },
        { hook: 'asA', state: 'alpha' },
      ]);
      expect(scan.unresolved).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
