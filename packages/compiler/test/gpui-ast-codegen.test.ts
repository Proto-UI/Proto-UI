import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TsProgramSession, extractModuleIR } from '../src/frontend';
import type { PrototypeIR } from '../src/ir';
import { emitGpuiComponent, type GpuiEmitResult } from '../src/targets/gpui';

function prototype(change: Partial<PrototypeIR> = {}): PrototypeIR {
  return {
    name: 'native-example',
    exportName: 'default',
    isDefaultExport: true,
    sourceFile: '/input/native.proto.ts',
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
      root: { tag: 'div', children: [{ kind: 'text', value: 'Hello' }] },
    },
    ...change,
  };
}

function compile(
  ir: PrototypeIR,
  componentName: string,
  gpuiDependency: 'pinned' | 'workspace' = 'workspace'
): GpuiEmitResult {
  const result = emitGpuiComponent(ir, { componentName, gpuiDependency });
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const output = result.value;
  expect(output.backend).toBe('syn-prettyplease');
  expect(output.code).toContain('impl gpui::Render for ' + componentName);
  expect(output.code).not.toMatch(/Prototype|ModuleIR|ValueExprIR|serde_json|proto_ui_runtime/);
  const artifactDir = process.env.PUI_GPUI_ARTIFACT_DIR;
  if (artifactDir) {
    const directory = path.join(artifactDir, componentName);
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'src/lib.rs'), output.code);
    fs.writeFileSync(path.join(directory, 'Cargo.toml'), output.cargoToml);
  }
  return output;
}

describe('GPUI Rust AST target', () => {
  it('compiles authored props/state/control flow to an actual native Render component', () => {
    const source = `import { definePrototype, tw } from '@proto.ui/core';
      export default definePrototype<{label:string}>({ name:'gpui-counter', setup(def) {
        def.props.define({label:{type:'string',default:'Count:'}});
        const count = def.state.numberDiscrete('count', 0);
        const hidden = def.state.bool('hidden', true);
        def.event.on('host:click', () => {
          hidden.set(!hidden.get());
          const before = count.get();
          if (before >= 1) { count.set(before / 2); }
          else { count.set(before + 1); }
        });
        def.rule({when:w=>w.state(count).gte(1),intent:i=>i.feedback.style.use(tw('bg-blue-500'))});
        return r => r.el('div', {style:tw('w-64 h-32 p-4')}, [r.read.props.get().label, count.get()]);
      }});`;
    const session = new TsProgramSession({ rootDir: process.cwd() });
    const { program, entryPath } = session.createVirtualProgram(
      'packages/compiler/test/__gpui_input__.proto.ts',
      source
    );
    const extracted = extractModuleIR(program, entryPath);
    expect(extracted.diagnostics).toEqual([]);
    expect(extracted.ir.prototypes[0].unlowered).toEqual([]);
    const output = compile(extracted.ir.prototypes[0], 'GpuiCounter');
    expect(output.code).toMatch(/\.on_click\(\s*cx\s*\.listener\(/);
    expect(output.code).toContain('self.set_state_count(');
    expect(output.code).toContain('ryu_js::Buffer::new().format(');
    expect(output.cargoToml).toContain('workspace = true');
    const pinned = compile(extracted.ir.prototypes[0], 'GpuiPinned', 'pinned');
    expect(pinned.cargoToml).toContain('62e5991dd0f0c8a3af8d5e7e9c4652490d468db8');
  }, 180_000);

  it('constructs typed raw props with missing/empty/invalid fallback and previous-valid fields', () => {
    const output = compile(
      prototype({
        props: [
          {
            index: 0,
            name: 'label',
            kind: 'string',
            tsType: 'string',
            defaultValue: 'Default',
            ssaType: 'i32',
          },
          {
            index: 1,
            name: 'amount',
            kind: 'number',
            tsType: 'number',
            defaultValue: 2,
            range: { min: 0, max: 100 },
            ssaType: 'f64',
          },
          {
            index: 2,
            name: 'nullable',
            kind: 'string',
            tsType: 'string',
            defaultValue: 'Fallback',
            empty: 'accept',
            ssaType: 'i32',
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: {
            tag: 'div',
            children: [
              { kind: 'prop-read', propName: 'label' },
              { kind: 'prop-read', propName: 'amount' },
              { kind: 'prop-read', propName: 'nullable' },
            ],
          },
        },
      }),
      'PropsMatrix'
    );
    expect(output.code).toContain('pub prop_label: Option<Option<String>>');
    expect(output.code).toContain('previous_prop_amount: Option<f64>');
    expect(output.code).toContain('pub fn update_props(');
    compile(
      prototype({
        props: [
          {
            index: 0,
            name: 'required',
            kind: 'string',
            tsType: 'string',
            empty: 'error',
            ssaType: 'i32',
          },
        ],
      }),
      'RequiredProp'
    );
  }, 180_000);

  it('preserves negative zero, fractions, Infinity and native non-NaN state validation', () => {
    const output = compile(
      prototype({
        states: [
          {
            index: 0,
            name: 'number',
            variableName: 'number',
            kind: 'number.discrete',
            initialValue: -0,
            ssaType: 'f64',
          },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'state-set',
                stateName: 'number',
                value: { kind: 'unary', operator: '-', operand: { kind: 'state', name: 'number' } },
              },
            ],
          },
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'state-set',
                stateName: 'number',
                value: { kind: 'literal', value: Infinity },
              },
            ],
          },
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              { kind: 'state-set', stateName: 'number', value: { kind: 'literal', value: 0.5 } },
            ],
          },
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'state-set',
                stateName: 'number',
                value: {
                  kind: 'binary',
                  operator: '/',
                  left: { kind: 'literal', value: 0 },
                  right: { kind: 'literal', value: 0 },
                },
              },
            ],
          },
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              { kind: 'state-set', stateName: 'number', value: { kind: 'literal', value: 999 } },
            ],
          },
        ],
        staticStyleTokens: ['w-64', 'h-32'],
        rules: [
          {
            id: 0,
            condition: { kind: 'cmp', operator: 'gte', source: 'state', key: 'number', value: 1 },
            styleTokens: ['bg-blue-500'],
          },
        ],
        render: {
          kind: 'reactive-tree',
          root: { tag: 'div', children: [{ kind: 'state-read', stateName: 'number' }] },
        },
      }),
      'NumericState'
    );
    expect(output.code).toContain('-0f64');
    expect(output.code).toContain('f64::INFINITY');
    expect(output.code).toContain('value.is_nan()');
    expect(output.code).not.toContain('.fract()');
    expect(output.code).toContain('self.state_number.is_finite()');
  }, 180_000);

  it('emits safe Rust literals without parsing a source template', () => {
    const value = '"; panic!("injected"); //\n\u2028 <script>& 😀';
    const output = compile(
      prototype({
        render: { kind: 'static-tree', root: { tag: 'div', children: [{ kind: 'text', value }] } },
      }),
      'EscapedText'
    );
    expect(output.code).not.toContain('\n panic!');
    expect(output.code).toContain('\\"injected\\"');
  }, 180_000);

  it('rejects unsupported semantics before invoking a native toolchain', () => {
    for (const ir of [
      prototype({ events: [{ scope: 'root', eventName: 'press.commit', body: [] }] }),
      prototype({ events: [{ scope: 'root', eventName: 'click', body: [] }] }),
      prototype({ render: { kind: 'default-slot' } }),
      prototype({ render: { kind: 'static-tree', root: { tag: 'button', children: [] } } }),
      prototype({ staticStyleTokens: ['unsupported-token'] }),
      prototype({ staticStyleTokens: ['p-4', 'px-2'] }),
      prototype({ lifecycle: ['onMounted'] }),
      prototype({ unlowered: [{ operation: 'setup-effect', message: 'Unknown side effect' }] }),
    ]) {
      const result = emitGpuiComponent(ir);
      expect(result.ok).toBe(false);
      expect(result.diagnostics.every((value) => value.code === 'PUI_GPUI_UNSUPPORTED')).toBe(true);
    }
  });
});
