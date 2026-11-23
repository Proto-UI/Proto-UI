import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

describe('hook source projection accessors', () => {
  it('uses the authored projection state instead of a built-in state table', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-rejected-name-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        `import { defineAsHook } from '@proto.ui/core';
export const asFormSubmit = defineAsHook({ name: 'custom',
  setup(d) { d.state.bool('alpha', false); },
  projectHandle: r => ({ noop() {}, stateHandles: { disabled: r.stateHandles.alpha } })
});`
      );
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(
        file,
        `import { asFormSubmit } from './producer';
const bag = asFormSubmit().stateHandles;
def.rule({ when: w => w.state(bag.disabled).eq(true),
  intent: i => i.feedback.style.use(tw('bg-primary')) });`
      );
      // The authored projection publishes the author's own state, so the rule
      // lowers against that state. A built-in spelling table for the same
      // hook name would answer `data-[disabled]` instead, so the token also
      // proves that no table substituted the authored handle.
      expect(await collectProtoStyleTokensFromFiles([file])).toEqual([
        'bg-primary',
        'data-[alpha]:bg-primary',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the members a partly observed projection proved', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-partial-projection-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        `import { defineAsHook } from '@proto.ui/core';
export const asParent = defineAsHook({ name: 'parent',
  setup(d) { d.state.bool('alpha', false); },
  projectHandle(r) { return { ...r, stateHandles: { alpha: r.stateHandles.alpha } }; }
});`
      );
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(
        file,
        `import { asParent } from './producer';
const bag = asParent().stateHandles;
def.rule({ when: w => w.state(bag.alpha).eq(true),
  intent: i => i.feedback.style.use(tw('bg-primary')) });`
      );
      // A projection that republishes another hook's handles next to a spread
      // of its own result cannot enumerate every key it publishes, but the
      // member it assigns is proven and stays readable.
      expect(await collectProtoStyleTokensFromFiles([file])).toEqual([
        'bg-primary',
        'data-[alpha]:bg-primary',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['getter', '{ get ready() { return r.stateHandles.ready; } }'],
    ['setter', '{ set ready(value) { void value; } }'],
    ['method', '{ ready() { return r.stateHandles.ready; } }'],
    ['mixed', '{ ready: r.stateHandles.ready, get other() { return r.stateHandles.ready; } }'],
    ['local', 'local'],
    ['spread', '{ ...{ get ready() { return r.stateHandles.ready; } } }'],
  ])('withholds the public member-set proof for a %s projection', async (label, projection) => {
    const dir = await mkdtemp(path.join(tmpdir(), `hook-source-projection-${label}-`));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const asFacts = defineAsHook({ name: 'facts', setup(d) { d.state.bool('ready', false); },",
          `projectHandle(r) { ${label === 'local' ? 'const local = { get ready() { return r.stateHandles.ready; } };' : ''} return ${projection}; } });`,
          "export const asPlain = defineAsHook({ name: 'plain', setup(d) { d.state.bool('ready', false); }, projectHandle(r) { return { ready: r.stateHandles.ready, later: () => unknownEffect() }; } });",
        ].join('\n')
      );
      const file = path.join(dir, 'consumer.proto.ts');
      const text = [
        "import { asFacts, asPlain } from './producer';",
        'const facts = asFacts();',
        'const plain = asPlain();',
        "def.rule({ when: w => w.state(facts.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
        "def.rule({ when: w => w.state(plain.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
      ].join('\n');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const summary = createHookSourceSummaryContext();
      summary.registerSource(source);
      const calls: ts.CallExpression[] = [];
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'asFacts'
        )
          calls.push(node);
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(calls).toHaveLength(1);
      const resolved = summary.resolveCall(calls[0]!, source);
      expect(resolved.matched).toBe(true);
      const retained = resolved.value;
      if (retained.kind !== 'object')
        throw new Error(`expected a retained projection, received ${retained.kind}`);
      // The projection is kept instead of discarded, and the member set it
      // publishes was not fully observed, so it is not claimed complete.
      expect(retained.uncertainKeys).toBe(true);
      // A member the projection did not prove is never presented as proven.
      for (const member of retained.members.values()) expect(member.kind).toBe('unknown');

      const scan = scanRuleStateReads(text, file, createHookSourceSummaryContext());
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asPlain', state: 'ready' },
      ]);
      expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
