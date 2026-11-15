import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR, PrototypeIR } from '../src/ir';

function source(body: string): string {
  return `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'checked-callback-lifetime',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const defer=(effect:()=>void)=>{${body}};
      defer(()=>def.props.setDefaults({enabled:true}));
    }});`;
}

function parsed(input: string): PrototypeIR {
  const result = parsePrototype(input);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function functions(ir: PrototypeIR): FunctionIR[] {
  const result: FunctionIR[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if ('parameters' in value && 'body' in value) result.push(value as FunctionIR);
    Object.values(value).forEach(visit);
  };
  visit(ir);
  return result;
}

describe('checked helper callable lifetime', () => {
  it.each([
    'def.lifecycle.onMounted(()=>effect());',
    'const alias=effect; def.lifecycle.onMounted(()=>alias());',
    'const wrapper=()=>effect(); def.lifecycle.onMounted(()=>wrapper());',
    'const wrapper=()=>effect(); const alias=wrapper; def.lifecycle.onMounted(()=>alias());',
    'def.lifecycle.onMounted(()=>{const wrapper=()=>effect(); wrapper();});',
    'def.lifecycle.onMounted(()=>{}); return renderer=>{effect(); return renderer.slot();};',
    'return effect;',
    'const wrapper=()=>effect(); return wrapper;',
    'return true ? effect : () => {};',
  ])('rejects deferred callable capture or return: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: expect.stringMatching(/callable parameters cannot/) },
      ],
    });
  });

  it('rejects a concise returned helper which closes over a callable parameter', () => {
    const input = source('effect();').replace(
      'const defer=(effect:()=>void)=>{effect();}',
      'const defer=(effect:()=>void)=>()=>effect()'
    );
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: expect.stringMatching(/returned function/) }],
    });
  });

  it.each([
    { declaration: '', invoke: 'effect' },
    { declaration: 'const alias=effect;', invoke: 'alias' },
    { declaration: 'const wrapper=()=>effect();', invoke: 'wrapper' },
    { declaration: 'const wrapper=()=>effect(); const alias=wrapper;', invoke: 'alias' },
  ])('validates imported IR capture through $invoke', ({ declaration, invoke }) => {
    const ir = structuredClone(
      parsed(source(`${declaration} ${invoke}(); def.lifecycle.onMounted(()=>{});`))
    );
    const helper = functions(ir).find((fn) =>
      fn.parameters.some((parameter) => parameter.callback)
    )!;
    const mounted = functions(ir).find((fn) => fn.context === 'mounted')!;
    const index = helper.body.findIndex(
      (statement) =>
        statement.kind === 'effect' &&
        statement.expression.kind === 'helper-call' &&
        statement.expression.name === invoke
    );
    mounted.body.push(...helper.body.splice(index, 1));
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI2002',
          message: expect.stringMatching(/callable parameters cannot be captured/),
        },
      ],
    });
  });

  it('validates imported IR callable returns', () => {
    const ir = structuredClone(parsed(source('effect();')));
    const helper = functions(ir).find((fn) =>
      fn.parameters.some((parameter) => parameter.callback)
    )!;
    helper.returnType = 'function';
    helper.body = [
      {
        kind: 'return',
        value: { kind: 'reference', name: 'effect', type: 'function', span: helper.span },
        span: helper.span,
      },
    ];
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringMatching(/returned function/) }],
    });
  });

  it('keeps synchronous aliases, wrapper helpers and checked default callbacks', () => {
    const ir = parsed(`import {definePrototype,type RunHandle} from '@proto.ui/core';
      import {asControlLabel} from '@proto.ui/hooks';
      export default definePrototype({name:'synchronous-current',setup(def){
        def.expose.event('commit',{payload:'void'});
        const invoke=(effect:()=>boolean)=>effect();
        const apply=(run:RunHandle<{}>,current:()=>boolean=()=>true)=>{
          const alias=current;
          const wrapper=()=>invoke(alias);
          if(wrapper())run.expose.emit('commit');
        };
        asControlLabel().target((run,request)=>apply(run,()=>request.isCurrent()));
        def.lifecycle.onMounted(run=>apply(run));
      }});`);
    expect(validateIR(ir).ok).toBe(true);
  });

  it('allows callbacks created and consumed synchronously inside a registered callback', () => {
    const ir = parsed(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'callback-local-helper',setup(def){
        def.lifecycle.onMounted(()=>{
          const apply=(current:()=>boolean)=>{const wrapper=()=>current();return wrapper();};
          apply(()=>true);
        });
      }});`);
    expect(validateIR(ir).ok).toBe(true);
  });
});
