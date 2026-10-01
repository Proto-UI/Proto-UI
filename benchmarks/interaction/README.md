# Interaction benchmark: P0 development scaffold

This is a **falsifiable experiment harness**, not evidence that Proto UI is correct or valuable. `interaction-benchmark-v0` is **not frozen**. There are three public development cases, one each for Dialog, Tabs and Select. Their handwritten HTML fixtures exercise the measurement plumbing only; they are neither model outputs nor Proto components.

## Run the bounded calibration

Use the repository baseline, Node 22 and `corepack pnpm@10.32.1`. Install the locked workspace dependencies. No extra dependency or model API key is needed. A system Chrome/Chromium executable is required for browser evidence; set `CHROME_PATH` when it is not `/usr/bin/chromium`.

```sh
corepack pnpm@10.32.1 install --frozen-lockfile --ignore-scripts
corepack pnpm@10.32.1 benchmark:validate
corepack pnpm@10.32.1 benchmark:test
PROTO_BENCHMARK_BROWSER_TESTS=1 corepack pnpm@10.32.1 benchmark:test
node scripts/benchmark/benchmark.mjs dry-run --out /tmp/interaction-calibration-001 --repeats 2
node scripts/benchmark/benchmark.mjs verify --out /tmp/interaction-calibration-001
```

Calibration repetitions are bounded to 1–10 by both the producer and archive validator, before plan allocation. Calibration deviations are either empty or the single supported artificial negative control; unknown or duplicate declarations are rejected. Each output directory must be new. A blocked launch exits nonzero and keeps raw failures, missing-evidence checks, manifests, partial results and the report. `verify` checks archive integrity and cross-document bindings; successful verification means the archive is coherent, **not that its browser tests passed**. Never delete failed attempts merely to present a successful rerun. The opt-in browser tests include positive controls and explicit keyboard negative controls for each fixture. `--negative-control` additionally disables scripts in a dry-run artifact and must not be interpreted as a naturally occurring model regression.

The dedicated GitHub Actions workflow runs only public calibration, with read-only repository permission, no secrets, a 12-minute job timeout, and always-uploaded public evidence. It locates runner-provided Chrome instead of assuming a successful browser install. Both browser-producing CI commands have a 90-second process watchdog with a 10-second kill grace, and stream logs into the uploaded control-evidence directory. Dependency installation and nonbrowser tests also have bounded step timeouts, preserving time for verification/upload after a stuck browser command. A timed-out, unsealed attempt remains incomplete evidence, not a successful run. Job success is not formal benchmark acceptance. Artifact retention is 30 days; maintainers must preserve any evidence they rely on beyond that period.

Local browser actions have explicit bounds (10-second launch, 1.2-second action, 5-second screenshot). There is **no total local process watchdog**: CDP, artifact writes and shutdown are not globally capped. The manifest reports that budget as unavailable; use an external process/job timeout in CI. An abrupt process or machine kill can leave an **unsealed** directory; preserve it as an incomplete attempt, never call it verified or discard it.

## What the files mean

- `dataset.json`: version, pinned upstream source, split policy and minimum formal repetition policy
- `cases/*.json`: task text, semantic domain, visibility projection, opaque oracle reference, three oracle layers, evidence requirements and exclusions
- `materials/*.txt`: small, source-pinned **draft** Proto knowledge excerpts used only to test knowledge-packet delivery
- `fixtures/*.html`: intentionally public handwritten native-browser controls; their answers are already exposed
- `scoring.json`: draft dimension/status/conflict policy; no aggregate score and no calibrated severity weights
- `scripts/benchmark/schemas.mjs`: canonical case/dataset/scoring/run/result/failure JSON Schemas plus a strict validator for the supported keywords; export machine-readable JSON with `node scripts/benchmark/benchmark.mjs schemas`
- `scripts/benchmark/browser-calibration.mjs`: public black-box smoke journeys, independent of fixture implementation imports; **not yet an independently reviewed hidden oracle**
- `scripts/benchmark/verify-run.mjs`: evidence, schema, cell-plan, source, prompt, artifact and result binding checks

The result schema intentionally supports **calibration results only**. The run manifest records a future model-evaluation shape for design/review, but schema acceptance is not authorization, secure isolation, a working model adapter, or complete formal-result support. `run` and all non-calibration execution requests fail closed.

### Exposure and isolation

```sh
node scripts/benchmark/benchmark.mjs prepare --case dialog-open-close --arm blind --out /tmp/dialog-blind-packet
node scripts/benchmark/benchmark.mjs prepare --case dialog-open-close --arm knowledge --out /tmp/dialog-knowledge-packet
```

Both packets have identical ordinary task text. Blind receives only ordinary requirements/approved ordinary material; knowledge adds only the declared knowledge excerpt. The packet never serializes case metadata, oracle identifiers, evaluator paths, test names, final fixture implementations or compiled output. Hashes bind the delivered bytes. The archive's exposure manifest is evaluator-side metadata and is **not** part of the participant packet.

**This projection is not secure isolation.** The coordinator's workspace, Git history, network and previous context remain available. A new folder, a gitignored oracle, a new agent on this machine, a claimed `verified-external-isolation` string, or route-blocking inside a fixture browser cannot establish a hidden-oracle boundary. Public issues, test names, examples and retrieval are leakage routes. None of these public cases may be relabelled strict evaluation/held-out. No actual held-out answer inventory belongs in this repository, issue comments or prompts.

Strict blind discovery and formal evaluation are disabled until a separately reviewed executor prevents the tested agent from inspecting evaluator material through filesystem, Git, network, context/history and tools. That executor needs auditable access controls and negative leakage probes. The tested subject must have a genuinely fresh context; the author/coordinator that inspected criteria cannot be that subject. Provider training-data contamination remains a separately disclosed risk even with execution isolation.

### Oracle boundaries

1. Public platform/accessibility/host authority
2. Independently reviewed black-box user journey
3. Proto criteria/contracts with exact lifecycle and source revision

Keep each layer's judgment separate. A conflict is disputed, ambiguous or unsupported pending independent adjudication. Proto does not automatically win. A fixture expectation is not an amendment to a Base guarantee. The calibration platform links are inspectable references, not a frozen standards snapshot or completed independent review.

All three root prototypes are draft at `f5bae261491368b586959f1d8b353cf372775221`. These HTML journeys make no Proto conformance claim. In particular, native `<select>` commits during keyboard navigation and is **not** a parity oracle for Proto Select's popup navigation/commit separation. The Tabs fixture explicitly opts into wrapping; it does not claim that wrapping is Proto's default. Lifecycle and cleanup checks cover repeated/removal behavior in these fixtures only, not retained Proto owner lifetimes, resource leaks or other hosts. Accessibility-tree observations are not screen-reader testing.

## Evidence and reproducibility

A run records source/base SHA, dataset/scoring bytes, exact allowlisted final harness/fixture source snapshots, a public-source capture receipt, Node/OS/lockfile/browser/tool versions, arms, repetition index, actual visible packets, source artifacts, raw evaluator output, logs, failures, screenshots, DOM/AX snapshots and traces when produced. Model/provider/snapshot/date/reasoning/sampling/context/tools/seed, tokens, compute, human work and independence are explicit values or `null` with a reason, never guessed identifiers or fabricated zeroes.

The `p0-calibration-v3` source profile validates the entire catalog as public development material before selecting cases or creating output. It captures only explicitly declared cases/materials/fixtures, the required harness modules and dependency/workflow inputs, including `apps/www/package.json` and `pnpm-workspace.yaml` for the evaluator’s Playwright resolution. It does not recursively copy source directories or collect raw Git patches, deleted text, unrelated tracked/untracked files, or undeclared files. `source-capture.json` binds that file set. `gitHead` identifies the checkout; it **does not assert a clean working tree**. The retained final bytes and `sourceDigest` are authoritative even when they differ from that commit. Do not put private material in declared public inputs: this allowlist is a data-minimization guard, not content classification or secure isolation.

Historical `p0-calibration-v1` archives keep their original directory/history capture unchanged. Verification explicitly identifies that legacy profile and does not give it the v2 public-source privacy guarantee. The v2 profile preserves the final-public-byte privacy boundary but did not capture the Playwright workspace manifest/configuration. Both v1/v2 are explicitly labelled as incomplete for that dependency capture. Old failed or incomplete artifacts are never silently rewritten to satisfy a new profile.

### Draft oracle revision history

- Dataset `0.0.0-calibration.1`, Dialog oracle `public-calibration-dialog-open-close-v1`: the original public journey did not assert the required input accessible name or initial value. Its retained evidence describes that narrower check vector
- Dataset `0.0.0-calibration.2`, Dialog oracle `public-calibration-dialog-open-close-v2`, harness `p0-calibration-v3`: add separate assertions for the input’s accessible name `Display name` and initial value `Example`, plus independently targeted missing-label and wrong-value controls. Requirements and fixture bytes are unchanged. Tabs/Select oracle identities remain v1

V3 raw records carry the case and oracle identities and must match their retained tasks. This is an explicit draft calibration revision, not a silently changed frozen oracle. Preserve previous sources, check vectors and evidence; do not interpret the increased check count as a comparative quality improvement. To reconstruct a run, start from the exact checkout identified by `source-inventory.json`’s `gitHead`, then overlay its retained exact source files before installing the locked workspace. The older `dataset.source.sha` is the semantic baseline, not necessarily that checkout. Preserve access to the checkout tree as well: the archive is not a standalone copy of every repository package.

### Authority and cross-binding audit

| Claim | Retained authority and verification | Limit |
| --- | --- | --- |
| Upstream baseline, dataset and scoring | Pinned dataset source; run copies and digests match exact snapshotted files | Declared revision is not upstream acceptance or a clean checkout assertion |
| Harness bytes and source completeness | Exact physical source inventory, explicit public input set, required core modules and literal relative import closure; v2 capture receipt | Current trusted runner/verifier code and the public declarations are part of the trust boundary |
| Dependency and environment identity | Package-manager declaration and lock hash match source files; v3 Playwright workspace declaration/configuration hashes and lock importer agree, and observed Playwright versions match; Node/OS match raw per-cell observations; browser identity is the first successfully observed raw identity | Git/CI IDs and runtime observations are recorded values, not independently attested machine identity |
| Participant and exposure | Handwritten-fixture only; model details/audit unavailable; task-to-case identity, visible packet names/bytes, material digests and exposure record are cross-bound | Arm labels exercise packet delivery; there is no tested model or verified hidden boundary |
| Candidate artifact | Exact case-mapped fixture bytes, or the declared negative-control transformation | Public controls are not generated implementations or Proto components |
| Checks, failures and evidence | Raw evaluator checks plus deterministic missing-evidence checks; raw failures match result and sidecar; raw artifact list matches physical evidence | Hash consistency does not authenticate browser observations against an adversarial archive author |
| Outcomes and costs | Dimensions/status recomputed; first/final outcomes scoped to executed checks; zero repairs; uninstrumented recall/cost/human metrics unavailable | Elapsed time and timestamps are local observations, not token/compute cost or causal effects |
| Completed and interrupted execution | Every completed cell has exactly one ordered start/finish and result; typed failure counts match journal; only the planned completed prefix and next partial cell may exist | Abrupt kills can leave unsealed attempts; incomplete attempts cannot become passes |
| Human report | Exact deterministic rendering of verified manifest, result vectors and failure | A coherent report is not formal benchmark acceptance |

A complete archive also retains the runner's initial manifest: only the first-browser-identity field may change. Completed cell task IDs, oracle references, exclusions, deviations and prompt/artifact digests must agree across the result, case, packet and source snapshot. Tests include resealed counterexamples: merely recalculating the inventory cannot hide contradictory evidence. Initialization failures can have no completed cells; valid execution aborts preserve their completed prefix and next interrupted attempt.

Before and after each cell, the runner rejects detected changes to snapshotted source bytes. Fixtures execute from the snapshot. Run one coordinator and do not edit source while collecting a run. This calibration drift check is not an adversarial sandbox or a substitute for immutable execution images in formal work.

The run manifest preserves the first successfully measured browser identity; a later setup failure cannot erase it, and every cell retains its own browser/launch details. Verification rederives that identity from ordered raw cell records, binds dataset/scoring copies to their snapshotted sources, and validates typed failure records/counts against the abort journal before accepting a partial run. It also preserves the initial manifest except for the declared browser-identity update. Verification binds each copied artifact back to its case-mapped source fixture (including the declared negative transformation) and replays the narrowly defined runner-derived checks against the raw evaluator output and failures.

The runner refuses to reuse a directory or overwrite an artifact. `inventory.json` hashes every payload; `seal.json` binds the inventory. `verify` detects corruption, missing/extra files, invalid results, duplicate/unplanned cells, changed source/inputs and missing result references. These are **write-once-by-runner, tamper-evident local files**, not trusted immutable storage: an owner can rewrite files and both hashes. Preserve the independently received inventory digest and archive in access-controlled append-only/WORM storage before relying on formal results. CI control-test directories sit outside the inner dry-run inventory; the separately obtained GitHub artifact ZIP digest covers the complete uploaded archive, including those controls and command logs. Verify both layers when relying on a downloaded CI run.

Every dimension remains separate: behavior, keyboard, focus, accessibility, lifecycle, host and cleanup. Recall/false requirements, the discovery crosswalk, first-pass/final outcomes, repair cycles/convergence, time/token/compute/human work, exclusions and deviations have explicit fields. Unknown and unexecuted checks never become passes. The report preserves each cell and repeat check-outcome vectors; repetitions of copied fixtures test harness repeatability, **not independent model variance**. No strategic conclusion follows from them.

## Admission gates and next bounded steps

P0 is partial until a real-browser positive/negative-control run succeeds and its raw artifacts are inspected, source/packet audits pass, and independent oracle/isolation review is complete. Do not start a large model matrix.

1. Finish public browser calibration and inspect rendered PNGs plus trusted input, DOM/AX and trace evidence; retain failures and reruns
2. Establish the real private evaluator boundary and independent oracle review; author genuinely separate evaluation/held-out cases without publishing answers
3. Freeze tasks, source/standards revisions, scoring, severity/conflict dispositions, evidence requirements and repair budgets as `interaction-benchmark-v0`
4. P1: frontier first; run #748 discovery and #734 blind/knowledge with **at least three independent repetitions per task × condition × model**. Prefer fewer models to fewer repeats. Model access and cost require explicit configuration/authorization. Equal or negative results are useful
5. Keep later lanes gated: #754 regression prevention and detection are distinct; #749 needs an accepted real generated path; #751 needs predeclared repair economics; #757 needs a pinned real external protocol; #758 needs a real generated consumer

Main currently provides no supported compiler. CLI facades are runtime-backed, and unmerged compiler PRs are not the accepted baseline. This scaffold does not merge them, create a product integration, promote a draft guarantee, or run model endpoints.

Methodology sources: [#734](https://github.com/Proto-UI/Proto-UI/issues/734#issuecomment-5909865821), [#748](https://github.com/Proto-UI/Proto-UI/issues/748#issuecomment-5909870381), [#754](https://github.com/Proto-UI/Proto-UI/issues/754#issuecomment-5909881394), [#749](https://github.com/Proto-UI/Proto-UI/issues/749), [#751](https://github.com/Proto-UI/Proto-UI/issues/751), [#757](https://github.com/Proto-UI/Proto-UI/issues/757), [#758](https://github.com/Proto-UI/Proto-UI/issues/758), dependencies [#732](https://github.com/Proto-UI/Proto-UI/issues/732), [#733](https://github.com/Proto-UI/Proto-UI/issues/733), [#750](https://github.com/Proto-UI/Proto-UI/issues/750).
