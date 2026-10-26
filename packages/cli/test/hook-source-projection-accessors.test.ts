import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

describe('hook source projection accessors', () => {
  it('does not substitute built-in states for a rejected authored projection', async () => {
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
      expect(await collectProtoStyleTokensFromFiles([file])).toEqual(['bg-primary']);
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
      expect(summary.resolveCall(calls[0]!, source)).toEqual({
        matched: true,
        value: { kind: 'unknown', reason: 'unproved public projection' },
      });

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
