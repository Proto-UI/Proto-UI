// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

describe('source forms the shadcn families use', () => {
  // `String(value)` is the global conversion with one argument.
  for (const profile of nativeOwnerProfiles)
    it(`lowers String() for ${profile}`, async () => {
      const owner = await mountNativeOwner(
        `import {definePrototype} from '@proto.ui/core';
        export default definePrototype({name:'to-string',setup(def){
          def.expose.method('text',(value:string|number|boolean|null)=>String(value));
          return r=>r.el('output',[]);
        }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect([api.text(42), api.text(true), api.text(null), api.text('x')]).toEqual([
        '42',
        'true',
        'null',
        'x',
      ]);
    });

  it('rejects String() with other than one argument', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'x',setup(def){def.expose.method('t',()=>String(1,2));}});`);
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('exactly one argument') }],
    });
  });

  // A style list joined into a module constant is a static tw token, and a
  // state handle returned by a helper is a rule state observed through its
  // binding.
  it('admits joined tw constants and helper-returned states in rules', () => {
    const parsed = parsePrototype(`import {definePrototype,tw,type DefHandle} from '@proto.ui/core';
      const BASE=['shrink-0','bg-border'].join(' ');
      function selection(def:DefHandle<{},{}>){return def.state.enum('choice','a',{options:['a','b']});}
      export default definePrototype({name:'x',setup(def){
        const choice=selection(def);
        def.feedback.style.use(tw(BASE));
        def.rule({when:(w)=>w.state(choice).eq('b'),intent:(i)=>i.feedback.style.use(tw('h-px'))});
        return r=>r.el('div',[]);
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.stringify(parsed.value);
    expect(ir).toContain('shrink-0');
    expect(ir).toContain('bg-border');
  });

  // A for...of over finite literal data in setup is unrolled at compile time;
  // literal-only branches inside it are decided, and style tables indexed by a
  // static key or template fold to the token they name.
  it('unrolls static loops into one rule per element', () => {
    const parsed = parsePrototype(`import {definePrototype,tw} from '@proto.ui/core';
      const IDS=['vega','rhea'] as const;
      const TONES={primary:'bg-primary',ghost:'bg-transparent'} as const;
      const SIZES={'vega-sm':'h-7','vega-lg':'h-9','rhea-sm':'h-6','rhea-lg':'h-8'} as const;
      export default definePrototype({name:'x',setup(def){
        def.props.define({tone:{type:'string'},size:{type:'string'},id:{type:'string'}});
        for (const tone of Object.keys(TONES) as Array<keyof typeof TONES>) {
          def.rule({when:(w)=>w.prop('tone').eq(tone),intent:(i)=>i.feedback.style.use(tw(TONES[tone]))});
        }
        for (const id of IDS) {
          for (const size of ['sm','lg','icon'] as const) {
            if (size === 'icon') {
              def.rule({when:(w)=>w.prop('size').eq(size),intent:(i)=>i.feedback.style.use(tw('size-8'))});
            } else {
              def.rule({when:(w)=>w.all(w.prop('id').eq(id),w.prop('size').eq(size)),intent:(i)=>i.feedback.style.use(tw(SIZES[\`\${id}-\${size}\`]))});
            }
          }
        }
        return r=>r.el('div',[]);
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.stringify(parsed.value);
    for (const token of ['bg-primary', 'bg-transparent', 'h-7', 'h-9', 'h-6', 'h-8', 'size-8'])
      expect(ir).toContain(token);
    expect(ir.match(/"rule.declare"/g)?.length).toBe(2 + 2 * 3);
  });

  it('keeps for...of over non-static data unsupported', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'x',setup(def){
        const list=[1,2];
        for (const item of list) { def.expose.method('m',()=>item); }
      }});`);
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('ForOfStatement') }],
    });
  });
});
