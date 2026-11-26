# Sprint 5 integration commit-hook reconciliation

The ordinary repository hook created merge commit `5b5716d042bffc056b46e1f218f5d380399d5724` from the original Sprint 5 head `b5a02916b9cd2246ee467c19f91f4e9861a4d7a5` and main `1dd7afa3ea4ff43c1f28306c9b035e87ed11ea62`. It formatted sixteen files carried unchanged from main, moving the prepared tree `5941d11111eff2f6c731cb96971de1e00e52dea3` to `b796e84a6d555dc0c15bc771ad4de8dcc0e1552c`. Publication was held after reading the actual commit and tree. That merge remains in history.

## Exact frozen input restoration

The Dialog study's `fixture.ts` and `oracle.test.ts` are directly constrained by the existing `plan.json` and `freeze/check-freeze.json` raw hashes. The plan's original SHA-256 is also the retained summary's `planSha256`. Formatting changes these identities even when parsed code and data remain equivalent.

This follow-up restores only those three exact paths from the unchanged main parent. It adds three complete paths to the existing historical byte-preservation policy in `.prettierignore`. The ordinary hook remains enabled. It does not ignore the study directory, maintained report or source-variant scripts, ordinary runtime source, specifications or other tests. No old hash, timestamp, assertion or failed outcome is replaced.

## Retained equivalent formatting

The other thirteen paths retain normal formatting. Across all sixteen changes, the six JSON documents preserve parsed values, eight TypeScript/JavaScript files preserve parsed structure and literals, the YAML entity preserves parsed values, and the Markdown record preserves its content and table cells. The AST comparison retains syntax flags and removes source positions, parser caches, comments and multiline layout metadata. The complete path, blob and raw-hash inventory is in the [reconciliation record](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint5-hook-reconciliation/reconciliation.json).

The maintained study scripts' historical hash references describe source copies inside the raw archive. They are not a promise that current maintained scripts remain permanently unformatted. The unchanged archive SHA-256 remains `6070865e0f5f49b385563abe580c31dc6c62ff1fcc844e13f81ba06ec8c0b9c1`; all 607 archived members passed byte-count and SHA-256 readback. The current reducer loaded all nine archived final cells and reproduced the archived report exactly. This is historical receipt verification, not a new product execution.

The study's existing Node classifier and preparation controls passed **13/13**, with zero failed or skipped tests. The original Sprint 5 integration validations remain separate: the unchanged original reveal suite passed 28/28 before integration; the focused integrated selection passed 187/187; the original 44-file selection passed 786/786; and the Node conflict controls passed 2,235/2,235 after the earlier 20 failures were preserved and resolved. Those runs identify their actual prepared trees and are not relabeled as native, browser or full-workspace acceptance on this follow-up.

## Retained unresolved observations

The actual command `node scripts/coverage-matrices/prototype-coverage.mjs --check` exited 1 with a candidate source path-set drift and stale binding/object proof for `internal/website/self-hosting-coverage-matrix.md`. The pre-hook structured matrix and that website matrix both match the main parent; the structured matrix's formatting preserves parsed data. Its advertised candidate is still `15fb805919169ae8b31acc67105494a1e7b5ec54`. This follow-up neither refreshes that projection nor claims the check passed.

The Dialog study plan already did not match `packages/adapters/web-component/test/dialog-overlay.test.ts` before the hook ran. The hook introduced two additional input mismatches, which this change removes. Restoring these frozen bytes does not establish that the complete historical study can run on current integration source.

Current exact-head CI, contribution requirements and eligible independent review remain separate. The parent's technical review accepted this bounded merge-resolution and byte-preservation work; it is not full-PR or platform acceptance.

The additional `git diff --check` observation reports the frozen fixture's original blank line at EOF. That exact original byte is retained with its existing hash; it is not trimmed to manufacture a clean whitespace result. The other follow-up paths are checked separately.
