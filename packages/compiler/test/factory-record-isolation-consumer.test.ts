// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = (record: string, callback = 'first.invoke();', extra = '') => `
  import { definePrototype } from '@proto.ui/core';
  export default definePrototype({ name: 'factory-record-isolation', setup(def) {
    let count = 0;
    const empty = () => {};
    const make = (invoke: () => void) => (${record});
    const first = make(() => { count += 1; });
    const second = make(() => { def.state.bool('flag', true); });
    ${extra}
    def.lifecycle.onCreated(() => { ${callback} });
    def.expose.method('read', () => count);
    return r => r.el('div', []);
  }});
`;

it.each(['{ invoke }', '{ ...{ invoke } }'])(
  'preserves separate ordinary factory invocations for %s',
  (record) => {
    const parsed = parsePrototype(source(record));
    expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  }
);

it('still rejects invoking the effectful second factory result in a lifecycle callback', () => {
  expect(parsePrototype(source('{ invoke }', 'second.invoke();'))).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007' }],
  });
});

it.each(['{ invoke }', '{ ...{ invoke } }'])(
  'accepts portable IR invoking only the first independent factory result for %s',
  (record) => {
    const parsed = parsePrototype(
      source(record, 'const retained = first; empty();', 'first.invoke();')
    );
    expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
    if (!parsed.ok) throw new Error('expected an inert lifecycle callback control');
    const ir = JSON.parse(JSON.stringify(parsed.value));
    expect(validateIR(ir).ok).toBe(true);
    const firstInvocation = ir.setup.body.find(
      (statement: any) =>
        statement.kind === 'effect' &&
        statement.expression.kind === 'call' &&
        statement.expression.callee.kind === 'member' &&
        statement.expression.callee.property === 'invoke'
    );
    const lifecycle = ir.setup.body.find(
      (statement: any) =>
        statement.kind === 'effect' && statement.expression.operation === 'lifecycle.onCreated'
    );
    expect(firstInvocation).toBeDefined();
    expect(lifecycle).toBeDefined();
    lifecycle.expression.arguments[0].function.body.push(
      JSON.parse(JSON.stringify(firstInvocation))
    );
    const checked = validateIR(ir);
    expect(checked.ok, JSON.stringify(checked.ok ? {} : checked.diagnostics)).toBe(true);
  }
);

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('executes only the first factory result through the generated host lifecycle', async () => {
      const owner = await mountNativeOwner(source('{ invoke }'), profile);
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().read()).toBe(1);
    });
  });
