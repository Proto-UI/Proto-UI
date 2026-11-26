import { mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

function fixture() {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-returned-state-query-')));
  const safe = path.join(directory, 'safe.ts');
  const unsafe = path.join(directory, 'unsafe.ts');
  const link = path.join(directory, 'helper.ts');
  writeFileSync(safe, 'export function prepare(def) { def.props.setDefaults({ active: false }); }');
  writeFileSync(unsafe, 'export function prepare(def) { def.state.bool = () => ({}); }');
  writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
  symlinkSync(safe, link);

  const fileName = path.join(directory, 'entry.proto.ts');
  const text = `
    import { definePrototype } from '@proto.ui/core';
    import { prepare } from './helper';
    function createPrivateState(def) {
      const active = def.state.bool('active', false);
      return active;
    }
    export default definePrototype({ name: 'returned-state-query', setup(def) {
      prepare(def);
      const active = createPrivateState(def);
      def.rule({ when: w => w.state(active).eq(true) });
    } });
  `;
  writeFileSync(fileName, text);
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  let native: ts.ParameterDeclaration | undefined;
  let call: ts.CallExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'setup')
      native = node.parameters[0];
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'createPrivateState'
    )
      call = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!native || !call) throw new Error('Expected the native setup and returned State call');
  const context = createHookSourceSummaryContext();
  context.registerSource(source);
  return { directory, safe, unsafe, link, source, native, call, context };
}

describe('returned State proof query lifetime', () => {
  it('rechecks imported Def uses after a safe helper symlink becomes unsafe for the same AST', () => {
    const { directory, unsafe, link, source, native, call, context } = fixture();
    try {
      expect(context.isNativeSetupDefinition(native)).toBe(true);
      expect(context.resolveReturnedLocalState(call, source, new Set([native]))).toMatchObject({
        declaredName: 'active',
      });

      unlinkSync(link);
      symlinkSync(unsafe, link);
      // These APIs observe imports afresh. An unchanged entry SourceFile does
      // not keep the old helper's native-Def closure or returned-State proof.
      expect(context.isNativeSetupDefinition(native)).toBe(false);
      expect(context.resolveReturnedLocalState(call, source, new Set([native]))).toBeNull();

      const fresh = createHookSourceSummaryContext();
      fresh.registerSource(source);
      expect(fresh.isNativeSetupDefinition(native)).toBe(false);
      expect(fresh.resolveReturnedLocalState(call, source, new Set([native]))).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not retain a negative Def proof after a later helper identity becomes safe', () => {
    const { directory, safe, unsafe, link, source, native, call, context } = fixture();
    try {
      unlinkSync(link);
      symlinkSync(unsafe, link);
      expect(context.isNativeSetupDefinition(native)).toBe(false);
      expect(context.resolveReturnedLocalState(call, source, new Set([native]))).toBeNull();

      unlinkSync(link);
      symlinkSync(safe, link);
      expect(context.isNativeSetupDefinition(native)).toBe(true);
      expect(context.resolveReturnedLocalState(call, source, new Set([native]))).toMatchObject({
        declaredName: 'active',
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
