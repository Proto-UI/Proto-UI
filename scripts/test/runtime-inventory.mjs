// The executor and exact-source CI plan must discover the same test files.
// Keep explicit non-TypeScript entries here alongside the shared globs.
export const RUNTIME_TEST_INCLUDES = Object.freeze([
  'packages/**/*.test.ts',
  'packages/**/test/**/*.test.ts',
  'internal/contracts/__tests__/**/*.test.ts',
  'apps/**/test/**/*.test.ts',
  'apps/www/test/proto-ui-source.test.mjs',
  'apps/www/src/**/*.test.ts',
]);
