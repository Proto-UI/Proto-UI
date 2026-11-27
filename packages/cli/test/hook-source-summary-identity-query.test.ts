import { mkdtempSync, realpathSync, rmSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

function query(source: ts.SourceFile): ts.CallExpression {
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'asFacts'
    )
      calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(calls).toHaveLength(1);
  return calls[0];
}
const text = `import { defineAsHook } from '@proto.ui/core';
const asFacts = defineAsHook({name:'query-facts', setup(def){def.state.bool('active', false);}});
asFacts();`;

function fixture() {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-summary-query-')));
  const fileName = path.join(directory, 'source.ts');
  writeFileSync(fileName, text);
  writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const call = query(source);
  const context = createHookSourceSummaryContext();
  context.registerSource(source);
  return { directory, fileName, source, call, context };
}

describe('one synchronous summary identity observation', () => {
  it.each(['resolve', 'resolveCall'] as const)(
    'shares physical source identity inside one %s without caching later calls',
    (method) => {
      const { directory, fileName, source, call, context } = fixture();
      const spy = vi.spyOn(realpathSync, 'native');
      try {
        const first = context[method](call, source);
        expect(first.matched).toBe(true);
        expect(spy.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(1);
        const second = context[method](call, source);
        expect(second).toEqual(first);
        expect(spy.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
      } finally {
        spy.mockRestore();
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );

  it.each(['resolve', 'resolveCall'] as const)(
    'observes a later symlink target through %s for the same immutable AST',
    (method) => {
      const { directory, source: ignored, call: ignoredCall, context: ignoredContext } = fixture();
      const first = path.join(directory, 'first.ts');
      const second = path.join(directory, 'second.ts');
      const link = path.join(directory, 'source-link.ts');
      writeFileSync(first, text);
      writeFileSync(second, text);
      symlinkSync(first, link);
      const source = ts.createSourceFile(link, text, ts.ScriptTarget.Latest, true);
      const call = query(source);
      const context = createHookSourceSummaryContext();
      try {
        const before = context[method](call, source);
        expect(before.matched).toBe(true);
        expect(JSON.stringify(before)).toContain(first);
        unlinkSync(link);
        symlinkSync(second, link);
        const after = context[method](call, source);
        expect(after.matched).toBe(true);
        expect(JSON.stringify(after)).toContain(second);
        expect(JSON.stringify(after)).not.toContain(first);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );
});
