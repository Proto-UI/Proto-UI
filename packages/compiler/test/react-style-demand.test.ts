import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { nativeStyleArtifact } from '../src/native-style';

// These assertions bind the support module API, not generated local names or whitespace.
const styleModule = './.proto-ui/style/native-v1';
function compile(setup: string, name = 'ordinary-prototype') {
  const parsed = parsePrototype(`import { definePrototype, tw } from '@proto.ui/core';
    export default definePrototype({ name: ${JSON.stringify(name)}, setup(def) { ${setup} } });`);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  return emitted.value;
}
function styleImports(code: string) {
  const source = ts.createSourceFile('generated.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return source.statements.filter((node) => ts.isImportDeclaration(node)
    && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === styleModule);
}
function expectDemand(setup: string, expected: boolean, name?: string) {
  const output = compile(setup, name);
  expect(styleImports(output.code).length > 0).toBe(expected);
  expect(output.supportingFiles?.some((file) => file.path === '.proto-ui/style/native-v1.ts') ?? false).toBe(expected);
  return output;
}

describe('React source reached style support', () => {
  it.each(['empty', 'Button', 'RenamedComponent'])('does not allocate unused style support for %s', (name) => {
    expectDemand(`return r => r.el('span', 'plain');`, false, name);
  });

  it('does not keep support used only by a dormant authored helper', () => {
    expectDemand(`const unused = () => { def.feedback.style.use(tw('ring-2')); };
      return r => r.el('span', 'plain');`, false);
  });

  it('retains setup style support reached through an authored helper', () => {
    expectDemand(`const apply = () => { def.feedback.style.use(tw('ring-2')); };
      apply(); return r => r.el('span', 'styled');`, true);
  });

  it('retains template-only style handles without a feedback operation', () => {
    expectDemand(`return r => r.el('span', { style: tw('font-bold') }, 'styled');`, true);
  });

  it('retains reactive Rule support and its lifecycle implementation', () => {
    expectDemand(`const active = def.state.bool('active', false);
      def.expose.method('activate', () => { active.set(true); });
      def.rule({ when: w => w.state(active).eq(true), intent: i => i.feedback.style.use(tw('ring-2')) });
      return r => r.el('span', 'reactive');`, true);
  });

  it('retains callback patch support and preserves the existing checked implementation', () => {
    const output = expectDemand(`def.props.define({ command: { type: 'number', default: 0 } });
      def.props.watch(['command'], (run, next) => { if (next.command === 1) run.feedback.style.patch(tw('ring-2')); });
      return r => r.el('span', 'patch');`, true);
    // Existing native-style tests and real generated-consumer lifecycle tests remain required.
    // This checks delivery of the original support unit, not a no-op replacement.
    expect(output.supportingFiles?.find((file) => file.path === '.proto-ui/style/native-v1.ts')?.contents)
      .toBe(nativeStyleArtifact.contents);
  });
});
