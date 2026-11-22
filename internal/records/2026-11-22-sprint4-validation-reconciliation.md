# Sprint 4 validation reconciliation

This follow-up records actual failures and bounded repairs after `9bd42c30cdf13093916f4866155de29afaab2e32`. It does not declare a green full cycle, close the nine original Issues, promote a draft definition, or accept the historical private compiler. The source and receipt digests are retained in [the Website ownership record](2026-11-22-sprint4-website-ownership.json).

## Original CI and the exact baseline

The candidate [CI 45017591649](https://github.com/Proto-UI/Proto-UI/actions/runs/45017591649) executes `ef60557fbd2c486ca15885c3e38d92f599f140a3`; the independent [baseline CI 45017955280](https://github.com/Proto-UI/Proto-UI/actions/runs/45017955280) executes `dc3b184ba10b0de53e40359c52d012b204b2cd01`.

The candidate general job was cancelled after 652 passed suites, 68 failed suites, two running suites and 1,080 unobserved suites. Its 420 failed leaf cases, two collection errors and seven failed preflights are real failures preceding cancellation. They are not relabelled as resource failures. Baseline general reached terminal results for all 1,783 suites: 1,686 passed, 92 failed and five skipped, with 499 failed leaf cases.

Actual case and error-text comparison reproduces 412 of the candidate's 420 failed leaf cases on that baseline, plus both collection errors. Eight candidate failures had passed on the baseline:

- Four old compiler fixtures disagree with the newly governed getter/dormant semantics. Their original source is preserved and the fixtures are repaired below.
- Three `projection-composition.test.ts` cases cover theme restamping, late portal theme and shared-marker observation. One `site-native-controls.test.ts` case covers navigation-current feedback. All four original tests pass unchanged on the current `9bd42c` R8 snapshot, with stable source hashes and no test edits. This is a four-case current replay, not a causal proof isolating every R8 line or complete Website acceptance.

The baseline's other 87 failed leaf cases belong to suites not observed before the candidate job was cancelled. They are not candidate passes. The three GPUI fixture preflight logs are byte-identical between these runs; GPUI-script and release preflights retain the same failed diagnostics. The two Website governance gates differ: source/import violations grow from 11 baseline observations to 66 candidate observations (55 additional occurrences, 48 distinct diagnostics), and production-graph failures grow from two baseline Liquid-page violations to 49 diagnostics involving the new shader edges. These are the in-scope projection repairs below, not inherited passes.

Shard numbers are not case identity: the baseline's browser-4 did not select Scroll Area. Its actual browser-5 executed the same Scroll Area case and failed at the same original 1,000 ms assertion with WC `scrollTop === 0`. The baseline also reproduces the actual Homepage family timing case and the Liquid Accordion opaque-fallback case. Their assertions and failures remain intact.

Number Field has 80 passing combinations and 20 failures on both revisions. The same 20 uncontrolled paths fail their trusted-events assertion with `compositionend.isTrusted === false`; the native/component event arrays match pairwise. The runner then throws, leaving 20 controlled paths unexecuted. Twelve failures belong to the 0.3 Base/Shadcn/Brutalist combinations; eight belong to experimental families. This CDP exercise is not physical OS IME evidence.

The candidate CI itself separately passes all 20 shader browser cases and all 16 Presence browser cases. Those exact test results remain distinct from the non-green shards and the earlier remote browser receipt.

## Restore meaningful compiler controls

The original getter-source `Object.assign` example is now a lawful parse → serialized IR → cold-validator control. It retains a real zero-argument getter, readonly source field and ordinary writable copied data field. A getter target remains rejected. Existing four-native-host getter consumers still check actual read counts and assignment effects.

The original uncalled local function in the String fixture remains a lawful dormant control. The malformed-IR negative now first reaches the function through an actual call, establishes that the unchanged IR is legal, then substitutes that function as the String operand and retains the rejection assertion.

The two original uncalled Vue2 bodies remain source-retaining dormant controls. Actual calls and a retained record property now make the negative bodies reachable; the captured alias remains distinct from a same-named caller parameter. Direct, alias, after-return and dead-branch negatives remain intact.

The focused run passes 79 selected cases: 44 Object.assign, 22 String, nine Vue2 proof cases and four existing native getter consumers; 63 cases were unselected. These getter consumers use the existing happy-dom native fixture. They are not a new replay of the separately preserved original 270-byte Issue #893 source.

The optional Vue2 proof-capture inventory grows exactly from 20 to 23 because of the two dormant controls and one retained-property control. A separate real capture run passes 22 selected cases and produces all 23 complete captures: 17 admitted and six expected cold rejections. Its existing invoked native helper's strict TypeScript graph has zero diagnostics. Fifty tests, including the separate SSR checks, were unselected. No runtime timing bound or semantic assertion was relaxed.

The original local A/B attempt hit a worker/resource boundary and is retained. Smaller original-case runs reached terminal results for 19 selected cases. The shipped-catalog baseline's original full local run remained incomplete; a real original-scanner counterexample established that its empty-inventory invariant already failed, but did not certify all 654 candidate entries as identical. The subsequent complete baseline CI provides the separate full-case comparison above.

## Exact Website ownership projection

Matrix enforcement rule 6 requires source review for every new raw import and runtime entry. The default WC shader capability adds two exact files to the existing public Adapter closure:

- `packages/adapters/base/src/material/shader-webgl2.ts`
- `packages/adapters/base/src/material/shader-webgl2-host.ts`

Only these two files join the existing `site-shadcn-controls` chunk and reviewed owner list. Every other material module retains its existing lazy boundary. A direct Header/importer bypass, a foreign importer co-located with the renderer, a sibling or dependency chunk, a lookalike/query API, and adjacent legacy optical/program sources remain rejected. React/Vue acquisition stays lazy and build-only prerender roots remain forbidden in client chunks.

The build-time style owner also needs four reviewed Feedback/Runtime source fingerprint updates and the exact `feedback/src/shader/sink.ts` token/frame entry. Its literal imports are retained; no GPU capability is installed by that build-time owner. The changed Astro configuration updates only its current Retry profile fingerprint and corresponding exact test fixture. It does not become a general package resolver profile.

Executed controls:

| Evidence | Actual result | Boundary |
| --- | --- | --- |
| Complete production-graph policy fixtures | 1,977 / 1,977 passed | Includes exact owner placement, foreign imports, neighboring material and server-only controls; not an actual production graph |
| Startup/source/Retry controls | 74 / 74 passed | First run retained 43 failures from the test helper's stale exact Astro hash; updating that one current binding preserves all historical profiles and mutation controls |
| Real Feedback plus real Web shader sink in Node | 1 / 1 passed | Ordinary ownership, Effects and repeated retirement never read the physical root; an actual declaration reaches the same guarded root. No DOM/browser/GPU allocation claim is made |
| Full local source scan | No result: SIGKILL with default heap and with 1,536 MiB | Empty logs cannot establish a source-scan pass or classify every remaining finding |
| Local production build | Exit 137, `Killed` during style generation | No production graph was produced; actual hosted build remains required |

The source implementation of Feedback, Runtime, shader hosts and compiler is unchanged by this follow-up. This change repairs the ownership projection and executable controls. Existing unrelated Liquid/source findings remain individually attributable; they are not removed by expanding an allowlist.

## Collect the remaining hosted evidence

The new strict package workflow is reusable from the ordinary CI package job, but its standalone manual page is unavailable while it is absent from the default branch. The existing Compiler GPUI source-consumer workflow therefore gains one explicit, default-false `package_budget_evidence` dispatch input. When requested, it calls the same complete-package strict gate. Both original GPUI OS jobs still execute. Reusable full-cycle calls do not accept the new input and retain the existing package gate owner. There are no added automatic triggers, secrets or write permissions, and no changes to queues, measurement parameters, assertions or ceilings.

The CI policy, job-inventory and cycle-report controls pass 50/50, and the schedule audit passes. Actual UI dispatch, canonical budget measurements and the final candidate's strict result remain separate execution requirements. The existing Runtime switching evidence workflow can retain an actual production bundle graph without deleting any of its original browser journeys. Its hosted results will be appended after they exist.

## Actual manual dispatch and package-policy preflight

On published `b8d77f3ed209ee07eda04ffb59cc6eb86aac8318`, the existing GPUI workflow's Run workflow dialog did expose the new `package_budget_evidence` checkbox after selecting the feature branch. It was explicitly checked. The successful UI acknowledgment and GitHub API readback identify [run 45024775706](https://github.com/Proto-UI/Proto-UI/actions/runs/45024775706) at that exact SHA; no unregistered workflow or fabricated API dispatch was used. Both original native OS jobs remained selected.

The actual package job [137215299120](https://github.com/Proto-UI/Proto-UI/actions/runs/45024775706/job/137215299120) ran from 12:57:12 to 12:59:12 UTC and failed before measurement. All 47 public package builds and all 47 manifest checks succeeded. The package policy/evidence suite passed 14 cases and failed one at `package-budget-policy.test.mjs:236`: it still accessed `ci.yml.jobs.public_package_build.steps.find`, although that job now calls the reviewed reusable workflow. The strict measurement step was skipped because of this preceding failure; no budget report was produced, and artifact upload then failed because the report was absent. These are not new size measurements or an independent artifact-production defect.

The decoded original job log has SHA-256 `00f59c26be7253a48d68cab3b5a5e2ff316cc5d55a8ff70783e67dae5107bad6`; the retained source/job/step/artifact receipt has SHA-256 `81e7e56c2f8f487f325f5b8abfbbdb48344c6134c3f18c3ac48d13f01c664c7c`.

The bounded correction changes only the package policy test and this record. The test follows the exact local reusable path and checks the real `whole-entry-budgets` job. It retains clean/current-SHA strict measurement, blocking failures, and always-upload/error-on-missing-report requirements. Thirteen single-change negative controls remove or weaken those specific requirements; each must fail. Production code, workflows, manifest rules, compression settings and numerical ceilings are unchanged.

The unmodified local test first reproduces the hosted failure: 14 passed, one failed. After correction, the complete package policy/evidence command passes 28/28 with zero skips. This restores the preflight's coverage; a new hosted canonical measurement is still required, and the original failed run remains failed.

The independent [Website production/Retry run 45024888405](https://github.com/Proto-UI/Proto-UI/actions/runs/45024888405) and [full cycle 45024994906](https://github.com/Proto-UI/Proto-UI/actions/runs/45024994906) also bind to B8. Their pending states at this checkpoint are not pass evidence. The pending `9bd42c3` cycle was automatically superseded before it acquired jobs; no active evidence-producing run was cancelled to admit this work.
