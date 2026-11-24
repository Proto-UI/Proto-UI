// @vitest-environment node
import { expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { FlowProof } from '../src/flow-proof';
import type { ExpressionIR, PrototypeIR } from '../src/ir';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';

function source(tail = 'if(run)run.update();'): string {
  return `import {definePrototype,type RunHandle}from'@proto.ui/core';
  export default definePrototype({name:'joined-signal-proof',setup(def){
    def.props.define({disabled:{type:'boolean',default:false}});
    const value=def.state.numberRange('value',0,{min:0,max:1});
    let run:RunHandle<{disabled?:boolean}>|null=null;let disposed=false;let epoch=0;
    const current=(ticket:number)=>!disposed&&run!==null&&epoch===ticket;
    const publish=()=>{value.set(1,'signal');return true;};
    def.expose.method('sample',()=>{
      if(!run)return false;
      const ticket=epoch;
      value.set(0,'signal');
      if(!current(ticket)||!publish())return false;
      ${tail}
      return true;
    });
    def.lifecycle.onMounted(handle=>{run=handle;});
  }});`;
}

it.each([
  'react-runtime-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
  'gpui-source-v1',
])('preserves a fresh handle guard after a nested predicate and signal in %s', (profile) => {
  const result = compilePrototype(source(), { profile });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
  if (result.ok) {
    const cold = validateIR(JSON.parse(JSON.stringify(result.value.ir)));
    expect(cold.ok, JSON.stringify(cold.ok ? {} : cold.diagnostics)).toBe(true);
  }
});

it('does not retain the nested predicate as a proof after an intervening write', () => {
  const unsafe = `import{definePrototype}from'@proto.ui/core';
  export default definePrototype({name:'stale-joined-predicate',setup(def){
    let value:{n:number}|null={n:1};let disposed=false;let epoch=0;
    const current=(ticket:number)=>!disposed&&value!==null&&epoch===ticket;
    const clear=()=>{value=null;return true;};
    def.expose.method('read',()=>{
      if(!current(epoch)||!clear())return -1;
      return value.n;
    });
  }});`;
  expect(parsePrototype(unsafe)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1006' }],
  });
});

it('rejects a cold IR read forged to reuse the stale non-null predicate', () => {
  const parsed = parsePrototype(source());
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir: PrototypeIR = JSON.parse(JSON.stringify(parsed.value));
  const sample = ir.setup.body.find(
    (statement) =>
      statement.kind === 'effect' &&
      statement.expression.kind === 'operation' &&
      statement.expression.operation === 'expose.method'
  );
  if (sample?.kind !== 'effect' || sample.expression.kind !== 'operation')
    throw new Error('missing exposed method');
  const callback = sample.expression.arguments[1];
  if (callback.kind !== 'function') throw new Error('missing method body');
  const guard = callback.function.body.at(-2);
  if (guard?.kind !== 'if' || guard.condition.kind !== 'lexical-read')
    throw new Error('missing fresh handle guard');
  expect(guard.condition.type).not.toBe('run');
  guard.condition.type = 'run';
  expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
});

it('keeps conflicting sibling observations stale when a serialized node is shared', () => {
  const span = {
    file: 'shared.proto.ts',
    start: 0,
    end: 1,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 2,
  };
  const read: ExpressionIR = {
    kind: 'lexical-read',
    cell: { kind: 'reference', name: 'value', type: 'lexical:number', span },
    type: 'number',
    span,
  };
  const original = new FlowProof(new Set());
  const before = original.fork();
  before.observe(read);
  const after = original.fork();
  after.call();
  after.observe(read);
  const joined = original.join([before, after]);
  expect(joined.current(read)).toBe(false);
  const copy: ExpressionIR = JSON.parse(JSON.stringify(read));
  joined.copyObservation(read, copy);
  expect(joined.current(copy)).toBe(false);

  // When all continuing paths observe the shared node again, an earlier
  // incoming observation is no longer a possible value at the join.
  original.observe(read);
  original.call();
  const left = original.fork();
  const right = original.fork();
  left.observe(read);
  right.observe(read);
  expect(original.join([left, right]).current(read)).toBe(true);

  // Long sequential control flow must not turn a valid retained observation
  // into a host-language stack overflow while independently importing IR.
  let deep = original;
  for (let index = 0; index < 4000; index++) {
    const branch = deep.fork();
    branch.call();
    deep = deep.join([branch]);
  }
  expect(deep.current(read)).toBe(false);
});
