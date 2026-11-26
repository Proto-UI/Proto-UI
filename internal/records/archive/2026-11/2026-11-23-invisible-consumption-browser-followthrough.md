# Invisible-consumption operator browser follow-through — 2026-11-23

This bounded change repairs the #750 operator observer. The same compiled Base Button artifact now completes all nine browser checkpoints. It does not admit an artifact or count an unaware consumer study.

## Why the observer changed

The original remote run is retained with its actual exit code 1. Its Space-held assertion expected the activation count to remain 1, while the pinned Web host profile commits on keydown and the generated consumer had already reached 2. The independent authority review found no normative keyup requirement: the legacy keyup example is explicitly non-normative. The observer now expects 2 while held and still 2 after release. Compiler, prototype, generated consumer, input sequence and time budgets are unchanged.

The original run also treated Vite's two conditional HTTP 304 responses as asset failures. The new helper accepts a 304 only after an actual 200 body for the same URL/path has been hashed against the artifact, the on-disk hash is unchanged, and the request's nonempty If-None-Match exactly matches that verified response's ETag. A response ETag, if present, must also match. A 304 never becomes body evidence. Eight regression cases exercise this boundary, including missing or mismatched bindings.

## Actual evidence

- Source/product base: `84105d9226ea40964c5b4fd0225975f75ed28b07`; four-file observer candidate is bound by the retained manifest and pre/post source inventories.
- The original 220-file artifact archive and its manifest are retained. Each attempt independently restored those exact bytes and installed the exact consumer lock with npm ci. The source checkout used to verify the original archive remained unchanged.
- Original attempt: four checkpoints reached, Space-held timeout, exit 1; trace SHA-256 `9f569fd64e4c2c037ca85d164160bae6487648d12c26cdc69be71721a527ab28`.
- Corrected attempt: nine checkpoints, exit 0 in 4.630 seconds, activation sequence **0, 1, 0, 1, 2, 2, 2, 2, 3**. The count reset before keyboard focus is the observer's deliberate navigation.
- Two actual HTTP 200 body bindings and two conditional 304 bindings were observed; browser errors are empty.
- Node 24.22.3, npm 11.19.1 and sandboxed Chrome for Testing 145.0.7632.6 were used. Owned preview processes were stopped and source/artifact hashes were checked after execution.
- The original eight cache tests passed locally and in the independent remote review. The independent source review found no blocking issue; it is not a GitHub approval.
- The nine original PNGs were viewed and all eight adjacent pairs were compared. The focus outline, disabled count retention and renewed pointer activation are recorded in `visual-review.json.gz`.

The full evidence inventory, original failed and successful receipts, raw traces, original screenshots, source manifests, archive and independent reviews are under [the evidence directory](./evidence/2026-11-23-sprint7-operator-browser/). Browser result SHA-256 is `5bf0b0c64686618f316fb6338832bb50170f5c1decd5855501950c32e9826a30`; the successful trace is `c93b5ef9e35bb93483f86bebea502a379d825e3ed6d09859b93bafdc11bf4993`.

## Scope still open

`observedConsumerRuns` remains **0**. This is an operator preflight on a small unstyled Base Button consumer at 960×720, with the existing finite 250ms inactive observation. It does not prove a participant protocol, artifact admission, knowledge or task-time outcome, styled-family parity, assistive technology, physical OS input or whole-library completion. Original failed receipts remain failures. Review, trusted CI and ordinary integration are separate gates.

Implemented and inspected with Codex under the user's authorized seven-Sprint continuation.

## Publication formatting

The ordinary commit hook requires Prettier formatting. Three observer/test JavaScript files were formatted after the browser run. TypeScript AST comparison retains semantic flags, directives, template raw/cooked text, operators, import attributes and optional-chain nodes; only source positions, caches and formatting hints are omitted. AST and comment digests match, and all eight cache regressions pass again. The original browser receipt retains its pre-format source hashes; no identical-byte or new browser-run claim is made. The independent formatting addendum and before/after source bytes are retained.

Immutable raw JSON, source samples and patch evidence are stored as gzip files with a complete original-path/hash map; decompression restores exact original bytes. Original screenshots and traces remain directly available.
