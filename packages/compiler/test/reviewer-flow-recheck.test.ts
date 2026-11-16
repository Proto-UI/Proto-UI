// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (body: string) => `import{definePrototype}from'@proto.ui/core';
  export default definePrototype({name:'review-flow-recheck',setup(def){${body}}});`;

it.each([
  `let value:number|null=1;const clear=()=>{value=null;};if(value!==null){clear();const invalid:number=value;def.expose.value('invalid',invalid);}`,
  `const box:{value:number|null}={value:1};const alias=box;if(box.value!==null){alias.value=null;const invalid:number=box.value;def.expose.value('invalid',invalid);}`,
  `let value:number|null=1;if(value!==null){try{value=null;}finally{}const invalid:number=value;def.expose.value('invalid',invalid);}`,
])('rejects an original stale source proof after an intervening write: %s', (body) => {
  expect(parsePrototype(source(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1006' }],
  });
});

it.each([
  `let value:number|null=1;const clear=()=>{value=null;};
   if(value!==null){const invalid:number=value;def.expose.value('invalid',invalid);}clear();`,
  `const box:{value:number|null}={value:1};const alias=box;
   if(box.value!==null){const invalid:number=box.value;def.expose.value('invalid',invalid);}alias.value=null;`,
  `let value:number|null=1;
   if(value!==null){const invalid:number=value;def.expose.value('invalid',invalid);}try{value=null;}finally{}`,
])('rejects a serialized IR proof moved across its actual invalidating operation: %s', (body) => {
  const parsed = parsePrototype(source(body));
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error('expected the valid pre-mutation control');
  const ir = JSON.parse(JSON.stringify(parsed.value));
  expect(validateIR(ir).ok).toBe(true);
  const index = ir.setup.body.findIndex((statement: { kind: string }) => statement.kind === 'if');
  expect(index).toBeGreaterThanOrEqual(0);
  const mutation = ir.setup.body.splice(index + 1, 1)[0];
  expect(['effect', 'try']).toContain(mutation.kind);
  ir.setup.body[index].then.unshift(mutation);
  expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
});

it('rejects the original source which previously crashed the generated React consumer', () => {
  expect(
    parsePrototype(
      source(`def.expose.method('read',()=>{
    let value:{n:number}|null={n:1};const clear=()=>{value=null;};
    if(value!==null){clear();return value.n;}return -1;
  });`)
    )
  ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
});

it.each([
  `let value:number|null=1;const clear=()=>{value=null;};
   if(value!==null){clear();if(value!==null){const valid:number=value;}}`,
  `let value:number|null=1;const clear=()=>{value=null;};
   if(value!==null){const snapshot=value;clear();const valid:number=snapshot;}`,
  `let value:number|null=1;const read=()=>1;
   if(value!==null){read();const valid:number=value;}`,
])('preserves a fresh guard, immutable observation, or known readonly call: %s', (body) => {
  const parsed = parsePrototype(source(body));
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (parsed.ok) expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
});
