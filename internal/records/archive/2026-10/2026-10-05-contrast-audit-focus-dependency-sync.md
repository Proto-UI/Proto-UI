# Contrast audit Focus dependency synchronization, 2026-10-05

PR #775 carried a copy of the earlier #832 Focus repair. The current owner-approved direction is now realized by #832 at `85691891044525ca525b374f5f02d5ea5a7abf20`, which preserves #811's native owner, request-kind and Runtime phase groundwork. This change merges that verified dependency into #775 with both parents retained; it does not create another implementation or change audit acceptance.

## Preservation and conflict resolution

The #775 parent is `9ee801f646d130e8cb67e340790feee568ce6ad4`; the dependency parent is `85691891044525ca525b374f5f02d5ea5a7abf20`. Their common ancestor is `cdc46e63`. The earlier role-cancellation change reached these branches through separate commits, so the only actual conflict was `spec/tests/T-FOCUS-0001.yaml`. The old #775 file was first verified identical to #832's old `75a9f16d` file, then the current #832 catalog mapping was retained exactly. This preserves both existing cancellation cases and the new actual-owner/request-kind cases.

All Adapter, Module, Runtime and spec files in the result match #832's accepted source. The audit runner, paint probe, anatomy and storage controls, native contrast calibration, four-shard/17-family workflow, and package budget thresholds remain byte-identical to #775's previous head. The runtime plan retains contrast calibration and adds the seven-case Focus native suite from #832. No assertion, retry limit, family selection, source-provenance rule or numerical budget is relaxed.

## Validation boundaries

Local merge checks passed 42 Focus tests across six files and 91 audit controls; the latter retain bounded storage scaling, failure accounting, audit-family planning and anatomy assertions. Type, catalog, runtime-plan and independent preservation review results are tracked with the final candidate. Local Chromium remains unavailable because its process-singleton socket is denied, so the new rendered observations must come from the existing exact-head workflow after the one branch update.

The dependency already has its own observed programmatic/native/entry controls and native validation. Its canonical run used merge ref `d511fd0c` (main `dc8bf26c` plus dependency head `85691891`); all product, fixture and runtime-plan files are identical to `85691891`. That evidence supports the dependency choice but does not replace a new #775 audit.

The previous #775 run `37283003622` observed 822 matched frames at `9ee801f6`. Those frames remain historical evidence and are not attributed to this new source. A fresh run must bind its complete 17-family, four-shard observations, raw attempts, hashes and calibration results to the newly published #775 head. Standalone budget failure, deployment quota, metadata-publication debt and independent platform approval remain separate from rendered-audit acceptance. This synchronization does not merge to main or close #469.
