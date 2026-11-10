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

`node scripts/coverage-matrices/prototype-coverage.test.mjs` — 120 cases; 69 failures before this sync, 55 after, with no case regressed. The 14 newly passing cases are the ledger/JSON agreement assertions that the stale `consumerRows` entries had broken, including `review 4198701671: consumer program and exact ledger are closed sets`. The 55 remaining failures are pre-existing source-state gaps in this checkout, not drift from this change: the retained Shadcn style source pins `LICENSE.md` while it is stored under `upstream/`, `P-BASE-MENUBAR` cites two Base families without one inherited owner, and the GPUI native-receipt cases lack their bound receipts.

The readable views (`prototype-coverage-matrix.md`, `finf-delivery-checklist.md`) were not regenerated: the canonical `--write` path fails candidate-source validation on current main (`internal/fixtures/shadcn-style-source/LICENSE.md` is pinned by the retained manifest but stored under `upstream/`), and the two views are already stale on main for unrelated JSON drift. Both gaps pre-date this change and belong to #870's broader reconciliation.

## Original-condition accounting

| Source key | Original condition | Current accounting |
| --- | --- | --- |
| `745.body.Acceptance.1` | Both exact rows and their re-review triggers reflect the merged #531 research result. | Delivered by #928, extended by #1417; this sync ensures the derived JSON projection agrees with the authoritative ledger. |
| `745.body.Acceptance.3` | The matrix checker and focused tests pass on the candidate. | The five focused cases pass. The matrix checker's `--write` path has a pre-existing fixture dependency unrelated to editor rows. |
| `745.body.CurrentDirection.InspectorDelta` | Assess new Inspector requirements as explicit deltas while retaining research/infrastructure exemptions and old validation failures. | Ledger text (from #1417) and JSON projection (this change) now agree; the Inspector delta is consistently reflected in both the source ledger and the derived index. |
