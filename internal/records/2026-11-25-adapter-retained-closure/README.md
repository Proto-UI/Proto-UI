# Retained adapter closure review — 2026-11-25

The requested work was to investigate the React, Vue and Web Component size regressions and reduce actual retained bytes while preserving behavior. The baseline is `078c6e91c6ffdc1a4e1508978f63f31289da2cf8`.

The [measured report](size-audit.json) retains the unchanged strict budgets, external dependency boundary, toolchain and artifact hashes. The retained change shares the Props fallback search and Anatomy query/diagnostic traversal. Each adapter loses 2,542 minified bytes. Gzip savings are only 29 B (React), 79 B (Vue) and 108 B (Web Component), because the original nearby copies already compressed well. These are different measurements; the three gzip budget gates remain failed. The report does not claim a canonical CI pass or release readiness.

The graph did not reveal duplicate positioning copies or source/dist duplicates. Recent positioning changes retain real scroll, measurement and style-ownership behavior; moving them into another bundled workspace package would not remove bytes. The excluded experiments in the report are measurements, not accepted compatibility changes.

## Behavioral comparison

The existing Props suite passed 136 tests in 12 files; Anatomy passed 57 tests in 7 files. The [portable differential replay](verify-refactor.mjs) compares the two baseline files with the current files under the same dependencies and toolchain:

```sh
node internal/records/2026-11-25-adapter-retained-closure/verify-refactor.mjs /tmp/adapter-refactor-review.json
```

It compares complete Props results, metadata, failures and validator traces for 75 scenarios / 930 operations. For Anatomy it compares 12 scenarios / 540 port operations and 64 diagnostics, including property shape, ordering and getter traces. Logical fake host caps do not establish browser geometry or accessibility acceptance. The emitted JSON binds the exact source hashes used in each replay.

## Release boundary

The draft `V-PROTO-UI-0012` and the [release execution plan](../../governance/release-0.3-plan.md#three-step-candidate-convergence) now separate bundle measurement, generated/source consistency and actual current-source rehearsal. Registry identities, publisher authorization and the complete rehearsal receipt remain independent requirements. No budget was raised, no correctness code removed, and no npm package or release published by this change.
