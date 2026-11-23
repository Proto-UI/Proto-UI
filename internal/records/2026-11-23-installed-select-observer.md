# Installed Select committed-display observer repair

## Scope and authority

This is a follow-up to merged Sprint 3 PR #1713. The candidate starts from `824f7b12d828a179670e1d751f5f2c14d97d995d` and repairs only the installed consumer observer plus its focused controls. Product behavior, package budgets, workflow scheduling, timeouts and Prototype lifecycle remain unchanged.

`spec/prototypes/P-BASE-SELECT.yaml` remains **draft**. `P-BASE-SELECT-TEXT-DERIVATION` supplies the existing relationship between the committed selection and Value display; this repair adds no instantaneous framework child-render guarantee. It changes no normative definition or test mapping acceptance state.

## Original native failure

[Run 45206446598](https://github.com/Proto-UI/Proto-UI/actions/runs/45206446598) tested `6a2bb11a1e8abf3fffa8921d267db215bb70b10d`. Installed job `137806713492` produced [artifact 14835756714](https://github.com/Proto-UI/Proto-UI/actions/runs/45206446598/artifacts/14835756714). Its downloaded ZIP SHA-256 equals GitHub's server digest: `01d20393994ee202c08927e351e2344f41e8e233bff4592f8341d7d353a95426`.

The sealed native reports show Tooltip **12/12**, Select **3/4** and the old CLI negative **1/1**. The React Select observer failed after root `data-value === 'vue'` and `data-text-value === 'Vue'` had passed: the next immediate Value text read still returned `Pick a framework`. Preparation/build stdout is not a native pass.

The catch-time failure screenshot was inspected and already displays `Vue`. Its hash is recorded in the manifest. That delayed capture supports the timing diagnosis but is not used as sole protocol evidence. The native receipts show the server closed and no cleanup failure. Original raw receipts and the failed log are retained below; the image and ZIP remain supplementary Actions artifacts with login/access and retention limits.

## Bounded repair

The Select case now calls `assertSelectCommit(root, value)`. It keeps the original root value and selected-text checks, waits for the exact same `Vue` leaf text through the existing `until` owner, then rechecks root value and text to reject a selection that changes while waiting. The existing strict equality, 5,000 ms deadline and 30 ms poll are unchanged.

The original close, focus, portal, provenance and cleanup assertions remain. The producer still covers all 17 installed scenarios (Tooltip 12, Select 4, old CLI negative 1).

Four controls cover a delayed valid leaf, a permanently old leaf, incorrect selected-text metadata and a root value that changes while the leaf settles. Mechanically retaining the old immediate helper yields **9/11** (two failures); the corrected observer controls yield **11/11**.

## Prepared candidate verification

These results bind the two source SHA-256 values in `manifest.json` at the prepared base above. They do not describe a committed native acceptance run.

- Node observer/cleanup/result controls: **16/16**, no skipped cases.
- Python producer-owner controls: **9/9**.
- The permanently old leaf is rejected after **5008.496009 ms** by the unchanged bounded observer; it is not accepted or skipped.
- Targeted format check and `git diff --check`: passed.
- Two independent local source reviews found no blocker in this narrow repair. They are working-session reviews, not GitHub `APPROVED` reviews.

The current head still requires the real installed producer and its four hosts. New hosted evidence must bind the actual published commit before claiming that acceptance or changing the PR's readiness.

## Retained evidence

[Evidence manifest](evidence/2026-11-23-installed-select-observer/manifest.json) lists deterministic gzip files with both raw and stored byte counts and SHA-256 values. It retains the original pipeline/native receipts, failed Select log, verified extraction record, counterfactual red controls and exact prepared green controls. Decompress a file with `gzip -dc FILE.gz`.

The source branch intentionally excludes the 32 MB ZIP and ephemeral browser captures. The original artifact link remains the source for those supplementary visuals; no durable inline-image upload is claimed.
