import { expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src';

const source = `import { definePrototype } from '@proto.ui/core';
import { asNativeLink } from '@proto.ui/hooks';
import { declareNativeLink } from '@proto.ui/module-native-link';
export default definePrototype({
  name: 'native-link-boundary',
  modules: [declareNativeLink()],
  setup(def) {
    const link = asNativeLink();
    def.lifecycle.onCreated(() => link.sync({ href: '/safe' }));
    return () => 'Link';
  },
});`;

it('extracts nativeLink capability cleanly and stays in Tier-2 protocol wrapper (v2 / #1809)', () => {
  const result = compilePrototype(source, { llvm: { verify: true } });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const proto = result.value.ir.prototypes[0];
  expect(proto.tier).toBe('protocol');
  expect(proto.capabilities).toContain('nativeLink');
  expect(result.value.primary!.react.code.split('\n').length).toBeLessThan(35);
});
