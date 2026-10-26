import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';

describe('hook source projector scope', () => {
  it('resolves a function-scoped projector variable across its blocks', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-projector-scope-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "function setup(d) { d.state.bool('alpha', false); d.state.bool('beta', false); }",
          // A nested `var` re-declaration keeps the same function-scoped
          // binding, so the inner declaration is the one the projection returns.
          "export const asFacts = defineAsHook({ name: 'facts', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { var ready = r.stateHandles.beta; } return { ready }; } });",
          // A `let` is scoped to its own block, so the outer `var` survives it.
          "export const asShadow = defineAsHook({ name: 'shadow', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { let ready = r.stateHandles.beta; } return { ready }; } });",
          // The same `let` shadows the outer `var` for the code inside its block.
          "export const asInner = defineAsHook({ name: 'inner', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { let ready = r.stateHandles.beta; return { ready }; } } });",
          // The only continuing branch leaves its function-scoped `var` update
          // visible to the return after the guard.
          "export const asGuard = defineAsHook({ name: 'guard', setup, projectHandle(r) { var ready = r.stateHandles.alpha; if (r.useBeta) { var ready = r.stateHandles.beta; } else { throw new Error('no result'); } return { ready }; } });",
          // A bare redeclaration does not clear the existing function binding.
          "export const asBare = defineAsHook({ name: 'bare', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { var ready; } return { ready }; } });",
          // The function is initialized at block entry; the earlier object
          // literal must not capture the shadowed outer state handle.
          "export const asHoisted = defineAsHook({ name: 'hoisted', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { var held = { ready }; function ready() {} } return held; } });",
          // A later lexical declaration also shadows from block entry, so the
          // earlier read cannot be certified from the outer state handle.
          "export const asLexical = defineAsHook({ name: 'lexical', setup, projectHandle(r) { var ready = r.stateHandles.alpha; { var held = { ready }; let ready = r.stateHandles.beta; } return held; } });",
        ].join('\n')
      );
      const consumer = [
        "import { asFacts, asShadow, asInner } from './producer';",
        "import { asGuard } from './producer';",
        "import { asBare, asHoisted, asLexical } from './producer';",
        'const facts = asFacts();',
        'const shadow = asShadow();',
        'const inner = asInner();',
        'const guard = asGuard();',
        'const bare = asBare();',
        'const hoisted = asHoisted();',
        'const lexical = asLexical();',
        "def.rule({ when: w => w.state(facts.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
        "def.rule({ when: w => w.state(shadow.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        "def.rule({ when: w => w.state(inner.ready).eq(true), intent: i => i.feedback.style.use(tw('italic')) });",
        "def.rule({ when: w => w.state(guard.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        "def.rule({ when: w => w.state(bare.ready).eq(true), intent: i => i.feedback.style.use(tw('line-through')) });",
        "def.rule({ when: w => w.state(hoisted.ready).eq(true), intent: i => i.feedback.style.use(tw('font-bold')) });",
        "def.rule({ when: w => w.state(lexical.ready).eq(true), intent: i => i.feedback.style.use(tw('font-light')) });",
      ].join('\n');
      const consumerFile = path.join(dir, 'consumer.proto.ts');
      await writeFile(consumerFile, consumer);

      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asFacts', state: 'beta' },
        { hook: 'asShadow', state: 'alpha' },
        { hook: 'asInner', state: 'beta' },
        { hook: 'asGuard', state: 'beta' },
        { hook: 'asBare', state: 'alpha' },
      ]);
      expect(scan.unresolved).toEqual([
        { expression: 'hoisted.ready', reason: 'subject' },
        { expression: 'lexical.ready', reason: 'subject' },
      ]);

      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[beta]:bg-primary');
      expect(tokens).not.toContain('data-[alpha]:bg-primary');
      expect(tokens).toContain('data-[alpha]:bg-secondary');
      expect(tokens).not.toContain('data-[beta]:bg-secondary');
      expect(tokens).toContain('data-[beta]:italic');
      expect(tokens).not.toContain('data-[alpha]:italic');
      expect(tokens).toContain('data-[beta]:underline');
      expect(tokens).not.toContain('data-[alpha]:underline');
      expect(tokens).toContain('data-[alpha]:line-through');
      expect(tokens).not.toContain('data-[beta]:line-through');
      expect(tokens).not.toContain('data-[alpha]:font-bold');
      expect(tokens).not.toContain('data-[beta]:font-bold');
      expect(tokens).not.toContain('data-[alpha]:font-light');
      expect(tokens).not.toContain('data-[beta]:font-light');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
