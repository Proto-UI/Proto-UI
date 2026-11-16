// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

const source = (body: string) => `
import {createContextKey,definePrototype} from '@proto.ui/core';
const KEY=createContextKey<{value:number}>('context-disposer');
export default definePrototype({name:'context-disposer',setup(def){
  def.context.provide(KEY,{value:0});
  ${body}
}});`;

function checked(body: string): PrototypeIR {
  const parsed = parsePrototype(source(body));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const validated = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!validated.ok) throw new Error(JSON.stringify(validated.diagnostics));
  return validated.value;
}

describe('Context subscription disposers are ordinary callable values', () => {
  it.each(['subscribe', 'trySubscribe'])('calls the direct %s result', (operation) => {
    checked(`const off=def.context.${operation}(KEY,()=>{});off();`);
  });

  it.each(['subscribe', 'trySubscribe'])(
    'captures a later %s result in a deferred callback',
    (operation) => {
      checked(`
      def.context.${operation}(KEY,()=>{offSecond();});
      const offSecond=def.context.${operation}(KEY,()=>{});
    `);
    }
  );

  it.each(['subscribe', 'trySubscribe'])(
    'assigns a %s disposer to an ordinary mutable function binding',
    (operation) => {
      checked(`let off=()=>{};off=def.context.${operation}(KEY,()=>{});off();`);
    }
  );

  it('preserves receiver aliases and ordinary closure transport', () => {
    checked(`
      const definition=def;
      definition.context.subscribe(KEY,()=>{const invoke=(cancel:()=>void)=>cancel();invoke(later);});
      const later=definition.context.subscribe(KEY,()=>{});
      const renamed=later;
      def.expose.method('cancel',()=>renamed());
    `);
  });

  it('does not identify an ordinary function by its Context property spelling', () => {
    checked(`
      const ordinary={context:{subscribe:()=>()=>7}};
      const off=ordinary.context.subscribe();
      const value:number=off();
      def.expose.value('value',value);
    `);
  });

  it('independently rederives the disposer call result in portable IR', () => {
    const ir = checked('const off=def.context.subscribe(KEY,()=>{});off();');
    const last = ir.setup.body.at(-1);
    if (last?.kind !== 'effect' || last.expression.kind !== 'call')
      throw new Error('missing ordinary disposer call');
    expect(last.expression.type).toBe('void');
    last.expression.type = 'number';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
