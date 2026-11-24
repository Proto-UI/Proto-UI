// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const core = `import {definePrototype,defineAsHook} from '@proto.ui/core';`;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

// Finite literal data and explicit readonly views retain their authored
// permissions. Shared mutable bindings stay scalar; a const fixes the binding
// while a finite record may still be mutated through a checked field.
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

describe('finite module data', () => {
  it('flattens checked imported primitive arrays in order through a barrel', () => {
    const parsed = parsePrototype(
      `${core}
      import {IDS} from './barrel';
      const MORE=[...IDS,'new-york','inherit'];
      export default definePrototype({name:'spread',setup(def){
        const values=[...MORE,...[],...IDS];
        def.expose.method('values',()=>values);
      }});`,
      {
        fileName: 'entry.proto.ts',
        files: {
          'ids.ts': `export const STYLES=['vega','rhea','vega'] as const;`,
          'barrel.ts': `export {STYLES as IDS} from './ids';`,
        },
      }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const values = parsed.value.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'values'
    );
    expect(values).toMatchObject({
      value: {
        kind: 'array',
        elements: [
          { kind: 'literal', value: 'vega' },
          { kind: 'literal', value: 'rhea' },
          { kind: 'literal', value: 'vega' },
          { kind: 'literal', value: 'new-york' },
          { kind: 'literal', value: 'inherit' },
          { kind: 'literal', value: 'vega' },
          { kind: 'literal', value: 'rhea' },
          { kind: 'literal', value: 'vega' },
        ],
      },
    });
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });

  it('retains checked assertion authority and finite enum alternatives', () => {
    const parsed = parsePrototype(`${core}
      import type {DefHandle} from '@proto.ui/core';
      const IDS=['vega','rhea'] as const;
      interface StyleProps {styleProfile?:'vega'|'rhea'|'new-york'|'inherit'}
      function declareChoice(def:DefHandle<StyleProps>){
        const cdef=def as unknown as DefHandle<StyleProps>;
        cdef.props.define({styleProfile:{type:'enum',options:[...IDS,'new-york','inherit'],empty:'fallback'}});
        cdef.props.setDefaults({styleProfile:'inherit'});
      }
      export default definePrototype<StyleProps>({name:'choice',setup(def){declareChoice(def);}});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(JSON.stringify(parsed.value.props)).toContain('new-york');
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });

  it('reads the unchanged style selection declaration and its canonical context', () => {
    const styleScope = resolve(__dirname, '../../prototypes/shadcn/src/style-scope');
    const selection = readFileSync(resolve(styleScope, 'selection.ts'), 'utf8');
    const file = ts.createSourceFile('selection.ts', selection, ts.ScriptTarget.Latest, true);
    const choice = file.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'declareChoice'
    );
    if (!choice) throw new Error('Missing authored declareChoice');
    const context = readFileSync(resolve(styleScope, 'context.ts'), 'utf8');
    const parsed = parsePrototype(
      `${core}
      import type {DefHandle} from '@proto.ui/core';
      import {SHADCN_STYLE_IDS,type ShadcnStyleProps} from './context';
      ${choice.getText(file)}
      export default definePrototype<ShadcnStyleProps>({name:'authored-choice',setup(def){declareChoice(def);}});`,
      {
        fileName: 'entry.proto.ts',
        files: { 'context.ts': context },
      }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    for (const id of [
      'vega',
      'nova',
      'maia',
      'lyra',
      'mira',
      'luma',
      'sera',
      'rhea',
      'new-york-v4',
      'new-york',
      'inherit',
    ])
      expect(JSON.stringify(parsed.value.props)).toContain(id);
  });

  it.each([
    [`const IDS=['module'];`, `def.expose.method('read',(IDS:string[])=>[...IDS]);`, true],
    [`const IDS=['module'];`, `const IDS=['local'];const copy=[...IDS];`, true],
    [`const IDS=['module'];`, `let local=['local'];const copy=[...local];`, true],
    [``, `def.expose.method('read',(value:unknown)=>[...(value as string[])]);`, false],
    [``, `def.expose.method('read',(value:readonly string[])=>[...value]);`, true],
    [`function ids():string[]{return ['dynamic'];}`, `const copy=[...ids()];`, true],
    [`const IDS=['module'];`, `const copy=[...(true?IDS:[])];`, true],
    [`const IDS={value:['module']};`, `const copy=[...IDS.value];`, true],
    [`const IDS='scalar';`, `const copy=[...IDS];`, true],
    [`const IDS={value:'record'};`, `const copy=[...IDS];`, false],
    [`const IDS=[['nested']];`, `const copy=[...IDS];`, true],
    [`const IDS=[{value:'identity'}];`, `const copy=[...IDS];`, true],
    [`let IDS=['mutable'];`, `const copy=[...IDS];`, false],
    [`let item='before';const IDS=[item];`, `item='after';const copy=[...IDS];`, true],
    [`const IDS=['readonly'];`, `const copy=[...IDS];IDS[0]='changed';`, false],
  ])('checks iterable provenance and storage permissions: %s %s', (declaration, body, accepted) => {
    const parsed = parsePrototype(`${core}${declaration}
      export default definePrototype({name:'rejected-spread',setup(def){${body}}});`);
    expect(parsed.ok).toBe(accepted);
    if (parsed.ok)
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });
  it.each([`[1,2]`, `['a',1]`, `[]`])('keeps enum options finite and nonempty: %s', (ids) => {
    expect(
      parsePrototype(`${core}const IDS=${ids};
      export default definePrototype({name:'bad-enum',setup(def){
        def.props.define({choice:{type:'enum',options:[...IDS],empty:'fallback'}});
      }});`).ok
    ).toBe(false);
  });

  for (const profile of nativeOwnerProfiles)
    it(`preserves inline element identity and evaluation for ${profile}`, async () => {
      const owner = await mountNativeOwner(
        `${core}
        const IDS=['first','second'];
        export default definePrototype({name:'spread-evaluation',setup(def){
          def.expose.method('check',()=>{
            let calls=0;
            const original={value:1};
            const next=()=>{calls=calls+1;return calls;};
            const objects=[...[original]];
            const values=[...[next(),next()],...IDS];
            return objects[0]===original && calls===2 && values[0]===1 && values[1]===2 && values[2]==='first' && values[3]==='second';
          });
          return r=>r.el('output',[]);
        }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().check()).toBe(true);
      expect(owner.handle.getExposes().check()).toBe(true);
    });

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
    [`let SHARED={n:0};`, 'mutable module binding', false],
    [`const SHARED={n:0};const W=(SHARED.n=1);`, 'top-level execution', false],
    [`const SHARED=[1,2].join(String(3));`, 'a non-literal separator', false],
    [`const SHARED={n:0};function bump(){SHARED.n=1;}`, 'a write through finite shared data', true],
    [
      `const SHARED={inner:{n:0}};function bump(){const alias=SHARED.inner;alias.n=1;}`,
      'a write through a finite nested alias',
      true,
    ],
  ])('checks module storage %s (%s)', (declaration, _reason, accepted) => {
    const parsed = parsePrototype(`${core}${declaration}
      export default definePrototype({name:'x',setup(def){def.expose.method('n',()=>SHARED);${declaration.includes('bump') ? 'bump();' : ''}}});`);
    expect(parsed.ok).toBe(accepted);
    if (parsed.ok)
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
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
