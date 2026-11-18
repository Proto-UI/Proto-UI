// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = (body: string) =>
  `import{definePrototype}from'@proto.ui/core';export default definePrototype({name:'lexical-initialization',setup(def){${body}return r=>r.el('div',[]);}});`;
function checked(body: string) {
  const result = parsePrototype(source(body));
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error('source rejected');
  const portable = validateIR(JSON.parse(JSON.stringify(result.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
  return result.value;
}

it.each([
  `const x=()=>{};if(true){const x=x;}`,
  `const x=x;`,
  `const alias=x;const x=7;`,
  `const alias=x;const x=()=>{};`,
  `let x=x;`,
  `x=2;let x=1;`,
  `x();const x=()=>{};`,
])('rejects a direct read or write before lexical initialization: %s', (body) => {
  expect(parsePrototype(source(body))).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI1005', message: expect.stringContaining('before its initialization') },
    ],
  });
});

it.each([
  `const x=()=>{};if(true){const x=7;const alias=x;}`,
  `const read=()=>later;const later=7;const result=read();`,
  `const read=()=>later();const later=()=>7;const result=read();`,
  `const alias=hoisted;function hoisted(){return 7;}const result=alias();`,
  `const self=(n:number):number=>n===0?0:self(n-1);const result=self(2);`,
  `const invoke=(first:()=>number=()=>later,later:number=7)=>first();const result=invoke();`,
])('preserves shadowing, hoisted functions and deferred binding reads: %s', (body) => {
  checked(body);
});

it('independently rejects reordered portable initialization with all binding identities intact', () => {
  const ir = checked(`const first=1;const second=first;def.expose.value('result',second);`);
  const forged = JSON.parse(JSON.stringify(ir));
  [forged.setup.body[0], forged.setup.body[1]] = [forged.setup.body[1], forged.setup.body[0]];
  expect(validateIR(forged)).toMatchObject({
    ok: false,
    diagnostics: [
      { code: 'PUI2002', message: expect.stringContaining('before its initialization') },
    ],
  });
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
it.each(nativeOwnerProfiles)(
  'preserves delayed reads and block shadowing in %s',
  async (profile) => {
    const owner = await mountNativeOwner(
      source(`
      const read=()=>later;const later=7;
      const before=()=>hoisted();function hoisted(){return 2;}
      const x=()=>1;let observed=0;
      if(true){const x=7;observed=x;}
      def.expose.method('read',()=>read()+before()+observed);
    `),
      profile
    );
    cleanup.push(owner.dispose);
    expect(owner.handle.getExposes().read()).toBe(16);
  }
);
