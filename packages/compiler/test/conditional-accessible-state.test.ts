// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanups.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
function source(options = '{when:applicable}', replacement = '') {
  return `import{definePrototype,type RunHandle}from'@proto.ui/core';
  import{asAccessible}from'@proto.ui/hooks';
  export default definePrototype({name:'conditional-a11y-consumer',setup(def){
    const applicable=def.state.bool('applicable',false);
    const value=def.state.bool('value',false);
    const text=def.state.string('text','invalid-condition');
    const accessible=asAccessible();accessible.role('button');
    accessible.state('pressed',value,${options});${replacement}
    let current:RunHandle<{}>|null=null;
    def.lifecycle.onCreated(run=>{current=run;});
    def.expose.method('applicable',(next:boolean)=>applicable.set(next));
    def.expose.method('value',(next:boolean)=>value.set(next));
    def.expose.method('hide',()=>current?.lifecycle.setPresent(false));
    def.expose.method('show',()=>current?.lifecycle.setPresent(true));
    return r=>r.el('section','state condition');
  }});`;
}

for (const profile of nativeOwnerProfiles) {
  it(`${profile}: omits inactive state, restores current value, withdraws only owned attributes and remounts`, async () => {
    const owner = await mountNativeOwner(source(), profile);
    cleanups.push(owner.dispose);
    const root = () =>
      profile === 'web-component-source-v1'
        ? (owner.handle as unknown as HTMLElement)
        : owner.host.querySelector('section')!.closest<HTMLElement>('[data-pui-root]')!;
    const api = owner.handle.getExposes();
    const initial = root();
    expect(initial.hasAttribute('aria-pressed')).toBe(false);
    initial.setAttribute('aria-pressed', 'mixed');
    await owner.act(() => api.value(true));
    expect(initial.getAttribute('aria-pressed')).toBe('mixed');
    await owner.act(() => api.applicable(true));
    expect(initial.getAttribute('aria-pressed')).toBe('true');
    await owner.act(() => api.applicable(false));
    expect(initial.getAttribute('aria-pressed')).toBe('mixed');
    initial.removeAttribute('aria-pressed');
    await owner.act(() => api.value(false));
    await owner.act(() => api.applicable(true));
    expect(initial.getAttribute('aria-pressed')).toBe('false');
    initial.setAttribute('aria-pressed', 'host-rewrite');
    await owner.act(() => api.applicable(false));
    expect(initial.getAttribute('aria-pressed')).toBe('host-rewrite');
    await owner.act(() => api.hide());
    await owner.flush();
    await owner.act(() => {
      api.value(true);
      api.applicable(true);
    });
    await owner.act(() => api.show());
    await owner.flush();
    expect(root().getAttribute('aria-pressed')).toBe('true');
    await owner.act(() => api.applicable(false));
    expect(root().getAttribute('aria-pressed')).not.toBe('false');
  });
  it(`${profile}: a later unconditional declaration replaces value and condition together`, async () => {
    const owner = await mountNativeOwner(
      source('{when:applicable}', "accessible.state('pressed',value);"),
      profile
    );
    cleanups.push(owner.dispose);
    const root =
      profile === 'web-component-source-v1'
        ? (owner.handle as unknown as HTMLElement)
        : owner.host.querySelector('section')!.closest<HTMLElement>('[data-pui-root]')!;
    expect(root.getAttribute('aria-pressed')).toBe('false');
    await owner.act(() => owner.handle.getExposes().value(true));
    expect(root.getAttribute('aria-pressed')).toBe('true');
  });
}

it.each(['{when:true}', '{when:text}', '{when:1}', '{when:()=>true}'])(
  'rejects an unproven Boolean State condition: %s',
  (options) => {
    expect(compilePrototype(source(options), { profile: 'gpui-source-v1' }).ok).toBe(false);
  }
);
it('rechecks serialized condition authority independently', () => {
  const parsed = parsePrototype(source());
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = JSON.parse(JSON.stringify(parsed.value));
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'operation' && node.operation === 'accessible.state') {
      node.arguments[2] = {
        kind: 'record',
        entries: [
          {
            key: 'when',
            value: { kind: 'literal', value: true, type: 'boolean', span: node.span },
          },
        ],
        type: {
          kind: 'record',
          fields: [{ name: 'when', type: 'boolean', optional: false, readonly: false }],
        },
        span: node.span,
      };
    } else for (const value of Object.values(node)) visit(value);
  };
  visit(ir);
  expect(validateIR(ir).ok).toBe(false);
});
