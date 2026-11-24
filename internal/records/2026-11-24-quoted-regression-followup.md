# Quoted regression audit: native follow-up after integration

## Scope and source boundaries

This continues the user-directed audit of duplicate GPUI dependencies, the zero-scroll assertion, the Drawer compiler timeout, Button lifecycle text, and the alleged author self-acceptance statement. The initial repairs and independent local review are recorded in [the original audit](2026-11-24-quoted-regression-audit.md).

GitHub records [PR #1797](https://github.com/Proto-UI/Proto-UI/pull/1797) as merged by `cyjin-yl` at 2026-11-24 11:39:57 UTC, with merge commit `fd3796c2d70b0efb738b20c764f5fc1c4133fdc5`. The audit branch was first updated from `e47c69754d983d95dc356521b1fc02094aa590b1` to `6a8117e904bb0c8facece4b96cea1dd22ea992de`, merging main `566afd9da983e2e29772f6afd033bf75c0f95ea6`. This task's Agent performed neither that update nor the merge. Platform integration does not establish the unexecuted or failed technical acceptance conditions.

The follow-up starts from observed main `4aaac6ac60348dc99896c34cd1186abcda98ff0d`. The older CI run below tests **e47**, not this later main. In particular, main changes to the CLI style-token collector and WC style dependency cache mean that unchanged Contents source alone cannot establish an unchanged browser input closure. The new focused lane retains the actual generated CSS and its hashes.

## What the first real hosted execution established

[Full CI run 45383599762](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762) was dispatched once on exact e47. Its original HTTP 204 acknowledgment and matching-run readback are retained in the [original service receipt](evidence/2026-11-24-quoted-regression-followup/recovered-original-dispatch-service-evidence.json.gz). This is an actual connected-service operation receipt, not a substituted CLI receipt or an approval.

| Subject | Actual observation | Limit |
| --- | --- | --- |
| GPUI Linux source consumers | [Job 138408703039](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762/job/138408703039) completed successfully, including generated Rust source consumers. The decoded full job log is retained. | This goes beyond the earlier TOML parse check; it is not all GPUI visual, interaction, or release acceptance. |
| New native wheel controls | [Browser job 138409100661](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762/job/138409100661) executed both controls: 2 passed, 0 skipped. Uncancelled trusted input moved the authored viewport from 0 to 400; cancelled input left it at 0. Both reject a replaced dialog. | Authored oracle controls, not the public Popover. The containing shard still failed six other tests. |
| Original public Contents matrix | [Browser job 138409100587](https://github.com/Proto-UI/Proto-UI/actions/runs/45383599762/job/138409100587) reproduced `expected +0 not to be +0` on Shadcn / WC / click. | The original product failure remains real. Readiness checks and diagnostic improvements did not fix this observation. |
| Complete CI | Multiple jobs failed; the retained readback is a nonterminal snapshot. | Neither full CI nor later merged/current main is declared passing. Later main independently repairs some of the old failures. |

The [public failure receipt](evidence/2026-11-24-quoted-regression-followup/e47-browser6/contents-command/shadcn-wc-click-wheel.json) reports the same connected, positioned Content with a 776 px viewport, 6230 px scroll height and 5454 px remaining range. The hit is a `summary` at (195, 448). A trusted wheel with deltaY 500 reaches Content without cancellation, but Content and document offsets remain 0. The [failure screenshot](evidence/2026-11-24-quoted-regression-followup/e47-browser6/contents-command/shadcn-wc-click-wheel-failure.png) and transition receipt are retained without rewriting the failure.

The recorded pre-input and final samples show a positioned, positive-height Content. They do not exclude a transient geometry change between samples or identify whether an inner scroll container consumes the input, the native scroll chain differs from the event path, or another operation resets movement. WC uses light DOM on this production registration path; a source comment mentioning shadow roots is not evidence of a split surface in this case.

## Follow-up diagnostic change

The retained observer adds a separate `inspect()` report for the actual hit-to-root ancestry and dispatch-time wheel path identities, with computed overflow, overscroll behavior, rectangle, scroll range and offset for each element. Geometry and CSS in the saved wheel paths are sampled at inspection time, not falsely represented as event-time measurements.

Passive listeners retain up to 64 scroll events and expose an explicit `droppedScrolls` count. The report records any observed movement and later reset without assigning scroll offsets, changing CSS, moving focus or synthesizing input. Listener cleanup remains owned by the observer. These observations run before the real wheel and in the existing final evidence block.

The original current-owner readiness, native event trust/cancellation, direction, document isolation and **1000 ms movement assertion** remain intact. Errors in the wheel evidence/probe-cleanup block remain supplemental to its first assertion error; this is not a claim about every outer cleanup operation in the existing matrix. The new layout-controlled unit verifies the recorder's observations, not native behavior.

A dedicated explicit `contents-wheel` scope in the existing browser repair evidence workflow runs the two native controls and the unchanged public Contents matrix test. It does not replace existing repair or Sprint 1 selections, run a weakened copy of the matrix, or claim coverage of other homepage tests.

## Evidence recovery

The local scratch workspace and temporary files became unavailable during execution. Published Git objects and hosted artifacts survived. The follow-up source was recovered from GitHub; the restored diagnostic delta was reapplied to a fresh clone and revalidated. Original hosted artifact ZIP digests were checked before extracting their members. The [evidence manifest](evidence/2026-11-24-quoted-regression-followup/manifest.json) distinguishes downloaded/recovered bytes from the two explicitly reconstructed independent narrative reports.

Both old and fresh local Chromium startup probes failed before page execution with `Operation not permitted` in process-singleton socket creation. The fresh probe preserved `chromiumSandbox: true`. These failures are environment evidence, not skipped cases silently counted as passed or evidence of the public product's behavior.

The focused follow-up unit checks pass 20/20 (9 observer controls and 11 existing site controls), and the observer's no-emit TypeScript check and formatting checks pass. The first local rerun exposed an undefined `Event.isTrusted` in the DOM test environment; the recorder now records trust only when `isTrusted === true`, consistently with the existing wheel observer. Native follow-up results and any proven owning-layer repair will be appended with their exact candidate source.

## First focused dispatch was rejected before execution

The one dispatch request on `6be3babcac8bc11fd43679b446a486c93642fb74` at 12:17 UTC returned HTTP 422. GitHub's workflow parser rejects `runner.temp` in the job-level `env` context. No workflow run or native test executed; a bounded live readback returned zero dispatch runs for this new branch. The [request, rejection and readback](evidence/2026-11-24-quoted-regression-followup/dispatch-rejected-6be3/readback.json) are retained alongside the response.

The earlier local YAML, shell, Node and test-selection checks did not validate this platform expression context. The original independent review remains historical and is supplemented by this finding rather than rewritten. The correction derives the paths from `RUNNER_TEMP` inside the first runner step, exports them for that same step, and writes them to `GITHUB_ENV` for later steps. It does not change the native assertions, test selection or deadlines. A new source-bound dispatch is required after the correction; the rejected request is not counted as a run or a pass.
