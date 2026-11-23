import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const paint = `function paint(def, facts) {
  def.rule({ when: w => w.state(facts.ready).eq(true),
    intent: i => i.feedback.style.use(tw('bg-primary')) });
}`;
const independent = `const independent = asC().ready;
def.rule({ when: w => w.state(independent).eq(true),
  intent: i => i.feedback.style.use(tw('underline')) });`;

async function observe({
  helper = paint,
  setup = 'const facts = asA(); paint(def, facts);',
  tail = '',
  factory = 'definePrototype',
  declarations = '',
}: {
  helper?: string;
  setup?: string;
  tail?: string;
  factory?: string;
  declarations?: string;
} = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lowered-local-helper-'));
  try {
    const producer = path.join(directory, 'producer.ts');
    await writeFile(
      producer,
      `import { defineAsHook } from '@proto.ui/core';
export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); },
  projectHandle: result => ({ ready: result.stateHandles.alpha }) });
export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); },
  projectHandle: result => ({ ready: result.stateHandles.beta }) });
export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); },
  projectHandle: result => ({ ready: result.stateHandles.gamma }) });`
    );
    const source = `import { definePrototype, tw } from '@proto.ui/core';
import { asA, asB, asC } from './producer';
${declarations}
${helper}
export default ${factory}({ name: 'helper-consumer', setup(def) {
  ${setup}
} });
${tail}
const separateOwner = definePrototype({ name: 'independent', setup(def) {
  ${independent}
} });`;
    const file = path.join(directory, 'consumer.proto.ts');
    await writeFile(file, source);
    return {
      scan: scanRuleStateReads(source, file),
      tokens: await collectProtoStyleTokensFromFiles([file]),
      producer,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('closed local rule helper invocation', () => {
  it('proves the helper parameter from its actual source-backed argument', async () => {
    const { scan, tokens, producer } = await observe();
    expect(scan.unresolved).toEqual([]);
    expect(
      scan.usages.map(({ state, provenance }) => ({
        state,
        declaration: provenance?.declaration.file,
      }))
    ).toEqual([
      { state: 'alpha', declaration: producer },
      { state: 'gamma', declaration: producer },
    ]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
    expect(tokens).toContain('data-[gamma]:underline');
    expect(tokens).not.toContain('data-[beta]:bg-primary');
  });

  it('replays distinct call arguments without caching the first helper invocation', async () => {
    const { scan, tokens } = await observe({ setup: 'paint(def, asA()); paint(def, asB());' });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'beta', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
    expect(tokens).toContain('data-[beta]:bg-primary');
  });

  it('captures the value of a caller-created literal container in the caller scope', async () => {
    const { scan, tokens } = await observe({
      setup: 'const ready = asA().ready; paint(def, { ready });',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('binds a direct borrowed State without using the parameter name or annotation', async () => {
    const { scan, tokens } = await observe({
      helper: paint.replaceAll('facts.ready', 'facts'),
      setup: 'paint(def, asA().ready);',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('retains an unknown invocation beside a separately proven invocation', async () => {
    const { scan, tokens } = await observe({
      setup: 'paint(def, asA()); paint(def, opaque);',
    });
    expect(scan.unresolved).toEqual([{ reason: 'subject', expression: 'facts.ready' }]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
    expect(tokens).toContain('data-[gamma]:underline');
  });

  it('captures an earlier argument before a later argument rebinds its identifier', async () => {
    const { scan, tokens } = await observe({
      helper: paint.replace('def, facts)', 'def, facts, ignored)'),
      setup: 'let facts = asA(); paint(def, facts, (facts = asB()));',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
    expect(tokens).not.toContain('data-[beta]:bg-primary');
  });

  it('observes a later argument mutating the same borrowed container', async () => {
    const { scan, tokens } = await observe({
      helper: paint.replace('def, facts)', 'def, facts, ignored)'),
      setup: 'const facts = asA(); paint(def, facts, Object.assign(facts, asB()));',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta', 'gamma']);
    expect(tokens).toContain('data-[beta]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('preserves a direct identifier assignment as the argument value', async () => {
    const { scan, tokens } = await observe({
      setup: 'let facts = asA(); paint(def, (facts = asB()));',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta', 'gamma']);
    expect(tokens).toContain('data-[beta]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('captures a scalar after the earlier argument rebinds its owner', async () => {
    const { scan, tokens } = await observe({
      helper: paint
        .replace('def, facts)', 'def, ignored, facts)')
        .replaceAll('facts.ready', 'facts'),
      setup: 'let facts = asA(); paint(def, (facts = asB()), facts.ready);',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['beta', 'gamma']);
    expect(tokens).toContain('data-[beta]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  for (const [name, argument, read] of [
    ['a scalar', 'facts.ready', 'facts'],
    ['a literal copy', '{ ready: facts.ready }', 'facts.ready'],
    ['a spread copy', '{ ...facts }', 'facts.ready'],
  ] as const) {
    it(`keeps ${name} captured before a later argument writes the original container`, async () => {
      const { scan, tokens } = await observe({
        helper: paint
          .replace('def, facts)', 'def, facts, ignored)')
          .replaceAll('facts.ready', read),
        setup: `const facts = asA(); paint(def, ${argument}, Object.assign(facts, asB()));`,
      });
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
      expect(tokens).toContain('data-[alpha]:bg-primary');
      expect(tokens).not.toContain('data-[beta]:bg-primary');
    });
  }

  it('keeps a passive conditional whose two branches capture the same State', async () => {
    const { scan, tokens } = await observe({
      helper: paint.replaceAll('facts.ready', 'facts'),
      setup: 'const facts = asA(); paint(def, flag ? facts.ready : facts.ready);',
    });
    expect(scan.unresolved).toEqual([]);
    expect(scan.usages.map(({ state }) => state)).toEqual(['alpha', 'gamma']);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  for (const argument of [
    '{ ...facts, ready: replacement.ready }',
    '{ ready: facts.ready, ...replacement }',
  ]) {
    it(`preserves source-backed object overwrite order in ${argument}`, async () => {
      const { scan, tokens } = await observe({
        setup: `const facts = asA(); const replacement = asB(); paint(def, ${argument});`,
      });
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ state }) => state)).toEqual(['beta', 'gamma']);
      expect(tokens).toContain('data-[beta]:bg-primary');
      expect(tokens).not.toContain('data-[alpha]:bg-primary');
    });
  }

  for (const argument of [
    '{ ...facts, ...opaque }',
    '{ ...facts, ready: opaque }',
    '{ ...opaque, ready: facts.ready }',
  ]) {
    it(`does not certify the partial object spread ${argument}`, async () => {
      const { scan, tokens } = await observe({
        setup: `const facts = asA(); paint(def, ${argument});`,
      });
      expect(scan.unresolved).toEqual([{ reason: 'subject', expression: 'facts.ready' }]);
      expect(scan.usages.map(({ state }) => state)).toEqual(['gamma']);
      expect(tokens).not.toContain('data-[alpha]:bg-primary');
      expect(tokens).toContain('data-[gamma]:underline');
    });
  }

  for (const [name, argument, read] of [
    ['a truthy condition rebind', '(facts = asB()) ? facts.ready : facts.ready', 'facts'],
    [
      'a false condition after rebind',
      '(facts = asB(), false) ? facts.ready : facts.ready',
      'facts',
    ],
    [
      'a nested literal value',
      '{ ready: (facts = asB()) ? facts.ready : facts.ready }',
      'facts.ready',
    ],
    ['a nested spread value', '{ ...((facts = asB()) ? facts : facts) }', 'facts.ready'],
    ['a member receiver', '((facts = asB()) ? facts : facts).ready', 'facts'],
    ['a computed member key', "facts[(facts = asB(), 'ready')]", 'facts'],
    ['a condition call', '(mutate(facts), flag) ? facts.ready : facts.ready', 'facts'],
    ['an object getter condition', 'opaque.flag ? facts.ready : facts.ready', 'facts'],
    ['an earlier object getter', '{ noise: opaque.value, ready: facts.ready }', 'facts.ready'],
    ['an earlier unknown spread', '{ ...opaque, ready: facts.ready }', 'facts.ready'],
  ] as const) {
    it(`keeps ${name} unresolved instead of capturing a stale earlier State`, async () => {
      const { scan, tokens } = await observe({
        helper: paint.replaceAll('facts.ready', read),
        setup: `let facts = asA(); paint(def, ${argument});`,
      });
      expect(scan.unresolved).toEqual([{ reason: 'subject', expression: read }]);
      expect(scan.usages.map(({ state }) => state)).toEqual(['gamma']);
      expect(tokens).toContain('data-[gamma]:underline');
    });
  }

  for (const [name, options] of [
    ['an unknown actual argument', { setup: 'paint(def, opaque);' }],
    ['an escaped helper', { tail: 'consume(paint);' }],
    ['a reassigned helper', { tail: 'paint = replacement;' }],
    ['an exported helper', { helper: 'export ' + paint }],
    ['a named export of the helper', { tail: 'export { paint as exposedPaint };' }],
    [
      'a default function alias escaping to unknown code',
      { tail: 'const alias = paint; consume(alias);' },
    ],
    ['an independent uncalled helper declaration', { setup: '' }],
    ['an unproved spread invocation', { setup: 'paint(...argumentsFromElsewhere);' }],
    ['an incomplete argument list', { setup: 'paint(def);' }],
    ['a shadowed callee', { setup: 'const paint = opaque; paint(def, asA());' }],
    ['a call before the helper declaration', { helper: '', tail: paint }],
    [
      'a recursive helper call',
      { helper: paint.replace('\n}', '\n  if (again) paint(def, facts);\n}') },
    ],
    [
      'a non-Core caller',
      { factory: 'fakeFactory', declarations: 'const fakeFactory = value => value;' },
    ],
    ['dynamic lexical execution', { tail: 'eval("consume(paint)");' }],
  ] as const) {
    it(`retains the independent rule and leaves ${name} unresolved`, async () => {
      const { scan, tokens } = await observe(options);
      expect(scan.unresolved).toEqual([{ reason: 'subject', expression: 'facts.ready' }]);
      expect(scan.usages.map(({ state }) => state)).toEqual(['gamma']);
      expect(tokens).toContain('data-[gamma]:underline');
    });
  }
});
