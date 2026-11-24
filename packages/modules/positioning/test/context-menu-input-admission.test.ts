// @vitest-environment node
import { expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src';

it('records experimental context menu input hook without inventing static lowering (v2 / #1809)', () => {
  const result = compilePrototype(
    `import { definePrototype } from '@proto.ui/core';
import { asContextMenuInput } from '@proto.ui/hooks';
export default definePrototype({
  name: 'context-input-admission',
  setup() {
    asContextMenuInput();
  },
});`,
    { fileName: 'entry.proto.ts', llvm: { verify: true } }
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const proto = result.value.ir.prototypes[0];
  expect(proto.tier).toBe('protocol');
  expect(proto.hooks.some((h) => h.name === 'asContextMenuInput')).toBe(true);
});
