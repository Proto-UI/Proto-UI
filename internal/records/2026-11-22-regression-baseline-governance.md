# Complete regression baseline restoration

Date: 2026-11-22 (Asia/Shanghai). This is an implementation and evidence record, not release acceptance or a replacement product contract.

## Historical source and bounded request

The requested repair starts from [native cycle 44876125495](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495) at `7a696228c31e6b77998c4e356a57dcebd08854a0`. Its 89 jobs ended with 53 successes and 36 failures. Of ten shared browser shards, two succeeded, seven reached the 900-second execution limit, and one finished with nine failed, 89 passed and four skipped assertions. These counts remain historical execution outcomes, not 36 product defects or seven diagnosed product-failure groups.

The implementation starts on main `d095fa0a811facff676b6f62929b177aa1dc7583`, which includes the intervening Slider and GPUI changes. The older native run cannot certify this checkout or the resulting PR candidate. [The historical native job inventory](2026-11-22-regression-historical-cycle.json) retains every job and source link. [The browser triage record](2026-11-22-regression-browser-triage.md) retains original observed failures, log hashes, source hashes and bounded rerun groups.

The current user authorizes one repair PR covering complete execution, preserved assertions, source/matrix binding and strict budget restoration. No product lifecycle, required check, publication or release guarantee is promoted by this work.

## Execution and evidence changes

1. **Measured browser capacity.** The historical file-duration fixture retains 65 terminal-file observations, including failed files completed before a containing job timed out. The existing ten-shard plan cannot fit this observed work under its original deadline. Eighteen deterministic shards, at most six concurrent jobs and 180 seconds of setup reserve retain the original 900-second cap. Current estimated work is 584–694 seconds per shard; the maximum plus setup is 874 seconds. These are planning estimates, not timing promises. Interrupted passive-atoms work receives an explicit 600-second estimate, not a fabricated measurement. Malformed, nonfinite, duplicated or mismatched observations fail admission.
2. **Complete general observations.** `general-ci.mjs` derives its ordered prerequisite list from the actual root test command, preserves every existing check, and continues to independent later checks after a failure. Runtime controls and the runtime execution have separate outcomes. All original failures still make the job fail. A 45-minute outer allowance covers prerequisite work and execution without changing individual assertion deadlines. The planner and Vitest now share an include manifest, correcting the omitted `apps/www/test/proto-ui-source.test.mjs` receipt entry.
3. **Failure evidence before process exit.** The runtime reporter writes a small append-only event journal and throttled atomic progress snapshots. The runner retains the selected inventory, original failure messages, completed results, interruptions, missing files and JSON parsing failures even on a red exit. It preserves child termination signals. Partial progress is diagnostic and never accepted as a completed result.
4. **Exact candidate binding.** Passing runtime evidence requires a clean source snapshot before execution, the same snapshot afterward, the expected checkout SHA/tree, every selected suite exactly once and the existing strict assertion rules. Stable but dirty worktrees, altered sources, skipped browser assertions, older attempts and incomplete plans cannot certify the final commit. Budget measurements independently retain the clean expected source, resolved input closure and artifact hashes.
5. **Native cycle accounting.** The cycle receipt includes every native job from a complete paginated acquisition, validates run/SHA/identity/count bindings and rejects incomplete upstream jobs. Its own active report job remains visible without being mistaken for an unfinished upstream producer. Lane results and native outcomes remain distinct from assertion-level product diagnosis.

The PR schedule remains lightweight. Full builds and browser execution still run only through the coordinated scheduled/manual cycle. Required check names, strict aggregate gates, noncancelling active-cycle behavior and original browser assertions are retained.

## Source binding and browser diagnosis

[Source binding reconciliation](2026-11-22-regression-source-bindings.md) explains the original 101 website findings, the 40 stale fingerprints, newly bound diagnostic sources, finite diagnostic import admission and relocation of two pure test helpers. Existing blocked/experimental rows retain their acceptance status. The first complete coverage test run additionally exposed stale prototype portfolio projections and two resolver defects; its failures are retained there rather than rewritten as earlier success.

The initial browser corrections address bounded test assumptions supported by actual source:

- Search's enlarged-font geometry test controls its Pagefind response and waits for the existing idle state; its focus, hit-target, clipping, dismissal and reachability assertions remain.
- Runtime layout parity expects the current gallery's real Text inventory, including the additional analytics card; pairwise geometry and negative strut assertions remain.
- Drawer fixtures explicitly request the extent they assert and install both real emitted JavaScript and CSS; original constrained-scroll and cold-start geometry assertions remain.

Demo Matrix initialization, WC Shadow ownership/paint and remaining Liquid observations still require native execution. A source-only control is not proof that these browser assertions pass. The local sandbox could not create Chromium's required Unix socket, and its supported permission request was rejected. Those tests are unexecuted locally, not product failures or successful acceptance. Native GitHub Actions is the final candidate validation path.

## Strict package budgets

[The cost attribution record](2026-11-22-package-budget-restoration.md) retains the six old strict overages and all nine whole-entry measurements. All eleven current artifact vectors (nine entries plus two diagnostics) exactly match the canonical historical job. Remeasuring the old source under the current toolchain also reproduces its old vectors, separating integrated source growth from toolchain/compression drift.

The dominant retained additions are traced to existing input, positioning, ownership, motion/Presence and authored Shadcn profile work. The investigation found no third-party bundling, duplicate Runtime or accidental optical program/sink closure in ordinary entries. Semantic removal for a smaller gzip number is not justified by this evidence.

Strict default, CI and snapshot enforcement is a governance change. Any six-entry numeric adjustment is a separate commit with its own old/new values, measured margins and retained historical failures. Other entries, measurement shape and external dependency boundaries remain unchanged. The final clean candidate must be measured again, and the native cycle must provide its own report; the older canonical run is not relabelled.

## Validation and acceptance boundary

Local controls exercise overloaded shards, malformed timings, continuation after prerequisite failure, retained original assertion failures, source drift, truncated reports, duplicate/missing evidence, partial reruns and actual pinned-Vitest reporter behavior. Independent review checks the implementation and cost attribution; it is not a GitHub approval or native execution result.

The accompanying focused records state their actual pass/fail/unrun results. The final PR must link the dispatched run with the same head SHA, retain every terminal outcome and identify any product, fixture, measurement-capability or resource diagnosis from concrete evidence. A completely ended red cycle supplies useful failure evidence but does not satisfy the existing green-baseline or scheduled-recovery policy.
