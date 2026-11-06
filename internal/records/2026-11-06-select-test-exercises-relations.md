# Select test exercises relations — 2026-11-06

Two test entities under `spec/tests/` declared `verifies` relations to Select prototypes but declared no `exercises` relation, leaving the catalog with verification intent that no exercised boundary carried. The Matrix repair design packet (digest `ad37eba440a831dee5d29600c9be56e9746f7dff4d861f02e88fb7a79a4ac134`) pinned this gap among its reviewed entries.

The repair adds exactly three `exercises` prototype links and nothing else:

- `T-BASE-SELECT-SIZE-POLICY-0001` now exercises `P-BASE-SELECT` and `P-BASE-SELECT-ITEM`, matching the two exercised prototypes it already verifies.
- `T-BRUTALIST-SELECT-ITEM-MOTION-0001` now exercises `P-BRUTALIST-SELECT-ITEM`, matching the prototype it already verifies.

Criteria, lifecycle status, test assertions, implementations, sources and open questions are unchanged. No new cases or assertions were declared; this is a reverse-link completion only.

## Executed verification

On Node 24.21.0 with the frozen offline dependency set, `check:prototype-catalog` completed in 7.49 s: 981 declaration files, 1,364 static authoring entries, 446 cataloged prototype entities, 479 known-debt files and 3 dynamic factory files — all OK, with the chained bounded-map tail at 7 passed and 0 failed.

`check:spec-authoring -- --base 508e2d3b7dc397c06d843d61748aa7962fc67bb8` checked the two changed catalog inputs and passed. `spec:docs:agent` regenerated the ignored projection (1,243 entities, sha256 `e25975ff48fb62d8e77096823e77fec62c87d24f42e2166c4167333c4f041622`) and `check:agent-doc` confirms it current. Both changed YAML files pass Prettier. After the real `generate:proto-ui-style` prerequisite (1,350 package plus website tokens and the Shadow companion), `tsc -p tsconfig.workspace.json --noEmit` passes. An earlier direct `check:types:workspace` invocation without that prerequisite failed with two TS2307 missing generated-module diagnostics; it is preserved as a real failed invocation, not a source regression.

The focused four-file spec run reports 11 tests, 9 passed, 2 failed. Both failures are inside `catalog-evidence-integrity.test.ts`: a 5-second timeout in the cited-path sweep and an assertion listing 57 declared cases that no implementation consumes. The identical run on a source-equivalent clean baseline worktree at `e00df05dc` (tree `51988a973b0e76dfaeaf16dc86e9848ce6c02577`, identical to the main `508e2d3b7` tree) fails with the same two identities and byte-identical normalized messages. A literal re-extraction of the orphan list from each loaded workspace returns the same 57-row multiset in candidate and baseline (57 unique, no candidate-only or baseline-only rows). These two failures are therefore inherited catalog debt, not caused by this repair.

## Remaining boundaries

The 57 unconsumed declared cases and the 5-second cited-path sweep timeout are pre-existing debt, unchanged by this change and unresolved. The docs-side type check (`apps-www` Astro check) was not run in this slice. Hosted CI on this exact head has not run; two successful scheduled cycles remain the standing recovery requirement. No native or product acceptance is claimed by this record.
