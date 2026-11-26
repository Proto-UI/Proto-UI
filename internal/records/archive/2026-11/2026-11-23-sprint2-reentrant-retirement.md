# Sprint 2: retire old work before processing synchronous reentry

## Scope and provenance

This is a bounded repair of three locally reproduced ownership failures. The initial read-only review inspected integration candidate `58568a4bb5c15e62ca7c888c69ba0ea984cdfa53` by its abbreviated commit name `58568a4bb5` and the separate Rule Meta candidate `8675f0a08d`. The repair was prepared in an isolated worktree based on `58568a4bb5`, with `8675f0a08d` cherry-picked as `9ead4b70fc37250fd0c44a8105cb070ee14f2d0c` before modifying source. The full integration-base identity is recorded by Git; the short identifier is the review boundary. No platform review, GitHub write, merge, or release was performed by this repair context. After starting the repair, this context is no longer an independent acceptance reviewer for these changes.

The reproducible [probe](evidence/2026-11-23-sprint2-retirement/probe.mjs) executes the real projector source and emitted React owner/support modules by TypeScript transpilation. Its host deliberately invokes callbacks synchronously during release. Happy DOM supplies the React owner's DOM. This isolates an admitted reentry boundary; it does not claim that a native browser's observer delivery is synchronous or that hardware/assistive-technology acceptance was executed.

Both [baseline](evidence/2026-11-23-sprint2-retirement/baseline-probe.jsonl) and [candidate](evidence/2026-11-23-sprint2-retirement/candidate-probe.jsonl) retain the actual Node version, Git parent, and SHA-256 of the three source files. The candidate was executed as a working-tree change above the recorded parent; its source hashes, rather than the unchanged parent field, bind that execution.

## Governing definitions

All of the applicable catalog entities remain **draft**. This repair does not activate them or expand their public capability vocabulary.

| Finding | Relevant authority | Required ownership boundary |
| --- | --- | --- |
| RR-PRESENCE-01 | `C-FEEDBACK-PRESENCE-PRESENTATION-0001-AUTHORITY`, `HC-FEEDBACK-PRESENCE-PRESENTATION-0001-LEASE/INPUTS`, `C-FEEDBACK-INTRINSIC-BLOCK-SIZE-0001-OWNERSHIP` | Only the current attempt, physical binding and target may complete. Terminal semantic sizing remains restored; release cannot replay a settled target. |
| RR-ROOT-01 | `C-LIFECYCLE-0006-C/D`, `C-LIFECYCLE-0002-J/K`, `C-FEEDBACK-INTRINSIC-BLOCK-SIZE-0001-OWNERSHIP` | Old view retirement cannot dispose resources acquired for its replacement. Complete private cleanup and preserve the initiating failure without changing logical owner identity. |
| RR-META-01 | `M-RULE-META-0001-C/D`, `C-RULE-VIEWPORT-WIDTH-0001-A/B/C` | Retire the old generation before release, admit only the current paired source, and prevent stale callbacks, cleanup or sampled facts from affecting its replacement. |

The repair stays in the neutral presentation projector and generated native resource owners. It adds no component identity dispatch, second interpreter, public bypass, additional animation clock, or prototype-specific workaround.

## Observations and changes

### RR-PRESENCE-01: release notifications recursively reacquired a terminal endpoint

On the original source, a reduced-motion endpoint completed its projection, marked `completed`, and called `host.release`. If that release synchronously notified the subscriber, `tick -> settle` incremented the frame generation and projected another endpoint. The newer `complete` path released again despite the existing completion marker. With notification limits of 1, 5 and 100, the probe observed respectively **2, 6 and 101 releases**, and **zero completion receipts** in every case. Before `289750ff10`, the same callback could already invalidate the only receipt; that commit additionally enabled the recursive release path. These are separate observations, not a retroactive claim that the earlier candidate passed.

The projector now defers ticks, settlements and nested completion until the current completion/release transaction returns. A terminal attempt/target does not read dimensions or acquire another transient lease on notification or explicit repeated settlement. A semantic commit can still prepare its style. When release publishes a new frame revision for the same attempt and target, the one receipt is delivered through that latest frame. A new attempt or target receives only its own subsequent completion. Timer and nonanimated endpoint paths retain their existing absence of a presentation receipt.

The same probe now observes **one release, two applications (semantic preparation and endpoint), and one `reduced-motion` receipt**, independently of the injected notification limit. Persistent tests also cover ordinary animated completion, completion callback reentry, new attempts/targets, and timer-mode frames. The older projector test that counted a new transient lease on every settled invalidation now instead requires no additional sample or lease; its original expectation described the defect being removed, while restored sizing and stale-callback assertions remain covered by the Web sink tests.

### RR-ROOT-01: an old cleanup batch erased the replacement Root's style

The generated owner initially projected `data-pui-style="block"`. During retirement, the injected `clearTimeout` callback called `bindRoot(replacement)`. The nested call returned with `replacement` correctly styled, but the outer cleanup batch then continued through shared Presence/Root state. The final replacement attribute was absent. A generation check after the entire cleanup batch prevented assigning the obsolete requested Root, but could not undo damage already done by the remaining cleanup steps.

`bindRoot` now queues the latest reentrant request while it retires the previous Root. It captures that old element for attribute removal, attempts every reached cleanup, then admits the last requested Root. Reentry during admission invalidates the remaining admission steps and causes the partially bound Root to retire before the next one is attached. The original first error is preserved, including `0`, while replacement admission still completes.

The probe's nested call now intentionally returns before the replacement is styled; after the outer retirement completes, the replacement has `block` and both the previous and superseded Roots are unstyled. The persistent emitted-owner test additionally throws `0` from the reentrant timer release and observes both the correct final Root and that identical failure.

Local cross-review of the first repair found a coalescing edge in the same transaction: during admission of A, `bindRoot(B)` followed by `bindRoot(A)` left the pending B request intact because the current-A call returned early. The added test reproduced this as A losing `opacity-50`. A same-Root request is now ignored only when no different request is pending. The finite B-to-A callback finishes at A, preserves public State identity and the two live preference source listeners, and final disposal retires both listeners. The first repair's probe and 30-test result remain separate historical evidence.

### RR-META-01: an old reconciliation overwrote a newer Document

The baseline probe began at width 900 and started an outer reconciliation toward a width-700 Document. Old-source removal synchronously selected a width-500 Document and reentered `reader.read`; the nested read correctly returned 500. The outer reconciliation then overwrote that newer binding, returned **700 while the current Document was 500**, and left listeners in both destination Documents. When reentry selected the same destination, one resize delivered two logical invalidations. A further negative case showed the obsolete registration's catch path releasing the newer lease, and a reentrant host getter returning a stale sample after its source was retired.

Reconciliation now binds both mount identity and generation across `getDocument`, old release and source acquisition. An obsolete catch path cannot clean up a newer generation. Sampling verifies the source and owner generation again before publishing a value; a read invalidated during the getter returns `unknown`. The probe now returns **500**, leaves **zero** listeners at the obsolete destination and **one** at the current destination. Persistent tests also cover same-destination deduplication, initiating error identity, getDocument reentry, source getter reentry and final release.

## Executed evidence

All Vitest runs used Node `v24.22.3`, `pnpm@10.32.1`, one worker and no file parallelism. The retained logs include the preexisting Vite `ES2024` target warnings; those warnings are not type-check results.

| Run | Selection and observed result | Retained output |
| --- | --- | --- |
| Original probe | All three ownership failures above, source hashes retained | `baseline-probe.jsonl` |
| Baseline regression | Presence block-size plus Rule Meta retirement: **8 failed, 19 passed** | `baseline-focused.log.gz` |
| First repair | Same two files: **27 passed** | `candidate-focused.log.gz` |
| Presence regression | Six existing projector/controller/semantic/Web sink/adoption files: **91 passed, 1 TODO** | `candidate-presence-regression.log.gz` |
| Root reproduction | One emitted-owner Root test: **1 passed, 6 filtered out** | `candidate-react-root.log.gz` |
| First bounded selection | Presence block-size, Rule Meta retirement and the strengthened Root case: **30 passed, 6 filtered out** | `candidate-first-focused.log.gz` |
| Review negative case | B-to-A Root request coalescing: **1 failed, 7 filtered out** | `review-coalescing-red.log.gz` |
| Final bounded selection | Presence block-size, Rule Meta retirement and both Root cases: **31 passed, 6 filtered out** | `candidate-final-focused.log.gz` |
| Replayed probe | One Presence release/receipt, correctly styled replacement Root, current Document width 500 | `candidate-probe.jsonl` |
| Generated-source check | Canonical Web host assets regenerated by their generator; `--check` and `git diff --check` passed | Source and generator in this change |

The exact commands are:

```sh
node --import tsx internal/records/evidence/2026-11-23-sprint2-retirement/probe.mjs
corepack pnpm@10.32.1 exec vitest run packages/modules/feedback/test/presence-block-size.test.ts packages/compiler/test/native-rule-meta-retirement.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=verbose
corepack pnpm@10.32.1 exec vitest run packages/modules/feedback/test/presence-projector.test.ts packages/modules/feedback/test/presence-semantic-style.test.ts packages/modules/feedback/test/presence-controller.test.ts packages/adapters/base/test/web-presence-block-size.test.ts packages/adapters/base/test/web-presence-presentation.test.ts packages/adapters/base/test/web-presence-adoption.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=verbose
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/react-owner-failure-cleanup.test.ts -t 'finishes old Root retirement' --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=verbose
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/react-owner-failure-cleanup.test.ts -t 'coalesces B' --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=verbose
corepack pnpm@10.32.1 exec vitest run packages/modules/feedback/test/presence-block-size.test.ts packages/compiler/test/native-rule-meta-retirement.test.ts packages/compiler/test/react-owner-failure-cleanup.test.ts -t 'intrinsic block-size|releases the old document|old release|document adoption|rollback|reached source|unpaired viewport|duplicate the current lease|overwrite a newer Document|newer lease|old source value|reentrantly by getDocument|finishes old Root retirement|coalesces B' --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=verbose
node scripts/compiler/generate-web-host-sources.mjs
node scripts/compiler/generate-web-host-sources.mjs --check
git diff --check
```

## Remaining verification and acceptance

The preserved TODO is `native repeated adoption back to the original Document during cancellation` in `web-presence-adoption.test.ts`. The six filtered React cases were not executed in this repair context; this record does not convert the filtered selection into a full-file pass. Full compiler/type-check, final integrated consumer/browser evidence, independent review and platform acceptance remain with the integration owner. Hardware, native observers and assistive technology were not exercised here. This record closes no umbrella release criterion and claims no platform approval.
