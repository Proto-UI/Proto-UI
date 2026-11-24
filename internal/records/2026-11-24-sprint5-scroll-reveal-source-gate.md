# Scroll Reveal source gate coverage

The explicit source-regression command omitted the complete `packages/compiler/test/scroll-reveal-consumers.test.ts` suite. This change adds that original file once to the existing `source_regressions` lane; fixed main `1dd7afa3ea4ff43c1f28306c9b035e87ed11ea62` grows from 23 selected files to 24. Existing input defaults, triggers, job limits, assertions, case deadlines and failure propagation are unchanged. This is source-gate coverage, not public profile admission.

The unchanged suite has seven controls for each of four ordinary generated host profiles: React, Vue 3, Vue 2 and Web Component. Its Git blob is `8838283ed2a4e04af3f6d4469c1c83587b86bfa4`, SHA-256 `bc44131a01668c3a75675d91891d032f4e66f4ff87a5bc218f6fd99bdd484b88`. That identity matches b5a, fixed main 1dd and the owner's 84f40 main-union successor. This host-model execution is not native browser layout acceptance.

## Actual source-bound results

| Source | Original complete suite | Result and elapsed time |
| --- | --- | --- |
| `b5a02916b9cd2246ee467c19f91f4e9861a4d7a5` | 28 original cases | 28 passed, 0 failed/pending; exit 0; 18,525 ms |
| `84f40b077fd1fa64af04c6259942a4286153d8d4` | 28 original cases | 28 passed, 0 failed/pending; exit 0; 21,408 ms |
| Gate change `7902a47f8bd2ba33745840d9248548b2309c9a6a` | 28 original cases | 28 passed, 0 failed/pending; exit 0; 23,912 ms |

The gate-change tree is `627ece7de9f7499de3d063205c654f71dab4f165`. It changes exactly one workflow line from fixed main. The normal Husky hook passed. On that same committed source:

- `node scripts/ci/check-ci-schedule.mjs` exited 0.
- The complete CI scheduling-policy, cycle-job-inventory and cycle-report files passed **59/59**, with zero skipped or cancelled tests.
- The original complete Scroll Reveal file passed as shown above; no test filter, assertion modification or per-case timeout change was used.

Each run retained the clean source head and tree, full command, terminal state, original test JSON and full log. Node was 24.22.3; pnpm was 10.32.1. Frozen offline dependency installation completed successfully. The suite supervisor used an independent 300-second outer bound and one Vitest worker, preserving the original per-test deadlines.

[Original receipts, logs and SHA-256 manifest](./evidence/2026-11-24-scroll-reveal-source-gate/) are retained byte-for-byte. The later evidence commit adds this record, a narrow raw-evidence formatter exception and those receipts; it does not alter the tested workflow or suite.

## Historical failure and current owner boundary

The [original #1738 review comment](https://github.com/Proto-UI/Proto-UI/pull/1738#issuecomment-7119115448) reported a first React reveal failure at `5006bd06a2cd570583dd4387cb1b3eff81932b38`, with 28 passing on its then-main comparison. That comment remains historical evidence. Its raw failing assertion and duration were not recovered here; the new successful executions do not diagnose it or erase that result.

The original owner merged b5a and fixed main 1dd at `5b5716d042bffc056b46e1f218f5d380399d5724`, then produced 84f40. Its reconciliation record distinguishes pre-integration original28 from the integrated focused and broader selections. The independent 84f40 execution above is a new, separate current-head result. This change does not modify the owner's branch or relabel its earlier prepared-tree results.

The 24-file gate and any future union's larger selection have not been run in full by this narrow follow-up. Broader browser, native host, material diagnostic, scheduled-cycle, required CI and eligible independent review remain separate acceptance requirements. No full Sprint or release completion is claimed.

A separate reviewing agent identified the missing gate selection and reviewed the one-line change and existing scheduler/control coverage. That technical review is not a GitHub approval. Codex materially implemented, validated and recorded this follow-up using its actual author and sign-off identity.
