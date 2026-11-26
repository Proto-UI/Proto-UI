# Preserve original historical evidence bytes during integration

The normal pre-commit formatter for integration merge `f81654e1f23c10a5b0265bc78754ab0736bee9fa` changed 183 historical evidence files inside the eight dated directories below. Their original bytes are retained by Sprint 2 commit `4a11517171aa0a019c4bcbd2314c779e25f21de5`. Reformatting these files breaks the existing SHA references and changes the archived bytes, so this follow-up restores the original blobs and excludes only these exact directories from future formatting.

| Historical directory | Original files | Restored files |
| --- | --: | --: |
| `internal/records/2026-11-22-sprint2-mobile-navigation-control-evidence/` | 132 | 60 |
| `internal/records/2026-11-22-sprint2-mobile-navigation-fixture-evidence/` | 40 | 16 |
| `internal/records/evidence/2026-11-22-sprint2-collections-review/` | 256 | 67 |
| `internal/records/evidence/2026-11-22-sprint2-compiled-native-repair/` | 21 | 5 |
| `internal/records/evidence/2026-11-22-sprint2-compiler/` | 131 | 5 |
| `internal/records/evidence/2026-11-22-sprint2-datepicker-review/` | 65 | 11 |
| `internal/records/evidence/2026-11-22-sprint2-input/` | 117 | 4 |
| `internal/records/evidence/2026-11-22-sprint2-native-round1/` | 39 | 15 |

All 801 files in these directories matched the original Sprint 2 commit before the merge hook. Of the 183 changed files, 175 have direct original-SHA references in retained manifests or records. The other eight are original run manifests, raw Vitest output, source/trace summaries, or independent reviews of dated runs. An independent read-only audit also verified 732 stored-file SHA/length entries and 381 decoded gzip SHA entries in the six original manifests, with no mismatch.

The proposal inventory SHA-256 is `6965a36dcb0d92f934933db377aa867c746de563a4cdc978c7297808a4bc006b`. The retained pre-hook tree is `0752bd3400eb6055606cbb9a179a93e62d46b503`; the formatted merge remains in history. The restoration can be independently checked against the original Sprint 2 Git blobs. Original pass, failure, and pending outcomes and their source/run attribution remain unchanged; no receipt hash is recomputed to bless formatted historical bytes.

The two ordinary Sprint 2 summary documents and all active compiler, product, test, specification, and script files remain on their existing formatting path. This commit does not claim those active formatting changes are semantically equivalent or reuse pre-hook test results for a different source tree. Their structural review and exact-source regression checks are recorded separately.

This is a byte-preservation repair within the unpublished integration worktree, and does not alter CI workflows, DCO, approval requirements, or the seven original PR bases.
