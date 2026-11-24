// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { checkTargetOperations, resolveTargetProfile } from '../src/targets';
it('rejects self-region static insets outside the admitted native lifecycle subset', () => {
  const result = parsePrototype(
    `
    import { definePrototype } from '@proto.ui/core';
    import { asHitParticipation } from '@proto.ui/hooks';
    export default definePrototype({ name: 'self-hit-boundary', setup(def) {
      const hit = asHitParticipation();
      def.lifecycle.onMounted(() => { hit.registerSelfRegion({ staticHitInset: { left: { value: 12, unit: 'px' } } }); });
    } });`,
    { fileName: 'self-hit-boundary.proto.ts' }
  );
  const control = parsePrototype(
    `import { definePrototype } from '@proto.ui/core';
    import { asHitParticipation } from '@proto.ui/hooks';
    export default definePrototype({ name: 'self-hit-control', setup() {
      const hit = asHitParticipation(); hit.configure({ mode: 'participating' });
    } });`,
    { fileName: 'self-hit-control.proto.ts' }
  );
  expect(control.ok).toBe(true);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const profile = resolveTargetProfile('react-dom-source-v1');
  if (!profile.ok) throw new Error(JSON.stringify(profile.diagnostics));
  const admission = checkTargetOperations(result.value, profile.value);
  expect(admission.ok).toBe(false);
  if (admission.ok) throw new Error('unadmitted self-region inset was silently emitted');
  expect(admission.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction v1 does not support option staticHitInset.',
        category: 'unsupported-input',
        span: expect.objectContaining({ line: 6, column: 80 }),
      }),
    ])
  );
});
