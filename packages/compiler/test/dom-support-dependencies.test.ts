import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';

const profiles = [
  ['React', emitReactSource, 'react'],
  ['Vue3', emitVueSource, 'vue'],
  ['Vue2', emitVue2Source, 'vue'],
] as const;
function importsPackage(code: string, name: string): boolean {
  return ts.createSourceFile('artifact.ts', code, ts.ScriptTarget.Latest, true).statements.some((node) =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === name);
}

describe.each(profiles)('%s source dependency closure', (_name, emit, framework) => {
  function compile(interaction: boolean) {
    const parsed = parsePrototype(`import { definePrototype } from '@proto.ui/core';
      import { asFocusable } from '@proto.ui/hooks';
      export default definePrototype({ name: 'ordinary-owner', setup(def) {
        ${interaction ? 'const focus = asFocusable(); focus.configure({ disabled: false });' : ''}
        return r => r.el('span', 'native');
      } });`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const output = emit(parsed.value);
    if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
    return output.value;
  }

  it('does not advertise Floating UI when no delivered support unit imports it', () => {
    const output = compile(false);
    expect([output.code, ...(output.supportingFiles ?? []).map((file) => file.contents)]
      .some((code) => importsPackage(code, '@floating-ui/dom'))).toBe(false);
    expect(output.dependencies.some((dependency) => dependency.name === '@floating-ui/dom')).toBe(false);
    expect(output.dependencies.some((dependency) => dependency.name === framework)).toBe(true);
  });

  it('retains the exact pinned dependency when the delivered interaction module imports it', () => {
    const output = compile(true);
    expect((output.supportingFiles ?? []).some((file) => importsPackage(file.contents, '@floating-ui/dom'))).toBe(true);
    expect(output.dependencies).toContainEqual({ name: '@floating-ui/dom', version: '1.8.0', role: 'target' });
    expect(output.dependencies.some((dependency) => dependency.name === framework)).toBe(true);
  });
});
