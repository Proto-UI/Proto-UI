// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

// The existing external-callback-owner.test.ts accepts public host inputs
// containing typed callable members; mutable-callable-orders.test.ts accepts
// a required host callable that overwrites an authored setup-only closure.
// These cases distinguish a missing own key from an own undefined value.
const source = (body: string) => `import { definePrototype } from '@proto.ui/core';
export default definePrototype({name:'optional-host-presence',setup(def){
  const illegal=()=>{def.state.bool('late-registration',false);};
  ${body}
  return r=>r.el('div',[]);
}});`;

describe('typed host own-property presence through object spread', () => {
  it('retains the preceding authored callable when an optional host key is absent', () => {
    const result = parsePrototype(
      source(`
      def.expose.method('invoke',(input:{invoke?:()=>void})=>{
        const box={invoke:illegal,...input};
        box.invoke?.();
      });
    `)
    );
    expect(result, JSON.stringify(result.ok ? null : result.diagnostics)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('state.bool') }],
    });
  });

  it('retains the false branch when a host key explicitly contains undefined', () => {
    const result = parsePrototype(
      source(`
      def.expose.method('invoke',(input:{invoke?:()=>void})=>{
        const box={invoke:()=>{},...input};
        if(box.invoke){}else{illegal();}
      });
    `)
    );
    expect(result, JSON.stringify(result.ok ? null : result.diagnostics)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('state.bool') }],
    });
  });

  it('accepts a required host member that certainly overwrites the authored callable', () => {
    const result = parsePrototype(
      source(`
      def.expose.method('invoke',(input:{invoke:()=>void})=>{
        const box={invoke:illegal,...input};
        box.invoke();
      });
    `)
    );
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (result.ok)
      expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });
});
