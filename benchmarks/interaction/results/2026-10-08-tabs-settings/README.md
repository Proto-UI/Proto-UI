# Tabs settings: interrupted two-batch exploratory results

This directory is a portable, allowlisted projection of the local, independently audited results. It does not replace the frozen archive or authorize more participant calls. The original records remain unchanged.

## Results

- Original batch: 4 actual attempts, 3 scorable/all-passing, 1 upstream `token_revoked` failure (unscorable; usage and billing unknown), 5 original slots not run.
- Supplement: 6 new attempts following original slots 4–9, all scorable/all-passing. The original fourth failure is not overwritten.
- Combined exploratory description: **10 actual attempts, 9 scorable**, 3 scorable per condition (`none`, `ordinary`, `proto`). Each scorable attempt passed 6 new-feature checks and 9 regression checks (15/15). Checks are not independent samples.
- Known provider-reported usage: **22,245 input / 16,362 output / 38,607 total tokens** across 9 attempts. The failed attempt remains unknown, not zero.
- Historical reference estimate: **USD 0.208110** for those known attempts, not a route-specific invoice, verified compute cost or spending cap. Actual costs remain unknown.
- Supplement duration: **388,643 ms (6 min 28.643 s)**, Shanghai time October 8, 2026, 01:22:55.290–01:29:23.933. Preparation, diagnostics and reviews are excluded.
- No behavioral score difference was observed on this task. This is not evidence of equivalence, a causal effect, or Proto UI having no value. Combining batches across an authentication interruption is exploratory only.

`results.json` contains all ten attempt rows, receiving/scoring status, complete fifteen-check vectors where available, reported settings, timing, usage and cost basis. It retains source-results and ledger SHA-256 values. A successful nonparticipant diagnostic is separately identified; the earlier HTTP400 diagnostic remains documented in the historical record and is not a participant sample.

## Model and isolation

Route: `yvxi`; requested/returned alias: `gpt-6.1-sol`. Immutable model version is unknown. Requests used `stream=true`, `max_output_tokens=8192`, `store=false`, `tools=[]`, `tool_choice=none`; temperature, top_p, reasoning, service_tier and seed were not specified. Returned settings are recorded per attempt. The returned output cap was null; actual cap enforcement, provider internal cache/retries, executed defaults and actual billing remain unverified.

Every participant request contained only the common task, starter and its condition material, without earlier responses, evaluator or coordinator context. `none` and `ordinary` did not receive the Proto document. No further model calls were made to prepare this Git projection.

## Evidence and regeneration

Readable historical reports:

- `internal/records/2026-10-05-noncompiler-nine-run-results.zh-CN.md`
- `internal/records/2026-10-07-noncompiler-auth-smoke-stop.zh-CN.md`
- `internal/records/2026-10-08-noncompiler-six-supplement-results.zh-CN.md`

These repository-relative paths are rooted at this repository, not this directory. Raw responses, assembled receipts, browser evidence, manifests and independent review reports remain in the local evidence roots indexed by those records; they are **not uploaded** with this projection. Hashes identify retained files but do not make the raw evidence remotely available or independently verify its contents. Browser visual evidence publication remains explicit evidence debt; no external image upload is claimed.

Generate a new projection from the retained, audited results file (the target must not exist):

```sh
node scripts/benchmark/participant/export-results.mjs "$ARCHIVED_RESULTS" "$NEW_OUTPUT"
```

The exporter drops provider message attribution and copies allowlisted result fields, preserving null/unknown values and all attempt rows. It does not read credentials or modify the archive. Do not edit the generated JSON by hand.

## Contribution provenance

Original repository-specific experimental tooling and observations, materially AI-assisted by the coordinating coding agent, fresh-context local reviewers, and the `gpt-6.1-sol` participant alias. Human involvement supplied the experiment scope, decisions and execution/expense authorization; do not infer a human source-code review. Automated focused tests, offline controls and independent local audits are described in the historical records. Participant inputs were the committed task materials; no third-party or private implementation source was added to participant prompts. This disclosure is not model-version certification or proof of licensing rights.
