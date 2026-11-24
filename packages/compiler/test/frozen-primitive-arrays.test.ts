// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const core = `import {definePrototype} from '@proto.ui/core';`;
const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

const source = `${core}
  import {VALUES as IDS} from './barrel';
  const ALL=Object.freeze([...IDS,'last']);
  export default definePrototype({name:'frozen-primitive-consumer',setup(def){
    def.props.define({choice:{type:'enum',options:[...ALL],empty:'fallback'}});
    def.props.setDefaults({choice:'first'});
    const copy=[...ALL];
    def.expose.method('snapshot',()=>copy.join('|'));
    def.expose.method('same',()=>Object.freeze(ALL)===ALL);
    return r=>r.el('output',[]);
  }});`;
const input = {
  fileName: 'entry.proto.ts',
  files: {
    'values.ts': `export const IDS=Object.freeze(['first','second','first'] as const);`,
    'barrel.ts': `export {IDS as VALUES} from './values';`,
  },
};

function checked(text: string): PrototypeIR {
  const result = parsePrototype(text);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const cold = validateIR(JSON.parse(JSON.stringify(result.value)));
  if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
  return cold.value;
}

function walk(value: unknown, visit: (value: ExpressionIR) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) value.forEach((part) => walk(part, visit));
  else {
    visit(value as ExpressionIR);
    Object.values(value).forEach((part) => walk(part, visit));
  }
}

describe('checked frozen primitive arrays', () => {
  it('preserves imported order, duplicates and finite enum options through cold IR', () => {
    const parsed = parsePrototype(source, input);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    expect(parsed.value.props).toMatchObject([
      {
        name: 'choice',
        type: {
          kind: 'union',
          members: [
            { kind: 'literal', value: 'first' },
            { kind: 'literal', value: 'second' },
            { kind: 'literal', value: 'last' },
          ],
        },
      },
    ]);
  });

  it.each([`[1,2,1]`, `[true,false,true]`, `[]`])(
    'admits the actual frozen primitive value %s',
    (values) => {
      checked(`${core}const VALUES=Object.freeze(${values});
        export default definePrototype({name:'finite-frozen',setup(def){
          def.expose.method('values',()=>[...VALUES]);
        }});`);
    }
  );

  it.each([
    `const values=Object.freeze(['first']);values.push('next');`,
    `const values=Object.freeze(['first']);values.sort((a,b)=>0);`,
    `Object.freeze();`,
    `Object.freeze(['a'],['b']);`,
    `Object.freeze?.(['a']);`,
    `Object.freeze<string[]>(['a']);`,
    `def.expose.method('freeze',(value:unknown)=>Object.freeze(value));`,
  ])('rejects unsupported operands or writes through the frozen view: %s', (body) => {
    expect(
      parsePrototype(
        `${core}export default definePrototype({name:'freeze-refusal',setup(def){${body}}});`
      )
    ).toMatchObject({ ok: false });
  });

  it('does not turn a shadowed module factory into a static builtin', () => {
    expect(
      parsePrototype(`${core}
      const Object={freeze:(values:readonly string[])=>values};
      const VALUES=Object.freeze(['first']);
      export default definePrototype({name:'shadowed-freeze',setup(def){def.expose.method('values',()=>VALUES);}});`)
    ).toMatchObject({ ok: false });
  });

  it('retains the field-existence guard in an unrolled frozen-key Partial style table', () => {
    const ir = checked(`import {definePrototype,tw,type StyleHandle} from '@proto.ui/core';
      const BASE=['first','missing','first'] as const;
      const IDS=Object.freeze([...BASE,'last']);
      const TABLE:Partial<Record<'first'|'missing'|'last',StyleHandle>>={first:tw('p-1'),last:tw('p-2')};
      export default definePrototype({name:'frozen-partial-style',setup(def){
        for(const id of IDS){
          const recipe=TABLE[id];
          if(!recipe)continue;
          def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(recipe)});
        }
      }});`);
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
    expect(
      parsePrototype(`import {definePrototype,tw,type StyleHandle} from '@proto.ui/core';
      const IDS=Object.freeze(['first','missing'] as const);
      const TABLE:Partial<Record<'first'|'missing',StyleHandle>>={first:tw('p-1')};
      export default definePrototype({name:'missing-style-field',setup(def){
        for(const id of IDS){def.feedback.style.use(TABLE[id]);}
      }});`)
    ).toMatchObject({ ok: false });
  });

  it('rederives readonly array permission instead of trusting serialized intrinsic metadata', () => {
    const ir = checked(`${core}export default definePrototype({name:'frozen-ir',setup(def){
      const values=Object.freeze(['first']);def.expose.method('values',()=>values);
    }});`);
    let changed = 0;
    walk(ir, (value) => {
      if (value.kind === 'intrinsic' && value.name === 'object.freeze') {
        value.type = { kind: 'value-array', element: 'string' };
        changed++;
      }
    });
    expect(changed).toBe(1);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  for (const profile of nativeOwnerProfiles) {
    it(`executes the frozen module and imported duplicate sequence in ${profile}`, async () => {
      const owner = await mountNativeOwner(source, profile, { compile: input });
      disposers.push(owner.dispose);
      expect(owner.handle.getExposes().snapshot()).toBe('first|second|first|last');
      expect(owner.handle.getExposes().same()).toBe(true);
    });

    it(`retains native freeze identity and an older alias's thrown write in ${profile}`, async () => {
      const owner = await mountNativeOwner(
        `${core}
        export default definePrototype({name:'frozen-alias',setup(def){
          const original=['before'];const alias=original;
          const frozen=Object.freeze(original);
          def.expose.method('same',()=>frozen===original);
          def.expose.method('snapshot',()=>frozen.join('|'));
          def.expose.method('write',()=>alias.push('after'));
          return r=>r.el('output',[]);
        }});`,
        profile
      );
      disposers.push(owner.dispose);
      expect(owner.handle.getExposes().same()).toBe(true);
      expect(owner.handle.getExposes().write).toThrow();
      expect(owner.handle.getExposes().snapshot()).toBe('before');
    });
  }
});
