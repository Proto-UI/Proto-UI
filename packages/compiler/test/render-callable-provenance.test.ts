// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

it('rejects a setup-only callable that can be installed before a later render', () => {
  const source = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'mutable-render-effect',setup(def){
      const illegal = () => { def.state.bool('flag', true); };
      const box = { invoke: () => {} };
      def.expose.method('replace', () => { box.invoke = illegal; });
      return r => { box.invoke(); return r.el('div', []); };
    }});`;
  expect(parsePrototype(source)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
});

it('rejects portable IR when a later callback installs a render-illegal callable', () => {
  const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'mutable-render-portable',setup(def){
      const illegal=()=>{def.state.bool('flag',true);};
      const box={invoke:()=>{}};
      def.expose.method('replace',()=>{if(false)box.invoke=illegal;});
      return r=>{box.invoke();return r.el('div',[]);};
    }});`);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = JSON.parse(JSON.stringify(parsed.value));
  expect(validateIR(ir).ok).toBe(true);
  const expose = ir.setup.body.find(
    (statement: any) =>
      statement.kind === 'effect' && statement.expression.operation === 'expose.method'
  );
  const guarded = expose.expression.arguments[1].function.body[0];
  expect(guarded.kind).toBe('if');
  expect(guarded.condition.kind).toBe('literal');
  guarded.condition.value = true;
  expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('retains a function installed by a public call and reached on the next render', async () => {
      const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'mutable-render-value',setup(def){
        const box = { invoke: () => 1 };
        def.expose.method('replace', () => { box.invoke = () => 9; });
        return r => r.el('output', box.invoke());
      }});`;
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      expect(owner.host.querySelector('output')?.textContent).toBe('1');
      await owner.act(() => {
        owner.handle.getExposes().replace();
        owner.handle.update();
      });
      expect(owner.host.querySelector('output')?.textContent).toBe('9');
    });
  });

it('revisits a render returned by authored hook setup in render context', () => {
  const source = `import{definePrototype,defineAsHook}from'@proto.ui/core';
    const install=defineAsHook({name:'hook-render',setup(def){
      const box={invoke:()=>{}};const illegal=()=>{def.state.bool('illegal',true);};
      def.expose.method('replace',()=>{box.invoke=illegal;});
      return r=>{box.invoke();return r.el('div',[]);};
    }});
    export default definePrototype({name:'hook-render-owner',setup(){install();}});`;
  expect(parsePrototype(source)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('render') }],
  });
});

const guardedRaw = (body: string) => `import{definePrototype,defineAsHook}from'@proto.ui/core';
 const install=defineAsHook({name:'guarded-raw',setup(def){
  const flag=def.state.bool('flag',false);const box={invoke:()=>{}};
  const illegal=()=>{def.state.bool('illegal',true);};
  def.expose.method('prime',()=>{${body}});
  return r=>{box.invoke();return r.el('div',[]);};
 }});
 export default definePrototype({name:'guarded-raw-owner',setup(){install();}});`;

it('stops the implicit raw public path at its real phase guard', () => {
  const parsed = parsePrototype(guardedRaw(`flag.setDefault(true);box.invoke=illegal;`));
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (parsed.ok) expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
});
it.each([
  `box.invoke=illegal;flag.setDefault(true);`,
  `try{flag.setDefault(true);}catch{box.invoke=illegal;}`,
  `try{flag.setDefault(true);}finally{box.invoke=illegal;}`,
])('keeps raw guard side effects and abrupt successors: %s', (body) => {
  expect(parsePrototype(guardedRaw(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('render') }],
  });
});
