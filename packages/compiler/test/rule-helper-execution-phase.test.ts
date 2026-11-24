import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR, PrototypeIR } from '../src/ir';

const declaration = `def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(tw('p-1'))});`;
const source = (body: string, alias = false) => `
import {definePrototype,tw,type DefHandle} from '@proto.ui/core';
function paint(def:DefHandle){${alias ? `const cdef=def;${declaration.replace('def.rule', 'cdef.rule')}` : declaration}}
export default definePrototype({name:'rule-helper-phase',setup(def){${body}}});`;

function parsed(input: string): PrototypeIR {
  const result = parsePrototype(input);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return JSON.parse(JSON.stringify(result.value));
}

function functions(value: unknown): FunctionIR[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(functions);
  const object = value as Record<string, unknown>;
  return [
    ...('parameters' in object && 'body' in object && 'phase' in object
      ? [object as unknown as FunctionIR]
      : []),
    ...Object.values(object).flatMap(functions),
  ];
}

describe.each([false, true])('Rule helper with receiver alias=%s', (alias) => {
  it('accepts a synchronous setup call in source and cold IR', () => {
    const ir = parsed(source('paint(def);', alias));
    expect(validateIR(ir)).toMatchObject({ ok: true });
  });

  it.each([
    ['mounted', 'def.lifecycle.onMounted(()=>paint(def));', 'callback'],
    ['public method', "def.expose.method('paint',()=>paint(def));", 'callback'],
    ['render', "return r=>{paint(def);return r.el('div',[]);};", 'render'],
  ])('checks the actual %s invocation phase', (_name, body, phase) => {
    expect(parsePrototype(source(body, alias))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: `rule.declare is not permitted in ${phase}.` }],
    });
  });
});

it.each([
  ['mounted', 'paint(def);def.lifecycle.onMounted(()=>{});', 'callback'],
  ['helper', "paint(def);def.expose.method('paint',()=>{});", 'callback'],
  ['render', "paint(def);return r=>r.el('div',[]);", 'render'],
])('rederives a transported Rule helper call in %s', (context, body, phase) => {
  const ir = parsed(source(body));
  const mounted = functions(ir).find(
    (fn) => fn.context === context && (context !== 'helper' || fn.body.length === 0)
  )!;
  const parameter = ir.setup.parameters[0];
  mounted.body.unshift(...ir.setup.body.splice(0, 1));
  mounted.captures = [{ bindingId: parameter.bindingId!, name: parameter.name, storage: 'value' }];
  expect(validateIR(ir)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI2002', message: `rule.declare is not permitted in ${phase}.` }],
  });
});

it('keeps a dormant ordinary Rule helper outside host admission', () => {
  expect(validateIR(parsed(source('')))).toMatchObject({ ok: true });
});

const raw = (body: string) => `
import {definePrototype,defineAsHook,tw,type DefHandle} from '@proto.ui/core';
function paint(def:DefHandle){${declaration}}
const install=defineAsHook({name:'raw-rule-guard',setup(def){
  const box={invoke:()=>{}};
  const illegal=()=>{def.state.bool('illegal',true);};
  def.expose.method('prime',()=>{${body}});
  return r=>{box.invoke();return r.el('div',[]);};
}});
export default definePrototype({name:'raw-rule-owner',setup(){install();}});`;

it('stops an implicit raw public entry at the real Rule phase guard', () => {
  expect(validateIR(parsed(raw('paint(def);box.invoke=illegal;')))).toMatchObject({ ok: true });
});

it.each([
  'box.invoke=illegal;paint(def);',
  'try{paint(def);}catch{box.invoke=illegal;}',
  'try{paint(def);}finally{box.invoke=illegal;}',
])('preserves effects before and across a guarded Rule throw: %s', (body) => {
  expect(parsePrototype(raw(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('render') }],
  });
});
