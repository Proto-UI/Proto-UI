// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import type { ExpressionIR, PrototypeIR } from '../src/ir';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';

const declaration = `import {createContextKey,definePrototype} from '@proto.ui/core';
type Value={orientation:'horizontal'|'vertical';mode:'automatic'|'manual';
  nested:{status:'idle'};directions:readonly ('horizontal'|'vertical')[]};
const KEY=createContextKey<Value>('context-order');`;
const initial = `{orientation:'horizontal',mode:'automatic',nested:{status:'idle'},directions:['horizontal']}`;
const retained = `{orientation:'horizontal',mode:'automatic',nested,directions:[]}`;
const invalidated = retained.replace('directions:[]', 'directions:mutate()');
const mutation = `const nested:{status:'idle'|'active'}={status:'idle'};
  const mutate=()=>{nested.status='active';return [];};`;
const source = (body: string) => `${declaration}
export default definePrototype({name:'context-order',setup(def){${body}}});`;
const wrappers = [
  ['direct', (value: string) => value],
  ['assertion', (value: string) => `(${value} as Value)`],
  ['spread', (value: string) => `({...(${value} as Value)})`],
  ['intrinsic', (value: string) => `(Object.freeze(${value}) as Value)`],
  ['ordinary call', (value: string) => `keep(${value} as Value)`],
] as const;

function checked(input: string): PrototypeIR {
  const parsed = parsePrototype(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const restored = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!restored.ok) throw new Error(JSON.stringify(restored.diagnostics));
  expect(compilePrototype(input, { profile: 'web-component-source-v1' })).toMatchObject({
    ok: true,
  });
  return restored.value;
}

function contextRecord(expression: ExpressionIR): Extract<ExpressionIR, { kind: 'record' }> {
  let record: Extract<ExpressionIR, { kind: 'record' }> | undefined;
  JSON.stringify(expression, (_key, value) => {
    if (
      value?.kind === 'record' &&
      value.entries?.some((entry: { key: string }) => entry.key === 'directions')
    )
      record = value;
    return value;
  });
  if (!record) throw new Error('missing Context record');
  return record;
}

function moveMutationIntoRecord(
  record: Extract<ExpressionIR, { kind: 'record' }>,
  mutation: ExpressionIR
) {
  record.entries.find((entry) => entry.key === 'directions')!.value = mutation;
  // Calls return ordinary arrays, whereas a contextual empty array is finite data.
  // Keep the modified record's complete shape accurate so the replay tests order.
  record.type = {
    kind: 'object',
    fields: record.entries.map(({ key, value }) => ({ name: key, type: value.type })),
  };
}

describe('Context aggregate evaluation order', () => {
  const snapshotSource = (read: string) =>
    `import{definePrototype,createContextKey}from'@proto.ui/core';
    const KEY=createContextKey<{items:readonly number[];value:number}>('snapshot-order');
    export default definePrototype({name:'snapshot-order',setup(def){
      def.props.define({value:{type:'number',empty:'fallback'}});
      def.props.setDefaults({value:1});
      const value=def.state.numberDiscrete('value',1);const items=[1];
      const changed=()=>{items.push(2);return value;};
      def.context.provide(KEY,{items:[1],value:1});
      def.lifecycle.onCreated(run=>run.context.update(KEY,{items,value:${read}}));
    }});`;

  it.each(['value.get()', 'run.props.get().value'])(
    'retains shared data before the checked snapshot observation %s',
    (read) => {
      checked(snapshotSource(read));
    }
  );

  it('checks the receiver evaluation before a pure State observation', () => {
    expect(parsePrototype(snapshotSource('changed().get()'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it('rechecks a forged effectful receiver independently of the snapshot operation', () => {
    const ir = checked(
      snapshotSource('value.get()').replace(
        'run=>run.context.update(KEY,{items,value:value.get()})',
        'run=>{run.context.update(KEY,{items,value:value.get()});changed().get();}'
      )
    );
    let callback: Extract<ExpressionIR, { kind: 'function' }> | undefined;
    JSON.stringify(ir, (_key, value) => {
      if (value?.kind === 'operation' && value.operation === 'lifecycle.onCreated')
        callback = value.arguments[0];
      return value;
    });
    const [update, changed] = callback?.function.body ?? [];
    if (
      update?.kind !== 'effect' ||
      update.expression.kind !== 'operation' ||
      changed?.kind !== 'effect' ||
      changed.expression.kind !== 'operation'
    )
      throw new Error('missing original update and later receiver effect');
    const aggregate = update.expression.arguments[1];
    if (aggregate.kind !== 'record') throw new Error('missing Context aggregate');
    const read = aggregate.entries.find((entry) => entry.key === 'value')?.value;
    if (read?.kind !== 'operation' || read.operation !== 'state.get')
      throw new Error('missing snapshot operation');
    read.receiver = changed.expression.receiver;
    callback!.function.body = [update];
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringContaining('retain shared values') }],
    });
  });

  const scalarSource = (
    body: string
  ) => `import {createContextKey,definePrototype} from '@proto.ui/core';
    type Value={nested:{status:'idle'};n:number};
    const KEY=createContextKey<Value>('context-scalar-order');
    export default definePrototype({name:'context-scalar-order',setup(def){${body}}});`;

  it.each(['Number.isFinite(1)?1:0', 'Math.abs(-1)', "Number.parseInt('1',10)"])(
    'preserves checked scalar intrinsic %s after a shared field',
    (value) => {
      checked(
        scalarSource(`const nested:{status:'idle'}={status:'idle'};
        def.context.provide(KEY,{nested,n:${value}});`)
      );
    }
  );

  it('preserves a scalar-only object spread before an ordinary helper call', () => {
    checked(
      scalarSource(`const nested:{status:'idle'}={status:'idle'};const one=()=>1;
      def.context.provide(KEY,{nested:{...nested},n:one()});`)
    );
  });

  it('preserves a scalar-only object snapshot before its source is mutated', () => {
    checked(
      scalarSource(`const nested:{status:'idle'|'active'}={status:'idle'};
      const one=()=>{nested.status='active';return 1;};
      if(nested.status==='idle')def.context.provide(KEY,{nested:{...nested},n:one()});`)
    );
  });

  it('preserves a scalar-only array snapshot before its source is mutated', () => {
    checked(`import {createContextKey,definePrototype} from '@proto.ui/core';
      const KEY=createContextKey<{items:readonly number[];n:number}>('context-array-snapshot');
      export default definePrototype({name:'context-array-snapshot',setup(def){
        const items=[1];const one=()=>{items.push(2);return 1;};
        def.context.provide(KEY,{items:[...items],n:one()});
      }});`);
  });

  it.each(['??', '||', '&&'])(
    'preserves mutually exclusive %s operands without retaining the discarded left value',
    (operator) => {
      checked(
        scalarSource(`const make=():Value=>({nested:{status:'idle'},n:1});
        const install=(value:${operator === '&&' ? 'Value' : 'Value|null'})=>{
          def.context.provide(KEY,value${operator}make());
        };install(${operator === '&&' ? "{nested:{status:'idle'},n:0}" : 'null'});`)
      );
    }
  );

  it('does not retain a discarded object through a scalar short-circuit result', () => {
    checked(`import {createContextKey,definePrototype} from '@proto.ui/core';
      const KEY=createContextKey<{nested:{status:'idle'};text:string;n:number}>('context-scalar-result');
      export default definePrototype({name:'context-scalar-result',setup(def){
        const nested:{status:'idle'}={status:'idle'};const one=()=>1;
        def.context.provide(KEY,{nested:{status:'idle'},text:nested&&'ok',n:one()});
      }});`);
  });

  it('still checks effects inside a known scalar intrinsic argument', () => {
    expect(
      parsePrototype(
        scalarSource(`const nested:{status:'idle'|'active'}={status:'idle'};
      const mutate=()=>{nested.status='active';return -1;};
      if(nested.status==='idle')def.context.provide(KEY,{nested,n:Math.abs(mutate())});`)
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it('rechecks a JSON-restored mutation inside a scalar intrinsic argument', () => {
    const ir = checked(
      scalarSource(`const nested:{status:'idle'|'active'}={status:'idle'};
      const mutate=()=>{nested.status='active';return -1;};
      if(nested.status==='idle'){
        def.context.provide(KEY,{nested,n:Math.abs(-1)});mutate();
      }`)
    );
    const branch = ir.setup.body.find((statement) => statement.kind === 'if');
    if (branch?.kind !== 'if') throw new Error('missing scalar Context guard');
    const [provide, mutate] = branch.then;
    if (
      provide.kind !== 'effect' ||
      provide.expression.kind !== 'operation' ||
      mutate.kind !== 'effect'
    )
      throw new Error('missing scalar provider and later mutation');
    const record = provide.expression.arguments[1];
    if (record.kind !== 'record') throw new Error('missing scalar Context record');
    const intrinsic = record.entries.find((entry) => entry.key === 'n')!.value;
    if (intrinsic.kind !== 'intrinsic') throw new Error('missing scalar intrinsic');
    intrinsic.arguments[0] = mutate.expression;
    branch.then = [provide];
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringContaining('retain shared values') }],
    });
  });

  it.each(['??', '||', '&&'])('still checks mutation in a later %s field', (operator) => {
    expect(
      parsePrototype(
        scalarSource(`const nested:{status:'idle'|'active'}={status:'idle'};
      const mutate=()=>{nested.status='active';return 1;};
      const install=(value:${operator === '&&' ? 'number' : 'number|null'})=>{
        if(nested.status==='idle')def.context.provide(KEY,{nested,n:value${operator}mutate()});
      };install(${operator === '&&' ? '1' : 'null'});`)
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it('retains shared nested objects across a shallow spread', () => {
    expect(
      parsePrototype(
        scalarSource(`const nested:{status:'idle'|'active'}={status:'idle'};
      const mutate=()=>{nested.status='active';return 1;};
      if(nested.status==='idle')def.context.provide(KEY,{...{nested},n:mutate()});`)
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it.each(wrappers)(
    'rejects a retained alias before a later mutation through %s',
    (_label, wrap) => {
      const input = source(`${mutation}const keep=(value:Value)=>value;
      if(nested.status==='idle')def.context.provide(KEY,${wrap(invalidated)});`);
      for (const result of [
        parsePrototype(input),
        compilePrototype(input, { profile: 'web-component-source-v1' }),
      ]) {
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            { code: 'PUI1006', message: expect.stringContaining('retain shared values') },
          ],
        });
      }
    }
  );

  it.each(['update', 'tryUpdate'])('checks the same order for a direct %s value', (operation) => {
    const input = source(`def.context.provide(KEY,${initial});
      def.context.${operation === 'tryUpdate' ? 'trySubscribe' : 'subscribe'}(KEY);
      def.lifecycle.onCreated(run=>{${mutation}
        if(nested.status==='idle')run.context.${operation}(KEY,${invalidated});
      });`);
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it.each(['update', 'tryUpdate'])('checks a typed inline %s updater return', (operation) => {
    const input = source(`def.context.provide(KEY,${initial});
      def.context.${operation === 'tryUpdate' ? 'trySubscribe' : 'subscribe'}(KEY);
      def.lifecycle.onCreated(run=>{run.context.${operation}(KEY,():Value=>{
        ${mutation}if(nested.status==='idle')return ${invalidated};return ${initial};
      });});`);
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });

  it.each(wrappers)(
    'rechecks JSON-restored IR through %s without source re-reading',
    (_label, wrap) => {
      const ir = checked(
        source(`${mutation}const keep=(value:Value)=>value;
      if(nested.status==='idle'){def.context.provide(KEY,${wrap(retained)});mutate();}`)
      );
      const branch = ir.setup.body.find((statement) => statement.kind === 'if');
      if (branch?.kind !== 'if') throw new Error('missing Context guard');
      const [provide, mutate] = branch.then;
      if (
        provide.kind !== 'effect' ||
        provide.expression.kind !== 'operation' ||
        mutate.kind !== 'effect'
      )
        throw new Error('missing provider and later mutation');
      const record = contextRecord(provide.expression.arguments[1]);
      moveMutationIntoRecord(record, mutate.expression);
      JSON.stringify(provide.expression.arguments[1], (_key, value) => {
        if (value?.kind === 'intrinsic' && value.name === 'object.freeze')
          value.type = value.arguments[0].type;
        return value;
      });
      branch.then = [provide];
      expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
        ok: false,
        diagnostics: [
          { code: 'PUI2002', message: expect.stringContaining('retain shared values') },
        ],
      });
    }
  );

  it('rechecks a JSON-restored updater return independently', () => {
    const ir = checked(
      source(`def.context.provide(KEY,${initial});def.context.subscribe(KEY);
      def.lifecycle.onCreated(run=>{run.context.update(KEY,():Value=>{
        ${mutation}if(nested.status==='idle'){return ${retained};mutate();}return ${initial};
      });});`)
    );
    let update: Extract<ExpressionIR, { kind: 'operation' }> | undefined;
    JSON.stringify(ir, (_key, value) => {
      if (value?.kind === 'operation' && value.operation === 'context.update') update = value;
      return value;
    });
    const updater = update?.arguments[1];
    if (updater?.kind !== 'function') throw new Error('missing Context updater');
    const branch = updater.function.body.find((statement) => statement.kind === 'if');
    if (branch?.kind !== 'if') throw new Error('missing updater guard');
    const [returned, mutate] = branch.then;
    if (returned.kind !== 'return' || !returned.value || mutate.kind !== 'effect')
      throw new Error('missing return and mutation');
    moveMutationIntoRecord(contextRecord(returned.value), mutate.expression);
    branch.then = [returned];
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringContaining('retain shared values') }],
    });
  });

  it('keeps fresh nested literal admission for provide and direct update', () => {
    checked(
      source(`def.context.provide(KEY,${initial});def.context.subscribe(KEY);
      def.lifecycle.onCreated(run=>{run.context.update(KEY,{
        orientation:'vertical',mode:'manual',nested:{status:'idle'},directions:[]});});`)
    );
  });

  it.each([
    ['alias without a later effect', retained],
    [
      'pure later expression',
      retained.replace('directions:[]', "directions:nested.status==='idle'?[]:[]"),
    ],
    [
      'scalar snapshot',
      retained.replace('nested,directions:[]', 'nested:{status:nested.status},directions:mutate()'),
    ],
    [
      'fresh data before a call',
      initial.replace("directions:['horizontal']", 'directions:mutate()'),
    ],
  ])('preserves %s', (_label, value) => {
    checked(source(`${mutation}if(nested.status==='idle')def.context.provide(KEY,${value});`));
  });

  it('rejects a retained array element before a later element mutates it', () => {
    const input = `import {createContextKey,definePrototype} from '@proto.ui/core';
      const KEY=createContextKey<{items:readonly {status:'idle'}[]}>('context-array-order');
      export default definePrototype({name:'context-array-order',setup(def){
        const nested:{status:'idle'|'active'}={status:'idle'};
        const mutate=():{status:'idle'}=>{nested.status='active';return {status:'idle'};};
        if(nested.status==='idle')def.context.provide(KEY,{items:[nested,mutate()]});
      }});`;
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('retain shared values') }],
    });
  });
});
