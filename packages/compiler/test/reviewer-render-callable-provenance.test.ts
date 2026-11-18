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
