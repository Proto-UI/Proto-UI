// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const core = `import {definePrototype,defineAsHook} from '@proto.ui/core';`;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

// Immutable finite data written as literals is admitted at module scope: style
// tables, `as const` id lists and a static string list joined by a literal
// separator (folded at compile time). Mutable module storage stays scalar.
const tables = `${core}
  const IDS=['vega','rhea'] as const;
  const TOKENS={vega:'h-9 rounded-md',rhea:'h-8 rounded-2xl'} as const satisfies Record<(typeof IDS)[number],string>;
  const BASE=['shrink-0','bg-border'].join(' ');
  const LIST=['a','b','c'];
  const JOINED=LIST.join('-');
  export default definePrototype({name:'static-data',setup(def){
    def.expose.method('token',(id:string)=>id==='vega'?TOKENS.vega:TOKENS.rhea);
    def.expose.method('base',()=>BASE+'|'+JOINED);
    def.expose.method('count',()=>IDS.length);
    return r=>r.el('output',[]);
  }});`;

describe('immutable module data', () => {
  for (const profile of nativeOwnerProfiles)
    it(`lowers literal tables and folded joins for ${profile}`, async () => {
      const owner = await mountNativeOwner(tables, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.token('vega')).toBe('h-9 rounded-md');
      expect(api.token('rhea')).toBe('h-8 rounded-2xl');
      expect(api.base()).toBe('shrink-0 bg-border|a-b-c');
      expect(api.count()).toBe(2);
    });

  it.each([
    [`let SHARED={n:0};`, 'mutable module data'],
    [`const SHARED={n:0};const W=(SHARED.n=1);`, 'top-level execution'],
    [`const SHARED=[1,2].join(String(3));`, 'a non-literal separator'],
    [`const SHARED={n:0};function bump(){SHARED.n=1;}`, 'a write through shared data'],
    [
      `const SHARED={inner:{n:0}};function bump(){const alias=SHARED.inner;alias.n=1;}`,
      'a write through a nested alias',
    ],
  ])('rejects %s (%s)', (declaration) => {
    const parsed = parsePrototype(`${core}${declaration}
      export default definePrototype({name:'x',setup(def){def.expose.method('n',()=>SHARED);${declaration.includes('bump') ? 'bump();' : ''}}});`);
    expect(parsed.ok).toBe(false);
  });

  it('inherits module requirements from a static hook declaration', () => {
    const parsed = parsePrototype(`import {definePrototype,defineAsHook} from '@proto.ui/core';
      import {declareTextControl} from '@proto.ui/module-text-control';
      export const asText=defineAsHook({name:'as-text',modules:[declareTextControl({content:'plain-text',lineMode:'single',engine:'host'})],setup(def){}});
      export default definePrototype({name:'text',modules:asText.modules,setup(def){asText();return r=>r.el('input',[]);}});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(parsed.value.moduleDeclarations.map((declaration) => declaration.id)).toHaveLength(1);
  });
});
