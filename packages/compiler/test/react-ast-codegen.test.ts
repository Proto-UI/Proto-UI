// @vitest-environment happy-dom
import path from 'node:path';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionStatementIR, PrototypeIR, StateDeclIR } from '../src/ir';
import { emitReactComponent, getReactLoweringDiagnostics } from '../src/targets/react';

function prototype(change: Partial<PrototypeIR> = {}): PrototypeIR {
  return {
    name: 'ast-example',
    exportName: 'default',
    isDefaultExport: true,
    sourceFile: '/input/example.proto.ts',
    tier: 'static',
    props: [],
    states: [],
    exposes: [],
    events: [],
    hooks: [],
    contexts: [],
    staticStyleTokens: [],
    rules: [],
    lifecycle: [],
    capabilities: ['render'],
    capabilityMask: 1n << 8n,
    functions: [],
    stringTable: [],
    render: {
      kind: 'static-tree',
      root: { tag: 'button', children: [{ kind: 'text', value: 'Hello' }] },
    },
    ...change,
  };
}

const count: StateDeclIR = {
  index: 0,
  name: 'count',
  variableName: 'count',
  kind: 'number.discrete',
  initialValue: 0,
  ssaType: 'f64',
};

function checkGeneratedTypes(code: string): void {
  const fileName = path.resolve(process.cwd(), 'packages/compiler/__react_ast_generated__.tsx');
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, createNew) =>
    path.resolve(name) === fileName
      ? ts.createSourceFile(name, code, languageVersion, true, ts.ScriptKind.TSX)
      : originalGetSourceFile(name, languageVersion, onError, createNew);
  const program = ts.createProgram([fileName], options, host);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((value) => value.category === ts.DiagnosticCategory.Error);
  expect(
    diagnostics.map((value) => ts.flattenDiagnosticMessageText(value.messageText, '\n'))
  ).toEqual([]);
}

function compiled(definition: PrototypeIR): React.ComponentType<Record<string, unknown>> {
  const output = emitReactComponent(definition);
  expect(output.dependencies).toEqual(['react']);
  checkGeneratedTypes(output.code);
  const source = ts.createSourceFile(
    'output.tsx',
    output.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports = source.statements
    .filter(ts.isImportDeclaration)
    .map((value) => (value.moduleSpecifier as ts.StringLiteral).text);
  expect(imports).toEqual(['react']);

  const javascript = ts.transpileModule(output.code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  expect(javascript.diagnostics).toEqual([]);
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  const require = (name: string) => {
    if (name === 'react') return React;
    throw new Error('Generated component attempted to import ' + name);
  };
  new Function('require', 'module', 'exports', javascript.outputText)(require, module, exported);
  return module.exports.default as React.ComponentType<Record<string, unknown>>;
}

const roots = new Map<Root, HTMLElement>();
afterEach(() => {
  for (const [root, host] of roots) {
    flushSync(() => root.unmount());
    host.remove();
  }
  roots.clear();
  vi.restoreAllMocks();
});

function mount(
  Component: React.ComponentType<Record<string, unknown>>,
  props: Record<string, unknown> = {},
  strict = false
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.set(root, host);
  const render = (next: Record<string, unknown>) =>
    flushSync(() => {
      const element = React.createElement(Component, next);
      root.render(strict ? React.createElement(React.StrictMode, null, element) : element);
    });
  render(props);
  return { host, root, render };
}

describe('React AST target: executable native artifacts', () => {
  it('preserves a props-only render tree, updates, and committed fallback history', () => {
    const Component = compiled(
      prototype({
        // This was previously classified static and silently emitted an empty div.
        tier: 'static',
        props: [
          {
            index: 0,
            name: 'label',
            kind: 'string',
            tsType: 'string',
            defaultValue: 'Default',
            ssaType: 'i32',
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: { tag: 'button', children: [{ kind: 'prop-read', propName: 'label' }] },
        },
      })
    );
    const view = mount(Component, { label: 'First' });
    expect(view.host.firstElementChild?.tagName).toBe('BUTTON');
    expect(view.host.textContent).toBe('First');
    view.render({ label: null });
    expect(view.host.textContent).toBe('First');
    view.render({});
    expect(view.host.textContent).toBe('Default');
    view.render({ label: undefined });
    expect(view.host.textContent).toBe('First');
    view.render({ label: 'Second' });
    view.render({ label: 42 });
    expect(view.host.textContent).toBe('Second');
  });

  it('distinguishes missing, accepted empty, and error with or without a valid fallback', () => {
    const base = {
      props: [
        {
          index: 0,
          name: 'label',
          kind: 'string' as const,
          tsType: 'string',
          defaultValue: 'Default',
          empty: 'accept' as const,
          ssaType: 'i32' as const,
        },
      ],
      render: {
        kind: 'reactive-tree' as const,
        root: { tag: 'span', children: [{ kind: 'prop-read' as const, propName: 'label' }] },
      },
    };
    const Component = compiled(prototype(base));
    const view = mount(Component, { label: 'Text' });
    view.render({ label: null });
    expect(view.host.textContent).toBe('');
    view.render({ label: undefined });
    expect(view.host.textContent).toBe('');
    view.render({});
    expect(view.host.textContent).toBe('Default');

    const ErrorWithFallback = compiled(
      prototype({ ...base, props: [{ ...base.props[0], empty: 'error' }] })
    );
    expect(renderToStaticMarkup(React.createElement(ErrorWithFallback, { label: null }))).toBe(
      '<span>Default</span>'
    );
    const ErrorWithoutFallback = compiled(
      prototype({ ...base, props: [{ ...base.props[0], defaultValue: undefined, empty: 'error' }] })
    );
    expect(() => renderToStaticMarkup(React.createElement(ErrorWithoutFallback, {}))).toThrow(
      'Missing prop has no non-empty fallback'
    );
  });

  it('executes callback control flow with synchronous state reads and cleans up native listeners', () => {
    const body: ActionStatementIR[] = [
      {
        kind: 'state-set',
        stateName: 'count',
        value: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'state', name: 'count' },
          right: { kind: 'literal', value: 1 },
        },
      },
      { kind: 'local', name: 'snapshot', value: { kind: 'state', name: 'count' } },
      {
        kind: 'if',
        condition: {
          kind: 'binary',
          operator: '===',
          left: { kind: 'local', name: 'snapshot' },
          right: { kind: 'literal', value: 1 },
        },
        then: [
          {
            kind: 'state-set',
            stateName: 'count',
            value: {
              kind: 'binary',
              operator: '+',
              left: { kind: 'local', name: 'snapshot' },
              right: { kind: 'literal', value: 2 },
            },
          },
        ],
        otherwise: [
          { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: -5 } },
        ],
      },
      { kind: 'return' },
      { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 999 } },
    ];
    const Component = compiled(
      prototype({
        states: [count],
        events: [
          { scope: 'root', eventName: 'key.down', body },
          {
            scope: 'root',
            eventName: 'key.down',
            simpleAction: { kind: 'increment-state', stateName: 'count', delta: 10 },
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: { tag: 'button', children: [{ kind: 'state-read', stateName: 'count' }] },
        },
      })
    );
    const view = mount(Component);
    const button = view.host.querySelector('button')!;
    flushSync(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(button.textContent).toBe('13');
    flushSync(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(button.textContent).toBe('5');
    flushSync(() => button.click());
    expect(button.textContent).toBe('5');
    const remove = vi.spyOn(button, 'removeEventListener');
    flushSync(() => view.root.unmount());
    roots.delete(view.root);
    expect(remove.mock.calls.filter(([name]) => name === 'keydown')).toHaveLength(2);
    view.host.remove();
  });

  it('lowers static feedback and conditional rules into the rendered native class list', () => {
    const Component = compiled(
      prototype({
        tier: 'reactive',
        props: [
          {
            index: 0,
            name: 'enabled',
            kind: 'boolean',
            tsType: 'boolean',
            defaultValue: true,
            ssaType: 'i1',
          },
        ],
        states: [count],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            simpleAction: { kind: 'increment-state', stateName: 'count', delta: 1 },
          },
        ],
        staticStyleTokens: ['base-token'],
        rules: [
          {
            id: 0,
            condition: {
              kind: 'all',
              exprs: [
                { kind: 'cmp', operator: 'eq', source: 'prop', key: 'enabled', value: true },
                { kind: 'cmp', operator: 'gte', source: 'state', key: 'count', value: 1 },
              ],
            },
            styleTokens: ['active-token'],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: {
            tag: 'button',
            styleTokens: ['element-token'],
            children: [{ kind: 'state-read', stateName: 'count' }],
          },
        },
      })
    );
    const view = mount(Component, { className: 'caller-token' });
    const button = view.host.querySelector('button')!;
    expect(button.className.split(' ')).toEqual(['caller-token', 'base-token', 'element-token']);
    flushSync(() => button.click());
    expect(button.classList.contains('active-token')).toBe(true);
    view.render({ enabled: false });
    expect(button.classList.contains('active-token')).toBe(false);
    expect(button.classList.contains('base-token')).toBe(true);
  });

  it('retains literal text safely and preserves signed numeric state constants', () => {
    const text = '"; globalThis.unwanted = true; // \u2028 <script>&';
    const Component = compiled(
      prototype({
        render: {
          kind: 'static-tree',
          root: { tag: 'pre', children: [{ kind: 'text', value: text }] },
        },
      })
    );
    const view = mount(Component);
    expect(view.host.textContent).toBe(text);
    expect(Reflect.get(globalThis, 'unwanted')).toBeUndefined();

    const output = emitReactComponent(prototype({ states: [{ ...count, initialValue: -0 }] }));
    const sf = ts.createSourceFile(
      'signed-zero.tsx',
      output.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    let preserved = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'useState'
      ) {
        const value = node.arguments[0];
        preserved =
          ts.isPrefixUnaryExpression(value) &&
          value.operator === ts.SyntaxKind.MinusToken &&
          ts.isNumericLiteral(value.operand) &&
          value.operand.text === '0';
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(preserved).toBe(true);
    expect(
      getReactLoweringDiagnostics(prototype({ states: [{ ...count, initialValue: NaN }] }))
    ).not.toEqual([]);
    expect(
      getReactLoweringDiagnostics(prototype({ states: [{ ...count, initialValue: Infinity }] }))
    ).toEqual([]);
    const builtinName = prototype({ name: 'number', states: [count] });
    expect(emitReactComponent(builtinName).componentName).toBe('CompiledNumber');
    compiled(builtinName);
    expect(() => emitReactComponent(builtinName, { componentName: 'Number' })).toThrow(
      'shadows an imported or native binding'
    );
  });

  it('runs created before render and maps repeatable mount cleanup without recreating state', () => {
    const Component = compiled(
      prototype({
        states: [count],
        lifecycle: ['onCreated', 'onMounted', 'onUnmounted'],
        lifecycleHandlers: [
          {
            phase: 'created',
            body: [
              { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 10 } },
            ],
          },
          {
            phase: 'mounted',
            body: [
              {
                kind: 'state-set',
                stateName: 'count',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: { kind: 'state', name: 'count' },
                  right: { kind: 'literal', value: 1 },
                },
              },
            ],
          },
          {
            phase: 'unmounted',
            body: [
              {
                kind: 'state-set',
                stateName: 'count',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: { kind: 'state', name: 'count' },
                  right: { kind: 'literal', value: 100 },
                },
              },
            ],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: { tag: 'span', children: [{ kind: 'state-read', stateName: 'count' }] },
        },
      })
    );
    // Server rendering is used only to observe pre-commit initialization, not as an SSR-profile claim.
    expect(renderToStaticMarkup(React.createElement(Component, {}))).toBe('<span>10</span>');
    const ordinary = mount(Component);
    expect(ordinary.host.textContent).toBe('11');
    ordinary.render({ unrelated: true });
    expect(ordinary.host.textContent).toBe('11');

    const replayed = mount(Component, {}, true);
    // React's development replay is detach + remount: created is not rerun between those epochs.
    expect(replayed.host.textContent).toBe('112');
    replayed.render({ unrelated: true });
    expect(replayed.host.textContent).toBe('112');
  });

  it('dispatches resolved watchers after hydration, in FIFO order, before updated callbacks', () => {
    const numeric = (name: string, index: number, initialValue = 0): StateDeclIR => ({
      ...count,
      name,
      index,
      initialValue,
    });
    const readState = (name: string) => ({ kind: 'state' as const, name });
    const readProp = (name: string, source: 'current' | 'previous' = 'current') => ({
      kind: 'prop' as const,
      name,
      source,
    });
    const Component = compiled(
      prototype({
        props: [
          {
            index: 0,
            name: 'value',
            kind: 'number',
            tsType: 'number',
            defaultValue: 1,
            ssaType: 'f64',
          },
          {
            index: 1,
            name: 'other',
            kind: 'number',
            tsType: 'number',
            defaultValue: 0,
            ssaType: 'f64',
          },
        ],
        states: [
          numeric('count', 0),
          numeric('previous', 1),
          numeric('calls', 2),
          numeric('lastSeen', 3, 1),
          numeric('observed', 4),
        ],
        propWatches: [
          {
            keys: ['value'],
            body: [
              { kind: 'state-set', stateName: 'count', value: readProp('value') },
              { kind: 'state-set', stateName: 'previous', value: readProp('value', 'previous') },
              {
                kind: 'state-set',
                stateName: 'calls',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: readState('calls'),
                  right: { kind: 'literal', value: 1 },
                },
              },
            ],
          },
          {
            keys: null,
            body: [
              {
                kind: 'state-set',
                stateName: 'calls',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: readState('calls'),
                  right: { kind: 'literal', value: 10 },
                },
              },
            ],
          },
        ],
        lifecycle: ['onUpdated'],
        lifecycleHandlers: [
          {
            phase: 'updated',
            body: [
              {
                kind: 'if',
                condition: {
                  kind: 'binary',
                  operator: '!==',
                  left: readState('lastSeen'),
                  right: readProp('value'),
                },
                then: [
                  { kind: 'state-set', stateName: 'observed', value: readState('count') },
                  { kind: 'state-set', stateName: 'lastSeen', value: readProp('value') },
                ],
                otherwise: [],
              },
            ],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: {
            tag: 'span',
            children: [
              { kind: 'state-read', stateName: 'count' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'previous' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'calls' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'observed' },
            ],
          },
        },
      })
    );
    const view = mount(Component, { value: 1, other: 0 });
    expect(view.host.textContent).toBe('0|0|0|0');
    flushSync(() => {
      view.root.render(React.createElement(Component, { value: 2, other: 0 }));
      view.root.render(React.createElement(Component, { value: 3, other: 0 }));
    });
    expect(view.host.textContent).toBe('3|1|11|3');
    view.render({ value: 3, other: 2 });
    expect(view.host.textContent).toBe('3|1|21|3');
    view.render({ value: null, other: 2, rawOnly: 'new' });
    expect(view.host.textContent).toBe('3|1|21|3');
  });

  it('uses Object.is for watcher changes and canonical finite-gte and semantic token merging', () => {
    const Watcher = compiled(
      prototype({
        props: [
          {
            index: 0,
            name: 'value',
            kind: 'number',
            tsType: 'number',
            defaultValue: 0,
            ssaType: 'f64',
          },
        ],
        states: [count],
        propWatches: [
          {
            keys: ['value'],
            body: [
              {
                kind: 'state-set',
                stateName: 'count',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: { kind: 'state', name: 'count' },
                  right: { kind: 'literal', value: 1 },
                },
              },
            ],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: { tag: 'span', children: [{ kind: 'state-read', stateName: 'count' }] },
        },
      })
    );
    const watch = mount(Watcher, { value: -0 });
    watch.render({ value: -0 });
    expect(watch.host.textContent).toBe('0');
    watch.render({ value: 0 });
    expect(watch.host.textContent).toBe('1');

    const Styled = compiled(
      prototype({
        props: [
          {
            index: 0,
            name: 'a',
            kind: 'boolean',
            tsType: 'boolean',
            defaultValue: false,
            ssaType: 'i1',
          },
          {
            index: 1,
            name: 'b',
            kind: 'boolean',
            tsType: 'boolean',
            defaultValue: false,
            ssaType: 'i1',
          },
        ],
        states: [{ ...count, initialValue: Infinity }],
        rules: [
          {
            id: 0,
            condition: { kind: 'cmp', source: 'prop', key: 'a', operator: 'eq', value: true },
            styleTokens: ['bg-red-500', 'text-sm'],
          },
          {
            id: 1,
            condition: { kind: 'cmp', source: 'prop', key: 'b', operator: 'eq', value: true },
            styleTokens: ['text-lg', 'bg-blue-500'],
          },
          {
            id: 2,
            condition: { kind: 'cmp', source: 'state', key: 'count', operator: 'gte', value: 0 },
            styleTokens: ['block'],
          },
        ],
      })
    );
    const view = mount(Styled, { a: false, b: true });
    expect(view.host.firstElementChild?.className).toBe('text-lg bg-blue-500');
    view.render({ a: true, b: true });
    expect(view.host.firstElementChild?.className).toBe('bg-blue-500 text-lg');
    view.render({ a: true, b: false });
    expect(view.host.firstElementChild?.className).toBe('bg-red-500 text-sm');
    view.render({ a: false, b: false });
    expect(view.host.firstElementChild?.hasAttribute('class')).toBe(false);
  });

  it('preserves primitive operator semantics across nullable current and previous props', () => {
    const read = (name: string, source: 'current' | 'previous' = 'current') => ({
      kind: 'prop' as const,
      name,
      source,
    });
    const lit = (value: string | number) => ({ kind: 'literal' as const, value });
    const Component = compiled(
      prototype({
        props: [
          {
            index: 0,
            name: 'value',
            kind: 'number',
            tsType: 'number | null',
            defaultValue: 2,
            empty: 'accept',
            ssaType: 'f64',
          },
          {
            index: 1,
            name: 'label',
            kind: 'string',
            tsType: 'string',
            defaultValue: '5',
            ssaType: 'i32',
          },
        ],
        states: [
          count,
          { index: 1, name: 'text', kind: 'string', initialValue: '', ssaType: 'i32' },
          { index: 2, name: 'matches', kind: 'bool', initialValue: false, ssaType: 'i1' },
          { ...count, index: 3, name: 'signed' },
        ],
        propWatches: [
          {
            keys: ['value'],
            body: [
              {
                kind: 'state-set',
                stateName: 'count',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: read('value', 'previous'),
                  right: read('value'),
                },
              },
            ],
          },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'local',
                name: 'added',
                value: { kind: 'binary', operator: '+', left: read('value'), right: lit(1) },
              },
              {
                kind: 'state-set',
                stateName: 'count',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: {
                    kind: 'binary',
                    operator: '*',
                    left: { kind: 'local', name: 'added' },
                    right: lit(10),
                  },
                  right: { kind: 'binary', operator: '??', left: read('value'), right: lit(4) },
                },
              },
              {
                kind: 'state-set',
                stateName: 'text',
                value: { kind: 'binary', operator: '+', left: read('label'), right: read('value') },
              },
              {
                kind: 'state-set',
                stateName: 'matches',
                value: { kind: 'binary', operator: '<', left: read('label'), right: lit('20') },
              },
              {
                kind: 'state-set',
                stateName: 'signed',
                value: {
                  kind: 'binary',
                  operator: '/',
                  left: lit(1),
                  right: { kind: 'unary', operator: '-', operand: read('value') },
                },
              },
            ],
          },
        ],
        rules: [
          {
            id: 0,
            condition: {
              kind: 'cmp',
              source: 'state',
              key: 'matches',
              operator: 'eq',
              value: true,
            },
            styleTokens: ['matching'],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: {
            tag: 'button',
            children: [
              { kind: 'state-read', stateName: 'count' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'text' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'matches' },
              { kind: 'text', value: '|' },
              { kind: 'state-read', stateName: 'signed' },
            ],
          },
        },
      })
    );
    const view = mount(Component, { value: 2 });
    view.render({ value: 3 });
    expect(view.host.textContent).toBe('5|||0');
    view.render({ value: null });
    flushSync(() => view.host.querySelector('button')!.click());
    expect(view.host.textContent).toBe('14|5null||-Infinity');
    expect(view.host.firstElementChild?.classList.contains('matching')).toBe(false);
    view.render({ value: 0, label: '10' });
    flushSync(() => view.host.querySelector('button')!.click());
    expect(view.host.textContent).toBe('10|100||-Infinity');
    expect(view.host.firstElementChild?.classList.contains('matching')).toBe(true);
  });

  it('rejects every unsupported semantic edge instead of importing a prototype or adapter', () => {
    const rejected: Partial<PrototypeIR>[] = [
      { render: { kind: 'dynamic' } },
      { hooks: [{ name: 'asTrigger', kind: 'builtin' }] },
      { contexts: [{ keyName: 'KEY', mode: 'read' }] },
      { exposes: [{ name: 'count', kind: 'state', tsType: 'number' }] },
      { lifecycle: ['onMounted'] },
      { lifecycleHandlers: [{ phase: 'before-dispose', body: [] }] },
      { propWatches: [{ keys: [], body: [] }] },
      { states: [{ ...count, initialValue: undefined }] },
      { states: [{ ...count, kind: 'number.range' }] },
      {
        states: [count],
        events: [
          {
            scope: 'root',
            eventName: 'press.commit',
            simpleAction: { kind: 'increment-state', stateName: 'count', delta: 1 },
          },
        ],
      },
      { states: [count], events: [{ scope: 'global', eventName: 'key.down', body: [] }] },
      { events: [{ scope: 'root', eventName: 'host:unknown-event', body: [] }] },
      { events: [{ scope: 'root', eventName: 'key.down' }] },
      { unlowered: [{ operation: 'props.watch', message: 'Callback has not been lowered.' }] },
      {
        rules: [
          {
            id: 0,
            condition: { kind: 'cmp', operator: 'eq', source: 'meta', key: 'present', value: true },
            styleTokens: ['show'],
          },
        ],
      },
    ];
    for (const change of rejected) {
      const input = prototype(change);
      expect(
        getReactLoweringDiagnostics(input).every((value) => value.code === 'PUI_REACT_UNSUPPORTED')
      ).toBe(true);
      expect(() => emitReactComponent(input)).toThrow('PUI_REACT_UNSUPPORTED');
    }
  });
});
