// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

function checked(source: string): PrototypeIR {
  const result = parsePrototype(source);
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error('source rejected');
  const portable = validateIR(JSON.parse(JSON.stringify(result.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
  return result.value;
}
function pointer(body: string): string {
  return `import{definePrototype}from'@proto.ui/core';export default definePrototype({name:'identity-flow',setup(def){def.event.on('pointer.move',(_run,event)=>{${body}});}});`;
}
function anatomy(body: string): string {
  return `import{definePrototype,createAnatomyFamily}from'@proto.ui/core';
  const FAMILY=createAnatomyFamily('parts',{roles:{root:{cardinality:{min:1,max:1}},item:{cardinality:{min:0,max:'*'}}}});
  export default definePrototype({name:'part-flow',setup(def){
    def.anatomy.claim(FAMILY,{role:'root'});
    def.anatomy.subscribeParts(FAMILY,'item',(_run,parts)=>{${body}});
  }});`;
}
function records(value: unknown): Record<string, any>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(records);
  return [value as Record<string, any>, ...Object.values(value).flatMap(records)];
}

it.each(['mixed === event', 'event === mixed', '!(mixed !== event)', '!(event !== mixed)'])(
  'keeps nominal event identity stronger than an ordinary presence proof: %s',
  (guard) => {
    checked(
      pointer(`const choose=(flag:boolean)=>{if(flag)return event;return event.control;};
      const mixed=choose(true);if(${guard}){const fact=mixed.pointerType;}`)
    );
  }
);
it.each(['mixed !== event', 'mixed === mixed', 'event === event', 'mixed'])(
  'does not create payload authority from an insufficient identity proof: %s',
  (guard) => {
    expect(
      parsePrototype(
        pointer(`const choose=(flag:boolean)=>{if(flag)return event;return event.control;};
        const mixed=choose(true);if(${guard}){const fact=mixed.pointerType;}`)
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  }
);
it.each([
  `const first=parts[0]??null;if(first!==null){const role=first.role;}`,
  `const first=parts[0]??null;if(null!==first){const role=first.role;}`,
  `const first=parts[0];if(first){const role=first.role;}`,
  `const role=parts[0]?.role;`,
])('refines an Anatomy part without erasing its nominal identity: %s', (body) => {
  checked(anatomy(body));
});
it.each([
  `const first=parts[0]??null;const role=first.role;`,
  `const first=parts[0]??null;if(first===null){const role=first.role;}`,
  `const first=parts[0];const role=first.role;`,
])('keeps nullish Anatomy parts inaccessible without evidence: %s', (body) => {
  expect(parsePrototype(anatomy(body))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1006' }],
  });
});

it('normalizes nested callable control results from their checked bodies without mutating input', () => {
  const current = checked(
    pointer(`const get=()=>()=>event.control;const returned=get();const same=returned()===event.control;`)
  );
  const legacy = JSON.parse(JSON.stringify(current));
  for (const node of records(legacy))
    for (const key of ['type', 'returnType'])
      if (node[key] === 'event-control' || node[key] === 'event-or-control') node[key] = 'event';
  const before = JSON.stringify(legacy);
  const result = validateIR(legacy);
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
  expect(JSON.stringify(legacy)).toBe(before);
  if (!result.ok) return;
  expect(result.value).toEqual(current);
  const second = validateIR(result.value);
  expect(second.ok).toBe(true);
  if (second.ok) expect(second.value).toBe(result.value);
});
it('does not normalize a forged callable parameter into proven event authority', () => {
  const ir = checked(pointer(`const get=(value:number)=>event.control;const same=get(1)===event.control;`));
  const forged = JSON.parse(JSON.stringify(ir));
  const expression = records(forged).find(
    (node) => node.kind === 'function' && node.function.parameters[0]?.name === 'value'
  )!;
  expression.type.parameters[0].type = 'event';
  expression.type.returnType = 'event';
  expect(validateIR(forged)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI2002' }],
  });
});
