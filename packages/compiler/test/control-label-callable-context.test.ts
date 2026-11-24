// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { traceCallableDemand } from '../src/callable-effects';
import { functionValueType } from '../src/value-types';
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

function reverseEffectChoice(ir: PrototypeIR): void {
  const declaration = functions(ir)
    .flatMap((fn) => fn.body)
    .find((statement) => statement.kind === 'const' && statement.name === 'effect');
  if (!declaration || declaration.kind !== 'const' || declaration.value.kind !== 'conditional')
    throw new Error('Expected the checked callable choice');
  const choice = declaration.value;
  [choice.then, choice.otherwise] = [choice.otherwise, choice.then];
}

function replaceAliasWrite(ir: PrototypeIR, name: string): void {
  const declaration = ir.setup.body.find(
    (statement) => statement.kind === 'const' && statement.name === name
  );
  const write = ir.setup.body.find(
    (statement) => statement.kind === 'effect' && statement.expression.kind === 'member-write'
  );
  if (!declaration || declaration.kind !== 'const' || declaration.value.kind !== 'function')
    throw new Error('Expected the callable declaration');
  if (!write || write.kind !== 'effect' || write.expression.kind !== 'member-write')
    throw new Error('Expected the alias write');
  // Reuse the checked callable body as an ordinary function expression and keep
  // both recorded types consistent with it, so the portable validator reaches
  // the effect analysis instead of rejecting the rewritten type first.
  const callable = functionValueType(declaration.value.function);
  write.expression.value = {
    kind: 'function',
    type: callable,
    function: declaration.value.function,
    span: declaration.value.span,
  };
  write.expression.type = callable;
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

describe('checked native callable argument escapes', () => {
  const core = `import {definePrototype,defineHook} from '@proto.ui/core';`;

  it('retains checked numeric arguments for direct and computed callback forwarding', () => {
    parsed(`${core}export default definePrototype({name:'numeric-forward',setup(def){
      def.expose.method('apply',(read:(value:number)=>number,value:number)=>{
        read(value);return read(value+1);
      });
    }});`);
  });

  it.each(['warn', 'conflict'])(
    'retains checked computed string arguments for ordinary tools.%s',
    (method) => {
      parsed(`${core}
        const install=defineHook<{}, {}, {}, number>({name:'computed-tool',mode:'configurable',
          setup(){},configure(api,value,tools){tools.${method}('value='+value);}
        });
        export default definePrototype({name:'tool-owner',setup(){install(1);}});`);
    }
  );

  it.each([
    [
      'computed data beside an authored callback',
      `(entry:{value:number;label:string;read:()=>number})=>void`,
      `{value:value+1,label:'value='+value,read:()=>value}`,
    ],
    [
      'additional nested data omitted by the native signature',
      `(entry:{read:()=>number})=>void`,
      `{details:{value:value+1,labels:['value='+value]},read:()=>value}`,
    ],
  ])('preserves mixed record field types: %s', (_label, consumeType, argument) => {
    parsed(`${core}export default definePrototype({name:'mixed-record-forward',setup(def){
      def.expose.method('apply',(consume:${consumeType},value:number)=>{consume(${argument});});
    }});`);
  });

  it('retains checked data fields in a host-supplied mixed record', () => {
    parsed(`${core}export default definePrototype({name:'host-record-forward',setup(def){
      def.expose.method('apply',(
        consume:(entry:{value:number;read:()=>number})=>void,
        entry:{value:number;read:()=>number}
      )=>{consume(entry);});
    }});`);
  });

  it('retains original data field types through a narrower mixed record view', () => {
    parsed(`${core}export default definePrototype({name:'narrow-record-forward',setup(def){
      def.expose.method('apply',(consume:(entry:{read:()=>number})=>void,value:number)=>{
        const entry:{read:()=>number}={value:value+1,read:()=>value};
        consume(entry);
      });
    }});`);
  });

  it('still checks an escaped callable beside computed data in source and portable IR', () => {
    const input = `${core}export default definePrototype({name:'mixed-record-effect',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const configure=()=>{def.props.setDefaults({enabled:true});};
      def.expose.method('apply',(consume:(entry:{read:()=>void})=>void,value:number)=>{
        const effect = false ? configure : () => {};
        consume({value:value+1,read:effect});
      });
    }});`;
    const ir = parsed(input);
    expect(
      parsePrototype(input.replace('false ? configure : () => {}', 'false ? () => {} : configure'))
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
    reverseEffectChoice(ir);
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it.each([
    [
      'native argument escape',
      `def.expose.method('apply',(consume:(effect:()=>void)=>void)=>{
        const effect = false ? unknownCallable() : () => {};
        consume(effect);
      });`,
    ],
    [
      'callable field in a narrower mixed record view',
      `def.expose.method('apply',(consume:(entry:{read:()=>void})=>void)=>{
        const effect = false ? unknownCallable() : () => {};
        const entry:{read:()=>void}={value:1+1,read:effect};
        consume(entry);
      });`,
    ],
    [
      'registered callback',
      `const effect = false ? unknownCallable() : () => {};
       def.lifecycle.onMounted(effect);`,
    ],
  ])('still rejects genuinely unresolved callable provenance at %s', (_label, body) => {
    const input = `${core}export default definePrototype({name:'unresolved-callable',setup(def){
      const unknownCallable=():()=>void=>unknownCallable();
      ${body}
    }});`;
    const ir = parsed(input);
    expect(
      parsePrototype(
        input.replace(
          'false ? unknownCallable() : () => {}',
          'false ? () => {} : unknownCallable()'
        )
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: expect.stringContaining('Callable provenance is not closed') },
      ],
    });
    reverseEffectChoice(ir);
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('Callable provenance is not closed') },
      ],
    });
  });
});

describe('alias writes and mixed record unions', () => {
  const core = `import {definePrototype} from '@proto.ui/core';`;
  const aliasSource = (
    write: string
  ) => `${core}export default definePrototype({name:'alias-write',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const configure=()=>{def.props.setDefaults({enabled:true});};
      const original={value:0,read:()=>{}};
      const outward:{read:()=>void}=original;
      const writable:{value:unknown;read:()=>void}=original;
      ${write}
      def.expose.method('apply',(consume:(entry:{read:()=>void})=>void)=>{consume(outward);});
    }});`;
  const unionSource = (
    condition: string,
    payload: string
  ) => `${core}export default definePrototype({name:'mixed-union',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const unknownCallable=():()=>void=>unknownCallable();
      def.expose.method('apply',(consume:(entry:{read:()=>number;payload:number|(()=>void)})=>void,value:number)=>{
        const entry = ${condition}
          ? {read:()=>value,payload:value+1}
          : {read:()=>value,payload:${payload}};
        consume(entry);
      });
    }});`;

  it.each([
    ['checked numeric data', 'writable.value=1;'],
    ['a pure authored callback', 'writable.value=()=>{};'],
  ])('keeps an alias write of %s legal', (_label, write) => {
    parsed(aliasSource(write));
  });

  it('rejects a setup-only closure written through an alias', () => {
    expect(parsePrototype(aliasSource('writable.value=configure;'))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('preserves checked numeric array-element provenance through an alias', () => {
    // The closed array literal proves this element is pure data. Losing that
    // proof used to make the hidden field appear to contain an unknown callable.
    // `parsed` also independently validates the serialized IR.
    parsed(aliasSource('writable.value=[1][0];'));
  });

  it('rejects the setup-only alias write in portable IR', () => {
    // A legal setup call retains the real body for the hostile IR alias write.
    const ir = parsed(aliasSource('configure();writable.value=1;'));
    replaceAliasWrite(ir, 'configure');
    const portable = validateIR(ir);
    expect(portable.ok).toBe(false);
    if (portable.ok) return;
    expect(portable.diagnostics[0]).toMatchObject({
      code: 'PUI2002',
      message: expect.stringContaining('props.setDefaults is not permitted in'),
    });
  });

  it('retains callable demand for an escaped alias callback', () => {
    // A legal setup call retains the real body for the hostile IR alias write.
    const ir = parsed(aliasSource('configure();writable.value=1;'));
    replaceAliasWrite(ir, 'configure');
    const declaration = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'configure'
    );
    if (!declaration || declaration.kind !== 'const' || declaration.value.kind !== 'function')
      throw new Error('Expected the callable declaration');
    const demanded = new Set<FunctionIR>();
    traceCallableDemand(ir, {
      expression() {},
      function(value) {
        demanded.add(value);
      },
      hook() {},
      opaque() {},
    });
    expect(demanded.has(declaration.value.function)).toBe(true);
  });

  it.each([
    ['a literal true condition', 'true', '()=>value'],
    ['a literal false condition', 'false', '()=>value'],
    ['a runtime boolean condition', 'value > 0', '()=>value'],
  ])('admits the mixed record union with %s', (_label, condition, payload) => {
    parsed(unionSource(condition, payload));
  });

  it('rejects a setup-only callable payload of the mixed record union', () => {
    expect(
      parsePrototype(
        unionSource('value > 0', '()=>{def.props.setDefaults({enabled:true});return value;}')
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('rejects a setup-only callable payload selected by the condition', () => {
    expect(
      parsePrototype(
        unionSource('false', '()=>{def.props.setDefaults({enabled:true});return value;}')
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('rejects an unresolved callable payload of the mixed record union', () => {
    expect(parsePrototype(unionSource('value > 0', 'unknownCallable()'))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: expect.stringContaining('Callable provenance is not closed') },
      ],
    });
  });

  it('rejects an unresolved callable payload selected by the condition', () => {
    expect(parsePrototype(unionSource('false', 'unknownCallable()'))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: expect.stringContaining('Callable provenance is not closed') },
      ],
    });
  });
});
