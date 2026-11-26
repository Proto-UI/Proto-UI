# Sprint 6 controlled-overlay progress admission

## Observed failure

The first explicitly selected controlled-overlay experiment ran at candidate `435f64225a562e9dbd7cca765d1fc268c60e0b30`, with baseline algorithm `543c8a2990239dec7c08458a902da3f5a97b49dd`:

- [Run 45100530653](https://github.com/Proto-UI/Proto-UI/actions/runs/45100530653), attempt 1, completed with failure.
- Artifact `14785496911`, 10,241,985 bytes, SHA-256 `b61a26e1b73e90ee551767da937f966ec14cfbc5ece4a27e189dc98f69d80592`.
- Both original frame measurements and their matched comparison completed. The comparison recorded equal probe/workload/browser/lockfile/fixture inputs.
- GPU prefilter, the exact old-source program-clear check, release lifecycle coverage (all five required cases), and post-measurement overlay verification completed successfully.
- Candidate four-host progress completed both original windows with `failures: []`. WC, React, Vue and Vue2 all advanced source revisions. Cleanup retained zero contexts, consumers, pending images, decoded images and pending source refresh tasks, including the two-RAF observation.
- Baseline progress stopped before launching the browser: its clean-checkout assertion rejected the five recorded dependency/fixture changes. No baseline progress report or baseline progress acceptance was produced. The final four-host outcome propagation therefore failed correctly.

The complete original logs and 241 artifact files are retained. This is a source-admission integration defect in the new controlled experiment. It is not evidence of a baseline rendering failure, and the candidate progress result does not replace the missing baseline observation. The older clean-source experiment `45058183519` remains a failed comparison with its original evidence intact.

## Bounded repair

The baseline progress command receives an explicit receipt argument only when the workflow selects `controlled-overlay`. Default clean-source commands and the candidate command still require a clean checkout.

Before and after progress, admission invokes the existing complete overlay verifier. It checks both prepared source trees, exact dependency/fixture inventory, retained patch and each material implementation against its own Git commit. It also binds the progress snapshot's HEAD, tree, status and complete tracked diff to the verified baseline identity. The receipt hash, source hashes and instrument identity must remain stable; the verifier's own source hash is now included in the instrument identity. Both verification receipts and the explicit experiment attribution are retained in the evidence.

This change does not alter the baseline implementation, candidate material algorithm, main 60-press latency probe, four-host workload, paint/progress/cleanup assertions, timing budgets, comparison thresholds or failure propagation.

## Verification at this checkpoint

The new exact-overlay identity regression first failed against the preceding source: one test executed, zero passed, one failed, with the same clean-source rejection as the hosted run. After the repair, the workflow's original six Node attribution test files plus five added regression cases executed 58 tests: 58 passed, zero failed, zero skipped, using Node v24.22.3.

The added controls retain rejection of default dirty sources, missing receipts, wrong trees, implementation or recipe drift, additional untracked source, candidate changes, restamped source identities, replaced receipts and changed instrument identity. The four-host browser experiment for this repaired source has not yet run at this checkpoint. A subsequent exact-head run and independent review are required before crediting its baseline progress acceptance.

The controlled experiment means the historical algorithm under the candidate's dependency recipe and fixture. It does not replace clean historical-source acceptance or isolate the timing effect of a single function. Browser observation, GPU evidence and physical presentation/input latency remain different evidence.
