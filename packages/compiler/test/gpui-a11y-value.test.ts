// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitGpuiSource } from '../src/gpui-source';
import { pruneDeadValues } from '../src/demand-pruning';
import { structuralStatementOrder } from '../src/declaration-order';
import { gpuiNativeSdkFiles } from '../src/gpui-native-sdk';
import type { ExpressionIR } from '../src/ir';

const source = readFileSync(
  new URL('./fixtures/gpui-a11y-value/value.proto.ts', import.meta.url),
  'utf8'
);
function prototype(body: string) {
  return `import {definePrototype,type A11ySetValueEventPayload} from '@proto.ui/core';
    import {asAccessible} from '@proto.ui/hooks';
    export default definePrototype({name:'a11y-value-boundary',setup(def){
      const accessible=asAccessible();${body}return r=>r.slot();}});`;
}
function action(options = "{event:'host:numeric'}") {
  return `accessible.action('setValue',${options});`;
}
const listener = "def.event.on('host:numeric',(_run,event)=>{const next=event.value;});";
function operations(value: unknown): Extract<ExpressionIR, { kind: 'operation' }>[] {
  if (!value || typeof value !== 'object') return [];
  const result = Array.isArray(value)
    ? value.flatMap(operations)
    : Object.entries(value)
        .filter(([key]) => !['type', 'span', 'captures'].includes(key))
        .flatMap(([, child]) => operations(child));
  if ('kind' in value && value.kind === 'operation')
    result.unshift(value as Extract<ExpressionIR, { kind: 'operation' }>);
  return result;
}

describe('C-COMPILER-GPUI-A11Y-VALUE-0001 checked numeric host payload', () => {
  it('compiles the authored numeric request and scoped control without instance policy in the bridge', () => {
    const result = compilePrototype(source, { profile: 'gpui-source-v1' });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.output.code).toContain('listen_numeric_value(');
    expect(result.value.output.code).toContain('.member("value", false)');
    expect(result.value.output.code).toContain('.member("control", false)');
    expect(result.value.output.code).toContain('prevent(');
  });

  it('supports the documented default route and explicit public payload type', () => {
    const result = compilePrototype(
      prototype(`accessible.action('setValue');
      def.event.on('host:a11y-set-value',(_run,opaque)=>{
        const event=opaque as A11ySetValueEventPayload;const value=event.value;
      });`),
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('keeps retained event controls outside an Expose method callback', () => {
    const result = compilePrototype(
      prototype(
        action() +
          `let later=()=>{};
      def.event.on('host:numeric',(_run,event)=>{
        const control=event.control;later=()=>control.requestDefaultActionPrevention();
      });def.expose.method('late',()=>later());`
      ),
      { profile: 'gpui-source-v1' }
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
  });

  it.each(['()', '(_run)', '(_run, event)'])(
    'validates a numeric registration before once even when its callback omits payload: %s',
    (parameters) => {
      const result = compilePrototype(
        prototype(
          action() +
            `const calls=def.state.numberDiscrete('calls',0);def.expose.state('calls',calls);
        def.event.on('host:numeric',${parameters}=>calls.set(calls.get()+1),{once:true});`
        ),
        { profile: 'gpui-source-v1' }
      );
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code).toContain('listen_numeric_value(');
    }
  );

  it.each(['()', '(_run)', '(_run, event)'])(
    'retains each numeric registration schema after its declaration is pruned: %s',
    (parameters) => {
      const result = compilePrototype(
        prototype(`if(false){${action()}}
          const calls=def.state.numberDiscrete('calls',0);def.expose.state('calls',calls);
          def.event.on('host:numeric',${parameters}=>calls.set(calls.get()+1),{once:true});`),
        { profile: 'gpui-source-v1' }
      );
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code).toContain('listen_numeric_value(');
    }
  );

  it('does not retroactively change an earlier generic registration on the same route', () => {
    const result = compilePrototype(
      prototype(`const calls=def.state.numberDiscrete('calls',0);def.expose.state('calls',calls);
        def.event.on('host:numeric',()=>calls.set(calls.get()+1),{once:true});
        ${action()}
        def.event.on('host:numeric',()=>calls.set(calls.get()+1),{once:true});`),
      { profile: 'gpui-source-v1' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.output.code.match(/\blisten\(/g)).toHaveLength(1);
    expect(result.value.output.code.match(/\blisten_numeric_value\(/g)).toHaveLength(1);
  });

  it('derives omitted serialized registration schemas without mutating its input', () => {
    const parsed = parsePrototype(
      prototype(`if(false){${action()}}
        const calls=def.state.numberDiscrete('calls',0);def.expose.state('calls',calls);
        def.event.on('host:numeric',()=>calls.set(calls.get()+1),{once:true});`)
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const retained = structuredClone(parsed.value);
    for (const operation of operations(retained)) delete operation.inputPayloadType;
    const original = structuredClone(retained);
    const result = emitGpuiSource(retained);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.code).toContain('listen_numeric_value(');
    expect(retained).toEqual(original);
  });

  it.each(['host-event', 'event'] as const)(
    'rejects a serialized numeric registration claiming the weaker %s schema',
    (inputPayloadType) => {
      const parsed = parsePrototype(prototype(action() + listener));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const forged = structuredClone(parsed.value);
      operations(forged).find((node) => node.operation === 'event.on')!.inputPayloadType =
        inputPayloadType;
      expect(validateIR(forged)).toMatchObject({ ok: false });
    }
  );

  it('does not allow serialized metadata to grant a generic listener numeric provenance', () => {
    const parsed = parsePrototype(prototype("def.event.on('host:numeric',()=>{});" + action()));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const forged = structuredClone(parsed.value);
    operations(forged).find((node) => node.operation === 'event.on')!.inputPayloadType =
      'a11y-value-event';
    expect(validateIR(forged)).toMatchObject({ ok: false });
  });

  it.each([null, false, 0, '', 'unknown', {}, []])(
    'rejects malformed serialized registration schema metadata: %j',
    (inputPayloadType) => {
      const parsed = parsePrototype(prototype(action() + listener));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const forged = structuredClone(parsed.value);
      Object.assign(operations(forged).find((node) => node.operation === 'event.on')!, {
        inputPayloadType,
      });
      expect(validateIR(forged)).toMatchObject({ ok: false });
      expect(emitGpuiSource(forged)).toMatchObject({ ok: false });
    }
  );

  it.each([
    ["def.event.on('host:numeric',()=>{});useNumeric();", 1, 0],
    ["useNumeric();def.event.on('host:numeric',(_run,event)=>{const next=event.value;});", 0, 1],
    ["def.event.on('host:numeric',()=>{});useNumeric();def.event.on('host:numeric',()=>{});", 1, 1],
    ["if(false)useNumeric();def.event.on('host:numeric',()=>{});", 0, 1],
  ] as const)(
    'preserves registration order across an authored hook: %s',
    (body, generic, numeric) => {
      const result = compilePrototype(
        `import {definePrototype,defineAsHook} from '@proto.ui/core';
       import {asAccessible} from '@proto.ui/hooks';
       const useNumeric=defineAsHook({name:'numeric-hook',setup(def){
         const accessible=asAccessible();${action()}
       }});
       export default definePrototype({name:'hook-numeric-order',setup(def){
         ${body}return r=>r.slot();
       }});`,
        { profile: 'gpui-source-v1' }
      );
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code.match(/\blisten\(/g) ?? []).toHaveLength(generic);
      expect(result.value.output.code.match(/\blisten_numeric_value\(/g) ?? []).toHaveLength(
        numeric
      );
    }
  );

  it.each([
    [`def.event.on('host:numeric',()=>{});function declare(){${action()}}declare();`, 1, 0],
    [`${action()}function register(){${listener}}register();`, 0, 1],
    [`declare();${listener}function declare(){${action()}}`, 0, 1],
    [
      `def.event.on('host:numeric',()=>{});function declare(){${action()}}
      function register(){${listener}}register();declare();`,
      1,
      1,
    ],
    [`${listener.replace('const next=event.value;', '')}function declare(){${action()}}`, 1, 0],
  ] as const)(
    'retains structural declaration order when local functions are hoisted: %s',
    (body, generic, numeric) => {
      const result = compilePrototype(prototype(body), { profile: 'gpui-source-v1' });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code.match(/\blisten\(/g) ?? []).toHaveLength(generic);
      expect(result.value.output.code.match(/\blisten_numeric_value\(/g) ?? []).toHaveLength(
        numeric
      );
    }
  );

  it.each([null, false, -1, 0.5, 10000])(
    'rejects invalid structural declaration positions instead of trusting numeric metadata: %j',
    (declarationPosition) => {
      const parsed = parsePrototype(
        prototype(`function declare(){${action()}}declare();${listener}`)
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const forged = structuredClone(parsed.value);
      const declaration = forged.setup.body.find(
        (statement) => statement.kind === 'const' && statement.declarationPosition !== undefined
      )!;
      Object.assign(declaration, { declarationPosition });
      expect(validateIR(forged)).toMatchObject({ ok: false });
    }
  );

  it('keeps hoisted structural positions coherent when unused values are pruned', () => {
    const parsed = parsePrototype(
      prototype(`const unused=3;
      const calls=def.state.numberDiscrete('calls',0);def.expose.state('calls',calls);
      function increment(){calls.set(calls.get()+1);}def.expose.method('increment',()=>increment());`)
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const checked = validateIR(parsed.value);
    if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
    const pruned = pruneDeadValues(checked.value);
    const ordered = structuralStatementOrder(pruned.setup.body);
    expect(
      ordered.some((statement) => statement.kind === 'const' && statement.name === 'unused')
    ).toBe(false);
    expect(validateIR(pruned)).toMatchObject({ ok: true });
    expect(pruneDeadValues(pruned)).toBe(pruned);
  });

  it.each([
    listener,
    "accessible.action('increment',{event:'host:numeric'});" + listener,
    action("{event:'host:other'}") + listener,
    listener + action(),
    action() + listener.replace('event.on(', 'event.onGlobal('),
    "def.event.on('host:numeric',(_run,opaque)=>{const event=opaque as A11ySetValueEventPayload;const value=event.value;});",
  ])('does not manufacture numeric provenance: %s', (body) => {
    expect(parsePrototype(prototype(body))).toMatchObject({ ok: false });
  });

  it.each(["{event:'press.commit'}", "{event:'host:'}", "{event:''}"])(
    'rejects invalid SetValue route %s before native publication',
    (options) => {
      expect(
        compilePrototype(prototype(action(options)), { profile: 'gpui-source-v1' })
      ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_GPUI_A11Y_VALUE' }] });
    }
  );

  it.each(['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'])(
    'reports numeric host payload consumption unsupported in %s',
    (profile) => {
      const result = compilePrototype(prototype(action() + listener), { profile });
      expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4003' }] });
    }
  );

  it.each(['key', 'route', 'remove'])(
    'rechecks the numeric binding independently of source metadata (%s)',
    (mutation) => {
      const parsed = parsePrototype(prototype(action() + listener));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const forged = structuredClone(parsed.value);
      const declaration = operations(forged).find(
        (node) => node.operation === 'accessible.action'
      )!;
      if (mutation === 'key') Object.assign(declaration.arguments[0], { value: 'increment' });
      if (mutation === 'route') {
        const spec = declaration.arguments[1];
        if (spec.kind !== 'record') throw new Error('expected action spec');
        Object.assign(spec.entries[0].value, { value: 'host:other' });
      }
      if (mutation === 'remove') {
        forged.setup.body = forged.setup.body.filter(
          (statement) => !operations(statement).includes(declaration)
        );
      }
      expect(validateIR(forged)).toMatchObject({ ok: false });
    }
  );

  it('passes the actual GPUI callback data to the shared finite-value bridge', () => {
    const owner = gpuiNativeSdkFiles().find((file) =>
      file.path.endsWith('/gpui-native-owner.rs')
    )!.contents;
    expect(owner).toContain('"setValue"=>gpui::AccessibleAction::SetValue');
    expect(owner).toContain(
      'move |data,window,cx|lease.request_data(data,window,cx)'
    );
    const lease = owner.slice(
      owner.indexOf('impl NativeAccessibleActionLease {'),
      owner.indexOf('pub fn native_accessible_action_lease(')
    );
    expect(lease).toContain('if !current{return}');
    expect(lease).toContain('dispatch_accessibility_action(&owner,&self.key,data)');
    expect(owner).toContain(
      'Some(gpui::accesskit::ActionData::NumericValue(value))=data else{return false}'
    );
    expect(owner).toContain('if !value.is_finite(){return false}');
    expect(owner.indexOf('if listener.numeric_value')).toBeLessThan(
      owner.indexOf('if listener.once{let epoch=')
    );
  });
});
