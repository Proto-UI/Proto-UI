# Editor boundary projection: consumerRows sync

Date: 2026-11-11

Status: bounded derived-projection synchronization for [#745](https://github.com/Proto-UI/Proto-UI/issues/745). No new source, implementation, engine selection, entity admission or Inspector/editor runtime capability is claimed.

## Gap

The merged [PR #1417](https://github.com/Proto-UI/Proto-UI/pull/1417) delivered the Inspector delta into both editor rows of `internal/agent-harness/dogfood-coverage-matrix.md` and produced the [authoritative audit record](2026-11-10-editor-inspector-matrix-delta.md). That commit updated the ledger text but did not regenerate the derived `consumerRows` entries in `internal/coverage-matrices/prototype-coverage-matrix.json` or the `issues` index. The existing five-case `editor-boundary-projection.test.mjs` therefore reported field drift between the authoritative ledger and the stale JSON projection.

## What changed

Only `internal/coverage-matrices/prototype-coverage-matrix.json` was modified. The canonical `consumerLedgerRows` producer in `scripts/coverage-matrices/prototype-coverage.mjs` was used to parse the current ledger and update the two editor `consumerRows` entries field-by-field, plus the derived `issues` index. No ledger text, row IDs, states, milestones, or other consumer rows were modified.

## Fields synced

| Row | Updated fields | Issues index |
| --- | --- | --- |
| `harness.future.editor-chrome` | Target owner, Proto UI chain, App state and semantic events, Production host and equivalence evidence, Evidence, Re-review or removal issue | 531, 614, 745 → +928 |
| `harness.future.editor-engine` | Target owner, App state and semantic events, Production host and equivalence evidence, Evidence, Re-review or removal issue | 531, 614, 745 → +928 |

## Verification

`node scripts/coverage-matrices/test/editor-boundary-projection.test.mjs` — 5/5 pass.

`node scripts/coverage-matrices/prototype-coverage.mjs` — the 11 `Consumer source field drift` errors that this sync targeted are 0 on the candidate. The same 11 errors are present on the pre-sync source, so they measure the stale derived projection rather than an unrelated condition.

`node scripts/coverage-matrices/test/prototype-coverage.test.mjs` — 120 cases; 69 failures before this sync, 55 after, with no case regressed. The 14 newly passing cases are the ledger/JSON agreement assertions that the stale `consumerRows` entries had broken, including `review 4198701671: consumer program and exact ledger are closed sets`.

The 55 remaining failures are pre-existing source-state gaps in this checkout, not drift from this change, and they were read from the retained failure bodies rather than inferred. 50 of them fail inside `refreshCandidateSource` with `Catalog entity P-BASE-MENUBAR cites multiple base families (menu-primitives, menubar) without one inherited Base family`. The other 5 fail candidate-source validation with `ENOENT ... internal/fixtures/shadcn-style-source/LICENSE.md`, because the retained Shadcn style manifest pins that file at the fixture root while it is stored under `upstream/`. The GPUI receipt cases are among both groups: they fail at that earlier catalog or candidate-source step and never reach receipt validation, so their named receipts are not the cause.

Exact-head CI on the merged head `ffd95676adabb811a620a59f70ed5452317bb394` passed: DCO, `test-plan`, `lockstep-check`, `ci-config-audit` and `public_package_plan`. The only review recorded on that pull request is a bot comment stating that the reviewer could not run because the requesting user had insufficient remaining quota, so no formal independent approval accompanied the merge and the independent-review half of `745.body.Acceptance.3` remains unfulfilled. The merge was an administrative merge by the repository maintainer; a passing check run and an administrative merge are not independent acceptance.

The readable views (`prototype-coverage-matrix.md`, `finf-delivery-checklist.md`) were not regenerated: the canonical `--write` path fails candidate-source validation on current main (`internal/fixtures/shadcn-style-source/LICENSE.md` is pinned by the retained manifest but stored under `upstream/`), and the two views are already stale on main for unrelated JSON drift. Both gaps pre-date this change and belong to #870's broader reconciliation.

## Original-condition accounting

| Source key | Original condition | Current accounting |
| --- | --- | --- |
| `745.body.Acceptance.1` | Both exact rows and their re-review triggers reflect the merged #531 research result. | Delivered by #928, extended by #1417; this sync ensures the derived JSON projection agrees with the authoritative ledger. |
| `745.body.Acceptance.3` | The matrix checker and focused tests pass on the candidate, then exact-head CI and independent review pass before merge. | The five focused cases pass and the matrix checker's 11 consumer-drift errors are 0. The broader `prototype-coverage` suite fixes 14 cases and regresses none; its remaining 55 failures and the checker's `--write` path have a pre-existing fixture dependency unrelated to editor rows. Exact-head CI passed on the merged head, but no independent review passed before the administrative merge, so this condition is partially fulfilled. |
| `745.body.CurrentDirection.InspectorDelta` | Assess new Inspector requirements as explicit deltas while retaining research/infrastructure exemptions and old validation failures. | Ledger text (from #1417) and JSON projection (this change) now agree; the Inspector delta is consistently reflected in both the source ledger and the derived index. |
