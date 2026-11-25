// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const core = `import {definePrototype,tw} from '@proto.ui/core';`;
const source = (body: string, declarations = `const ICONS=new Set<'text'|'icon'>(['icon']);`) =>
  `${core}${declarations}export default definePrototype({name:'captured-membership',setup(def){
    def.props.define({size:{type:'enum',options:['text','icon'],empty:'fallback'},wrap:{type:'boolean'}});
    def.props.setDefaults({size:'text',wrap:false});${body}
  }});`;
const rules = `for(const size of ['text','icon'] as const) {
  def.rule({
    when:w=>ICONS.has(size)?w.prop('size').eq(size):w.all(w.prop('size').eq(size),w.prop('wrap').eq(false)),
    intent:i=>i.feedback.style.use(tw('p-2'))
  });
}`;

describe.each(nativeOwnerProfiles)('%s captured Set membership', (profile) => {
  it('retains the declaration choice and later native prop updates', async () => {
    const owner = await mountNativeOwner(source(rules), profile);
    try {
      const tokens = () => owner.host.firstElementChild?.getAttribute('data-pui-style');
      expect(tokens()).toBe('p-2');
      await owner.setProps({ size: 'text', wrap: true });
      expect(tokens() ?? '').toBe('');
      await owner.setProps({ size: 'icon', wrap: true });
      expect(tokens()).toBe('p-2');
      await owner.setProps({ size: 'text', wrap: false });
      expect(tokens()).toBe('p-2');
    } finally {
      await owner.dispose();
    }
  });

  it('uses the same checked membership choice in an intent callback', async () => {
    const owner = await mountNativeOwner(
      source(
        `def.rule({when:w=>w.t(),intent:i=>ICONS.has('icon')?i.feedback.style.use(tw('p-2')):i.feedback.style.use(tw('p-4'))});`
      ),
      profile
    );
    try {
      expect(owner.host.firstElementChild?.getAttribute('data-pui-style')).toBe('p-2');
    } finally {
      await owner.dispose();
    }
  });
});

describe('captured membership refusal boundaries', () => {
  it.each([
    `const ICONS=new Set<'text'|'icon'>(['foreign']);`,
    `const values:string[]=['icon'];const ICONS=new Set<'text'|'icon'>(values);`,
  ])('keeps constructor element checking for %s', (declarations) => {
    const result = compilePrototype(source(rules, declarations), {
      profile: 'web-component-source-v1',
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it.each([
    ['ordinary same-named method', ``, `ordinary.has('icon')`],
    ['callback-local receiver', `const ICONS=new Set(['icon']);`, `w.has('icon')`],
    ['callback-local argument', `const ICONS=new Set(['icon']);`, `ICONS.has(w)`],
    ['mutating collection call', `const ICONS=new Set(['icon']);`, `ICONS.delete('icon')`],
    [
      'effectful search helper',
      `const ICONS=new Set(['icon']);function key(){return 'icon';}`,
      `ICONS.has(key())`,
    ],
    [
      'effectful receiver helper',
      `const ICONS=new Set(['icon']);function values(){return ICONS;}`,
      `values().has('icon')`,
    ],
    ['optional member call', `const ICONS=new Set(['icon']);`, `ICONS?.has('icon')`],
    ['optional invocation', `const ICONS=new Set(['icon']);`, `ICONS.has?.('icon')`],
    [
      'spread argument',
      `const ICONS=new Set(['icon']);const KEYS=['icon'] as const;`,
      `ICONS.has(...KEYS)`,
    ],
  ])('does not lift %s', (_name, declarations, condition) => {
    const result = compilePrototype(
      source(
        `const ordinary={has(value:string){return value==='icon';}};def.rule({when:w=>${condition}?w.t():w.f(),intent:i=>i.feedback.style.use(tw('p-2'))});`,
        declarations
      ),
      { profile: 'web-component-source-v1' }
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });

  it('does not borrow a module Set through a later callback declaration', () => {
    const result = compilePrototype(
      source(
        `def.rule({when:w=>{const choice=ICONS.has('icon')?w.t():w.f();const ICONS=new Set(['text']);return choice;},intent:i=>i.feedback.style.use(tw('p-2'))});`
      ),
      { profile: 'web-component-source-v1' }
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1024' }] });
  });
});
