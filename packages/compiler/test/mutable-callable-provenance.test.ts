// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const prefix = `import { definePrototype, defineAsHook } from '@proto.ui/core';`;
const effectSource = (mutate: string) => `${prefix}
  export default definePrototype({ name: 'mutable-callable-effects', setup(def) {
    const illegal = () => { def.state.bool('flag', true); };
    const box = { invoke: () => {} };
    const alias = box;
    ${mutate}
    def.lifecycle.onCreated(() => box.invoke());
    return r => r.el('div', []);
  }});
`;

it.each(['box.invoke = illegal;', 'alias.invoke = illegal;'])(
  'rejects the known setup-only callback installed by %s',
  (mutate) => {
    expect(parsePrototype(effectSource(mutate))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007' }],
    });
  }
);

it('rejects portable IR with a known illegal callable assigned through a record field', () => {
  const parsed = parsePrototype(effectSource('box.invoke = () => {};'));
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) throw new Error('expected the inert field assignment control');
  const ir = JSON.parse(JSON.stringify(parsed.value));
  expect(validateIR(ir).ok).toBe(true);
  const illegal = ir.setup.body.find(
    (statement: any) => statement.kind === 'const' && statement.name === 'illegal'
  );
  const mutation = ir.setup.body.find(
    (statement: any) => statement.kind === 'effect' && statement.expression.kind === 'member-write'
  );
  expect(illegal).toBeDefined();
  expect(mutation).toBeDefined();
  mutation.expression.value = {
    kind: 'reference',
    name: illegal.name,
    bindingId: illegal.bindingId,
    type: illegal.value.type,
    span: illegal.span,
  };
  expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
});

const installRoutes = [
  `const box = { invoke: () => {} }; box.invoke = create; box.invoke();`,
  `let invoke = create; invoke();`,
] as const;

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each(installRoutes)(
      'captures a state that actually executes through mutable provenance: %s',
      async (route) => {
        const owner = await mountNativeOwner(
          `${prefix}
      const install = defineAsHook({ name: 'mutable-install', setup(def) {
        const create = () => {
          const flag = def.state.bool('flag', true);
          def.expose.method('readFlag', () => flag.get());
        };
        ${route}
      }});
      export default definePrototype({ name: 'mutable-capture', setup(def) {
        const captured = install();
        def.expose.value('hasState', !!captured.getState?.('flag'));
        return r => r.el('div', []);
      }});`,
          profile
        );
        cleanup.push(owner.dispose);
        const api = owner.handle.getExposes();
        expect(api.readFlag()).toBe(true);
        expect(api.hasState).toBe(true);
        expect(owner.compiled.ir.hooks[0].capture?.states).toEqual([
          { name: 'flag', type: 'state:boolean', definite: true },
        ]);
      }
    );
  });

for (const profile of nativeOwnerProfiles) {
  it(`${profile} preserves mutable ordinary calls over repeated public callback execution`, async () => {
    const owner = await mountNativeOwner(
      `${prefix}
      export default definePrototype({name:'mutable-public-consumer', setup(def) {
        let count = 0;
        let action = () => { count = count + 1; };
        const box = { invoke: action };
        def.expose.method('replace', () => { action = () => { count = count + 2; }; box.invoke = action; });
        def.expose.method('invoke', () => box.invoke());
        def.expose.method('read', () => count);
        return r => r.el('div', []);
      }});`,
      profile
    );
    cleanup.push(owner.dispose);
    const api = owner.handle.getExposes();
    api.invoke();
    expect(api.read()).toBe(1);
    api.replace();
    api.invoke();
    expect(api.read()).toBe(3);
    api.invoke();
    api.replace();
    api.invoke();
    expect(api.read()).toBe(7);
    expect(validateIR(JSON.parse(JSON.stringify(owner.compiled.ir))).ok).toBe(true);
  });
}
