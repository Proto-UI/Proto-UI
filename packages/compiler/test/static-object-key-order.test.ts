// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

const prototype = (setup: string, module = '') => `
  import {definePrototype} from '@proto.ui/core';
  ${module}
  export default definePrototype({name:'static-key-order',setup(def){
    ${setup}
    return r=>r.el('output',[]);
  }});
`;

// ECMAScript OrdinaryOwnPropertyKeys: array indices ascend numerically;
// other string keys retain creation order. These are native consumer values,
// independent of the compiler's IR shape or its key-order implementation.
// https://tc39.es/ecma262/2026/#sec-ordinaryownpropertykeys
const cases = [
  {
    name: 'mixed numeric and string keys',
    record: "{'9':'nine','2':'two',a:'letter'}",
    expected: '2|9|a|',
  },
  {
    name: 'array-index boundaries and ordinary string insertion order',
    record:
      "{z:'z','4294967295':'large','01':'leading','9':'nine','4294967294':'last',a:'a','0':'zero','-1':'negative','2':'two'}",
    expected: '0|2|9|4294967294|z|4294967295|01|a|-1|',
  },
  {
    name: 'ordinary string keys',
    record: "{z:'last',a:'first',middle:'middle'}",
    expected: 'z|a|middle|',
  },
];

describe('static Object.keys iteration order', () => {
  for (const profile of nativeOwnerProfiles)
    for (const scope of ['local', 'module'] as const)
      for (const { name, record, expected } of cases)
        it(`preserves ${name} from a ${scope} record in ${profile}`, async () => {
          const declaration = `const RECORD=${record};`;
          const source = prototype(
            `${scope === 'local' ? declaration : ''}
            let order='';
            for(const key of Object.keys(RECORD)){order+=key+'|';}
            def.expose.method('read',()=>order);`,
            scope === 'module' ? declaration : ''
          );
          const owner = await mountNativeOwner(source, profile);
          cleanup.push(owner.dispose);
          expect(owner.handle.getExposes().read()).toBe(expected);

          // A second full compilation must keep both the executable output and
          // its provenance stable after the first artifact has been consumed.
          const repeated = compilePrototype(source, { profile });
          if (!repeated.ok) throw new Error(JSON.stringify(repeated.diagnostics));
          expect(repeated.value.output).toEqual(owner.compiled.output);
        });

  for (const profile of nativeOwnerProfiles)
    it(`preserves nested iteration, closures and a shared handle in ${profile}`, async () => {
      const owner = await mountNativeOwner(
        prototype(
          `let order='';
          const shared=def.state.string('shared','');
          for(const outer of Object.keys(RECORD)){
            const captured=outer;
            def.expose.method(outer,()=>{
              shared.set(shared.get()+captured);
              return shared.get();
            });
            for(const inner of ['x','y']){order+=outer+inner+'|';}
          }
          def.expose.method('read',()=>order);`,
          "const RECORD={'9':'nine','2':'two',a:'letter'};"
        ),
        profile
      );
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.read()).toBe('2x|2y|9x|9y|ax|ay|');
      expect([api['2'](), api['9'](), api.a(), api['2']()]).toEqual(['2', '29', '29a', '29a2']);
    });

  it.each([
    ['computed key', "const key='a';const RECORD={[key]:'value'};"],
    ['getter', "const RECORD={get a(){return 'value';}};"],
    ['prototype setter', "const RECORD={__proto__:'value',a:'value'};"],
    ['shadowed Object', "const RECORD={a:'value'};const Object={keys:0};"],
  ])('does not acquire a static-record proof for %s', (_name, declaration) => {
    const result = compilePrototype(
      prototype(`${declaration}
        for(const key of Object.keys(RECORD)){def.expose.method(key,()=>key);}`),
      { profile: 'web-component-source-v1' }
    );
    expect(result.ok, JSON.stringify(result)).toBe(false);
  });
});
