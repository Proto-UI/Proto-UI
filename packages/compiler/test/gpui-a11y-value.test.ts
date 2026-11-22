// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
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
      'move |data,window,cx|{if dispatch_accessibility_action(&owner,&kind,data)'
    );
    expect(owner).toContain(
      'Some(gpui::accesskit::ActionData::NumericValue(value))=data else{return false}'
    );
    expect(owner).toContain('if !value.is_finite(){return false}');
    expect(owner.indexOf('if listener.numeric_value')).toBeLessThan(
      owner.indexOf('if listener.once{let epoch=')
    );
  });
});
