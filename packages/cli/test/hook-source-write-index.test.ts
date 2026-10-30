import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

function parse(text: string) {
  return ts.createSourceFile(path.resolve('write-index-fixture.ts'), text, ts.ScriptTarget.Latest, true);
}
function calls(source: ts.SourceFile, names: string[]) {
  const result: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.includes(node.expression.text)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}
const factory = `import { defineAsHook } from '@proto.ui/core';
const asFacts = defineAsHook({ name: 'facts', setup() {} });`;

describe('operation-owned write syntax index', () => {
  it.each([
    ['assignment', 'asFacts = other;'],
    ['compound assignment', 'asFacts += other;'],
    ['logical assignment', 'asFacts ||= other;'],
    ['array destructuring', '[asFacts] = other;'],
    ['object destructuring', '({ value: asFacts } = other);'],
    ['shorthand destructuring', '({ asFacts } = other);'],
    ['rest destructuring', '[...asFacts] = other;'],
    ['default destructuring', '[asFacts = other] = values;'],
    ['prefix update', '++asFacts;'],
    ['postfix update', 'asFacts--;'],
    ['for of', 'for (asFacts of values) {}'],
    ['for in', 'for (asFacts in values) {}'],
    ['nested captured write', 'function later() { asFacts = other; }'],
    ['uncertain branch', 'if (unknown) asFacts = other;'],
  ])('retains rejection for %s', (_label, write) => {
    const source = parse(`${factory}\n${write}\nasFacts();`);
    const context = createHookSourceSummaryContext();
    expect(context.isAuthoredProducerCall(calls(source, ['asFacts'])[0], source)).toBe(false);
  });

  it.each([
    'function nested(asFacts) { asFacts = other; }',
    '{ let asFacts; asFacts = other; }',
    'for (let asFacts of values) { asFacts++; }',
    'try {} catch (asFacts) { asFacts = other; }',
    'function nested(asFacts) { var asFacts = other; }',
  ])('does not confuse another binding with the producer: %s', (write) => {
    const source = parse(`${factory}\n${write}\nasFacts();`);
    const context = createHookSourceSummaryContext();
    expect(context.isAuthoredProducerCall(calls(source, ['asFacts'])[0], source)).toBe(true);
  });

  it('resolves a stable alias but rejects replacement of that alias', () => {
    for (const changed of [false, true]) {
      const source = parse(`${factory}\nconst held = asFacts; ${changed ? 'held = other;' : ''} held();`);
      const context = createHookSourceSummaryContext();
      expect(context.isAuthoredProducerCall(calls(source, ['held'])[0], source)).toBe(!changed);
    }
  });

  it('traverses irrelevant syntax once across different binding proofs', () => {
    const names = Array.from({ length: 12 }, (_, index) => `asFacts${index}`);
    const source = parse(`import { defineAsHook } from '@proto.ui/core'; void irrelevant;
      ${names.map(name => `const ${name} = defineAsHook({setup(){}});`).join('\n')}
      ${names.map(name => `${name}();`).join('\n')}`);
    const queries = calls(source, names);
    const marker = source.statements[1];
    if (!ts.isExpressionStatement(marker) || !ts.isVoidExpression(marker.expression)) throw Error('missing traversal marker');
    const node = marker.expression;
    const expression = node.expression;
    let visits = 0;
    Object.defineProperty(node, 'expression', { get() { visits++; return expression; } });
    const context = createHookSourceSummaryContext();
    expect(context.isAuthoredProducerCall(queries[0], source)).toBe(true);
    const first = visits;
    expect(first).toBeGreaterThan(0);
    for (const query of queries.slice(1)) expect(context.isAuthoredProducerCall(query, source)).toBe(true);
    expect(visits).toBe(first);
  });

  it('uses replacement SourceFile identity and a fresh operation, not a file path cache', () => {
    const before = parse(`${factory}\nasFacts();`);
    const after = parse(`${factory}\nfunction later() { asFacts = other; }\nasFacts();`);
    const context = createHookSourceSummaryContext();
    expect(context.isAuthoredProducerCall(calls(before, ['asFacts'])[0], before)).toBe(true);
    context.registerSource(after);
    expect(context.isAuthoredProducerCall(calls(after, ['asFacts'])[0], after)).toBe(false);
    const fresh = createHookSourceSummaryContext();
    expect(fresh.isAuthoredProducerCall(calls(after, ['asFacts'])[0], after)).toBe(false);
    expect(fresh.isAuthoredProducerCall(calls(before, ['asFacts'])[0], before)).toBe(true);
  });
});
