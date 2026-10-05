# Reviewed Focus kinds in the owned-material validation composition

Source: `69fe771848b9e800ec53c254a4f6f52573c4bd27`, tree `accba8e04268cf68d643a0b8b285205404804360`, parents `d9a6ff06deac35eec6aba9e8dd470e1119b5253a` and `85691891044525ca525b374f5f02d5ea5a7abf20`. The latter already contains #811. PR #826 is validation-only and must not merge.

## Canonical package measurement

[CI package job 111794190533](https://github.com/Proto-UI/Proto-UI/actions/runs/37319341617/job/111794190533) passed at runner merge `d5100f82ae0ce7a0b6a530d32539c1b18db2a93c` against main `dc8bf26cd903223f2dd4c8fc5fd37b8eb5227125`. Node 24.21.0, zlib 1.3.2.1-motley-8002e91 and esbuild 0.25.12 produced the same 11 minified hashes/byte counts/gzip sizes as the local candidate. Full values are in `canonical-budget.json`.

Bundled public-entry gzip: Runtime 67,831/68,000; React 89,298/89,300; Vue 88,546/88,700. Only React changed from the freshly reproduced d9a baseline, by 150 bytes. No ceiling or measurement setting changed. React's two-byte margin is specific to this source vector and does not cover later edits.

## Real source and package material rendering

[Material workflow 37319341615](https://github.com/Proto-UI/Proto-UI/actions/runs/37319341615) passed both paths. Artifact 11348813499 has ZIP SHA-256 `8b50944c4814529dc90692c208561f8d92280ac64905740d963360283093ba6f`. Both result files name the exact source commit, contain 17 interaction/lifecycle observations, and report zero page errors and zero non-test requests. All 31 source/packed PNG pairs are byte-identical.

The two included PNGs are the original built-package captures, inspected directly. Their text-background scene pixels match the previous 23f captures; the new source label changes. This demonstrates a new-source regression check, not an appearance improvement. The scene pixels are owned test content. No arbitrary DOM capture, native platform or cross-backend equivalence is claimed. The fixed kernel is `88f681ab7035fd55b04f63edff1841e32c4199e9`; retain the included LICENSE and NOTICE.

## Complete repository checks

[Complete CI](https://github.com/Proto-UI/Proto-UI/actions/runs/37319341617) passed 3,094 non-browser tests and 207 native browser tests across 39 browser files; 34 TODO tests and three skipped files remain. All ten workflows passed. The new seven-case Focus native suite passed in this combination, including actual descendant-owner readiness, cancellation, repeated CSS rejection/retry and programmatic/native/entry timing. The repaired Textarea matrix also retained identical four-adapter signatures. Full source/runner binding and observations are summarized in `ci-result.json`.

Independent source-PR acceptance and actual main integration remain separate. This evidence does not authorize merging PR #826 or replace required platform reviews.
