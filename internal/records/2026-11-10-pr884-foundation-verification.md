# PR884 foundation synchronization and verification — 2026-11-10

This additive, non-normative record recovers the remaining evidence for [Issue #1153](https://github.com/Proto-UI/Proto-UI/issues/1153). The [machine-readable companion](2026-11-10-pr884-foundation-verification.json) binds the source conditions, all 40 affected historical/current paths, 22 preserved author-conversation source keys and actual read-only observations. It is a prepared evidence repair; the original verification condition remains open.

## Original requirement and source identity

The complete original checkbox is retained unchanged:

> - [ ] 提升 PR884 版本并完成验证（PR884 与672 加速闭环）— 历史状态 pending

Its frozen criterion keys are `issue.1153.001` and parent `issue.1092.003` in `internal/governance/release-0.3-source-ledger.json`. The live Issue body still hashes to the frozen `6966c55e5a0345e4a7f585297b06c9dd2dce71175f923dcc877db195e0944087`. The source chain is #1153 → [#1092](https://github.com/Proto-UI/Proto-UI/issues/1092) → [#887, “相邻中断会话 / PR884 与672 加速闭环”](https://github.com/Proto-UI/Proto-UI/pull/887).

The actionable original source key is `owner-conversation:884:6095679394`, retained in [public carrier part 4](https://github.com/Proto-UI/Proto-UI/pull/887#issuecomment-6164204577) and `internal/records/2026-10-14-finf-followup-source-debt.json`. Its [coordination notice](https://github.com/Proto-UI/Proto-UI/pull/884#issuecomment-6095679394) asks to:

1. Synchronize #884 onto the evolving #872 foundation, retaining its own changes.
2. Resolve conflicts without dropping existing work.
3. Rerun relevant CI at the new exact head.
4. Refresh independent review evidence after synchronization.
5. Check the actual resulting main/latest #872 ref when that foundation advances or lands, rather than treating the observed `14ce5ddee6311b3b8e807f8b5ac24e1ba4173c92` as permanent.

The notice explicitly describes the “0.3.0 rc mainline” as a forward plan and disclaims a release, merge, review approval or CI waiver. Here, “version” means the source/foundation revision. This repair selects no package version and performs no release or publication.

The [2026-11-06 triage comment](https://github.com/Proto-UI/Proto-UI/issues/1153#issuecomment-6684405438) calls the item substantively moot because both PRs merged. That dated statement remains history. Merge state does not discharge the original verification and independent-review conditions. The frozen release disposition remains `criterion-split`; this record changes no release ledger or disposition.

## Actual delivery and evidence

| Subject | Actual source and delivery | Evidence and limits |
| --- | --- | --- |
| #884 preserved archive | `136e16b57c19de961532fa17cef51961f926bd7e`, tree `3c15075908e74a19e848194c7a77aa23ec37edd4`; live archive ref `archive/finf-200/pr884-136e16b5` still points there | The notice foundation is an ancestor of this archive. Its 38 contribution paths exactly match the compact integration head. The historical 557-commit count comes from the dated source-closure record, not a new complete enumeration. |
| #884 integration | Compact head `1e8df39f9524af063a139b8e08d07fa092b5c72a`, tree `77fe6e55cc35f32ff155939ebe30f4ae1d44d2ac`; [merge `a247ae2c9fa6b8a54467fe6072048d4692f57e1c`](https://github.com/Proto-UI/Proto-UI/commit/a247ae2c9fa6b8a54467fe6072048d4692f57e1c), 2026-10-14 | The 39th changed path is the source-closure receipt. Historical source preservation is observed byte equality, not proof of all behavior. |
| #884 DCO | [Native App 1861 / check 115708661470](https://github.com/Proto-UI/Proto-UI/runs/115708661470) genuinely succeeded on `1e8df39f` | The old [136e check 115129941912](https://github.com/Proto-UI/Proto-UI/runs/115129941912) genuinely failed with an unknown verdict after incomplete 250-commit retrieval. That is not a missing-signoff finding and is not retroactively changed. |
| #884 CI | [Exact-head run 38520441828, attempt 1](https://github.com/Proto-UI/Proto-UI/actions/runs/38520441828): 22 canonical jobs, 12 success / 10 failure | The [general job](https://github.com/Proto-UI/Proto-UI/actions/runs/38520441828/job/115709017062) checked out synthetic merge `972d100efbe025ea35c06a337707ad72ec38b3b6`, whose tree equals the product head. It stopped at 78 public-docs drift findings before Vitest. All eight browser shards and aggregate failed. The complete latest check inventory has 81 entries, 41 success / 40 failure, including other workflows. |
| #884 historical Collapsible consumer | [Archive job 115129940991](https://github.com/Proto-UI/Proto-UI/actions/runs/38346784865/job/115129940991) and [compact-head job 115708677109](https://github.com/Proto-UI/Proto-UI/actions/runs/38520441934/job/115708677109) each passed 1 file / 36 tests | Both exact checkout SHAs and terminal summaries were recovered from original logs. These are real historical positive results, improving on the then-pending PR body. They do not verify current evolved source. Artifact uploads are reported by those logs; no artifact or PNG was downloaded or visually inspected in this task. |
| #884 independent review | Complete live review collection: **0 reviews** | No old approval is inferred. The current user's separate review-deferral instruction for PRs 1380–1387 does not backdate or supply approval for #884. |
| #672 | Head `6b4a6c7f21cc6018b2412b5c0f4a1467ed3b6e82`; [merge `8abb627b0950b8eaa9743be10e67eb18a9c65b29`](https://github.com/Proto-UI/Proto-UI/commit/8abb627b0950b8eaa9743be10e67eb18a9c65b29), 2026-09-21 | [APPROVED review 5266342044](https://github.com/Proto-UI/Proto-UI/pull/672#pullrequestreview-5266342044) binds that exact head. [CI 35591135538](https://github.com/Proto-UI/Proto-UI/actions/runs/35591135538) succeeded; all 11 latest check entries, including native DCO, succeeded. The PR's Windows 74-pass/1-fail → 75-pass report retains its original run/source attribution and was not re-executed or independently log-verified here. |

Live discussion collection covered #1153's 1 comment, #1092's 5 comments, #887's 77 comments, #884's 24 comments / 0 reviews / 0 review comments and #672's 8 comments / 3 reviews / 0 review comments. PR collection followed API pagination. The 22 substantive #884 source rows remain separate from its two bot comments; every original body remains in the unchanged source-debt record and is identified by its own digest in the companion.

The supplied worktree and live `heads/main` were both `0607c6c5c386b8a932ab850e92a8873b2121dc45`, tree `6dfeee464d3e4b73ffa3b1c311dca573390fbef9`. Neither historical merge SHA is an ancestor of that assigned base. This ancestry result alone establishes no source loss. All 40 union paths exist and match the assigned-base worktree: 22 match their integrated historical bytes and 18 have later bytes. In particular, `packages/cli/test/lowered-hook-coverage.test.ts` still normalizes `path.relative()` with `.split(path.sep).join('/')` before the shipped-tree coverage assertion. Later Runtime, lifecycle, fixture and consumer changes must be reviewed on their own source; restoring an old file wholesale would discard those changes.

## Authority and ownership

`AGENTS.md`, `spec/README.md` and the current `internal/governance/release-0.3-plan.md` distinguish source preservation, development completion and actual acceptance. `internal/agent-operations/contributor-agents.md` preserves the historical source-integration deferral without presenting it as technical approval.

| Authority | Current lifecycle | Applicable boundary |
| --- | --- | --- |
| `C-LIFECYCLE-0002`, `T-LIFECYCLE-0001` | draft | Failed-created cleanup and identical initiating values, including falsy values, remain distinct from later ordinary authored `beforeDispose` fail-fast rule K. The Test maps actual fixtures and Runtime consumers; a catalog `passing` field is not a new run. |
| `C-LIFECYCLE-0008` | active, legacy activation provenance not backfilled | View epochs and terminal instance ownership remain distinct; stale completions must become inert. |
| `C-DELAY-0001` | draft | Cancellation and terminal cleanup must suppress queued work without inventing timing guarantees. |
| `M-ANATOMY-0001`, `C-ANATOMY-0005` | draft | Nearest-root domains, retained claims and terminal boundaries; Expose owns capabilities and the host supplies logical structure/order. |
| `C-EXPOSE-0004`, `T-SHADCN-RADIO-GROUP-0001` | draft | #672's historical Expose/coverage references; no lifecycle or public-surface promotion follows from that correction. |
| `internal/contracts/prototype-base/notification-completion.v0.md` | draft legacy explanation | Caller-owned notification retirement complements the active instance/view boundary. Its Runtime fixtures do not certify native focus, gestures or every Adapter. |

This owner changes only the two new `2026-11-10-pr884-foundation-verification` records. Existing product, Compiler/IR, shared ledgers/registries, workflows, VERSION and package manifests remain outside this candidate. Main owns serial execution, independent review coordination and all Git/GitHub operations. The original family-semantic and consumer owners retain their scopes; same-source evidence can be reused with an explicit revision/digest binding.

## Original-condition accounting

| Original condition | Recovered state | Remaining operation |
| --- | --- | --- |
| Foundation synchronization | Historically performed; actual current main and source paths rebound | Refresh the exact source at Main validation/integration; do not repeat a merge of an already merged PR. |
| Preserve own work through conflicts | All 38 archive contribution paths preserved exactly at compact integration | Review the 18 evolved current paths through their owners and current consumer outcomes. Byte comparison alone does not settle semantics. |
| Relevant exact-head CI | Historical run really executed and failed; specific failures retained | Perform proportional current-source validation and reconcile applicable retained CI failures with current scheduled integration evidence and existing owners. A record-only PR or skipped heavy lane is not a replacement pass. |
| Independent review after synchronization | #884 has zero reviews | Obtain genuine current-source independent technical acceptance. Keep historical absence and any new review's exact source separate. |
| Follow foundation changes | Current main and per-path hashes recovered | Rebind evidence after a source change; old screenshots, source-equivalence claims and checks keep their actual revisions. |
| #672 acceleration/verification | Exact historical approval, green CI and merge are established; normalization remains in current source | Use a native Windows current consumer if claiming current portability. Do not repeat #672's already completed historical delivery. |
| Release/version boundary | The original notice supplies no release operation | No version selection, stamping or publication is needed or authorized by this slice. |

The full checkbox remains open until applicable verification, independent acceptance and lawful integration are earned or each remaining original clause receives an explicit criterion-bound disposition. This candidate uses `Refs #1153`, not an automatic closing directive.

## Serial Main validation and consumer commands

All commands below are **proposed and unrun by this owner**. Run them in the supplied worktree, or an exact source-bound Main integration worktree with the normal locked dependencies already available. Initially this worktree contains only the metadata YAML link; that is not a product dependency installation. Main supplies any dependency preparation and the single heavy slot. Preserve each command's real exit status, executed/failed/skipped counts and source identity. Do not repeat archived failures to reconfirm them.

Set the installed Node 24 and Corepack invocation once:

```sh
export PATH=/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin:$PATH
pui1153_pnpm() {
  node /usr/local/lib/node_modules/corepack/dist/corepack.js pnpm@10.32.1 "$@"
}
```

**Before/after evidence-record control.** The before-state is the untouched assigned source plus the original pending checkbox and historical receipts above. Both new record paths were absent before preparation; no failed product-before result is claimed. After adding these two files, validate their actual source bindings and a rejecting corrupted-digest control without changing product files:

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordPath = 'internal/records/2026-11-10-pr884-foundation-verification.json';
const packet = JSON.parse(readFileSync(recordPath, 'utf8'));
const original = JSON.parse(readFileSync(
  'internal/records/2026-10-14-finf-followup-source-debt.json', 'utf8'
)).originalDebtSnapshot.records;
const ledger = JSON.parse(readFileSync(
  'internal/governance/release-0.3-source-ledger.json', 'utf8'
));
assert.equal(packet.originalCondition.criterionKey, 'issue.1153.001');
assert.equal(packet.originalCondition.parentCriterionKey, 'issue.1092.003');
assert.equal(packet.originalCondition.sourceKey, 'owner-conversation:884:6095679394');
assert.equal(packet.originalCondition.originalChecklist,
  ledger.issueSnapshot.issues.find((issue) => issue.number === 1153).criteria[0].original);
assert.equal(packet.sourceBindings.length, 40);
assert.equal(packet.preservedSourceRecords.length, 22);
for (const row of packet.preservedSourceRecords) {
  const retained = original.find((entry) => entry.key === row.key);
  assert.ok(retained, row.key);
  assert.equal(digest(retained.completeOriginalBody), row.completeOriginalBodySha256);
}
const gitBytes = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], {
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
});
const verifyCurrent = (rows) => {
  for (const row of rows) {
    assert.equal(digest(gitBytes(packet.binding.baseSha, row.path)), row.assignedBaseSha256,
      `assigned base: ${row.path}`);
    assert.equal(digest(readFileSync(row.path)), row.assignedBaseSha256,
      `working tree: ${row.path}`);
  }
};
verifyCurrent(packet.sourceBindings);
for (const row of packet.sourceBindings) {
  const integrated = row.pr === 884 ? packet.pr884.integratedHead : packet.pr672.headSha;
  assert.equal(digest(gitBytes(integrated, row.path)), row.integratedSha256);
  if (row.archivedSha256 !== null) {
    assert.equal(digest(gitBytes(packet.pr884.archivedSourceHead, row.path)), row.archivedSha256);
    assert.equal(row.archivedSha256, row.integratedSha256);
  }
}
assert.throws(() => verifyCurrent([
  { ...packet.sourceBindings[0], assignedBaseSha256: '0'.repeat(64) },
]));
console.log('40 actual source bindings, 22 original source bodies, corrupt-digest rejection');
NODE
pui1153_pnpm exec prettier --check \
  internal/records/2026-11-10-pr884-foundation-verification.json \
  internal/records/2026-11-10-pr884-foundation-verification.md
```

If Main's integration source has changed any of the 40 subject paths, the working-tree comparison should reject. Preserve that result and re-trace the changed paths before preparing a separately identified current-source supplement. Do not replace this dated record's historical hashes with a later source to make the check pass.

**Current lifecycle/notification controls.** This explicit selection expects 13 files, with their real case counts recorded by Vitest; no invented aggregate pass count is supplied. It covers actual failed-created error identity/resource retirement, queued Delay cancellation, ordinary fail-fast/private cleanup, valid versus rejected logical adoption, caller retirement versus normal completion, duplicate-value admission and later legal requests. Existing negative scenarios must remain enabled.

```sh
pui1153_pnpm exec vitest run \
  apps/www/src/content/docs/zh-cn/collapsible-focus-observation.test.ts \
  packages/adapters/web-component/test/anatomy-reparent-rollback.test.ts \
  packages/runtime/test/contract/anatomy.catalog-lifecycle.contract.test.ts \
  packages/runtime/test/contract/lifecycle.same-checkpoint-order.contract.test.ts \
  packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts \
  packages/runtime/test/contract/delay.v0.contract.test.ts \
  packages/prototypes/base/test/navigation-overlays/search.test.ts \
  packages/prototypes/base/test/notification-retirement-lifecycle.test.ts \
  packages/prototypes/base/test/popup-snap-validation-lifecycle.test.ts \
  packages/prototypes/base/test/selection-reset-lifecycle.test.ts \
  packages/prototypes/base/test/slider-root-lifecycle.test.ts \
  packages/prototypes/base/test/slider-values-publication.test.ts \
  packages/prototypes/base/test/toolbar-separator-lifecycle.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

Examples of discriminating controls already in that source include all five initiating falsy created values, throwing cleanup/diagnostics, an ordinary authored failure that stops later authors while invalidating State, a real private Props release failure retained alongside a falsy authored failure, normal/unmount/dispose/remount notification boundaries, and valid/rejected adoption with original child identity. They observe real consumer outcomes, not test wiring or copied constants.

**Current public consumer and visual evidence.** Reuse the owning #1096/Main exact-source result if it already covers this precise source; otherwise Main executes the existing acceptance suite once. Do not enable the independent focus diagnostic as a replacement for acceptance.

```sh
mkdir -p /tmp/i1153a
export PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR=/tmp/i1153a
unset PROTO_UI_COLLAPSIBLE_FOCUS_PATH_DIAGNOSTIC
pui1153_pnpm exec vitest run \
  apps/www/src/content/docs/zh-cn/demo-collapsible-projections.browser.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

The current suite declares 36 acceptance cases: four families × four runtimes × two English journeys, plus one Chinese narrow-page journey per family. Runtime IDs are `wc`, `react`, `vue`, `vue2`. Public routes are `/en/ui-libraries/shadcn/collapsible/`, `/en/ui-libraries/brutalist/components/collapsible/`, `/en/ui-libraries/bootstrap-2-3-2/collapsible/`, `/en/ui-libraries/liquid-glass/collapsible/`, with the corresponding `/zh-cn/` route for each narrow case. Bootstrap and Liquid remain WIP/Experimental; their retained original evidence is not stable 0.3 admission.

Observe native pointer and keyboard disclosure, correct expanded/content state, close/reopen, disabled boundaries, rematerialization/runtime-switch lifetime and retained ownership. Inspect actual adjacent closed/open/closed captures, focus indication and visible Content, then 320px / 200% type in both themes and Chinese narrow layout. Preserve each failing/skipped/unstarted case and its exact source; no force click, enlarged deadline, removed assertion or old PNG substitution. These visual observations do not establish real screen-reader delivery, full family parity or non-Web/Compiler conformance.

**#672's current portability witness.** Run this command on Main's authorized native Windows source checkout if making a current Windows claim; a Linux-only result cannot establish path-separator portability:

```sh
corepack pnpm@10.32.1 exec vitest run packages/cli/test/lowered-hook-coverage.test.ts \
  -t 'resolves every hook state a shipped rule condition reads' \
  --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

It must execute the one named shipped-tree coverage case and retain any other filtered cases explicitly. Keep the original Windows baseline/candidate runs as historical evidence; do not mutate a real product source file merely to recreate the already established old failure.

After all source-generating/native jobs have settled, Main may run the normal `pui1153_pnpm -s check:types` when current-source review requires it. Do not race it with docs-server generation of CLI declarations. Packed-package results belong to their exact package/consumer source and existing packed-consumer owner; none is claimed by this record. The next scheduled integration cycle supplies its own exact-head full regression inventory. A successful planner or intentionally skipped PR heavy jobs prove no native execution.

## PR preparation and closure boundary

Proposed title: **docs: reconcile PR884 foundation verification evidence**

Proposed body:

> Refs #1153. Recover the original foundation-sync requirement, preserve `issue.1153.001` / `issue.1092.003` / `owner-conversation:884:6095679394`, and bind all 40 historical/current source paths. Record #672's exact-head approval separately from #884's native DCO, historical 36-case Collapsible passes, failed CI and absent independent review.
>
> This adds two non-normative evidence records. Product verification, formatting, independent review and integration remain Main-owned and unrun for this candidate. No version/release selection or Issue completion is claimed.

Main must review and validate this additive candidate, repair actual findings, obtain genuine current-source independent acceptance and native DCO/platform admission, integrate under live permission, then update only earned criterion-bound tracking. No commit, push, PR/Issue write, approval, merge or closure was performed by this owner. The original #1153/#1092 conditions and all 22 #884 source records remain intact.
