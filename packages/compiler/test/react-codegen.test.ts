// @vitest-environment happy-dom
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createCompiler } from '../src';

function load(code: string): React.ComponentType<any> {
  const source = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (dependency: string) => {
      if (dependency === 'react') return React;
      throw new Error('Generated output must be a native React component: ' + dependency);
    },
    module,
    module.exports
  );
  return (module.exports as { default: React.ComponentType<any> }).default;
}

describe('Source to native React component integration', () => {
  const compiler = createCompiler({ rootDir: process.cwd() });
  it('renders props-only source and preserves missing/default resolution on update', () => {
    const result = compiler.compilePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype<{label:string}>({name:'label',setup(def){
        def.props.define({label:{type:'string',default:'fallback'}});
        return r => r.el('div', r.read.props.get().label);
      }});`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(result.value.llvm.emitted).toBe(false);
    expect(result.value.primary!.react.dependencies).toEqual(['react']);
    const Component = load(result.value.primary!.react.code);
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      flushSync(() => root.render(React.createElement(Component, { label: 'first' })));
      expect(host.textContent).toBe('first');
      flushSync(() => root.render(React.createElement(Component, {})));
      expect(host.textContent).toBe('fallback');
    } finally {
      flushSync(() => root.unmount());
    }
  });

  it('executes native key callbacks with control flow and synchronous state reads', () => {
    const result = compiler.compilePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'counter',setup(def){
        const count=def.state.numberDiscrete('count',7);
        def.event.on('key.down',()=>{const old=count.get(); if(old>=9){count.set(0);return;} count.set(old+1);});
        return r => r.el('div',count.get());
      }});`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const Component = load(result.value.primary!.react.code);
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      flushSync(() => root.render(React.createElement(Component)));
      expect(host.textContent).toBe('7');
      for (const expected of ['8', '9', '0']) {
        flushSync(() =>
          host.firstElementChild!.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, key: 'a' })
          )
        );
        expect(host.textContent).toBe(expected);
      }
    } finally {
      flushSync(() => root.unmount());
    }
  });

  it('reports missing Base atomic lowerings and never returns an adapter wrapper', () => {
    const result = compiler.compileFile('packages/prototypes/base/src/button/button.proto.ts');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.category === 'codegen')).toBe(true);
  });

  it('rejects unsupported press semantics instead of silently treating press.commit as click', () => {
    const result = compiler.compilePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'press',setup(def){const flag=def.state.bool('flag',false);def.event.on('press.commit',()=>{flag.set(true);});return r=>r.el('button','x');}});`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.message.includes('press.commit'))
    ).toBe(true);
  });
});
