// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

const source = (body: string, hooks = '') => `
  import { definePrototype, defineAsHook } from '@proto.ui/core';
  ${hooks}
  export default definePrototype({ name: 'spread-callable-proof', setup(def) {
    const flag = def.state.bool('flag', false);
    def.expose.event('changed', { payload: 'json' });
    def.event.on('press.commit', run => { ${body} });
  } });
`;

function accepted(body: string, hooks = ''): PrototypeIR {
  const parsed = parsePrototype(source(body, hooks));
  expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const cold = JSON.parse(JSON.stringify(parsed.value)) as PrototypeIR;
  const checked = validateIR(cold);
  expect(checked.ok, JSON.stringify(checked.ok ? null : checked.diagnostics)).toBe(true);
  return cold;
}

describe('ordinary spread callable unions', () => {
  const mixedReturn = `
    const left = (name: string) => 7;
    const right = (name: string) => 'safe';
    const selected = flag.get() ? left : right;
    run.expose.emit('changed', selected('key'));
  `;

  it('retains every return alternative for equal checked parameters', () => {
    accepted(mixedReturn);
  });

  it('retains the preceding callable when an optional spread is absent', () => {
    accepted(`
      const extra: { read?: (name: string) => number } = {};
      if (flag.get()) extra.read = (name: string) => 7;
      const forwarded = { read: (name: string) => 'safe', ...extra };
      run.expose.emit('changed', forwarded.read?.('key'));
    `);
  });

  it.each([
    [
      'incompatible parameter domains',
      `const a = (value: string) => 1; const b = (value: number) => 2;
       const selected = flag.get() ? a : b; selected('key');`,
    ],
    [
      'a noncallable alternative',
      `const selected = flag.get() ? ((value: string) => 1) : 7; selected?.('key');`,
    ],
    [
      'a missing required argument',
      `const a = (value: string) => 1; const b = (value: string) => 'safe';
       const selected = flag.get() ? a : b; selected();`,
    ],
  ])('rejects %s before execution', (_, body) => {
    const parsed = parsePrototype(source(body));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].code).toBe('PUI1006');
  });

  it('does not let serialized IR erase one possible call result', () => {
    const ir = accepted(mixedReturn);
    let replacements = 0;
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.kind === 'call') {
        const callee = node.callee as Record<string, unknown> | undefined;
        if (callee?.kind === 'reference' && String(callee.name).includes('selected')) {
          node.type = 'string';
          replacements++;
        }
      }
      for (const [key, child] of Object.entries(node))
        if (!['type', 'span', 'sourceFiles'].includes(key)) visit(child);
    };
    visit(ir);
    expect(replacements).toBe(1);
    expect(validateIR(JSON.parse(JSON.stringify(ir))).ok).toBe(false);
  });
});

describe('known immutable nullish spread inputs', () => {
  it.each(['undefined', 'null'])(
    'keeps the actual %s initializer through a declared view',
    (empty) => {
      accepted(`
      const original: { unused?: string } | null | undefined = ${empty};
      const alias = original;
      run.expose.emit('changed', { ...alias, value: 'safe' });
    `);
    }
  );

  it('does not treat a mutable later object as its earlier undefined initializer', () => {
    const parsed = parsePrototype(
      source(`
      let current: { hidden?: string } | undefined = undefined;
      current = { hidden: undefined };
      run.expose.emit('changed', { ...current, value: 'safe' });
    `)
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].code).toBe('PUI1006');
  });
});
