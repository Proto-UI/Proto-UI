// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitGpuiSource } from '../src/gpui-source';
import type { PrototypeIR } from '../src/ir';
import { partitionModuleBindings } from '../src/source-module-bindings';

const core = `import {definePrototype} from '@proto.ui/core';`;
function checked(source: string): PrototypeIR {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const portable = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!portable.ok) throw new Error(JSON.stringify(portable.diagnostics));
  return portable.value;
}

describe('shared module storage and owner closures', () => {
  it('invokes eligible data methods through the live owner registration', () => {
    const ir = checked(`${core}
      type Input = { held: boolean };
      type Decision = { consumed: boolean; effects: string[] };
      function reply(consumed: boolean, effects: string[]): Decision {
        return { consumed, effects };
      }
      function decide(input: Input): Decision {
        const held = input.held;
        if (held) return reply(true, ['hold']);
        return reply(false, []);
      }
      let counter = 0;
      function readCounter(): number { return counter; }
      function readIndirect(): number { return readCounter(); }
      export default definePrototype({ name: 'data-entry', setup(def) {
        const flag = def.state.bool('flag', false);
        def.expose.method('decide', decide);
        def.expose.method('readIndirect', readIndirect);
        def.expose.method('readFlag', () => flag.get());
      }});`);
    const result = emitGpuiSource(ir, { componentName: 'DataEntry' });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const { code } = result.value;
    const dataMethod = code.slice(
      code.indexOf('pub fn call_data_method('),
      code.indexOf('pub fn owner(&self)')
    );
    expect(dataMethod).toContain(
      'pub fn call_data_method(&self, name: &str, arguments: Vec<Option<Json>>)'
    );
    expect(dataMethod).toContain('ensure(&self.owner())');
    expect(dataMethod).toContain('self.owner.borrow().exposes.get(name).cloned()');
    expect(dataMethod).toContain('invoke(&self.owner, "expose-method", &callback, arguments)');
    expect(dataMethod).not.toContain('function.call_authored');
    expect(dataMethod).toContain('check_method(name, &arguments)');
    expect(dataMethod).toContain('exposed method returned invalid portable data');
    expect(dataMethod).toContain('unknown or ineligible data method');
    expect(dataMethod).not.toContain('"readIndirect"');
    expect(dataMethod).not.toContain('"readFlag"');
    expect(code).toContain(
      'pub fn call(&self, name: &str, arguments: Vec<Json>, window: &mut Window, cx: &mut App)'
    );
    expect(code).toContain('expose_method(&owner, Value::string("readFlag")');
  });

  it.each([
    "def.expose.method('decide', () => flag.get());",
    "if (true) { def.expose.method('decide', () => flag.get()); }",
  ])('rejects ambiguous data registration when setup also contains %s', (registration) => {
    const ir = checked(`${core}
      function decide(): boolean { return true; }
      export default definePrototype({ name: 'ambiguous-entry', setup(def) {
        const flag = def.state.bool('flag', false);
        def.expose.method('decide', decide);
        ${registration}
      }});`);
    const result = emitGpuiSource(ir);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.code).not.toContain('pub fn call_data_method(');
    expect(result.value.code).toContain('expose_method(&owner, Value::string("decide")');
  });

  it('preserves undefined argument holes for a conditionally registered data method', () => {
    const ir = checked(`${core}
      function decide(first: number = 7, last: number): number { return first + last; }
      let enabled = false;
      export default definePrototype({ name: 'conditional-data-entry', setup(def) {
        enabled = !enabled;
        if (enabled) { def.expose.method('decide', decide); }
      }});`);
    const result = emitGpuiSource(ir);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.code).toContain('pub fn call_data_method(&self');
    expect(result.value.code).toContain(
      'value.map(Value::json).unwrap_or(Value::Undefined)'
    );
    expect(result.value.code).toContain('self.owner.borrow().exposes.get(name).cloned()');
  });

  it('does not promote a conditional callback shadowed by a setup-local function', () => {
    const ir = checked(`${core}
      function decide(): number { return 7; }
      export default definePrototype({ name: 'shadowed-data-entry', setup(def) {
        if (true) {
          const decide = () => 9;
          def.expose.method('decide', decide);
        }
      }});`);
    const result = emitGpuiSource(ir);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.code).not.toContain('pub fn call_data_method(');
  });

  it('retains owner dependencies in defaults without promoting scalar-only module helpers', () => {
    const ir = checked(`import {definePrototype,delay} from '@proto.ui/core';
      function wait(task=delay(0,()=>{})){return 1;}
      function forwarded(value=wait()){return value;}
      function throughReference(helper=wait){return helper();}
      function scalar(value=7){return value;}
      export default definePrototype({name:'defaults',setup(def){
        def.expose.method('wait',()=>wait());
        def.expose.method('forwarded',forwarded);
        def.expose.method('throughReference',()=>throughReference());
        def.expose.method('scalar',scalar);
      }});`);
    const { shared, owned } = partitionModuleBindings(ir);
    expect(owned).toHaveLength(3);
    expect(shared).toHaveLength(1);
    expect(shared[0].value.kind).toBe('function');
    if (shared[0].value.kind === 'function')
      expect(shared[0].value.function.parameters[0].default).toMatchObject({
        kind: 'literal',
        value: 7,
      });
  });

  it('shares module data and static first-class functions without turning them into owner storage', () => {
    const ir = checked(`${core}let count:number=0;
      function increase(delta:number){count=count+delta;return count;}
      const forwarded=increase;
      export default definePrototype({name:'counter',setup(def){const alias=forwarded;def.expose.method('increase',alias);}});`);
    expect(ir.moduleBindings).toHaveLength(2);
    expect(ir.moduleBindings?.some((binding) => binding.value.kind === 'lexical-cell')).toBe(true);
  });

  it('preserves ordinary contextual callback arguments to static module functions', () => {
    checked(`${core}function call(fn:(value:number)=>number){return fn(2);}
      export default definePrototype({name:'callback',setup(def){const value=call(input=>input+1);def.expose.value('value',value);}});`);
  });

  it('allows a module function to create a closure returned to the current owner', () => {
    checked(`${core}function make(seed:number){let value=seed;return ()=>{value++;return value;};}
      export default definePrototype({name:'owner',setup(def){const next=make(1);def.expose.method('next',next);}});`);
  });

  it('keeps local mutable capability aliases inside their owner', () => {
    checked(
      `${core}export default definePrototype({name:'owner',setup(def){let state=def.state.bool('flag',false);const alias=state;def.expose.method('read',()=>alias.get());}});`
    );
  });

  it.each([
    `let shared:unknown=0;export default definePrototype({name:'owner',setup(def){shared=()=>1;}});`,
    `let shared=()=>0;export default definePrototype({name:'owner',setup(def){shared=()=>1;}});`,
    `const shared={callback:()=>0};export default definePrototype({name:'owner',setup(def){shared.callback=()=>1;}});`,
  ])('rejects source storage that could carry an owner beyond its lifetime: %s', (source) => {
    expect(parsePrototype(core + source)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input' }],
    });
  });

  it('rejects a forged unknown module cell before accepting writes into it', () => {
    const ir = checked(
      `${core}let shared=0;export default definePrototype({name:'owner',setup(def){def.expose.method('read',()=>shared);}});`
    );
    const storage = ir.moduleBindings![0].value;
    expect(storage.kind).toBe('lexical-cell');
    storage.type = { kind: 'cell', value: 'unknown' };
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI2002',
          message: expect.stringContaining('Shared module storage requires finite data'),
        },
      ],
    });
  });

  it('rejects forged callable containers in the shared module even if their initial function captures nothing', () => {
    const ir = checked(
      `${core}function get(){return 0;}export default definePrototype({name:'owner',setup(def){def.expose.method('get',get);}});`
    );
    const binding = ir.moduleBindings![0];
    binding.value = {
      kind: 'record',
      entries: [{ key: 'callback', value: binding.value }],
      type: { kind: 'object', fields: [{ name: 'callback', type: binding.value.type }] },
      span: binding.span,
    };
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('Shared module initializers') },
      ],
    });
  });
});
