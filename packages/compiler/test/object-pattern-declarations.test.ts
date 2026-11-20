// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

// `const { a, b: c } = source` declares reads of the source's fields. A source
// that is not an identifier is evaluated exactly once.
const source = `import {definePrototype} from '@proto.ui/core';
  export default definePrototype({name:'patterns',setup(def){
    let calls=0;
    const make=()=>{calls=calls+1;return {x:2,y:3,'data-k':'k'};};
    const box={a:1,b:'text'};
    const {a,b:renamed}=box;
    const {x,y,'data-k':quoted}=make();
    def.expose.method('numbers',()=>[a,x,y,calls]);
    def.expose.method('texts',()=>[renamed,quoted]);
    return r=>r.el('output',[]);
  }});`;

describe('object destructuring declarations', () => {
  for (const profile of nativeOwnerProfiles)
    it(`reads each field once from one evaluated source for ${profile}`, async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.numbers()).toEqual([1, 2, 3, 1]);
      expect(api.texts()).toEqual(['text', 'k']);
    });

  it.each([
    ['const {a=1}=box;', 'Defaults in a destructuring pattern'],
    ['const {...rest}=box;', 'Rest elements'],
    ['const {inner:{a}}=box;', 'Nested destructuring'],
    ['const {missing}=box;', 'Undeclared record member missing'],
  ])('rejects %s', (declaration, message) => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'x',setup(def){const box={a:1,inner:{a:2}};${declaration}}});`);
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining(message) }],
    });
  });
});
