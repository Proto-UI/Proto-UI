# Material diagnostics and homepage font preparation — 2026-11-06

The manual regression run [42145559289](https://github.com/Proto-UI/Proto-UI/actions/runs/42145559289) on `e5783ffa0647e14350652da234ddb22ed9eadc41` retained two workflow resource failures. Browser shard 1 reached the Material diagnostic without `PROTO_UI_MATERIAL_EVIDENCE_DIR`; its diagnostic also requires `CANDIDATE_SHA` to equal the actual clean CI checkout. Homepage capture spent its three-minute font-preparation window downloading the official 61,229,778-byte Ubuntu package and stopped before capture.

The delivery worktree starts at main `9e58834d167618216ed9b39278eb8dded2f2f596`. That main update changes the Scroll CSS tests and their record; the two affected workflow inputs retain the original failure-producing configuration.

## Owning changes

The ordinary `test-browser` job now obtains `CANDIDATE_SHA` from the event head and exports `PROTO_UI_MATERIAL_EVIDENCE_DIR` under its retained `runtime-ci` directory. The runtime runner already forwards these environment values to its native test child. Existing artifact retention therefore includes Material captures and failure diagnostics.

Homepage capture restores exactly the same official package path and immutable cache key used by the ordinary browser job. Its existing three-minute setup step invokes the candidate-owned `prepare-homepage-composition-fonts.sh`. That existing helper verifies package size, SHA-256, package identity, installed status, the selected Noto face and representative Chinese glyphs. Cache restoration still precedes verification.

The helper's bytes match the source that completed real font preparation in browser shard 1 of the original `e5783ffa` run. Its checksum, allowed origins, package identity, download bounds and glyph predicates remain the existing mechanism. The capture preparation deadline remains three minutes.

## Executed local verification

On Node 24.21.0, the five existing evidence/CI contract files completed with **226 passed, zero failed, zero skipped**. They cover scheduling policy, runtime selection and receipt gates, homepage acceptance predicates, projection scope, and label-selection observations. The actual `check-ci-schedule.mjs` command also passed: one three-slot regression owner, no push triggers and guarded event contexts.

A temporary native smoke probe parsed the candidate YAML and executed the actual browser setup prefix in Bash. It observed the retained runtime directory, the configured Material and typography paths, and a source SHA equal to the supplied candidate binding. The full browser runner was not started by this probe.

The same probe invoked the exact candidate-owned font command from the capture workflow, using the unchanged helper and an intentionally corrupt local package cache. The real helper rejected the cache with exit 1 before downloading or installing anything. This control used no PATH mocks or privileged package writes. It verifies the invocation and real rejection boundary; valid-package installation and rendered font coverage remain separate observations. The probe also compared the two workflow cache declarations and the helper bytes against the original hosted source.

Local receipts are `release03-ci-evidence-repair-focused-validation-20261106.json` and `release03-ci-evidence-workflow-smoke-result-20261106.json` in the integration owner's temporary evidence directory. They record the actual commands, source hashes, environment observations and negative-control output. These are local artifacts, not public hosted evidence.

## Remaining regression boundaries

Hosted execution of this repaired source is still unrun. The original run ended with 41 successful jobs, 45 failures and two skipped jobs. Its Material light/dark quality waits timed out at the existing 20-second predicates; their cause remains unresolved. The compiler WC job failed at `uid_map` with `Operation not permitted` before any test, with no established kernel or AppArmor attribution. Forty other failed jobs remain outside the completed bounded diagnosis.

Suite selection, the Material quality predicates, browser deadlines, namespace isolation, dependency locks and product implementation retain their existing behavior. Two successful scheduled cycles remain required for recovery from repair-only mode; this local verification supplies neither cycle.
