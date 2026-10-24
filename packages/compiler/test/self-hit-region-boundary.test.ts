// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
it('rejects self-region calls until the compiler profile admits their owned lifecycle', () => {
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
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unadmitted self-region call was silently emitted');
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'PUI1004',
        category: 'unsupported-input',
        span: expect.objectContaining({ line: 6, column: 39 }),
      }),
    ])
  );
});
