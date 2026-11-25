import { expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src/compile';

const source = `import { definePrototype } from '@proto.ui/core';
import { asNativeLink } from '@proto.ui/hooks';
import { declareNativeLink } from '@proto.ui/module-native-link';
export default definePrototype({ name: 'declared-native-link', modules: [declareNativeLink()],
  setup(def) { const link = asNativeLink(); def.lifecycle.onCreated(() => link.sync({ href: '/safe' })); return () => 'Link'; }
});`;
it.each([
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
  'gpui-source-v1',
  'qt-source-v1',
  'flutter-source-v1',
])('does not manufacture native-link Compiler support for %s', (profile) => {
  const result = compilePrototype(source, { profile });
  expect(result.ok).toBe(false);
  expect('value' in result).toBe(false);
  if (!result.ok) expect(result.diagnostics.length).toBeGreaterThan(0);
});

// The React DOM source profile admits the declared Native Link operations.
it('admits the declared sync operation on the React DOM source profile', () => {
  const result = compilePrototype(source, { profile: 'react-dom-source-v1' });
  expect(result.ok).toBe(true);
  const undeclared = compilePrototype(source.replace('modules: [declareNativeLink()],', ''), {
    profile: 'react-dom-source-v1',
  });
  expect(undeclared.ok).toBe(false);
  if (!undeclared.ok) {
    expect(
      undeclared.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('static native-link declaration')
      )
    ).toBe(true);
  }
});
