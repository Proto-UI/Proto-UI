# Finf development package-budget policy

The maintainer's 2026-10-08 direction allows unrestricted **size growth during Finf rapid development, until the 68 complete-delivery goals are finished**. This explicit, temporary project-stage decision supersedes only the blocking size comparison of the older numeric-budget policy for this scope. It is not a very large replacement ceiling and does not accept a feature, a source claim, a release, or a failed measurement.

## Scope and invocation

- `pnpm check:package-budgets` explicitly selects `--finf-development`, so the existing CI package check uses the authorized phase. Its policy regression tests run in the same CI job. `analysis:monorepo` also selects that mode and retains the existing `.results` consumer shape.
- `pnpm check:package-budgets:strict` and `node scripts/analysis/package-budgets.mjs` retain strict enforcement without reading the Finf ledger. There is no environment-variable, branch-name, or CI-error-based implicit exemption. Unknown or repeated flags fail.
- Finf advisory applies only to the nine existing entry paths listed in `FINF_BUDGET_ENTRIES` in `scripts/analysis/package-budget-policy.mjs`. Additional/unrelated entries stay strict. The baseline literals, entry points, tree shaking, external dependency boundary, minification, target and level-9 gzip are unchanged.
- Scope derives from `internal/coverage-matrices/prototype-coverage-matrix.json`: `deliveryPlan.items` contains 55 full-delivery goals (including `baseline.button`, `baseline.table`, and the Overlay repair), and `deliveryPlan.priorWork` contains 13 closeout/carry goals. Core, Runtime and the three measured Adapters implement those cross-host obligations; Base/Shadcn Button cover `baseline.button`; the six inventoried prototype libraries in `candidateSource.prototypeInventory` include the repository's Lucide package and its icon entry. These are measurements of Proto UI's integrated packages, not new upstream project authority or permission to modify upstream code. The 68 goals are not family/entity counts.

## Reporting and failure boundaries

Every entry retains raw minified bytes, SHA-256, actual gzip bytes, the old budget and the factual `pass` comparison. `overBudgetBytes` records the exact positive difference. `pass: false` remains false when an advisory overrun exits successfully; text calls it `ADVISORY`, never `PASS`. `withinBudgets` summarizes the actual numeric comparisons separately from `exitCode` and each row's `blocking` flag. JSON records toolchain, build/compression settings, policy scope/expiry and the delivery-ledger hash/count. No earlier failed run is rewritten or relabeled.

Only a valid, in-scope **size overrun** becomes advisory. Build errors, absent/empty output, missing or invalid measurements (including NaN/nonfinite/nonpositive byte counts and invalid artifact hashes), missing toolchain data, malformed/missing Finf state and unknown policy/arguments remain errors. Diagnostic consumer build/measurement errors also remain blocking, as before. Tests, source authenticity, coverage acceptance, types, DCO, independent review, permissions and repository protections are unchanged. The report is local measurement evidence until canonical exact-head CI reproduces it.

## End of phase and restoration

Finf mode reads the existing ledger on every run. It requires tracker #870, exactly 55 core and 13 prior-work items, 68 unique item IDs, Boolean completion states and a consistent core-completion count. The separate coverage validator continues to enforce exact goal identities, complete acceptance receipts, real source bindings and generated-view integrity; this policy does not replace it. Missing/invalid state fails closed, rather than falling back to an unlimited mode.

When all 68 items are recorded complete, the size check automatically returns to **strict**, even if the temporary CLI flag remains. `recordedCompleteItems` is a ledger observation, not independent acceptance; synthetic completion fixtures are tests only. The current recorded state is **0/68**, and this change checks no box.

Before final Finf acceptance, the integrator must remove the temporary opt-in from the package and snapshot entrypoints, rerun canonical strict budgets on the full final source, and restore a separately reviewed, evidence-backed bounded budget if accepted growth needs new ceilings. Retain the old baselines, prior red runs and growth attribution. Completion flags must never be held false or fabricated to prolong the exception. Re-entering advisory after Finf completion requires a new explicit project decision; ordinary numeric-budget authority cannot extend this phase. No registry publication or other release action is authorized here.

The original baseline and same-source strict/advisory measurements are retained in `internal/records/2026-10-08-finf-development-budget.json`.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
