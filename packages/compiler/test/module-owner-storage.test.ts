// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
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
