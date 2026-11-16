// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
const prefix = `import{defineHook,defineAsHook,definePrototype}from'@proto.ui/core';`;
const install = `const install=defineHook<{}, {}, {}, {init:()=>void}>({name:'options',mode:'multiple',setup(def,options){options.init();}});`;
const source = (body: string) =>
  `${prefix}${install}export default definePrototype({name:'owner',setup(def){${body}return r=>r.el('div',[]);}});`;
function checked(input: string) {
  const parsed = parsePrototype(input);
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) throw new Error('source rejected');
  const portable = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
  return parsed.value;
}
it.each([
  `const make=(init:()=>void)=>install({init});const captured=make(()=>{def.state.bool('flag',true);});`,
  `function make(init:()=>void){return install({init});}const alias=make;const captured=alias(()=>{def.state.bool('flag',true);});`,
  `const make=(init:()=>void)=>({handle:install({init})});const captured=make(()=>{def.state.bool('flag',true);}).handle;`,
])('infers capture through an ordinary caller with its actual argument: %s', (body) => {
  const ir = checked(source(`${body}def.expose.value('read',captured.getState?.('flag')?.get());`));
  expect(ir.hooks[0].capture?.states).toEqual([{ name: 'flag', type: 'state:boolean' }]);
});
it('omits an option initializer skipped by a definite once winner', () => {
  const input = source(
    `const first=install({init:()=>{}});const second=install({init:()=>{def.state.bool('unused',true);}});def.expose.value('absent',!!second.getState?.('unused'));`
  ).replace("mode:'multiple'", "mode:'once'");
  expect(checked(input).hooks[0].capture).toEqual({ states: [], methods: [], children: [] });
});
it.each([
  `install({init:()=>{def.state.bool('flag',true);}});install({init:()=>{def.state.numberDiscrete('flag',2);}});`,
  `install({init:()=>{def.expose.method('read',()=>true);}});install({init:()=>{def.expose.method('read',()=>2);}});`,
])('diagnoses incompatible schemas instead of selecting the last installation: %s', (body) => {
  expect(parsePrototype(source(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('Conflicting capture') }],
  });
});
it('rederives actual option contributions before accepting serialized metadata', () => {
  const ir = checked(
    source(`install({init:()=>{def.state.bool('flag',true);def.expose.method('read',()=>true);}});`)
  );
  for (const category of ['states', 'methods'] as const) {
    const forged = JSON.parse(JSON.stringify(ir));
    forged.hooks[0].capture[category] = [];
    expect(validateIR(forged)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('closed-graph installations') },
      ],
    });
  }
});
it('rederives option-installed children without flattening their capture into the parent', () => {
  const ir = checked(
    source(`install({init:()=>{child();}});`).replace(
      install,
      `const child=defineAsHook({name:'child',setup(def){def.state.bool('flag',true);}});${install}`
    )
  );
  const parent = ir.hooks.find((hook) => hook.name === 'options')!;
  expect(parent.capture).toMatchObject({
    states: [],
    children: [{ name: 'child' }],
  });
  const forged = JSON.parse(JSON.stringify(ir));
  forged.hooks.find((hook: any) => hook.id === parent.id).capture.children = [];
  expect(validateIR(forged)).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI2002', message: expect.stringContaining('closed-graph installations') },
    ],
  });
});
it.each([false, true])(
  'checks an activated option body independently of valid metadata: %s',
  (active) => {
    const ir = checked(source(`install({init:()=>{if(${active})def.state.bool('flag',true);}});`));
    const forged = JSON.parse(JSON.stringify(ir));
    const call = forged.setup.body.find(
      (statement: any) =>
        statement.kind === 'effect' && statement.expression.kind === 'authored-hook'
    ).expression;
    const callback = call.arguments[0].entries.find((entry: any) => entry.key === 'init').value
      .function;
    callback.body[0].condition.value = !active;
    expect(validateIR(forged)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('closed-graph installations') },
      ],
    });
  }
);
it('does not turn an ordinary closure into permission to install hooks in a callback', () => {
  const input = `${prefix}const child=defineAsHook({name:'child',setup(){}});export default definePrototype({name:'owner',setup(def){const invoke=()=>child();def.lifecycle.onCreated(()=>invoke());}});`;
  expect(parsePrototype(input)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('setup') }],
  });
});

it('rejects conflicting typed views of a shared once registration name', () => {
  const input = `${prefix}const first=defineAsHook({name:'shared',setup(def){def.state.bool('flag',true);}});const second=defineAsHook({name:'shared',setup(def){def.state.numberDiscrete('flag',2);}});export default definePrototype({name:'shared-owner',setup(){first();second();}});`;
  expect(parsePrototype(input)).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI1006', message: expect.stringContaining('Conflicting capture state types') },
    ],
  });
});
