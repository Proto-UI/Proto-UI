# Sprint 4: recovered candidate and readiness evidence

This non-normative continuation records the recovery of PR #1714 from `53194e0c01e6073b9ba3e7852c755ab57cfbe12d` with main `b715b8a6d08c2c79417272c8d4ca9254984feadb`. It supplements the [original integration record](2026-11-22-sprint4-integration.md) and [source-license repair](2026-11-23-sprint4-rust-data-license-metadata.md). It does not promote draft compiler contracts or close the separate IR10 contribution-rights, definition-owner, compatibility or consumer-migration requirements.

## Recovered source and transport

The restored getter publication and Qt admission production files and their two tests match the previously reviewed SHA-256 values exactly. Fresh independent review checked those bytes, the retained main flow/schema guards, the source-license delta and the numeric fixture reconciliation. Earlier transient getter reproduction logs were unavailable after the executor loss; they are not recreated or counted as fresh executions here.

The affected compiler run executed locally at `458f8ba776b4210f61079048ae65f05d02a739bf`, tree `b130be2e8c27d6f82e23230d5e6b5741e2c45830`. The subsequent archive repair and corrected shader fixture are retained in local candidate `c7ac9579ce15e838841c16814a43f5451c1fddc9`, tree `263a12d0dd5ca5b36d1cb2fe41a42a8f8c17931d`.

The Git Data API transport receipt maps all five local commits to objects with identical trees and the corresponding parent graph. In particular, local `458f8ba...` maps to API object `8576673a302a054d5ba0955240a6738e03bf6669`, and local `c7ac957...` maps to `2df19de17113c6c122442598aa281f6eb65b6272`. Commit metadata differs. Tree identity is a source-transfer check, not another test execution, branch-publication receipt or GitHub approval; the captured transport receipt records `branchUpdated: false`.

## Repairs and independent findings

- Recursive public-data conversion now rejects accessor authority while retaining ordinary readonly data and explicitly evaluated snapshots. Direct Qt emission rejects getters in the actual retained output closure instead of silently emitting callable fields.
- Numeric admission retains the original dormant-source omission controls and adds reached and independently validated retained-Hook negatives. The first 36-case run is also included in the later 376-case selection; these are not additive coverage counts.
- The shader host test's original structural style object caused `TS2741`. Independent review then caught the intermediate `tw()` call's missing required argument as `S4-SHADER-STYLE-ARITY`. The final `tw('')` uses the public factory and preserves the physical-root refusal and exactly-once assertions; the separate resolution report closes that finding.
- The normal merge formatter changed ten frozen history/archive files. The unchanged production snapshot reader actually rejected the changed timeline index. Restoring all ten files to main's exact bytes and Git blobs, with five narrowly scoped Prettier exclusions, made the same reader succeed. Historical JSON values and receipt hashes were not rewritten. Independent review accepted this bounded integrity repair; it does not establish Sprint 7 decision acceptance.

## Actual local execution

The [evidence manifest](evidence/2026-11-23-sprint4-ready-recovery/manifest.json) records raw and compressed SHA-256 values; [validation.json](evidence/2026-11-23-sprint4-ready-recovery/validation.json) retains commands, source bindings, execution provenance and limitations. Raw logs and JSON reports are gzip copies of their original bytes, not reformatted reconstructions.

| Boundary | Observed result |
| --- | --- |
| Affected compiler selection, including mandatory offline Rust data consumers | 21 files, 376/376 passed, no failures or skips; 79.27 seconds |
| Numeric admission restoration, before the combined run | 36/36 passed, no failures or skips |
| Diagnostic registry refresh | Initial 3/5 with two failures and one snapshot update; corrected refresh 5/5 with one snapshot update; ordinary 5/5 verification also passed within the 376 run |
| Corrected shader unused-capability fixture | 1/1 passed for `tw('')`; the intermediate runtime pass is retained separately and did not prove static validity |
| Actual frozen-history snapshot reader | Red exit 1, `native source index changed: timeline.index.json`; green exit 0, reading 1,230 PRs, 467 issue timelines and 43 inline pages |
| Archive preservation and formatter boundary | 10/10 original blobs and bytes match main; all ten ignored by Prettier, ordinary compiler source still formatted |
| Local public-document check | Passed: 305 bilingual primary routes, 4 library inventories and 436 maintained documents; distinct from final published-head workflows |
| Complete `check:types` corrected replay on local `c7ac957...` | Exit 137 after 278.93 seconds; workspace tsc completed, then Docs/Astro emitted warnings and was killed; the whole command did not pass |

The compiler selection used Node 24.22.3, one thread worker and a 1,536 MiB heap limit. The existing Rust 1.98.1 toolchain ran offline with `PROTO_UI_REQUIRE_RUST_DATA_TESTS=1`, so absent Cargo could not become skipped native evidence. Exact file selection and environment are recorded separately from the raw runner reports.

## Retained failures and remaining gates

The earlier full-types attempts remain failed observations: heap exhaustion/abort (134), the original style `TS2741` (2), a killed intermediate run (137), and an unavailable `/usr/bin/time` wrapper (127, before type checking). The raw logs retain those messages; numeric exit codes are attributed to the executor's actual completion observations rather than invented contemporaneous receipts. The corrected replay used a 3,072 MiB heap limit and reached a maximum RSS of 2,870,140 KiB. Its persisted receipt records exit 137 after 278.93 seconds. Completion of the workspace tsc stage does not establish a successful full command; the subsequent Docs/Astro stage was killed. This replay is a separate failed execution and does not erase the earlier failures.

The independent source and finding-resolution reports are local reviews of named source bytes and actual results. The complete types command will be rerun on the final published candidate in the isolated remote executor; its later result must be attached as new evidence rather than retroactively changing this failed checkpoint. Formal review input, `pui-review`, approval, branch readback and applicable workflows on that exact published candidate remain integration work. Historical browser/GPU, package-budget, website, native and source-license receipts are not relabeled as new executions by this recovery. Existing IR10 ownership, contribution-rights and migration boundaries remain open under their original owners.
