// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const core = `import {definePrototype,tw,type DefHandle,type StyleHandle} from '@proto.ui/core';`;
const recipes = `const RECIPES={wide:tw('gap-2'),tight:tw('gap-1')} as const;`;
const source = (body: string, declarations = recipes) => `${core}${declarations}
export default definePrototype({name:'rule-scope',setup(def){${body}}});`;
const props = `def.props.define({density:{type:'enum',options:['wide','tight'],empty:'fallback'}});
def.props.setDefaults({density:'wide'});`;

describe('Rule callback lexical bindings', () => {
  it.each([
    `RECIPES=>RECIPES.feedback.style.use(RECIPES.wide)`,
    `tw=>tw.feedback.style.use(tw('gap-2'))`,
    `i=>{const RECIPES=tw('gap-1');i.feedback.style.use(RECIPES.wide);}`,
    `i=>{const saved=RECIPES.wide;const RECIPES=tw('gap-1');i.feedback.style.use(saved);}`,
    `i=>{const RECIPES=RECIPES.wide;i.feedback.style.use(RECIPES);}`,
    `function RECIPES(i){i.feedback.style.use(RECIPES.wide);}`,
    `function tw(i){i.feedback.style.use(tw('gap-2'));}`,
  ])('rejects borrowing an outer style through %s', (intent) => {
    expect(
      compilePrototype(source(`def.rule({when:w=>w.t(),intent:${intent}});`), {
        profile: 'web-component-source-v1',
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });

  it.each([
    `active=>active.state(active).eq(true)`,
    `w=>{const observed=w.state(active);const active=true;return observed.eq(true);}`,
    `function active(w){return w.state(active).eq(true);}`,
  ])('rejects borrowing an outer state through %s', (when) => {
    expect(
      compilePrototype(
        source(
          `const active=def.state.bool('active',false);
def.rule({when:${when},intent:i=>i.feedback.style.use(tw('gap-2'))});`,
          ''
        ),
        { profile: 'web-component-source-v1' }
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });

  it('rejects a captured literal hidden by a later callback declaration', () => {
    expect(
      compilePrototype(
        source(
          `${props}const selected='wide';
def.rule({when:w=>{const earlier=selected;const selected='tight';return w.prop('density').eq(earlier);},
intent:i=>i.feedback.style.use(tw('gap-1'))});`,
          ''
        ),
        { profile: 'web-component-source-v1' }
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });

  it.each([
    `when:function selected(w){return selected?w.t():w.f();},intent:i=>i.feedback.style.use(tw('gap-1'))`,
    `when:w=>w.t(),intent:function selected(i){i.feedback.style.use(selected?tw('gap-1'):tw('gap-2'));}`,
  ])('does not hoist a named callback self reference into its outer scope: %s', (rule) => {
    expect(
      compilePrototype(source(`const selected=false;def.rule({${rule}});`, ''), {
        profile: 'web-component-source-v1',
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });

  it('retains named callbacks that do not read their function self binding', () => {
    expect(
      compilePrototype(
        source(`const active=def.state.bool('active',false);
def.rule({when:function active(w){return w.t();},
intent:function RECIPES(i){i.feedback.style.use(tw('gap-1'));}});`),
        { profile: 'web-component-source-v1' }
      ).ok
    ).toBe(true);
  });
});

describe.each(nativeOwnerProfiles)('%s Rule callback scope', (profile) => {
  it('preserves checked callback aliases over same-named outer values', async () => {
    const owner = await mountNativeOwner(
      source(`${props}const selected='wide';
def.rule({when:w=>{const selected='tight';return w.prop('density').eq(selected);},
intent:i=>{const RECIPES=tw('gap-1');const saved=RECIPES;i.feedback.style.use(saved);}});`),
      profile
    );
    try {
      expect(owner.host.firstElementChild?.getAttribute('data-pui-style') ?? '').toBe('');
      await owner.setProps({ density: 'tight' });
      expect(owner.host.firstElementChild?.getAttribute('data-pui-style')).toBe('gap-1');
    } finally {
      await owner.dispose();
    }
  });

  it('preserves distinct captured style tables through one ordinary helper', async () => {
    const owner = await mountNativeOwner(
      source(
        `${props}paint(def,FIRST);paint(def,SECOND);`,
        `const FIRST={wide:tw('gap-2'),tight:tw('gap-1')} as const;
const SECOND={wide:tw('p-4'),tight:tw('p-2')} as const;
const IDS=['wide','tight'] as const;
function paint(def:DefHandle,recipes:Readonly<Record<'wide'|'tight',StyleHandle>>){
  for(const id of IDS)def.rule({when:w=>w.prop('density').eq(id),intent:i=>i.feedback.style.use(recipes[id])});
}`
      ),
      profile
    );
    try {
      expect(owner.host.firstElementChild?.getAttribute('data-pui-style')).toBe('gap-2 p-4');
      await owner.setProps({ density: 'tight' });
      expect(owner.host.firstElementChild?.getAttribute('data-pui-style')).toBe('gap-1 p-2');
    } finally {
      await owner.dispose();
    }
  });
});
