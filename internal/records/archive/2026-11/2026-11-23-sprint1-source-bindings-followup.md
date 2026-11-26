# Sprint 1 source binding reconciliation — 2026-11-23

This follow-up is prepared on `3f62a317dc95ac853c57ae75ea3305fc2a5dfcfa` for Draft PR #1711. Its three affected website inputs are byte-identical to the reviewed Sprint 4 inputs at `53194e0c01e6073b9ba3e7852c755ab57cfbe12d`. It carries only their stale source-binding repair; it preserves the two current Search bindings and every other matrix row.

| Input | Actual SHA-256 |
| --- | --- |
| `apps/www/src/pages/en/test/liquid-glass-hover.astro` | `4db4262c4c5136993373e9d280b9bb54807b69cc91455943634cc195c974ad9c` |
| `apps/www/src/content/docs/demo-liquid-glass-select.demo.ts` | `3ecd674e4bfc765319ce5c9c0783bd4c116ab1eaad068b0a3c546016fb08fa04` |
| `apps/www/src/components/PrototypePreviewer/previewer-bootstrap.ts` | `5abf6359d556daf21777892ed99cec3b57d18c5102cfcaa9569987ab76086151` |

The exact hover diagnostic importer uses the same actual digest. Its existing eight permitted import edges and ownership remain unchanged. The current negative fixture now covers that importer as well as the two existing importers; changed source, foreign owner and adjacent import drift continue to reject. No additional runtime consumer is admitted, and Liquid Glass remains under its existing WIP / Experimental boundary. The Sprint 4 source review and historical failure are retained in [its fixed-commit record](https://github.com/Proto-UI/Proto-UI/blob/53194e0c01e6073b9ba3e7852c755ab57cfbe12d/internal/records/2026-11-23-sprint4-source-admission-followup.md).

## Actual validation

On Node 24.22.3, the following selected diagnostic-boundary checks executed: **3 passed, 0 failed, 0 skipped**. The result is limited to this explicit selection; it is not the complete matrix test file or a complete CI run.

```sh
node --test --test-name-pattern='diagnostic import review rejects owner, body and edge drift' --test-reporter=spec scripts/coverage-matrices/test/check-coverage-matrices.test.mjs
```

[Actual output](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint-followthrough/sprint1-source-bindings/diagnostic-boundaries.log) and the adjacent source-binding receipt preserve the command and candidate bytes. This work does not transfer Sprint 4's validation to Sprint 1. Full source governance and the current Sprint 1 browser/CI requirements still need execution on the published candidate. The earlier Search runtime evidence remains bound to its original source; no new runtime or native behavior result is asserted here.
