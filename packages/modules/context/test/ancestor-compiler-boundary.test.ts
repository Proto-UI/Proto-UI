import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src';

describe('ancestor Context compiler capability extraction (v2 / #1809)', () => {
  it.each([
    'def.context.trySubscribeAncestor(KEY);',
    'def.lifecycle.onMounted((run) => { run.context.tryReadAncestor(KEY); });',
  ])('records context capability and emits Tier-2 protocol wrapper for %s', (operation) => {
    const source = `
      import { definePrototype, createContextKey } from '@proto.ui/core';
      const KEY = createContextKey<{ value: number }>('ancestor');
      export default definePrototype({
        name: 'ancestor-boundary',
        setup(def) {
          ${operation}
          return (r) => r.el('div', 'Ancestor');
        },
      });
    `;
    const result = compilePrototype(source, { llvm: { verify: true } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const proto = result.value.ir.prototypes[0];
    expect(proto.tier).toBe('protocol');
    expect(proto.capabilities).toContain('context');
  });
});
