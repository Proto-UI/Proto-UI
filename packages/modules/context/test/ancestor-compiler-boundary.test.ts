import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../../../compiler/src/compile';
import { parsePrototype } from '../../../compiler/src/parser';

// This author extension is Runtime WIP. Existing compiler profiles must reject
// it at its source span, never silently emit unsupported native/Web behavior.
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
  ])('rejects unimplemented ancestor operations for %s', (profile) => {
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
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics[0]).toMatchObject({
          code: 'PUI1004',
          category: 'unsupported-input',
        });
        expect(result.diagnostics[0].message).toMatch(/Unsupported member context on (def|run)/);
        expect(result.diagnostics[0].span.line).toBe(5);
      }
    }
  });
});
