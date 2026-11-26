import { mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  createHookSourceSummaryContext,
  type HookSourceSummaryContext,
} from '../src/services/hook-source-summary';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';

function fixture(imports: string, count = 2) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-function-import-query-')));
  const helperFile = path.join(directory, 'helpers.ts');
  const sourceFile = path.join(directory, 'source.ts');
  const helperText = Array.from(
    { length: count },
    (_, index) => 'export function helper' + index + '() {}'
  ).join('\n');
  writeFileSync(helperFile, helperText);
  writeFileSync(sourceFile, imports);
  writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
  const helperSource = ts.createSourceFile(helperFile, helperText, ts.ScriptTarget.Latest, true);
  const source = ts.createSourceFile(sourceFile, imports, ts.ScriptTarget.Latest, true);
  const helpers = helperSource.statements.filter(ts.isFunctionDeclaration);
  const context = createHookSourceSummaryContext();
  context.registerSource(helperSource);
  context.registerSource(source);
  return { directory, helperFile, sourceFile, source, helpers, context };
}

function scalar(
  context: HookSourceSummaryContext,
  source: ts.SourceFile,
  helpers: readonly ts.FunctionLikeDeclaration[]
) {
  return new Map(
    helpers.map((helper) => {
      const nodes: ts.Node[] = [];
      if (context.hasDynamicImportOfFunction(source, helper)) nodes.push(source);
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) &&
          !statement.importClause?.isTypeOnly &&
          ts.isStringLiteralLike(statement.moduleSpecifier) &&
          statement.importClause?.namedBindings &&
          ts.isNamespaceImport(statement.importClause.namedBindings) &&
          context.isSourceFunctionExportedBy(source, statement.moduleSpecifier.text, helper)
        )
          nodes.push(statement);
      }
      return [helper, nodes] as const;
    })
  );
}

describe('bounded function import observations', () => {
  it('retains dynamic/namespace ordering, duplicate namespace sites and type-only exclusions', () => {
    const f = fixture(
      [
        "import * as first from './barrel';",
        "import type * as types from './helpers';",
        "import * as both from './helpers';",
        "import * as duplicate from './barrel';",
        "import { helper0 } from './helpers';",
        "void import('./barrel');",
        "void import('./helpers');",
        "type Types = typeof import('./helpers');",
      ].join('\n')
    );
    try {
      writeFileSync(path.join(f.directory, 'barrel.ts'), "export { helper0 } from './helpers';");
      const expected = scalar(f.context, f.source, f.helpers);
      const actual = f.context.resolveFunctionImportReferences!(f.source, f.helpers);
      expect(actual).toEqual(expected);
      expect(actual?.get(f.helpers[0])).toEqual([
        f.source,
        f.source.statements[0],
        f.source.statements[2],
        f.source.statements[3],
      ]);
      expect(actual?.get(f.helpers[1])).toEqual([f.source, f.source.statements[2]]);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it('shares physical identity only within one query for a large helper population', () => {
    const f = fixture("import * as both from './helpers'; void import('./helpers');", 24);
    const physical = vi.spyOn(realpathSync, 'native');
    try {
      const first = f.context.resolveFunctionImportReferences!(f.source, f.helpers);
      expect(first?.size).toBe(24);
      expect([...first!.values()].every((nodes) => nodes.length === 2)).toBe(true);
      expect(physical.mock.calls.filter(([file]) => String(file) === f.sourceFile)).toHaveLength(1);
      expect(physical.mock.calls.filter(([file]) => String(file) === f.helperFile)).toHaveLength(1);
      expect(f.context.resolveFunctionImportReferences!(f.source, f.helpers)).toEqual(first);
      expect(physical.mock.calls.filter(([file]) => String(file) === f.sourceFile)).toHaveLength(2);
      expect(physical.mock.calls.filter(([file]) => String(file) === f.helperFile)).toHaveLength(2);
    } finally {
      physical.mockRestore();
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it('does not resolve imports when no tracked helpers need observation', () => {
    const f = fixture("void import('./helpers');");
    const physical = vi.spyOn(realpathSync, 'native');
    try {
      expect(f.context.resolveFunctionImportReferences!(f.source, [])).toEqual(new Map());
      expect(physical).not.toHaveBeenCalled();
    } finally {
      physical.mockRestore();
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it('retries a missing import in a later query', () => {
    const f = fixture("void import('./late'); import * as later from './late';");
    try {
      expect([
        ...f.context.resolveFunctionImportReferences!(f.source, f.helpers)!.values(),
      ]).toEqual([[], []]);
      writeFileSync(path.join(f.directory, 'late.ts'), "export { helper0 } from './helpers';");
      const next = f.context.resolveFunctionImportReferences!(f.source, f.helpers)!;
      expect(next.get(f.helpers[0])).toEqual([f.source, f.source.statements[1]]);
      expect(next.get(f.helpers[1])).toEqual([]);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it('observes a changed symlink target for the same source AST in a later query', () => {
    const f = fixture("void import('./link'); import * as linked from './link';");
    try {
      const one = path.join(f.directory, 'one.ts');
      const two = path.join(f.directory, 'two.ts');
      const link = path.join(f.directory, 'link.ts');
      writeFileSync(one, "export { helper0 } from './helpers';");
      writeFileSync(two, "export { helper1 } from './helpers';");
      symlinkSync(one, link);
      const before = f.context.resolveFunctionImportReferences!(f.source, f.helpers)!;
      expect(before.get(f.helpers[0])).toEqual([f.source, f.source.statements[1]]);
      expect(before.get(f.helpers[1])).toEqual([]);
      unlinkSync(link);
      symlinkSync(two, link);
      const after = f.context.resolveFunctionImportReferences!(f.source, f.helpers)!;
      expect(after.get(f.helpers[0])).toEqual([]);
      expect(after.get(f.helpers[1])).toEqual([f.source, f.source.statements[1]]);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it('keeps replacement source syntax separate from an earlier immutable source AST', () => {
    const f = fixture("void import('./helpers');");
    try {
      expect(
        f.context.resolveFunctionImportReferences!(f.source, f.helpers)?.get(f.helpers[0])
      ).toEqual([f.source]);
      const next = ts.createSourceFile(
        f.sourceFile,
        "type Types = typeof import('./helpers');",
        ts.ScriptTarget.Latest,
        true
      );
      f.context.registerSource(next);
      expect([...f.context.resolveFunctionImportReferences!(next, f.helpers)!.values()]).toEqual([
        [],
        [],
      ]);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  });

  it.each(['hasDynamicImportOfFunction', 'isSourceFunctionExportedBy'] as const)(
    'returns to scalar observation when a supplied context overrides %s',
    (method) => {
      const f = fixture("void import('./helpers');");
      try {
        f.context[method] = () => false;
        expect(f.context.resolveFunctionImportReferences!(f.source, f.helpers)).toBeNull();
      } finally {
        rmSync(f.directory, { recursive: true, force: true });
      }
    }
  );

  it.each(['missing', 'overridden'] as const)(
    'preserves inventory through the %s scalar fallback',
    (mode) => {
      const f = fixture("import * as helpers from './helpers'; void import('./helpers');");
      try {
        writeFileSync(
          f.helperFile,
          [
            "import { definePrototype, tw } from '@proto.ui/core';",
            'export function rules(def) {',
            "const active = def.state.bool('active', false);",
            'def.expose.state({ active });',
            "def.rule({ when: (w) => w.state(active).eq(true), intent: tw('bg-primary') });",
            '}',
            "export const sample = definePrototype({ name: 'sample', setup(def) { rules(def); } });",
          ].join('\n')
        );
        const files = [f.helperFile, f.sourceFile];
        const expected = scanRuleStateReadInventory(files);
        expect(
          expected.observations.some((row) =>
            row.unresolved.some((item) => item.expression.startsWith('unverified helper value:'))
          )
        ).toBe(true);
        const supplied = createHookSourceSummaryContext();
        const original = supplied.hasDynamicImportOfFunction;
        const spy = vi.fn(original);
        if (mode === 'missing') delete supplied.resolveFunctionImportReferences;
        else supplied.hasDynamicImportOfFunction = spy;
        expect(scanRuleStateReadInventory(files, supplied)).toEqual(expected);
        if (mode === 'overridden') expect(spy).toHaveBeenCalled();
      } finally {
        rmSync(f.directory, { recursive: true, force: true });
      }
    }
  );
});
