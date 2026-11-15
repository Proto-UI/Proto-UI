// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR, PrototypeIR } from '../src/ir';

function source(
  body: string,
  effect = 'def.props.setDefaults({enabled:true})',
  after = ''
): string {
  return `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'checked-callback-lifetime',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const defer=(effect:()=>void)=>{${body}};
      defer(()=>{${effect};});${after}
    }});`;
}

function parsed(input: string): PrototypeIR {
  const result = parsePrototype(input);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const portable = validateIR(JSON.parse(JSON.stringify(result.value)));
  if (!portable.ok) throw new Error(JSON.stringify(portable.diagnostics));
  return portable.value;
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

const deferredBodies = [
  'def.lifecycle.onMounted(()=>effect());',
  'const alias=effect;def.lifecycle.onMounted(()=>alias());',
  'const wrapper=()=>effect();def.lifecycle.onMounted(()=>wrapper());',
  'const wrapper=()=>effect();const alias=wrapper;def.lifecycle.onMounted(()=>alias());',
  'def.lifecycle.onMounted(()=>{const wrapper=()=>effect();wrapper();});',
  'const box={effect};def.lifecycle.onMounted(()=>box.effect());',
  'const factory=()=>()=>effect();const later=factory();def.lifecycle.onMounted(later);',
  'const select=(fn:()=>void)=>fn;const later=select(effect);def.lifecycle.onMounted(later);',
  'const later=(next:()=>void=effect)=>next();def.lifecycle.onMounted(()=>later());',
  'def.lifecycle.onMounted(()=>forward());const forward=()=>effect();',
];

describe('ordinary callable execution contexts', () => {
  it.each(deferredBodies)(
    'rejects a known setup effect reached from a registered callback: %s',
    (body) => {
      expect(parsePrototype(source(body))).toMatchObject({
        ok: false,
        diagnostics: [
          { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
        ],
      });
    }
  );

  it.each(deferredBodies)(
    'permits deferred pure callable capture through the same transport: %s',
    (body) => {
      parsed(source(body, 'const ignored=1'));
    }
  );

  it.each([
    'return effect;',
    'return ()=>effect();',
    'return true?effect:()=>{};',
    'const result=()=>effect();return {result};',
  ])('does not execute an ordinary closure merely because it is returned: %s', (body) => {
    parsed(source(body));
  });

  it('checks returned closures when they are actually called in render', () => {
    const input = source('return ()=>effect();').replace(
      'defer(()=>{def.props.setDefaults({enabled:true});});',
      'const later=defer(()=>{def.props.setDefaults({enabled:true});});return ()=>{later();return "rendered";};'
    );
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: 'props.setDefaults is not permitted in render.' }],
    });
  });

  it('does not replace a lexical capture with a same-name caller binding', () => {
    parsed(
      source(
        'const wrap=()=>{const effect=()=>{};return ()=>effect();};def.lifecycle.onMounted(wrap());'
      )
    );
  });

  it('keeps independently supplied callback effects in separate call frames', () => {
    const input = source(
      'def.lifecycle.onMounted(()=>effect());',
      'const ignored=1',
      'defer(()=>def.props.setDefaults({enabled:true}));'
    );
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('preserves later-field overwrite when following a spread callback record', () => {
    parsed(
      source(
        'const first={effect};const last={effect:()=>{}};const copy={...first,...last};def.lifecycle.onMounted(()=>copy.effect());'
      )
    );
  });

  it('checks a synchronous parameter default at the actual call phase', () => {
    const input = `import{definePrototype}from'@proto.ui/core';export default definePrototype({name:'default-phase',setup(def){def.props.define({enabled:{type:'boolean',default:false}});const configure=()=>{def.props.setDefaults({enabled:true});return 1;};const read=(value=configure())=>value;def.lifecycle.onMounted(()=>{read();});}});`;
    expect(parsePrototype(input)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
    parsed(input.replace('read();', 'read(1);'));
  });

  it('rederives a transported callable effect from valid portable identities', () => {
    const ir = parsed(source('effect();def.lifecycle.onMounted(()=>{});'));
    const helper = functions(ir).find((fn) =>
      fn.parameters.some((parameter) => parameter.name === 'effect')
    )!;
    const mounted = functions(ir).find((fn) => fn.context === 'mounted')!;
    const index = helper.body.findIndex(
      (statement) => statement.kind === 'effect' && statement.expression.kind === 'call'
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const parameter = helper.parameters[0];
    mounted.body.push(...helper.body.splice(index, 1));
    mounted.captures = [
      { bindingId: parameter.bindingId!, name: parameter.name, storage: 'value' },
    ];
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('keeps raw capture methods callable during projection and checks their later invocations', () => {
    const input = `import{definePrototype,defineAsHook}from'@proto.ui/core';const install=defineAsHook({name:'raw-method',setup(def){const flag=def.state.bool('flag',false);def.expose.method('prime',()=>flag.setDefault(true));},projectHandle(capture){const prime=capture.getMethod('prime');prime?.();return {prime:()=>prime?.()};}});export default definePrototype({name:'owner',setup(def){const controls=install();}});`;
    parsed(input);
    expect(
      parsePrototype(
        input.replace(
          'const controls=install();',
          'const controls=install();def.lifecycle.onMounted(()=>controls.prime());'
        )
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: 'state.setDefault is not permitted in callback.' }],
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
