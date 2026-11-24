import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

function initializer(source: ts.SourceFile, name: string): ts.Expression {
  const found: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    )
      found.push(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(found).toHaveLength(1);
  return found[0]!;
}

async function inspectProjector(kind: 'closed-data' | 'known-reentrant-getter') {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-reentry-source-'));
  try {
    const prefix =
      kind === 'known-reentrant-getter'
        ? `const external = {
  get marker() {
    const raw = asFacts();
    const replacement = raw.getState('replacement');
    raw.stateHandles = { expanded: replacement };
    raw.getState = () => replacement;
    return 1;
  }
};`
        : '';
    const projection =
      kind === 'known-reentrant-getter'
        ? 'return { ...external, ...result };'
        : 'return { ...{ stateHandles: null, getState: null }, ...result };';
    await writeFile(
      path.join(directory, 'facts.ts'),
      `import { defineAsHook } from '@proto.ui/core';
${prefix}
export const asFacts = defineAsHook({ name: 'reentry-source-facts',
  setup(def) {
    def.state.bool('expanded', false);
    def.state.bool('replacement', false);
  },
  projectHandle(result) { ${projection} }
});`
    );
    const file = path.join(directory, 'consumer.proto.ts');
    const text = `import { definePrototype } from '@proto.ui/core';
import { asFacts } from './facts';
export default definePrototype({ name: 'reentry-source-consumer', setup(def) {
  const captured = asFacts();
  const bagRead = captured.stateHandles.expanded;
  const accessorRead = captured.getState('expanded');
} });`;
    await writeFile(file, text);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    // Use only the ordinary summary API. No selected Root projection context
    // or style-token fallback can supply these source proofs.
    const summary = createHookSourceSummaryContext();
    summary.registerSource(source);
    const call = initializer(source, 'captured');
    if (!ts.isCallExpression(call)) throw new Error('Expected the actual asFacts call.');
    expect(summary.isAuthoredProducerCall(call, source)).toBe(true);
    const capture = summary.resolveCall(call, source);
    expect(capture.matched).toBe(true);
    const environment = new Map([['captured', capture.value]]);
    return {
      capture,
      bag: summary.resolve(initializer(source, 'bagRead'), source, environment),
      accessor: summary.resolve(initializer(source, 'accessorRead'), source, environment),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('ordinary source proof across projector object spreads', () => {
  it('retains native capture fields after an inline closed data spread', async () => {
    const seen = await inspectProjector('closed-data');

    for (const resolution of [seen.bag, seen.accessor]) {
      expect(resolution.value.kind).toBe('state');
      if (resolution.value.kind === 'state') {
        expect(resolution.value.state.declaredName).toBe('expanded');
        expect(resolution.value.state.owner.file).toMatch(/[/\\]facts\.ts$/);
      }
    }
  });

  it('withholds capture proof when an external getter can reenter the same hook', async () => {
    const seen = await inspectProjector('known-reentrant-getter');

    expect(seen.capture.value.kind).toBe('unknown');
    expect(seen.bag.value.kind).toBe('unknown');
    expect(seen.accessor.value.kind).toBe('unknown');
  });
});
