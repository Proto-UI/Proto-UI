# Strict package-budget restoration and growth attribution

## Source and scope

The requested regression repair restores strict whole-entry budgets in the normal package check, complete CI cycle and monorepo snapshot. The explicit Finf development diagnostic remains available; its success cannot qualify a regression or release candidate. This change does not alter a numeric ceiling or claim that the Finf completion ledger is complete.

The source-bound measurement and all eleven artifact-vector comparisons are retained in [the accompanying record](2026-11-22-package-budget-restoration.json). The old budget source is `433b9c20581bf92e14ea6b71b6e84891650c2ea9`, whose historical measurements are in `2026-10-07-finf-main-495b-budget.json`. The current product source is `d095fa0a811facff676b6f62929b177aa1dc7583`; the instrumented local worktree is explicitly dirty.

## What the measurements establish

The old source was remeasured with Node **24.22.3**, zlib **1.3.2.1-motley-285e94b**, esbuild **0.25.12**, Linux x64, the existing browser/ESM/ES2020 options, third-party external boundary and level-9 gzip. All nine entry vectors and both diagnostic vectors reproduce the historical raw bytes, minified SHA-256 and gzip bytes. Thus the observed growth is not explained by the recorded Node/zlib update.

All eleven current local artifact vectors exactly match [the canonical package job](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761147724) at `7a696228c31e6b77998c4e356a57dcebd08854a0`. This proves equality of those measured artifacts across the intervening source changes; it does not turn that old cycle into a completed current-head run.

| Entry | Old source, same toolchain | Current source | Existing ceiling | Strict excess |
| --- | --: | --: | --: | --: |
| Lucide X icon | 1,737 | 2,879 | 3,000 | 0 |
| Lucide root | 635,940 | 637,306 | 700,000 | 0 |
| Core root | 7,464 | 11,378 | 7,600 | 3,778 |
| Runtime root | 77,661 | 101,068 | 78,500 | 22,568 |
| React adapter root | 105,183 | 163,757 | 106,000 | 57,757 |
| Vue adapter root | 105,015 | 162,553 | 106,000 | 56,553 |
| Web Component adapter root | 130,795 | 196,814 | 132,000 | 64,814 |
| Base Button | 3,815 | 5,274 | 6,000 | 0 |
| Shadcn Button | 4,797 | 7,812 | 7,000 | 812 |

All numbers in the table are gzip bytes. The two current consumer diagnostics are **202,998** and **203,003** bytes; they remain supplementary and do not replace the whole-entry gate.

## Growth cause and boundary inspection

The complete per-package attribution is in the JSON record. The largest retained **minified-byte** increases in React are Positioning **+38,856**, shared Adapter support **+38,531**, and Feedback **+27,562**. Web Component also adds **31,732** in its own Adapter; Core adds **12,388**, and Shadcn Button's family implementation adds **12,058**. These contributions precede gzip and must not be added together as compressed costs.

Inspection traces these retained additions to the existing integrated input, positioning, ownership and presentation work: Axis Input and Native Link, target alignment and border-box size leases, portal ownership, view-epoch input/event cleanup, resident motion and Presence presentation, and Shadcn's authored modern/New York profile selection. Useful exact source changes include `c57421c1e`, `0b7ada498`, `d0af6b09f`, `dd4dcd15d`, `67e8392b1` and the preserved Finf source in `991cc33ac`. Applicable catalog anchors include `M-POSITIONING-0001`, `C-TARGET-ALIGNMENT-BINDING-0001`, `C-AXIS-INPUT-DIRECTIONAL-0001`, `C-NATIVE-LINK-0001`, `C-FEEDBACK-RESIDENT-MOTION-0001` and `C-FEEDBACK-PRESENCE-PRESENTATION-0001`. Their draft status is unchanged; accounting for integrated source cost is not lifecycle promotion or product acceptance.

The actual input graphs contain no bundled `node_modules` input, no `dist`/source Runtime duplication, and only the one `packages/runtime` implementation. Ordinary entry roots do not retain the optional optical program/sink/source implementation. This rules out those particular accidental-closure explanations; it is not proof that no further optimization is possible. Removing input ownership or lifecycle code merely to recover the old ceiling would erase required behavior. A future capability-specific split would need its own design, API compatibility and conformance work.

## Receipt and failure behavior

Each measurement now captures the source head/tree, package and measurement-input fingerprint (including the Finf ledger), clean/dirty flags and start/end consistency. Canonical CI explicitly requires a clean tree and the event's expected SHA; stable dirty source cannot qualify. esbuild dependency metadata binds real inputs to captured file hashes and byte counts. Unbound, missing or outside-tree input metadata and source drift fail rather than producing a candidate receipt. The report retains the external dependency list and hash, every per-input retained-byte observation, zero-retained dependencies and package aggregates. JSON remains available when strict size comparison exits **1**.

Policy controls cover the real CLI overflow behavior, the actual strict CI step and its always-upload artifact, strict/development separation, malformed ledger/measurements, changed source/head and invalid dependency metadata. The new helper and tests select the full public package graph; a later helper-only change cannot silently avoid this gate.

## Validation and remaining work

- `node --test scripts/analysis/test/package-budget-policy.test.mjs scripts/analysis/test/package-budget-evidence.test.mjs`: **15 passed**, including clean/expected-candidate enforcement and CLI argument validation.
- `node --test scripts/analysis/test/package-budget-evidence.test.mjs scripts/release/test/public-package-plan.test.mjs`: **13 passed**, including five overlapping source controls; these totals are not added.
- `node scripts/analysis/package-budgets.mjs --json`: all nine entries and two diagnostics measured, **six strict failures retained**.
- Old-source same-toolchain control: all **11** minified hashes/raw sizes/gzip sizes match the historical record, and the external boundary is identical.
- Final candidate canonical CI and independent review remain required. The local source receipt is a historical diagnostic and must be regenerated after the candidate changes.

A separately reviewable numeric transaction may account for the already integrated capabilities after reviewing this growth evidence. This restoration commit leaves the old six failures intact; it does not grant headroom for future changes or relabel a historical failure.
