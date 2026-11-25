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
        def.event.on('host:click', run => {
          hidden.set(!hidden.get());
          const before = count.get();
          if (before >= 1) { count.set(before / 2); }
          else { count.set(before + 1); }
          run.update();
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

  it('lowers actual Base Text and Surface to ordinary native child slots', () => {
    const session = new TsProgramSession({ rootDir: process.cwd() });
    for (const [family, componentName] of [
      ['text', 'BaseTextRoot'],
      ['surface', 'BaseSurfaceRoot'],
    ]) {
      const entryPath = path.resolve('packages/prototypes/base/src', family, 'root.proto.ts');
      const extracted = extractModuleIR(session.ensureFiles([entryPath]), entryPath);
      expect(extracted.diagnostics).toEqual([]);
      expect(extracted.ir.prototypes).toHaveLength(1);
      const ir = extracted.ir.prototypes[0];
      expect(ir, entryPath).toBeDefined();
      expect(ir.unlowered).toEqual([]);
      expect(ir.props.length).toBeGreaterThan(0);
      const output = compile(ir, componentName);
      expect(output.childrenTypeName).toBe(componentName + 'Child');
      expect(output.code).toContain('View(gpui::AnyView)');
      expect(output.code).toContain('pub fn set_children(');
      expect(output.code).toContain('for child in &self.slot_children');
    }
  }, 180_000);

  it('lowers created callbacks and ordered resolved prop watches from authored source', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'created-watch',setup(def){
        def.props.define({label:{type:'string',default:'Initial'},amount:{type:'number',default:0}});
        const created = def.state.string('created', 'Not created');
        const order = def.state.string('order', '');
        const previous = def.state.numberDiscrete('previous', 0);
        const current = def.state.numberDiscrete('current', 0);
        def.lifecycle.onCreated(run => {created.set(run.props.get().label);});
        def.props.watchAll((run,next,prev) => {
          order.set(order.get() + 'A');
          previous.set(prev.amount); current.set(next.amount);
          if(next.amount === 13) {current.set(0/0);}
        });
        def.props.watch(['amount'], (run,next,prev) => {order.set(order.get() + 'B');});
        def.props.watch(['label'], (run,next,prev) => {order.set(order.get() + 'C');});
        return renderer => renderer.el('div', [created.get(), order.get(), current.get()]);
      }});`;
    const session = new TsProgramSession({ rootDir: process.cwd() });
    const { program, entryPath } = session.createVirtualProgram(
      'packages/compiler/test/__gpui_watch__.proto.ts',
      source
    );
    const extracted = extractModuleIR(program, entryPath);
    expect(extracted.diagnostics).toEqual([]);
    expect(extracted.ir.prototypes[0].unlowered).toEqual([]);
    const output = compile(extracted.ir.prototypes[0], 'CreatedWatch');
    expect(output.code).toContain('component.handle_created_0()?');
    expect(output.code).toContain('previous_snapshot_prop_amount');
    expect(output.code).toContain('.to_bits()');
    expect(output.code).toContain('if self.props_initialized');
    compile(
      {
        ...extracted.ir.prototypes[0],
        states: [
          ...extracted.ir.prototypes[0].states,
          {
            index: 4,
            name: 'range',
            kind: 'number.range',
            initialValue: -1,
            min: 0,
            max: 10,
            clamp: true,
            ssaType: 'f64',
          },
          {
            index: 5,
            name: 'step',
            kind: 'number.discrete',
            initialValue: 0,
            step: 0.25,
            ssaType: 'f64',
          },
        ],
        render: {
          kind: 'fragment',
          children: [{ kind: 'state-read', stateName: 'current' }, { kind: 'slot' }],
        },
      },
      'GpuiExpandedPinned',
      'pinned'
    );
    compile(
      prototype({
        states: [
          { index: 0, name: 'number', kind: 'number.discrete', initialValue: 0, ssaType: 'f64' },
        ],
        lifecycle: ['onCreated'],
        lifecycleHandlers: [
          {
            phase: 'created',
            body: [
              { kind: 'state-set', stateName: 'number', value: { kind: 'literal', value: NaN } },
            ],
          },
        ],
      }),
      'CreatedFailure'
    );
  }, 180_000);

  it('lowers numeric range initialization and discrete step/options policies', () => {
    compile(
      prototype({
        states: [
          {
            index: 0,
            name: 'bounded',
            kind: 'number.range',
            initialValue: -5,
            min: 0,
            max: 10,
            clamp: true,
            ssaType: 'f64',
          },
          {
            index: 1,
            name: 'stepped',
            kind: 'number.discrete',
            initialValue: 0.5,
            min: 0,
            max: 10,
            step: 0.25,
            ssaType: 'f64',
          },
          {
            index: 2,
            name: 'optioned',
            kind: 'number.discrete',
            initialValue: 0.5,
            options: [0.5, 2.5],
            min: 100,
            max: 200,
            step: 7,
            ssaType: 'f64',
          },
        ],
        events: [
          ['bounded', 5],
          ['bounded', -1],
          ['stepped', 0.75],
          ['stepped', 0.7],
          ['optioned', 2.5],
          ['optioned', 100],
        ].map(([stateName, value]) => ({
          scope: 'root' as const,
          eventName: 'host:click',
          body: [
            {
              kind: 'state-set' as const,
              stateName: stateName as string,
              value: { kind: 'literal' as const, value: value as number },
            },
          ],
        })),
        render: {
          kind: 'fragment',
          children: [
            { kind: 'state-read', stateName: 'bounded' },
            { kind: 'state-read', stateName: 'stepped' },
          ],
        },
      }),
      'NumericPolicy'
    );
    const invalid = emitGpuiComponent(
      prototype({
        states: [
          {
            index: 0,
            name: 'bad',
            kind: 'number.discrete',
            initialValue: 0.1,
            step: 0.25,
            ssaType: 'f64',
          },
        ],
      })
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics[0].message).toContain('step');
  }, 180_000);

  it('keeps state writes distinct from explicit update requests and helper return scopes', () => {
    const source = `import {definePrototype,tw} from '@proto.ui/core';
      export default definePrototype({name:'update-scheduling',setup(def){
        const count=def.state.numberDiscrete('count',0);
        def.feedback.style.use(tw('w-64 h-32'));
        def.event.on('host:click',run=>{count.set(count.get()+1);if(count.get()>=2){run.update();}});
        return renderer=>renderer.el('div',count.get());
      }});`;
    const session = new TsProgramSession({ rootDir: process.cwd() });
    const { program, entryPath } = session.createVirtualProgram(
      'packages/compiler/test/__gpui_updates__.proto.ts',
      source
    );
    const extracted = extractModuleIR(program, entryPath);
    expect(extracted.diagnostics).toEqual([]);
    expect(extracted.ir.prototypes[0].unlowered).toEqual([]);
    compile(extracted.ir.prototypes[0], 'UpdateScheduling');
    compile(
      {
        ...extracted.ir.prototypes[0],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
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
        rules: [
          {
            id: 0,
            condition: { kind: 'cmp', operator: 'gte', source: 'state', key: 'count', value: 1 },
            styleTokens: ['bg-blue-500'],
          },
        ],
      },
      'RuleScheduling'
    );
    compile(
      prototype({
        states: [
          { index: 0, name: 'count', kind: 'number.discrete', initialValue: 0, ssaType: 'f64' },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'invoke',
                body: [
                  {
                    kind: 'if',
                    condition: {
                      kind: 'binary',
                      operator: '===',
                      left: { kind: 'state', name: 'count' },
                      right: { kind: 'literal', value: 0 },
                    },
                    then: [{ kind: 'return' }],
                    otherwise: [],
                  },
                  { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 999 } },
                ],
              },
              { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 1 } },
              { kind: 'request-update' },
            ],
          },
        ],
      }),
      'InvokeReturn'
    );
  }, 180_000);

  it('keeps native host Root distinct from template nodes and ordered mixed children', () => {
    const output = compile(
      prototype({
        staticStyleTokens: ['p-4', 'w-64', 'h-64'],
        props: [
          {
            index: 0,
            name: 'label',
            kind: 'string',
            tsType: 'string',
            defaultValue: 'Root before',
            ssaType: 'i32',
          },
        ],
        states: [
          { index: 0, name: 'clicks', kind: 'number.discrete', initialValue: 0, ssaType: 'f64' },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              {
                kind: 'state-set',
                stateName: 'clicks',
                value: {
                  kind: 'binary',
                  operator: '+',
                  left: { kind: 'state', name: 'clicks' },
                  right: { kind: 'literal', value: 1 },
                },
              },
              { kind: 'request-update' },
            ],
          },
        ],
        render: {
          kind: 'fragment',
          children: [
            { kind: 'prop-read', propName: 'label' },
            {
              kind: 'element',
              node: { tag: 'div', styleTokens: ['p-2'], children: [{ kind: 'slot' }] },
            },
            { kind: 'text', value: 'Root after' },
          ],
        },
      }),
      'SlotHost'
    );
    expect(output.code).toContain('SlotHostChild');
    expect(output.code).toContain('.p_2()');
    expect(output.code).toContain('.p_4()');
    compile(prototype({ render: { kind: 'fragment', children: [] } }), 'EmptyRoot');
  }, 180_000);

  it('rejects unsupported semantics before invoking a native toolchain', () => {
    for (const ir of [
      prototype({ events: [{ scope: 'root', eventName: 'press.commit', body: [] }] }),
      prototype({ events: [{ scope: 'root', eventName: 'click', body: [] }] }),
      prototype({ render: { kind: 'fragment', children: [{ kind: 'slot' }, { kind: 'slot' }] } }),
      prototype({ render: { kind: 'static-tree', root: { tag: 'button', children: [] } } }),
      prototype({ staticStyleTokens: ['unsupported-token'] }),
      prototype({ staticStyleTokens: ['p-4', 'px-2'] }),
      prototype({ lifecycle: ['onMounted'] }),
      prototype({
        lifecycle: ['onCreated'],
        lifecycleHandlers: [{ phase: 'created', body: [{ kind: 'request-update' }] }],
      }),
      prototype({
        states: [
          { index: 0, name: 'count', kind: 'number.discrete', initialValue: 0, ssaType: 'f64' },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [
              { kind: 'request-update' },
              { kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 1 } },
            ],
          },
        ],
      }),
      prototype({
        states: [
          { index: 0, name: 'count', kind: 'number.discrete', initialValue: 0, ssaType: 'f64' },
        ],
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [{ kind: 'request-update' }, { kind: 'return' }],
          },
          {
            scope: 'root',
            eventName: 'host:click',
            body: [{ kind: 'state-set', stateName: 'count', value: { kind: 'literal', value: 1 } }],
          },
        ],
      }),
      prototype({
        events: [
          {
            scope: 'root',
            eventName: 'host:click',
            body: [{ kind: 'request-update' }, { kind: 'request-update' }],
          },
        ],
      }),
      prototype({ unlowered: [{ operation: 'setup-effect', message: 'Unknown side effect' }] }),
    ]) {
      const result = emitGpuiComponent(ir);
      expect(result.ok).toBe(false);
      expect(result.diagnostics.every((value) => value.code === 'PUI_GPUI_UNSUPPORTED')).toBe(true);
    }
  });
});
