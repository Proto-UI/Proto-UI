// @vitest-environment happy-dom
import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { createCompiler } from '../src';

const compiler = createCompiler({ rootDir: process.cwd() });
const roots = new Set<Root>();
afterEach(() => {
  for (const root of roots) flushSync(() => root.unmount());
  roots.clear();
});

function load(code: string): React.ComponentType<Record<string, unknown>> {
  const tree = ts.createSourceFile(
    'generated.tsx',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports = tree.statements
    .filter(ts.isImportDeclaration)
    .map((node) => (node.moduleSpecifier as ts.StringLiteral).text);
  expect(imports).toEqual(['react']);
  const result = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', result.outputText)(
    (name: string) => {
      if (name === 'react') return React;
      throw new Error('A native artifact cannot load authoring or adapter code: ' + name);
    },
    module,
    module.exports
  );
  return module.exports.default as React.ComponentType<Record<string, unknown>>;
}

function mount(code: string, initial: Record<string, unknown>) {
  const Component = load(code);
  const host = document.createElement('main');
  const root = createRoot(host);
  roots.add(root);
  const render = (props: Record<string, unknown>) =>
    flushSync(() => root.render(React.createElement(Component, props)));
  render(initial);
  return { host, render };
}

describe('Real Base source → native React artifacts', () => {
  for (const family of ['text', 'surface']) {
    it(
      'compiles the real Base ' + family + ' source and preserves its passive default slot',
      () => {
        const result = compiler.compileFile(
          'packages/prototypes/base/src/' + family + '/root.proto.ts',
          { target: 'react', exportName: 'default' }
        );
        expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
        if (!result.ok) return;
        expect(result.value.primary?.react.dependencies).toEqual(['react']);
        expect(result.value.ir.prototypes[0].unlowered ?? []).toEqual([]);
        const view = mount(result.value.primary!.react.code, {
          className: 'caller',
          children: React.createElement('strong', null, 'Before'),
        });
        const owner = view.host.firstElementChild!;
        expect(owner.tagName).toBe('DIV');
        expect(owner.className).toBe('caller');
        expect(owner.innerHTML).toBe('<strong>Before</strong>');
        expect(owner.hasAttribute('role')).toBe(false);
        expect(owner.hasAttribute('tabindex')).toBe(false);
        expect(owner.hasAttribute('aria-disabled')).toBe(false);
        view.render({
          className: 'after',
          children: React.createElement('em', null, 'After'),
          pressed: true,
        });
        expect(view.host.firstElementChild).toBe(owner);
        expect(owner.className).toBe('after');
        expect(owner.innerHTML).toBe('<em>After</em>');
        expect(owner.hasAttribute('pressed')).toBe(false);
        view.render({});
        expect(view.host.firstElementChild).toBe(owner);
        expect(owner.innerHTML).toBe('');
      }
    );
  }

  it('keeps an owner for a contentless render and rejects multiple slots', () => {
    const empty = compiler.compilePrototype(`import {definePrototype,tw} from '@proto.ui/core';
      export default definePrototype({name:'empty',setup(def){def.feedback.style.use(tw('border'));return () => null;}});`);
    expect(empty.ok, JSON.stringify(empty.diagnostics)).toBe(true);
    if (empty.ok) {
      const view = mount(empty.value.primary!.react.code, {
        children: 'must not leak',
        className: 'caller',
      });
      expect(view.host.innerHTML).toBe('<div class="caller border"></div>');
    }
    const duplicate = compiler.compilePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'duplicate',setup(){return r => [r.r.slot(),r.el('div',r.r.slot())];}});`);
    expect(duplicate.ok).toBe(false);
    expect(
      duplicate.diagnostics.some((issue) => issue.message.includes('slot')),
      JSON.stringify(duplicate.diagnostics)
    ).toBe(true);
  });
});
