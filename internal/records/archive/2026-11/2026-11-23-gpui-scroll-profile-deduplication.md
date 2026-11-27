# GPUI scroll profile duplicate removal

Date: 2026-11-23 UTC.

## Source and scope

The integrated S5 branch listed `scroll.sync` twice in the GPUI profile after both the earlier S5 repair and main's existing admission were retained. This change removes only the first duplicate string. The remaining GPUI entry still admits the implemented operation. The shared `nativeOperations` list and every other target profile are unchanged.

- Parent: `691f31462159af32882b65e0f3630c5ce04475d7`.
- Source: `packages/compiler/src/targets.ts`.
- Parent file SHA-256: `c66a50f16798afd2555baf04d617d30a737ba4f21eddebd18a98236fcc82add2`.
- Candidate file SHA-256: `2fd07e809c8b740303e8ea7b23a119e6d529cbf79425d2ce526488ac0b475e58`.
- The complete candidate file is byte-identical to the same file in integrated main `457d27f7fe554f398970a836ee9c95edb4846f47`.

This is a merge redundancy cleanup; no new failing product behavior is asserted. The earlier profile repair's original failure and validation records remain in history.

## Actual bounded validation

The existing public compiler, GPUI lifecycle, capability, legal-axis and rejection controls passed: **32 tests, 32 passed, zero failed, zero pending**. The three unchanged test files are:

- `packages/compiler/test/scroll-axis-sync.test.ts`
- `packages/compiler/test/gpui-event-notification.test.ts`
- `packages/compiler/test/gpui-capabilities.test.ts`

The run used Node 24.22.3 and pnpm 10.32.1, Vitest with one worker, and both the default and JSON reporters. Exact argv, timestamps, raw output and source hashes are retained in the [evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-gpui-scroll-profile-deduplication/manifest.json). Source hashes matched before and after the test. Prettier and file-scoped `git diff --check` both exited zero.

No test or assertion was changed to obtain this result. This source validation does not claim new Cargo, browser, macOS, physical accessibility, or hosted acceptance.

## Separate browser diagnostic archive

The accompanying [browser retirement diagnostic](2026-11-23-sprint5-browser-retirement-diagnostic.md) preserves its exact observed d995 source and failure receipts. It retains the 250-millisecond cleanup failure and the later zero-fill profile attempt. Its instrumented 17/19 result is not an unobserved canonical pass and does not unblock Ready by itself.
