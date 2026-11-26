# Sprint 4: Search source revalidation and complete type checking

This non-normative continuation follows the [recovered candidate record](2026-11-23-sprint4-ready-recovery.md). It records a bounded source-admission correction after the actual hosted scan on `b65a5d25feab5ceeacc3d0dd3bb1e23325b8beaf`, and the successful complete type check on that same published revision. It does not promote a draft contract or the blocked Search consumer rows.

## Observed failure and reviewed source delta

[Compiler source-consumer run 45179334550](https://github.com/Proto-UI/Proto-UI/actions/runs/45179334550) passed strict package budgets (9/9), the ten original Docs cases, and both Linux and macOS native jobs. Its complete Website source scan failed with five diagnostics for `site-search-commands.ts`: four raw-import refusals and a source-fingerprint mismatch.

All four literal imports were already present in `WEBSITE_RAW_IMPORT_ALLOWLIST`. The checker validates the importer's complete raw-byte hash before evaluating the literal specifiers, so the stale hash caused all four refusals. No additional import allowance is needed.

The previously reviewed blob `53fade32a4c7929fbfa06e64b2fc2f9fb34e44ca` has SHA-256 `7fa9135a6c446af8a8f9b4af9d585c80e85c210d831c429873e12f4dc6b67bf3`. The current blob `f18443f6dfc37abacb1cda0ec946b883368fa162` has SHA-256 `020e7875fcb38930114fbc516ade64e7b2f377afc16a425c1ef5f74b4fe836de` and is identical in the published candidate and main `b715b8a6d08c2c79417272c8d4ca9254984feadb`.

The complete source delta is [319278ec](https://github.com/Proto-UI/Proto-UI/commit/319278ec982aa251053c364126b6858e01f37511): install the existing public Button opener-return callback on every Dialog activation, while retaining panel-focus ownership, focus-epoch and current-focus guards. The import declarations, three fixed Lucide prototype registrations, and public Button state subscriptions are unchanged. The existing Button public-state/focus and Lucide fixed-entry definitions remain the applicable authorities with their existing draft lifecycle.

The repair changes only this source hash in the checker and the corresponding matrix row, and adds the bounded source-delta review to the matrix. Exact paths, four literal specifiers, owner predicates and all three `blocked` / #1323 dispositions remain unchanged. Source comparison does not establish browser, keyboard, assistive-technology, four-runtime or retained-focus-withdrawal acceptance.

## Executed evidence

The [manifest](evidence/2026-11-23-sprint4-search-source-revalidation/manifest.json) binds compressed original-byte logs and receipts. The source-admission runs used Node 24.22.3 and the exact two-file working patch `11eb678d9b9241005c63141fbbfb53ad4935f8dd9786f2ff4b196712d71036a8` on top of the published candidate.

| Boundary | Actual result |
| --- | --- |
| Original two Search import-boundary controls, before repair | 0/2 passed, 2 failed, no skips; the exact-current-importer positive assertions failed |
| Same original controls after repair | 2/2 passed, no skips; copied paths, unreviewed bytes, the adjacent icon and forbidden Runtime import remain refusing controls |
| Original complete `node scripts/coverage-matrices/check-coverage-matrices.mjs` | Exit 0, `OK (2 matrices)`, 186.553174 seconds; complete working diff unchanged during execution |
| Complete `corepack pnpm@10.32.1 -s check:types` on clean published `b65a5d25...` | Exit 0; style generation, workspace tsc and Docs/Astro completed; 1,258 Astro-checked files, 0 errors, 0 warnings, 32 hints |

The complete type check used Node 24.22.3 and a 6,144 MiB Node heap limit in an isolated checkout. Its receipt records 1,079.863551 seconds, maximum RSS 3,212,248 KiB, tree `9e60b3035ab3e68e3019cccc02fac3ad42d28beb`, and a clean worktree after execution. The original log SHA-256 is `b711f1f9c93f38b079155cda1920de54f97df7c649f7e24795c63b64a9430ee7`; the original receipt SHA-256 is `e41b1b384863d984efeda59fa0e0359e49420fe9daf55d66fd3826d595765785`. Earlier resource-terminated and fixture-defect attempts remain in the preceding record.

## Publication and remaining evidence boundary

These observations retain their actual source and working-patch bindings. A later commit containing the two governance changes and this record is not another execution of the complete types command. Reuse requires an actual final diff proving application/package sources, fixtures, dependency locks, build inputs and workflows unchanged; the changed complete source gate must run on the new published head. Formatting and documentation references must also be checked after this record is added.

The original production Search suite, remaining Homepage evidence, current-head hosted rerun and complete canonical independent review are tracked on PR #1714. A partial or failed workflow is not a green aggregate. This bounded revalidation does not close historical private IR10 rights, definition-owner or migration criteria, and does not assert final merge approval.
