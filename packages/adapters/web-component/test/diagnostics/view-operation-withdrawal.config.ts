import base from '../../../../../vitest.config';

// Explicit, reproducible HappyDOM diagnostic. Its original two failures are
// not passing conformance and must never replace the required native suite.
export default {
  ...base,
  test: {
    ...base.test,
    include: [
      'packages/adapters/web-component/test/diagnostics/view-operation-withdrawal.happy-dom.ts',
    ],
  },
};
