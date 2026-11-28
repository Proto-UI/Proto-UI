// The four reviewed cleanup importers select only runAllSteps. Their complete
// source hashes bind that named import; both the existing internal entry and
// its import-free implementation must retain these reviewed bytes as well.
// This is not permission for another Core internal export or importer.
export const SYNCHRONOUS_STEPS_SOURCE_CLOSURE = Object.freeze([
  Object.freeze({
    path: 'packages/core/src/internal.ts',
    sha256: '71ad0311d9129fbbaac337b02e30f0136a0d7b1e5a3f1be084db6a186aa74a3c',
  }),
  Object.freeze({
    path: 'packages/core/src/internal/synchronous-steps.ts',
    sha256: '0556bfbc5969b693a6f779b2d7e1f25fa8e34a3882e247212f42a3cd2e2dff54',
  }),
]);
