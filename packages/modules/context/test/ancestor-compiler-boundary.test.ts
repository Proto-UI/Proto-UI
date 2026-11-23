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
      expect(parsePrototype(source).ok).toBe(true);
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
        expect(result.diagnostics).toHaveLength(1);
        if (profile === 'gpui-source-v1') {
          // Source admission is shared; the implemented GPUI target rejects
          // this exact operation without borrowing Web lowering.
          const method = operation.startsWith('def.context')
            ? 'trySubscribeAncestor'
            : 'tryReadAncestor';
          expect(result.diagnostics[0]).toMatchObject({
            code: 'PUI4003',
            category: 'unsupported-input',
            message: `Operation context.${method} is not implemented by gpui-source-v1. Select an explicit supported profile; native output never falls back to Runtime/Adapter.`,
          });
          const { span } = result.diagnostics[0];
          expect(span.line).toBe(5);
          expect(source.slice(span.start, span.end)).toBe(
            `${operation.startsWith('def.context') ? 'def' : 'run'}.context.${method}(KEY)`
          );
        } else {
          // These public profiles are not registered as implemented. Their
          // target-selection refusal precedes any operation-level judgment.
          const framework = profile === 'qt-source-v1' ? 'qt' : 'flutter';
          expect(result.diagnostics[0]).toMatchObject({
            code: 'PUI4001',
            category: 'unsupported-input',
            message: `Target profile ${profile} identifies ${framework}, but no working emitter is implemented. Choose an implemented profile explicitly.`,
            span: { file: '<target>', start: -1, end: -1, line: 0 },
          });
        }
      }
    }
  });
});
