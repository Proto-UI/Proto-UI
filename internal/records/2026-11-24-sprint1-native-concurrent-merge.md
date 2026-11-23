# Sprint 1 native follow-up: concurrent merge reconciliation

## Scope

This normal merge joins the native follow-up checkpoint `0c9038ee587b9ff050b296da4d381a2dad4d6d82` with concurrent branch head `6ccb36ad473b72e75b3b86ee9ea5a5989b73ac5b`. Both histories and original attribution are retained. The shared base is `f419483e78403817fbe5aa6146caec30ab90352a`.

The incoming delta contains 42 paths. All 40 paths outside Search composition and its test file match the second parent byte for byte in the merge index, including AdapterHost disposal, Matrix diagnostics, overlay fixtures and Props policy. The private CLI analyzer test remains unstaged and outside this merge.

## Search conflict decision

Search composition was the sole content conflict. The reviewed complete `cd17` implementation is retained, formatted as blob `7f243c0f42dba64f89c797af276a96ca2b4fea19`. Its delayed-query wakeup checks presentation, opening epoch, current query/action identity and retirement after the microtask. The terminal owner guard prevents reentrant InputShell reads after disconnection.

Independent review compared the common base, incoming `754a51d78641c5595fb9d83535a1436bb831c3a2` implementation and the full local candidate. No incoming behavior was found missing. All nine incoming regression cases and the three fact disconnect callbacks are retained in the automatically merged test blob `5161376a98496db0ed637697912279d6ff0d21e2`.

## Executed evidence

The merged Search test file passed **63/63 cases, 0 failed, 0 skipped**. The execution receipt binds both product and test bytes before and after the run and reports unchanged sources. The command, full output, JSON result, status and 40-path preservation inventory are retained in the adjacent evidence archive.

This is unit evidence for the combined implementation. It does not establish the original native production Retry budget, Matrix initialization, or remaining Sprint 1 acceptance. The preceding native follow-up record retains the other executed source-bound checks and their limitations.

## Evidence

- `evidence/2026-11-24-sprint1-native-concurrent-merge/manifest.json`
- `evidence/2026-11-24-sprint1-native-concurrent-merge/raw-evidence.zip`

The manifest records archive and entry SHA-256 digests. This reconciliation does not mark the PR Ready, close an issue, relax a threshold, or replace required independent platform review.
