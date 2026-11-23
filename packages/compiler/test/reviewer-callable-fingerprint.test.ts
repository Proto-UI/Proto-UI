// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const prefix = `import{definePrototype,defineAsHook}from'@proto.ui/core';`;
const bindings = `const empty=()=>{};const create=()=>{def.state.bool('flag',true);};
 const dispatch=(value:{invoke:()=>void;other:()=>void})=>value.invoke();
 const first={invoke:empty,other:create};const second={invoke:create,other:empty};`;
const effects = (
  calls: string
) => `${prefix}export default definePrototype({name:'record-effects',setup(def){
 ${bindings}def.lifecycle.onCreated(()=>{${calls}});
}});`;

it('keeps a finite analysis for recursive code that constructs a deeper ordinary record', () => {
  const source = `${prefix}export default definePrototype({name:'finite-recursive-record',setup(){
    const walk=(n:number,value:unknown):void=>{if(n>0)walk(n-1,{next:value});};
    walk(1,0);return r=>r.el('div',[]);
  }});`;
  const result = compilePrototype(source, { profile: 'react-dom-source-v1' });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});

it.each(['dispatch(first);dispatch(second);', 'dispatch(second);dispatch(first);'])(
  'rejects the same illegal effect regardless of record-field permutation order: %s',
  (calls) => {
    expect(parsePrototype(effects(calls))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007' }],
    });
  }
);

it('rejects serialized callback IR with a second, distinct record environment', () => {
  const parsed = parsePrototype(effects('const retained=second;dispatch(first);'));
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error('expected an inert callback control');
  const ir = JSON.parse(JSON.stringify(parsed.value));
  expect(validateIR(ir).ok).toBe(true);
  const second = ir.setup.body.find(
    (statement: any) => statement.kind === 'const' && statement.name === 'second'
  );
  const registered = ir.setup.body.find(
    (statement: any) =>
      statement.kind === 'effect' && statement.expression.operation === 'lifecycle.onCreated'
  );
  expect(second).toBeDefined();
  expect(registered).toBeDefined();
  const callback = registered.expression.arguments[0].function;
  const additional = JSON.parse(
    JSON.stringify(callback.body.find((statement: any) => statement.kind === 'effect'))
  );
  expect(additional.expression.arguments[0].kind).toBe('reference');
  additional.expression.arguments[0] = {
    ...additional.expression.arguments[0],
    name: second.name,
    bindingId: second.bindingId,
    type: second.value.type,
  };
  callback.body.push(additional);
  expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('captures the state which actually executes after a record-field permutation', async () => {
      const owner = await mountNativeOwner(
        `${prefix}
      const install=defineAsHook({name:'outer',setup(def){${bindings}dispatch(first);dispatch(second);}});
      export default definePrototype({name:'record-capture',setup(def){
        const result=install();def.expose.value('hasState',!!result.getState?.('flag'));
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().hasState).toBe(true);
      expect(owner.compiled.ir.hooks[0].capture?.states).toEqual([
        { name: 'flag', type: 'state:boolean', definite: true },
      ]);
    });
  });
