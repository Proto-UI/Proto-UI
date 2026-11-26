# Dialog conformance discrimination study: public calibration preparation

Issue [#754](https://github.com/Proto-UI/Proto-UI/issues/754). AI-assisted source preparation for the current user's bounded assignment. **No study, product check, import check, native input, model call or visual capture was executed during preparation.** The source is a candidate for Main's serial validation and independent review. The Issue remains open. Its November 6 research deferral to 0.4 is retained; this work does not admit an experiment into the 0.3 release.

## Subject and authority

The new subject is `0607c6c5c386b8a932ab850e92a8873b2121dc45`. The original September 28 source-inspection baseline `3d9ab9f56dbabbf386162145778ea1de546db825` remains historical. No historical probe source, `PROBE_HASHES`, classifier, geometry capture or passing value was changed or reused as current execution.

`P-BASE-DIALOG`, `P-BASE-DIALOG-CONTENT`, `P-BASE-DIALOG-CLOSE`, `C-AS-FOCUS-SCOPE-0002`, `C-AS-TRANSITION-0001` and `T-BASE-DIALOG-CONTENT-0001` are draft. `A-WEB-COMPONENT-0001` is an active Adapter identity with bounded support; that status does not promote the Dialog/Focus/Transition criteria. Applicable relationships are Content -> Root, Focus Scope, Overlay, Boundary, Transition and A11y; Close -> Root/Content and command semantics; Test -> Content criteria and existing module/Adapter/native implementations. APG modal Dialog guidance is an external reference, not an additional universal requirement or an independently reproduced result.

The complete live discussion was read: the Issue reports four comments, and all four were present. The two maintenance suggestions, [September 30 10:55](https://github.com/Proto-UI/Proto-UI/issues/754#issuecomment-5909766413) and [11:03](https://github.com/Proto-UI/Proto-UI/issues/754#issuecomment-5909881394), remain distinct from mutation detection. The [November 6 deferral](https://github.com/Proto-UI/Proto-UI/issues/754#issuecomment-6684442645) and [scope clarification](https://github.com/Proto-UI/Proto-UI/issues/754#issuecomment-6684470159) remain effective historical decisions. OpenHands #17480/#17435, shadcn-ui/lint #5 and VS Code #336427 are attributed reports in the original Issue; none was reproduced here and none establishes an AI cause or Proto defect.

## Executable scope

The new `scripts/analysis/dialog-conformance-study/` directory reuses the repository's Vitest config, actual WC Adapter/Base Dialog and existing process-exit integrity reporter. Three existing test sources remain byte-identical: Base Dialog (17 cases), controlled Escape reentrancy (3), WC Dialog overlay (8). Their 28 checks are evaluated separately from five added, public consumer observations. This is 33 planned assertions per cell, 198 across six cells; these are inventory targets, not executed counts.

| Public cell | Criterion / task | Injected change or valid control | Independent observation |
| --- | --- | --- | --- |
| `baseline` | All selected draft criteria | Original source; legal nested section/div wrappers around named Cancel/Save | Five journeys below must establish the baseline before any detection is counted |
| `focus-no-loop` | `P-BASE-DIALOG-CONTENT-FOCUS`, Focus Scope H/G/D | Content disables trap and loop | Actual active control at every forward/reverse synthetic Tab, default traversal prevention, keyboard-close focus return |
| `controlled-eager-close` | Content CONTROLLED / DISMISS, Root CONTROLLED-OWNER | Root applies requested open despite a controlling owner | Exact request reason/focus reason, retained owner input/view on refusal and delay, accepted close boundary |
| `description-dangling` | Content A11Y-RELATIONS | Description relation is projected without a live Description | Before/remove/re-add relationships resolve existing same-domain elements; Title removal activates Root label fallback |
| `presence-early-complete` | Content PRESENCE, Transition E/G | Content completes its leave immediately | A task-configured 200ms leave retains the view before the fixture requests completion; detach and lock release occur afterward |
| `legal-rounded-border` | Legal presentation customization | Adds supported rounded/border feedback without changing semantics; wrapped content remains legal | All five journeys still apply; a styling override is not banned merely because it is an override |

`D754-ACTION` is a separate fixture application requirement: pointer Cancel records only cancel; after reopen Save records save exactly once. Logical closure alone is insufficient. The existing selected checks have **no mapped action-identity assertion**. There is no action mutant in this public calibration set, so the study cannot estimate detection for that requirement yet. This fixture records pointer action identity; it does not claim native Enter activation identity or a repaired VS Code defect.

The configuration substitutes only one exact, hash-bound module preimage in the isolated Vitest process. It never writes the production module, changes Git or touches another owner's suite. Each cell preserves original source bytes, injected bytes, before/after SHA-256, transform receipt, raw Vitest JSON, per-step oracle observations, runner log, execution status and process-exit integrity. Transformation is not proof that a branch changed observable behavior. The reducer excludes unexercised/equivalent/repaired mutations, baseline failures, setup/compilation errors, skipped checks, runner/unhandled/cleanup errors and mismatched inventories. It reports a caught mutation only when the target observation diverges and an existing criterion-mapped check supplies a new diagnostic. Unrelated failures are retained separately. Detection and legal-customization false alarms have separate denominators; missing denominators are null.

All input events in these five added journeys are synthetic DOM events. Transition completion is explicitly requested by the unit fixture; it is not a measurement of the natural 200ms clock, native focus traversal, CSS paint, AX output or assistive technology. The style cell checks semantic tolerance, not visual styling policy. The snapshot contains the declared subject/check/runner inputs and study bytes, not the complete dependency tree or a clean-worktree attestation. Main must bind the actual repository/dependency environment and supervise the serial process and its descendants with the portfolio's existing watchdog.

## Original condition ledger

No original checkbox is marked complete by authored source.

| Source key | Original condition | Prepared material and remaining work |
| --- | --- | --- |
| `754/body/completion/1` | A reproducible fixture, criterion-to-case mapping and independently reviewed expected outcomes are available. | Fixture and source-frozen mapping prepared. Main must validate the fixture and obtain independent expectation review before interpreting scores. The author is not that reviewer. |
| `754/body/completion/2` | Valid controls, broken variants and legal customizations have recorded outcomes; held-out variants challenge the checks rather than only their authors' examples. | Six public cells are executable candidates, all UNRUN. An independent reviewer must provide genuinely separate held-out variants and expected outcomes. Public source cannot be relabelled held-out. |
| `754/body/completion/3` | Misses, false alarms, ineffective mutations, disputed rules and untested environments are reported separately. | Reducer and classifier controls prepared; all outputs await execution. Rule disagreements remain unresolved, never automatically assigned to the catalog. Native/AT/other hosts remain untested. |
| `754/body/completion/4` | The report distinguishes existing-check coverage from checks added during the experiment; any repair comparison preserves failed and neutral results. | 28 unchanged checks and five added observations are separate. No repair comparison has run; failed/neutral repairs, residual regressions, cost and interventions are unavailable, not zero. |
| `754/body/completion/5` | Each actionable gap links to its existing owner or one bounded follow-up. A negative result can complete the experiment. | No measured actionable gap exists yet. Main/#754 owns classification/adjudication; #1161 owns ordinary native Dialog evidence; #1191 owns shared Focus, and existing Compiler ownership is retained. Link actual measured gaps after execution; a null result is valid. |

Retained method clauses: freeze source, criteria, checks and expected outcomes before evaluation; keep expected behavior independent of the edited implementation and its author; review disputes; execute isolated mutations; do not count compilation failure, an unreached branch or runtime-repaired mutation as detection; allow supported wrappers/style customization; preserve first divergence, action identity, criterion/source references and diagnostics; retain baseline failures, actual denominators and excluded equivalents; require native browser input for native claims and a named AT environment for screen-reader claims. No favorable improvement or arbitrary fixed run threshold is required for this calibration.

The optional repair comparison remains after calibration: ordinary versus criterion-linked diagnostics must use the same task/model/budget and rerun independent checks, preserving failed/neutral repairs, regressions and cost. It has not been implemented as a model executor or run here.

`754/comment/5909766413` separately proposes a realistic maintenance task with the same initial source, explicit product change, model/version, budget, host and hidden independent oracle in both feedback arms. Preserve initial semantic regressions and their classes/severity, first-pass correctness, repair cycles, residual regressions, false-positive customization constraints, strategy changes and secondary token/compute/time cost. It remains a follow-on, not a prerequisite for check calibration.

`754/comment/5909881394` separately proposes a reusable maintenance task class shared with #734: freeze implementation + requested change + visibility boundary + hidden oracle; compare ordinary versus knowledge/criterion context; record exact provider/model snapshot, reasoning mode, tools/harness, retrieval boundary and run date; use independent repetitions where supported (the existing formal benchmark policy requires at least three per task/condition/model). Preserve requested-change completion, initial/final regressions, severity/class, existing-only versus oracle-only detections, false alarms, repairs, token/compute/time, evaluator intervention and variance. Stable task IDs and versioned oracle changes remain required. None of these results can be inferred from the six public mutation cells. The existing formal benchmark executor remains disabled; this work does not bypass its isolation gates or start model calls.

Other parent/source ownership is retained: #505 metadata audit; #734 knowledge access and maintenance methodology; #748 blind discovery, to which this case set must not be delivered; #732/#749 compiler comparisons; #533 Harness enforcement; #640 generic Overlay policies. CSS-cascade analysis, a production validator, automatic repair service, release gates, new Dialog protocols and stable conformance claims remain outside #754. A generated Dialog is optional only with a genuinely supported path; Button compilation supplies no such evidence.

## Serial Main validation and consumer acceptance

Use Node 24 with the existing locked workspace dependency installation; this worker only had metadata dependencies and did not install anything. From this worktree, prepend `/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin` to PATH. Execute these commands under Main's single heavy slot, keeping each output directory new and preserving failed attempts:

```sh
node --test scripts/analysis/dialog-conformance-study/report.test.mjs
node scripts/analysis/dialog-conformance-study/run.mjs /tmp/d754-r1
node scripts/analysis/dialog-conformance-study/report.mjs /tmp/d754-r1
```

The first command proposes nine synthetic classifier controls. The second performs baseline plus four injected variants plus one legal style customization, in order, with no file parallelism and one worker. Its nonzero exit preserves the actual child failures, including expected injected failures; do not treat that aggregate as either a real product failure or successful detection. The third consumes actual bound reports and emits `study-report.json` once; unresolved/excluded outcomes remain visible and can make it exit nonzero. Preserve `launch.json`, every cell directory and the report. Before/after here means original source versus each in-memory variant under the same existing checks and added observations; no production repair or failed-before product result is claimed.

Review source changes through the repository's normal metadata/format/type checks only after Main's execution environment is ready. Formatting changes to study inputs require a new recorded source binding. Do not change the seven frozen preimage/check hashes to silence drift; review and preserve a new study revision if relevant product/runner/check source changes.

#1161 owner `SolMore1161Display` confirmed the ordinary native source is disjoint and currently UNRUN. Its candidate `/tmp/release03-more-issue-1161-20261110-candidate.json` has SHA-256 `20178476273402fc6040dbd3dc33c0e9ae955050f4ec22586fe10e3ef55081c4`; its authority artifact is `/tmp/release03-more-issue-1161-20261110-authority.json`. Those paths are local preparation references, not published proof or independently reviewed expected outcomes. Main separately runs its existing public suite after integrating that exact owner candidate:

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.browser.test.ts --no-file-parallelism --maxWorkers=1 --minWorkers=1
```

That suite has one existing WC partial-remount case plus eight proposed ordinary native cases; keep actual collected/executed counts and actual source binding. This is an ordinary native consumer control, not native mutation calibration. It cannot supply native/visual outcomes for this synthetic fixture or replace held-out study cases.

For ordinary visual review Main can run the actual docs consumer:

```sh
corepack pnpm@10.32.1 --filter apps-www dev --host 127.0.0.1 --port 4321
```

Open `http://127.0.0.1:4321/en/ui-libraries/shadcn/dialog/`, select the offered WC runtime, activate the actual Open Dialog trigger by keyboard/pointer, traverse ordinary wrapped controls, invoke Cancel and Save changes, observe the intermediate leave view before natural detach, confirm focus return and reopen. Inspect and retain actual closed/open/leaving/closed captures and native traces. Repeat only the runtimes/preferences required by #1161's real source. Inspect Title/close clearance and focus visibility in the actual rendered component; attribute any existing product failure to its original owner. No browser/server is launched by this worker. Study-specific mutated paint and keyboard-action identity remain genuine unresolved acceptance, not an ordinary public screenshot claim.

PR preparation title: **Prepare Dialog check discrimination calibration**.

PR preparation body: `Refs #754. Add isolated WC Dialog mutation/control fixtures and a source-bound report that separates existing checks from added consumer observations, excludes ineffective/setup/baseline failures, and counts legal-customization false alarms separately. This is public calibration preparation; independent expectation review, held-out cases, Main's actual outcomes and native/visual evidence remain pending. No production Dialog, lifecycle, historical evidence or compiler changes. Validation: not executed by the source worker; serial commands and exact inventories are recorded here.` No closing directive is appropriate yet.
