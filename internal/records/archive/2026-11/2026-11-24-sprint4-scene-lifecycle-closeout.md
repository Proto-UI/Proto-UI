# Scene lifecycle closeout on c18

This change repairs synchronous source-root and physical-cleanup reentry in both the Runtime and generated scene owners. It also repairs three concrete fixture types exposed by the new owned-pixels / owned-scene union.

## Source and failure boundaries

The source baseline is c18bf8f8c35a4ec1f69791468a5952c4cb460f41. The first two complete scene test files retained all 48 existing cases and added four regressions. Against unchanged baseline product source, those cases produced 48 passes and four assertion failures: retired source-root observer installation, retired publication replacement, and factory-failure fallback retirement in Runtime and generated paths.

The first product repair passed all 52. Independent review then added two physical-cleanup reentry controls without changing those 52 tests. On that intermediate candidate, 52 passed and two failed. Both failures observed reentry and the authored gradient incorrectly covering the current scene; final disposal already restored the authored gradient correctly. The later product repair waits for physical cleanup to finish before draining the latest admitted publication.

The clean exact c18 baseline, after the official style-generation prerequisite, had ten TypeScript errors. The intermediate candidate produced byte-identical diagnostics. Independent fixture aliases, satisfies declarations, and explicit source-kind guards repaired those pre-existing fixture errors while retaining every original assertion.

## Actual validation

- Original two scene files: 48 existing passes / four new assertion failures, followed by 52 passes after the initial repair.
- The later cleanup regression: 52 passes / two new assertion failures; unchanged complete 54 cases then passed with the final product repair, without skipped or todo cases.
- The two original fixture test files passed 34 of 34.
- Full workspace TypeScript passed after the fixture repair and again after the final cleanup repair, using the official generated styles. The final command was node node_modules/typescript/bin/tsc -p tsconfig.workspace.json --noEmit.
- Normal authored-source formatting, the canonical shader-host generator, its --check mode, and Git diff checks passed. Generated host source was produced normally, never edited manually.

The execution archive and manifest contain the exact commands, timestamps, exit codes, stdout/stderr, before/after sources, patch identities, and raw Vitest reports for every phase. The failed pre-style attempt and both stages of real assertion failures remain preserved. The source review roles are recorded separately from actual execution.

## Remaining acceptance

The new complete 37-case shader browser gate and the canonical package measurement must run on this published combination. Prior c1 / c18 hosted 37-case and nine-entry budget results remain valid only for their recorded source. This change preserves the author's existing numeric ceilings. No browser deadline, case, assertion, or package threshold is relaxed.

Public evidence: [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-scene-lifecycle-closeout/manifest.json) and [raw execution archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-scene-lifecycle-closeout/execution.tar.gz).
