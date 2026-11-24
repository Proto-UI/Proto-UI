// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const prefix = `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
import type {RunHandle,DefHandle} from '@proto.ui/core';
const FAMILY=createAnatomyFamily('ordinary-role-query',{roles:{root:{cardinality:{min:1,max:1}},content:{cardinality:{min:0,max:'*'}}}});`;
const queries = [
  'anatomy.has',
  'anatomy.partsOf',
  'anatomy.order.partsOf',
  'anatomy.order.indexOfSelf',
  'anatomy.order.prevOfSelf',
  'anatomy.order.nextOfSelf',
] as const;
const source = `${prefix}
type Role='root'|'content';
export default definePrototype({name:'finite-runtime-role',setup(def){
  def.anatomy.claim(FAMILY,{role:'root'});
function inspect(run:RunHandle<{}>,role:Role){
  return {
    has:run.anatomy.has(FAMILY,role),
    count:run.anatomy.partsOf(FAMILY,role)?.length??0,
    ordered:run.anatomy.order.partsOf(FAMILY,role).length,
    index:run.anatomy.order.indexOfSelf(FAMILY,role),
    previous:run.anatomy.order.prevOfSelf(FAMILY,role)!==null,
    next:run.anatomy.order.nextOfSelf(FAMILY,role)!==null,
  };
}
  let current:RunHandle<{}>|null=null;
  def.lifecycle.onCreated(run=>{current=run;});
  def.expose.method('inspect',(role:Role)=>current?inspect(current,role):null);
  return r=>r.el('section','finite role');
}});`;
function portable(): PrototypeIR {
  const parsed = parsePrototype(source, { fileName: 'ordinary-role.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const checked = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  return checked.value;
}
function queryOperations(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'operation' }>[] {
  const operations: Extract<ExpressionIR, { kind: 'operation' }>[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (
      'kind' in value &&
      value.kind === 'operation' &&
      'operation' in value &&
      queries.includes(value.operation as (typeof queries)[number])
    )
      operations.push(value as Extract<ExpressionIR, { kind: 'operation' }>);
    for (const child of Object.values(value)) visit(child);
  }
  visit(ir);
  return operations;
}
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

describe('finite runtime Anatomy role selectors', () => {
  it('admits a module helper with the actual Collapsible role-parameter shape', () => {
    const parsed = parsePrototype(`${prefix}
      function count(run:RunHandle<{}>,role:'root'|'content'){
        return run.anatomy.partsOf(FAMILY,role)?.length??0;
      }
      export default definePrototype({name:'module-role-helper',setup(def){
        def.anatomy.claim(FAMILY,{role:'root'});
        def.lifecycle.onMounted(run=>{count(run,'root');count(run,'content');});
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });

  it('retains the helper formal union through source and serialized IR admission', () => {
    const ir = portable();
    expect(
      queryOperations(ir)
        .map((operation) => operation.operation)
        .sort()
    ).toEqual([...queries].sort());
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
  });

  it.each(['string', "'root'|''", "'root'|null", "'root'|1"])(
    `rejects a non-finite/non-string role domain %s`,
    (role) => {
      const input = `${prefix}
      function inspect(run:RunHandle<{}>,role:${role}){return run.anatomy.partsOf(FAMILY,role);}
      export default definePrototype({name:'invalid-role',setup(def){
        def.anatomy.claim(FAMILY,{role:'root'});
        let current:RunHandle<{}>|null=null;
        def.lifecycle.onCreated(run=>{current=run;});
        def.expose.method('query',(role:${role})=>current?inspect(current,role):null);
      }});`;
      expect(parsePrototype(input)).toMatchObject({ ok: false });
    }
  );

  it('keeps setup subscription role declarations literal-only', () => {
    expect(
      parsePrototype(`${prefix}
      function install(def:DefHandle<{}>,role:'root'|'content'){
        def.anatomy.subscribeParts(FAMILY,role,()=>{});
      }
      export default definePrototype({name:'static-subscription',setup(def){install(def,'content');}});`)
    ).toMatchObject({ ok: false });
  });

  for (const query of queries)
    it(`independently rejects a coherent broad-string IR argument for ${query}`, () => {
      const ir = portable();
      const operation = queryOperations(ir).find((operation) => operation.operation === query)!;
      const literal = (value: string): ExpressionIR => ({
        kind: 'literal',
        value,
        type: 'string',
        span: operation.span,
      });
      // This expression is a valid string computation, but has no finite literal-domain proof.
      operation.arguments[1] = {
        kind: 'binary',
        operator: '+',
        left: literal('ro'),
        right: literal('ot'),
        type: 'string',
        span: operation.span,
      };
      const checked = validateIR(ir);
      expect(checked).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI2002',
            message: expect.stringContaining('finite set of nonempty string keys'),
          },
        ],
      });
    });

  for (const profile of nativeOwnerProfiles)
    it(`queries both role alternatives in real generated ${profile} output`, async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.inspect('root')).toEqual({
        has: true,
        count: 1,
        ordered: 1,
        index: 0,
        previous: false,
        next: false,
      });
      expect(api.inspect('content')).toEqual({
        has: false,
        count: 0,
        ordered: 0,
        index: -1,
        previous: false,
        next: false,
      });
      expect(api.inspect('root')).toEqual({
        has: true,
        count: 1,
        ordered: 1,
        index: 0,
        previous: false,
        next: false,
      });
    });
});
