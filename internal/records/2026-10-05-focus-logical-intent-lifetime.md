# Focus intent lifetime across view epochs

Date: 2026-10-05. This bounded repair continues PR #832 from `9b0cfad7132f4ff7bc8cbbd4ec8ca8cf1f414acf`. Existing draft authority is `C-AS-FOCUSABLE-0001-G`, `C-AS-FOCUS-ENTRY-0001-H`, `HC-FOCUS-TARGET-0001-C/D`, and the view-epoch ownership rules in `C-LIFECYCLE-0006`. No public request API or normative lifecycle rule is changed.

## Logical intent, not view-provider lifetime

[Review 4189370452](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4189370452) was reproduced in all four Web adapters and all three request kinds. After exhausting a request, retained hide/show rebuilt its provider and granted the same private options snapshot three more layout retries. Several readiness/hide/reveal paths also directly cleared the counter. The earlier replacement control issued a newer explicit request after replacement, so its renewed allowance did not test this same-intent path.

Each logical Adapter owner now retains its options-snapshot/kind tracker and passes it to replaceable providers. The accounting boundary is:

- New logical owner: fresh tracker and allowance.
- New explicit request: a distinct Module snapshot renews the allowance, including omitted or reused author options.
- Same pending request through readiness, hide/show, KeepAlive, controlled effect replay or a same-owner DOM move: preserve the consumed allowance.
- Actual success of the still-current intent: clear its failure allowance.
- Terminal disposal: retire that owner. A later genuine new owner starts fresh.

Old-view frame callbacks remain governed by their existing disposed/generation checks; retaining intent accounting does not make a stale view runnable again. React's replay control uses a controlled hook Runtime, not a claim that a real late StrictMode replay occurred. Vue KeepAlive and Web Component moves use their actual framework lifecycles.

A further eight actual-framework controls exposed post-focus reentry: an older accepted request could clear a newer failed request's budget, and an older rejected request could schedule work after a newer success. Providers now recheck the shared snapshot/kind after the host call before running success or retry accounting. This complements the Module's existing request/fact execution guards.

## Web Component terminal settlement

[Review 4189370468](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4189370468) proposed that `owner.dispose()` synchronously throws and skips outer terminal fields. That precise path was not reproduced: the observed readiness failure became a rejected disposal Promise, and those outer fields were already invalidated.

Two adjacent failures were independently established on exact `9b` source:

1. A readiness error interrupted the Web Component session's sequential `afterUnmount` chain before `HostDisplay.disconnect`, slot/projector and remaining adapter cleanup completed. The session now attempts every release and preserves the original error.
2. A real DOM reappend inside terminal invalidation reached `connectedCallback` before the old owner had settled. It reused the disposing owner as if this were a normal move; the old tail then left the connected element without an active owner. Reentrant connects are now held until terminal settlement, then only the current connected state may create a fresh token/controller. Synchronous moves that never entered terminal disposal still retain their owner.

The expanded controls include reappend, move twice, append then remove, both throwing and nonthrowing callbacks, and later fresh connection. The final-disconnected case must not be resurrected by a stale queued reconnect. The additional move-twice and final-disconnected controls are retained in `packages/adapters/web-component/test/focus-terminal-reconnect.integration.test.ts` as well as the main terminal-cleanup suite.

## Evidence and limits

The nine-file production candidate passed 18 independent probes and 123 related focused tests. The implementation matrix passed 113 cases. The independently tested supplemental terminal controls were retained as permanent regressions; final aggregate and supplemental results are reported separately with the development commit.

The native suite is expanded from 38 to 50 cases. Its twelve new retained-budget cases keep rejection CSS outside replaceable DOM, allow actual framework commit work to settle, remove that rejection without a new request, and finally test a genuinely new request. Real frame and trusted-focus behavior remain assigned to exact-source CI; bundle/type checks and simulated-DOM source smoke are not native acceptance. This round did not start a local browser.

Prior failed candidates, misleading initial frame-count fixtures, and the distinction between the unconfirmed review premise and the confirmed defects remain in the evidence history. Original package gates are unchanged; #824/#826 must measure their actual combined source. #775 consumes only the subsequent frozen source and must run its own fresh rendered audit. No old CI run or screenshot is relabeled as this candidate.

## Full-workspace regression checkpoint

The first general run of this uncommitted candidate completed with 4,332 passing tests and seven failures (634 passing files, four failing files, three skipped files and 34 TODO tests). Four failures were exact evidence-guard expectations that still listed only the previous retry case; those expectations now include the two newly exercised cases and separately pin their narrow criterion sets. The updated guard passed all nine tests.

The other three failures exposed candidate Web Component lifecycle regressions: Brutalist and Shadcn Tooltip teardown retained `aria-describedby` beyond their existing cleanup boundary, and a confirmed disconnect followed by reconnect created the new owner later than the established lifecycle control expects. These failures prevent source freeze. The existing assertions remain unchanged; neither extra test flushing nor a normative timing change is an accepted repair. The focused passes above are historical evidence and did not establish workspace-wide compatibility.

Independent tracing separated two causes. The normal reconnect was held by the disposal Promise's error-delivery microtasks even though synchronous session cleanup had already completed. Tooltip cleanup was more than a delay: the Web Component `globalMount.unmount` path reinserted an externally removed Content node into its original parent, and the candidate's automatic reconnect created a second owner and republished `aria-describedby`. Additional microtasks did not fix the Tooltip failure. The repair must retain normal connected portal restoration while preventing cleanup from resurrecting an externally removed node.

The compatibility repair uses the actual session-tail completion marker to release ordinary reconnect synchronously after old published-owner retirement. A once-only release prevents the older error-delivery Promise from clearing a newer owner's cleanup lock. A controlled Promise transport probe checks that ownership boundary; it is not evidence of native asynchronous presence behavior. Existing lifecycle and Tooltip assertions are unchanged.

### Separate unresolved portal-order observation

Additional portal controls also tested restoring the original next-sibling position. Both new position assertions failed even when only the Web Component modules provider was replaced with its exact `9b0cfad7` version and the rest of the candidate remained unchanged. This paired control rules out the new `isConnected` guard as their cause; it is not a full-tree `9b` baseline and does not settle the root cause. The failing sibling-order observations and paired logs are retained for a separate follow-up. This repair keeps its direct assertions on physical-parent restoration, disconnected-parent cleanup and prevention of external-removal resurrection. No old formal test was weakened, and no sibling-order repair is claimed.

A subsequent full-source control resolves the regression attribution: a clean detached worktree at exact `9b0cfad7132f4ff7bc8cbbd4ec8ca8cf1f414acf`, with all 36 `@proto.ui` source aliases rooted in that tree and 285 loaded source files path-checked and hashed, reproduces both sibling-order failures. The physical children are `[next, content]` and `content.nextSibling` is null in both cases. This establishes that the ordering observation predates this repair; its underlying cause and any user-visible impact remain a separate follow-up.

## Final product-candidate validation

After the compatibility repair, the canonical general run passes 639 files and 4,347 tests; three existing files remain skipped and 34 tests remain TODO. The first seven-failure aggregate is preserved separately. The final source passes all 44 public-package builds, workspace TypeScript, and documentation checks (446 files, zero errors, zero warnings, four existing hints). Documentation checking first stopped because Astro telemetry could not create its default configuration directory; rerunning with telemetry disabled passed. No browser was started, no skip was added, and all nine production-source hashes remained fixed throughout final validation.

The implementation's final focused matrix passes 139 tests, with the four permanent reconnect controls verified separately. Independent checks also retain the normal-close/same-owner-reopen control and the full-source sibling-order baseline above.

Unchanged package gates still reject Runtime 68,073/67,100, React 89,545/87,500, and Vue 89,365/87,200 gzip bytes. Web Component is 92,973/104,500. All eleven measured artifacts have source/environment-bound hashes. Numeric changes remain the separate #824/#826 transaction; these are source-only measurements, not proof of the final combined vector. Native 50 and downstream #775 rendered audit remain pending exact-source CI.
