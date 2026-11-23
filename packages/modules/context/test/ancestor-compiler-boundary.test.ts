import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src/compile';
import { parsePrototype } from '../../../compiler/src/parser';

// The explicit ancestor contract now has Web source lowering. Targets without
// that implementation must continue to reject the operation without fallback.
describe('ancestor Context compiler capability boundary', () => {
  it.each([
    'react-runtime-v1',
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'gpui-source-v1',
    'qt-source-v1',
    'flutter-source-v1',
  ])('admits only implemented ancestor operations for %s', (profile) => {
    for (const operation of [
      'def.context.trySubscribeAncestor(KEY);',
      'def.lifecycle.onMounted((run) => { run.context.tryReadAncestor(KEY); });',
    ]) {
      const source = `
          import { definePrototype, createContextKey } from '@proto.ui/core';
          const KEY = createContextKey<{ value: number }>('ancestor');
          export default definePrototype({ name: 'ancestor-boundary', setup(def) {
            ${operation}
            return (r) => r.el('div', 'Ancestor');
          } });`;
      const control = parsePrototype(
        source
          .replaceAll('trySubscribeAncestor', 'trySubscribe')
          .replaceAll('tryReadAncestor', 'tryRead')
      );
      expect(control.ok).toBe(true);
      const result = compilePrototype(source, { profile });
      const supported = [
        'react-runtime-v1',
        'react-dom-source-v1',
        'vue-source-v1',
        'vue2-source-v1',
        'web-component-source-v1',
      ].includes(profile);
      expect(result.ok).toBe(supported);
      if (!result.ok) {
        expect(result.diagnostics[0]).toMatchObject({
          // The typed member boundary rejects this unavailable Context facade
          // before syntax lowering. PUI1006 is its registered type diagnostic.
          code: 'PUI1006',
          category: 'unsupported-input',
          message: 'Undeclared object member context.',
        });
        expect(result.diagnostics[0].span.line).toBe(5);
        expect(source.slice(result.diagnostics[0].span.start, result.diagnostics[0].span.end)).toBe(
          operation.startsWith('def.context') ? 'def.context' : 'run.context'
        );
      }
    }
  });
});
