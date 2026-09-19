# Designing discriminating test evidence

Use this reference when a regression depends on input attribution, asynchronous delivery, resource ownership, CSS projection, or a misleading test result. It refines `pui-test`, `pui-regression` and `pui-validate`; it grants no task, semantic or external-write authority. Simple tests do not need every technique below.

The [Agent visual-evidence policy](visual-evidence.md) owns public paraphrases, captures and evidence debt. Humans may submit a symptom alone. Investigation belongs to the Agent, not the reporter.

## Distinguish the cause

Start from the authority map's entity, lifecycle and owning layer. Describe initial state, trigger, observable result and facts held constant. Separate test injections (geometry, callbacks, time, synthetic input), actual observations, and source-derived inference or proposed corrections.

A live contact does not prove movement; a movement sample does not prove applied offset. A browser-generated `scroll` event can be trusted even when the test wrote `scrollTop`. Name input and offset provenance separately when relevant. Do not inject the expected answer into fixture state and then claim reading it proves behavior.

Preserve the failing baseline and assertion. Confirm red means the intended violation, not an import failure, missing dependency, selector mismatch or startup timeout. Add a normal control or narrow mutation check when it distinguishes competing explanations; mutation testing is not mandatory for every assertion. Do not alter unrelated user work. If an older test encoded the wrong premise, explain and repair the fixture while retaining the legitimate assertion. Investigate contradictory expectations against the catalog instead of editing the spec to excuse a failure.

## Probe transitions and ownership

For event-driven behavior, identify the resource/request owner and state before and after meaningful events. Use an event/owner/observation table when it clarifies causality. Do not introduce portable state just to simplify a host-local test.

Choose orderings allowed by the host contract: applied effects before notifications, late callbacks after replacement, synchronous watcher reentry, terminal cancellation, or superseded requests. Assert both the intended effect and absence of stale-owner effects. Sample before ending or replacing ownership when that boundary is disputed. Disclose artificial harness ordering; do not present impossible sequences as platform guarantees.

Depending on the rule, useful probes may include clamping followed by reversal, multiple contacts, stationary contact, another axis, and reset/reacquisition. These Scroll examples are not a mandatory project-wide case list. For a visible claim, also assert the dependent rendered or consumer effect, not only a public state value.

Prefer explicit lifecycle transitions, request identity and observable readiness to grace-period fixes. Wait for the event, delivery boundary or visible condition the behavior needs. Layout-frame synchronization and server-readiness waiting are not inherently repairs; disclose their role. Do not add a sleep until a race disappears or replace real input with synthetic dispatch while retaining a native-input claim.

## Check CSS ownership and actual rendering

When cascade priority matters, snapshot both inline value and priority, including the absence of a declaration. Capture author state before the first host write, not the host's own override. Verify restoration on the relevant projection changes, replacement and disposal.

Use actual stylesheet rules and a real browser for cascade, clipping, paint or hit-testing claims. An inline `display:none` does not prove an important stylesheet stopped painting; a nonempty `boxShadow` does not prove a clipped focus ring is visible. Inspect the necessary computed style, geometry, pixels or interaction and capture the real component. Only claim hit-testing or accessibility behavior when it was tested.

For observer-driven projection, check that applying identical owned state does not generate another observer-triggering mutation capable of sustaining a callback loop, even when the rendered output is unchanged. Use real observer delivery where feasible, or a bounded deterministic harness with its artificial reentry disclosed. A bad implementation must not hang the runner indefinitely. Keep host-unit evidence distinct from complete Prototype-family and cross-Adapter journeys.

## Account for the executed scope

Resolve test paths from the current tree and reconcile the runner's collected files/results with the plan. One matching file can make a command succeed while another requested filter matches nothing. A command selecting no package build is not package evidence. Check required browser suites enter the repository runtime test plan. For catalog path checks, inspect whether the validator reads the worktree, index or committed tree; ensure new evidence files belong to that exact input before claiming the graph validates them.

Use the repository Node/pnpm baseline and shared workspace dependencies. Check declared workspace links after switching branches before treating missing-module errors as source regressions. Do not copy entire dependency trees or fetch new bundles to fix a missing local link.

Bound concurrency to the machine, especially when each suite loads the catalog or launches a docs server. Serialize heavyweight builds/browser jobs on constrained machines. Preserve timeout output, inspect discovery/startup/resource contention, then rerun the same assertions with controlled concurrency before considering a justified deadline change. A resource-limited rerun does not prove the original CI configuration is healthy.

Bind results to the candidate, command, selected files/tests, environment and important runner flags. Preserve failures, fixes and reruns instead of replacing them with a green aggregate. After main or the candidate changes, rerun checks affected by the delta and label reused older evidence. Separate focused tests, browser evidence, generated-path checks, package/consumer checks, CI and independent acceptance; retain skips, unsupported hosts, unmeasured details and next actions. Track a separately bounded defect under current authorization rather than silently expanding the repair.
