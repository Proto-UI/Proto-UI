# PR #1797 and native-control readback after workspace reset

Inspection completed at **2026-11-24 11:58:02 UTC**. Read-only GitHub connector calls were used. No PR, branch, workflow, approval, review, or CI retry was changed.

## Current PR and main

GitHub currently records PR [#1797](https://github.com/Proto-UI/Proto-UI/pull/1797) as **merged**, state closed, draft false:

- `merged_at: 2026-11-24T11:39:57Z`
- `merged_by: cyjin-yl`
- PR head: `6a8117e904bb0c8facece4b96cea1dd22ea992de`
- Merge commit: `fd3796c2d70b0efb738b20c764f5fc1c4133fdc5`

The intervening head commit `6a8117e...` records author/committer `cyjin-yl`, parents `e47c697...` and `566afd9da983e2e29772f6afd033bf75c0f95ea6`, and the message “Merge remote-tracking branch 'origin/main' into HEAD”. The merge commit has parents `566afd9...` and `6a8117e...`. These are live platform facts; this inspection performed neither operation.

The observed protected main head is now `4aaac6ac60348dc99896c34cd1186abcda98ff0d`. The GitHub comparison reports it 47 commits ahead and zero behind the PR merge commit, with `fd3796c...` as the merge base. The PR merge is therefore contained in this observed main revision.

## Full CI remains source-bound to e47

[Run 45383599762](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762), attempt 1, remains the one `workflow_dispatch` at:

`e47c69754d983d95dc356521b1fc02094aa590b1`

It does not test the later merged head or current main. Its aggregate response says `status=queued`, `conclusion=null`; the contemporaneous complete 89-job listing has:

| Job state | Count |
| --- | ---: |
| Completed success | 32 |
| Completed failure | 29 |
| Completed skipped | 4 |
| In progress | 7 |
| Queued | 17 |

These are a live snapshot, not terminal totals. The aggregate response and job details do not provide a completed green full-CI receipt. Existing failed jobs remain failed.

## Browser 11: new native controls pass; the shard fails elsewhere

[Job 138409100661](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762/job/138409100661), `test-browser (11/18, browser-11-of-18)`:

- Started `2026-11-24T11:41:02Z`; completed `2026-11-24T11:53:18Z`.
- Source exactly `e47c697...`.
- Setup, dependency installation, Chrome/font preparation and evidence upload succeeded.
- Job conclusion **failure**.
- Seven test files; 56 tests: **50 passed, 6 failed, 0 pending**.
- The six failures are all in `code-surfaces.browser.test.ts`: native token-selection mismatch at 1440/390 widths, and horizontal-geometry mismatch at 320 widths. No baseline causality claim is made.

The new `contents-wheel-evidence.browser.test.ts` **executed both cases and passed 2/2, with zero skipped**. The Vitest artifact records:

| Control | Result | Observed native evidence |
| --- | --- | --- |
| cancellation=false | Passed, 360.74 ms | Trusted wheel, deltaY 400, surface/content in path, final defaultPrevented=false; scrollTop 0 → 400 |
| cancellation=true | Passed, 269.22 ms | Trusted wheel, deltaY 400, surface/content in path, final defaultPrevented=true; scrollTop stays 0 |

Both receipts bind clean source `e47c697...`, observer SHA-256 `debc92aff6daa1b05f3bfa8dc1c79f9fbc0f96e51d50babc739811aea2e00a94`, and Chrome `157.0.8103.78`. After replacing the dialog, both report `ready=false` and `sameDialog=false`, with no completion errors.

The cancellation=true receipt also preserves that capture and its microtask saw false before the target set cancellation true. The observer's final native event result correctly records true. This is the specific phase/final-state distinction the controls were designed to test.

The artifact explicitly scopes these as **authored oracle controls, not public Popover acceptance**. A passing control suite is not a passing shard, complete CI, original-versus-candidate public Popover matrix, merged-head verification, or release acceptance.

## Retained evidence and reset boundary

The earlier local workspace disappeared during an environment reset. This directory contains newly fetched original GitHub responses, decoded job logs, and the downloaded artifact; it does not pretend the lost earlier local files survived.

Native artifact:

- ID `14916873192`
- Name `runtime-ci-45383599762-browser-11-of-18-attempt-1`
- ZIP size **1,672,996 bytes**
- GitHub SHA-256 `afecbb15ec836d673f191e3363a238ca50d9ad8e03dd63d206f68153cb2071a2`
- Digest verified against the downloaded ZIP before extraction.
- Source head in artifact metadata, runner receipt, selection and both control JSONs is exactly e47.

The original dispatch-service evidence was separately recovered from retained tool-store bytes, not reconstructed or re-executed:

- `recovered-original-dispatch-service-evidence.json.gz`
- **9,032 bytes**
- SHA-256 `541cf5e863cf59b5e2b77a85377b199061b550300fb1bec8297107a6d51415d3`
- Contains the original single dispatch payload, HTTP 204 acknowledgment, preflight and matching-run readback.

The earlier local Chromium socket/namespace failures retain their historical scope. Hosted success for these two controls supersedes “controls still unexecuted” only for this new source-bound evidence; it does not erase or reinterpret those earlier failures.

