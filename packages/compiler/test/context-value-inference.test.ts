// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const header = `import {definePrototype,createContextKey} from '@proto.ui/core';
  const KEY=createContextKey<{
    mode:'open'|'closed'; nested:{kind:'a'|'b';count:number}
  }>('context-inference');`;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

function source(operation: 'update' | 'tryUpdate') {
  return `${header}
    export default definePrototype({name:'context-inference',setup(def){
      def.props.define({step:{type:'number',default:0}});
      def.context.provide(KEY,{mode:'closed',nested:{kind:'a',count:0}});
      let value='unobserved';
      let trace='';
      def.context.${operation === 'update' ? 'subscribe' : 'trySubscribe'}(KEY,(_run,next,prev)=>{
        if(next && prev){
          value=next.mode+':'+next.nested.kind+':'+String(next.nested.count);
          trace=trace+prev.mode+'>'+next.mode+'|';
        }
      });
      def.expose.method('value',()=>value);
      def.expose.method('trace',()=>trace);
      def.lifecycle.onCreated(run=>{
        run.context.${operation}(KEY,prev=>({
          mode:'open',nested:{kind:'b',count:prev.nested.count+1}
        }));
      });
      def.props.watch(['step'],(run,next)=>{
        run.context.${operation}(KEY,prev=>{
          return {mode:'closed',nested:{kind:'a',count:prev.nested.count+(next.step ?? 0)}};
        });
      });
      return r=>r.el('output',[]);
    }});`;
}

describe('Context key contextual value inference', () => {
  it.each(['update', 'tryUpdate'] as const)(
    'checks fresh values and updater returns against the resolved key for %s',
    (operation) => {
      const parsed = parsePrototype(source(operation));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    }
  );

  it.each([
    `{mode:'invalid',nested:{kind:'b',count:1}}`,
    `{mode:'open',nested:{kind:'invalid',count:1}}`,
    `{mode:'open',nested:{kind:'b',count:'not-number'}}`,
    `{mode:'open'}`,
    `null`,
    `{mode:'open',nested:{kind:'b',count:1},leaked:()=>1}`,
  ])('refuses incompatible fresh updater result %s', (result) => {
    const parsed = parsePrototype(`${header}
      export default definePrototype({name:'invalid-context',setup(def){
        def.context.provide(KEY,{mode:'closed',nested:{kind:'a',count:0}});
        def.lifecycle.onCreated(run=>run.context.update(KEY,()=>(${result})));
      }});`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].code).toBe('PUI1006');
  });

  it('does not narrow an already widened updater field or accept a fallthrough return', () => {
    for (const body of [
      `const mode:string='open';return {mode,nested:{kind:'b',count:1}};`,
      `if(prev.nested.count>0)return {mode:'open',nested:{kind:'b',count:1}};`,
    ]) {
      const parsed = parsePrototype(`${header}
        export default definePrototype({name:'invalid-context',setup(def){
          def.context.provide(KEY,{mode:'closed',nested:{kind:'a',count:0}});
          def.lifecycle.onCreated(run=>run.context.update(KEY,prev=>{${body}}));
        }});`);
      expect(parsed.ok).toBe(false);
    }
  });

  it('portable validation refuses a forged updater result after serialization', () => {
    const parsed = parsePrototype(source('update'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const forged = JSON.parse(JSON.stringify(parsed.value));
    let changed = false;
    const mutate = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'literal' && node.value === 'open') {
        node.value = 'invalid';
        node.type = { kind: 'literal', value: 'invalid' };
        changed = true;
      }
      Object.values(node).forEach(mutate);
    };
    mutate(forged.setup);
    expect(changed).toBe(true);
    expect(validateIR(forged).ok).toBe(false);
  });

  for (const operation of ['update', 'tryUpdate'] as const)
    for (const profile of nativeOwnerProfiles)
      it(`preserves ${operation} transitions in an ordinary ${profile} consumer`, async () => {
        const owner = await mountNativeOwner(source(operation), profile);
        cleanup.push(owner.dispose);
        const exposed = owner.handle.getExposes();
        expect(exposed.value()).toBe('open:b:1');
        expect(exposed.trace()).toBe('closed>open|');
        await owner.setProps({ step: 1 });
        expect(exposed.value()).toBe('closed:a:2');
        expect(exposed.trace()).toBe('closed>open|open>closed|');
      });
});
