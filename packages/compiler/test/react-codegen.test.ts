// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import baseButton from '@proto.ui/prototypes-base/button';
import baseToggle from '@proto.ui/prototypes-base/toggle';
import { switchRoot } from '@proto.ui/prototypes-base/switch';
import { createCompiler } from '../src';
import { createCompiledReactComponent } from '../src/runtime';

function evalCompiledReactModule(code: string): React.ComponentType<any> {
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };
  const fakeRequire = (id: string) => {
    if (id === 'react') return React;
    throw new Error(`Unexpected runtime import in Tier-0/1 output: ${id}`);
  };
  new Function('require', 'module', 'exports', js)(fakeRequire, moduleObj, exportsObj);
  return (moduleObj.exports as { default: React.ComponentType<any> }).default;
}

describe('Thin React backend & real React 19 execution', () => {
  const compiler = createCompiler({ rootDir: process.cwd() });

  it('enforces zero String.raw embedded runtimes anywhere in packages/compiler/src', () => {
    const srcRoot = path.resolve(process.cwd(), 'packages/compiler/src');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.ts')) {
          const text = fs.readFileSync(p, 'utf8');
          if (text.includes('String.raw`')) hits.push(path.relative(srcRoot, p));
        }
      }
    };
    walk(srcRoot);
    expect(hits).toEqual([]);
  });

  it('Tier 0 (static): emits < 20 lines with zero runtime imports and renders cleanly in React 19', () => {
    const res = compiler.compilePrototype(`
      import { definePrototype } from '@proto.ui/core';
      export default definePrototype({
        name: 'empty-box',
        setup() {
          return (r) => r.el('div', 'hello');
        },
      });
    `);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const reactOut = res.value.primary!.react;
    expect(reactOut.tier).toBe('static');
    expect(reactOut.dependencies).toEqual(['react']);
    expect(reactOut.code.split('\n').length).toBeLessThan(20);
    expect(reactOut.code).not.toContain('@proto.ui/');

    const EmptyBox = evalCompiledReactModule(reactOut.code);
    const host = document.createElement('div');
    const root = createRoot(host);
    flushSync(() => {
      root.render(React.createElement(EmptyBox, { className: 'demo' }));
    });
    expect(host.innerHTML).toBe('<div class="demo">hello</div>');
    flushSync(() => root.unmount());
  });

  it('Tier 1 (reactive): emits idiomatic React useState + native onClick and updates interactively', () => {
    const res = compiler.compilePrototype(`
      import { definePrototype } from '@proto.ui/core';
      export default definePrototype({
        name: 'tiny-counter',
        setup(def) {
          def.props.define({ label: { type: 'string', default: 'Clicks' } });
          const count = def.state.numberDiscrete('count', 0);
          def.event.on('press.commit', () => {
            count.set(count.get() + 1);
          });
          return (r) => r.el('button', [r.read.props.get().label, ': ', count.get()]);
        },
      });
    `);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const reactOut = res.value.primary!.react;
    expect(reactOut.tier).toBe('reactive');
    expect(reactOut.dependencies).toEqual(['react']);
    expect(reactOut.code.split('\n').length).toBeLessThan(30);
    expect(reactOut.code).toContain('React.useState(0)');

    const TinyCounter = evalCompiledReactModule(reactOut.code);
    const host = document.createElement('div');
    const root = createRoot(host);
    flushSync(() => {
      root.render(React.createElement(TinyCounter, { label: 'Count' }));
    });
    const btn = host.querySelector('button')!;
    expect(btn.textContent).toBe('Count: 0');
    flushSync(() => btn.click());
    expect(btn.textContent).toBe('Count: 1');
    flushSync(() => btn.click());
    expect(btn.textContent).toBe('Count: 2');
    flushSync(() => root.unmount());
  });

  it('Tier 2 (protocol): emits thin strictly-typed React wrapper and runs official Base prototypes cleanly', () => {
    const btnCompile = compiler.compileFile('packages/prototypes/base/src/button/button.proto.ts');
    expect(btnCompile.ok).toBe(true);
    if (!btnCompile.ok) return;

    const reactOut = btnCompile.value.primary!.react;
    expect(reactOut.tier).toBe('protocol');
    expect(reactOut.code.split('\n').length).toBeLessThan(65);
    expect(reactOut.code).not.toContain('as any');
    expect(reactOut.code).toContain('@proto.ui/compiler/runtime');

    // Mount compiled BaseButton, BaseToggle, and BaseSwitch through the thin shared runtime bridge!
    const proto = btnCompile.value.ir.prototypes[0];
    const CompiledButton = createCompiledReactComponent(baseButton, {
      name: proto.name,
      tier: proto.tier,
      capabilities: proto.capabilities,
      capabilityMask: `0x${proto.capabilityMask.toString(16)}`,
      props: proto.props.map((p) => p.name),
      states: proto.states.map((s) => s.name),
      exposes: proto.exposes.map((e) => e.name),
      staticStyleTokens: proto.staticStyleTokens,
    });
    expect(CompiledButton.__protoMeta.capabilities).toContain('focus');
    expect(CompiledButton.__protoMeta.capabilities).toContain('accessible');

    let clicks = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => {
      root.render(React.createElement(CompiledButton, { onClick: () => clicks++ }, 'Save'));
    });
    const el = host.firstElementChild as HTMLElement;
    expect(el.textContent).toBe('Save');
    expect(el.getAttribute('role')).toBe('button');
    flushSync(() => el.click());
    expect(clicks).toBe(1);

    // Mount BaseToggle & SwitchRoot via the same thin shared runtime
    const CompiledToggle = createCompiledReactComponent(baseToggle, {
      name: 'base-toggle',
      tier: 'protocol',
      capabilities: ['accessible', 'event', 'expose', 'focus', 'props', 'state'],
      capabilityMask: '0x0',
      props: [],
      states: [],
      exposes: [],
      staticStyleTokens: [],
    });
    const CompiledSwitch = createCompiledReactComponent(switchRoot, {
      name: 'base-switch-root',
      tier: 'protocol',
      capabilities: ['accessible', 'anatomy', 'event', 'expose', 'focus', 'props', 'state'],
      capabilityMask: '0x0',
      props: [],
      states: [],
      exposes: [],
      staticStyleTokens: [],
    });
    flushSync(() => {
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(CompiledToggle, null, 'Bold'),
          React.createElement(CompiledSwitch, null, 'Notify')
        )
      );
    });
    expect(host.textContent).toContain('Bold');
    expect(host.textContent).toContain('Notify');

    flushSync(() => root.unmount());
    host.remove();
  });
});
