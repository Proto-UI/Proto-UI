// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (hook: string, field: string) => `
  import { defineAsHook, definePrototype } from '@proto.ui/core';
  const asProbe = defineAsHook({ name: 'presence-probe', ${hook} });
  export default definePrototype({ name: 'presence-owner', setup(def) {
    const flag = def.state.bool('flag', false);
    const facade = asProbe();
    const copied = facade.${field};
    if (copied) {} else { def.expose.method('late', () => flag.setDefault(true)); }
  } });
`;

function rejectsCallback(source: string) {
  const parsed = parsePrototype(source);
  expect(parsed, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1007', message: expect.stringContaining('state.setDefault') }],
  });
}

describe('copied capture members retain their actual presence', () => {
  it.each(['getState', 'getMethod', 'getAsHook', 'getAsHookHandle', 'methods', 'artifacts'])(
    'checks the real empty-capture absence branch for %s',
    (field) => {
      // finish_capture omits these fields when empty. Test the direct truth
      // branch so an unrelated conservative unary-! analysis cannot mask it.
      rejectsCallback(source('setup() {}', field));
    }
  );

  it('keeps conditional absence after a method-map join', () => {
    rejectsCallback(
      source(
        "setup(def) { const present = def.state.bool('present', false); if (present.get()) def.expose.method('read', () => 7); }",
        'getMethod'
      )
    );
  });

  it('does not visit a dead absence branch for a proven nonempty capture', () => {
    const parsed = parsePrototype(
      source("setup(def) { def.expose.method('read', () => 7); }", 'getMethod')
    );
    expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
    if (parsed.ok)
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });

  const spreadSource = (
    hook: string,
    copy: string = '{ ...facade }',
    observe: string = "forwarded.getMethod?.('read');"
  ) => `
    import { defineAsHook, definePrototype } from '@proto.ui/core';
    const asProbe = defineAsHook({ name: 'spread-probe', ${hook} });
    export default definePrototype({ name: 'spread-owner', setup(def) {
      const flag = def.state.bool('flag', false);
      const facade = asProbe();
      const copied = ${copy};
      const forwarded = { getMethod: (name: string) => flag.setDefault(true), ...copied };
      def.expose.method('late', () => { ${observe} });
    } });
  `;

  it('preserves a preceding callable through an empty capture and a second spread', () => {
    rejectsCallback(spreadSource('setup() {}'));
  });

  it('preserves a preceding callable when a conditional capture property is absent', () => {
    rejectsCallback(
      spreadSource(
        "setup(def) { const present = def.state.bool('present', false); if (present.get()) def.expose.method('read', () => 7); }"
      )
    );
  });

  // Keep an unrelated pure callable in this record so the analysis retains
  // callable field facts, independently of its conservative data-only values.
  it.each([
    [
      "setup(def) { def.expose.method('read', () => 7); }",
      '{ ...facade }',
      "forwarded.getMethod?.('read');",
    ],
    [
      'setup() {}',
      '{ getMethod: undefined, keep: () => 7 }',
      'if (forwarded.getMethod) { flag.setDefault(true); }',
    ],
  ])('distinguishes a real overwrite from an absent own key: %s / %s', (hook, copy, observe) => {
    const parsed = parsePrototype(spreadSource(hook, copy, observe));
    expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
    if (parsed.ok)
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });
});
