# Capture getter provenance and actual facade presence

Date: 2026-11-23

## Scope and status

This is a source-tested prepared compiler candidate, with an incomplete workspace type check, on isolated base `db747e1b81cbbfaf2b37dd8af3de48108f036a04`, using Node v24.22.3 and pnpm 10.32.1. The only inherited source change is the one-line spread validation alignment already committed in `52c87232f593d85a28cbd04ad205f0d5fe6f03a3`; this candidate does not repeat that change. The candidate changes one compiler source and adds two control files. It has not been applied to a new combined Sprint 5 head, and this record is not a GitHub approval or browser/CI acceptance.

## Problem and repair

The existing direct capture operations had access to actual capture contents, but member copies of getState/getMethod/getAsHook/getAsHookHandle lost their callable provenance. Twelve existing controls consequently stopped at PUI1007, before source-free forgery controls could test their intended PUI2002 rejection.

A copied framework getter now retains the reached capture and its operation. Direct operations and copied getters consult the same current closed capture graph. Returning or exporting a getter still checks its actual returned closures in their caller phase. Neither a function name nor serialized getter lookup metadata grants an authored callable authority; unresolved sources remain opaque.

Actual facade presence is separate from its schema. The native finish_capture protocol omits empty getter, methods and artifacts fields. Methods and children therefore use actual joined member facts; State/event presence follows actual executed contributions and participates in snapshots and fingerprints. Missing hook identities remain conservative. Known nonempty captures retain their dead absence branches as dead, while conditional registration preserves absence.

The internal ABSENT fact denotes a missing own key. A normal read converts it to undefined; spread retains the preceding value when the key is absent. An own undefined value still overwrites it. The distinction survives store joins, field writes, copied records and the existing Object.assign IR path. Optional typed host fields retain all three possibilities: value, own undefined and key absence. Operation exception snapshots retain both the pre-contribution edge and the existing post-operation edge. No frontend admission, public API, serialized IR format, phase policy or unknown-callable rejection is relaxed.

## Actual red and green evidence

| Stage | Result | Meaning |
| --- | --- | --- |
| Parent original 66 | 47 pass / 19 fail | Original spread and getter failures. |
| Parent spread-only alignment | 54 pass / 12 fail | The separate existing IR repair resolved seven controls. |
| Isolated original 98, before getter repair | 86 pass / 12 fail | Same twelve PUI1007 failures plus unchanged phase/owner controls. |
| Getter r2 | 98 / 98 pass | Getter copies restored, but independent presence review found an additional risk. |
| Direct-branch presence controls against r2 | 1 pass / 7 fail | Seven illegal callbacks were incorrectly accepted; the known-present positive passed. |
| Presence r3 | 8 / 8 and original 98 / 98 pass | Empty, conditional and definite capture cases recovered. |
| Final 15 controls against r3 | 14 pass / 1 fail | Missing optional host key incorrectly erased the preceding authored callable. |
| Final candidate | 15 / 15 plus original 98 / 98 pass | Zero pending or todo; all seven existing test files are byte-identical. |
| Official workspace TypeScript command | incomplete, 240-second diagnostic timeout | No diagnostics were emitted; this is not a pass. |

The workspace TypeScript command used the existing `tsconfig.workspace.json` and `--noEmit --pretty false`. Its bounded local wrapper timed out after 240 seconds with an empty log. A subsequent exact-cwd/argv process reconciliation found no remaining owned type-check process. The original timeout is preserved; it is not a source type-error diagnosis and is not a successful type check. The combined head must complete the applicable type gate.

The final 15 controls contain the eight capture-presence cases, four second-spread and overwrite cases, and three typed-host spread cases. Negative controls require the intended state.setDefault/state.bool callback-phase diagnostic. Positive controls include source-free JSON round-trip validation. The original lookup and metadata-forgery controls remain unchanged.

## Source-bound branch walkthrough

| Actual input | Internal property fact | Required observation |
| --- | --- | --- |
| Empty capture | ABSENT, read as undefined | The absence callback remains reachable and its setup-only operation is rejected. |
| Conditional method registration | Closure or ABSENT | Both present and absent possibilities survive the join. |
| Definite method registration | Present bound getter | The dead absence branch is not treated as an executable callback. |
| Host object missing an optional key | ABSENT | Spread retains the preceding authored closure and checks its callback effects. |
| Host key whose own value is undefined | UNDEFINED | Spread overwrites the preceding value and retains the false branch. |

## Preserved exploratory failures and limits

The first eight-case probe used unary `!`; its 6/2 result did not establish the presence claim because unary truth was conservative. The direct if/else revision produced the actual 1/7 counterfactual above. Two subsequent 15-case fixture drafts ended 11/4 before any r4 source was applied. The existing Object.assign profile rejects callable targets/sources, and static void cannot be called even optionally. Those PUI1006 failures remain archived and are not counted as phase evidence. The final host cases use admitted object spread; Object.assign admission remains unchanged. The explicit-own-undefined positive retains an unrelated pure callable so the analyzer retains record field facts; this change does not add general constant evaluation for data-only records. Its earlier conservative PUI1007 fixture result is also preserved.

No Cargo, generated Rust, native SDK, browser input or retirement deadline was changed or exercised by this candidate. Concurrent Sprint 5/main additions, including the two official Input round-trip controls, must be checked on the actual combined head before their coverage is claimed. Historical and candidate receipts are separate; an earlier green does not stand in for that combined run.

## Independent review

Root read the complete final three-file patch and independently hashed all three files. Its source-review receipt is archived as `r4c-source-peer-review-root.md.gz`, raw SHA-256 `e95a4053ba389fe1f9e2f3dbb6ccb7bf20642cfb6d07dea83e23f854f94f6f75`. The receipt correctly recorded type checking as pending at review time. This is technical source peer review, not a GitHub approval, CI acceptance or a later type-check result. Separate S5 review also examined the own-key/closure paths.

## Commit preparation and integration boundary

After these runs, this isolated topic branch was normally fast-forwarded to 52c87232f593d85a28cbd04ad205f0d5fe6f03a3. Before that fast-forward, only the Agent-owned copied IR prerequisite was restored to the old base; the incoming committed IR bytes were verified to be identical. All three candidate files and all seven existing test files stayed byte-identical. The new getter commit does not repeat the IR repair or other native changes. The 113 execution receipts remain bound to their recorded db747-plus-prerequisite tree, and are not relabeled as a post-fast-forward or final Sprint 5 acceptance run.

## Source and custody

The final source and both new test hashes are in the adjacent manifest, alongside the seven unchanged existing test hashes. The source-only patch SHA-256 is `2a2bbd9f6471c7ed6ab94200bca2ba5c0e70578a2c6773c4962ab3ca4f9a1bbe`. The final callable-effects source is `3608dbdd18ce3748cbebb67d83cf1fd113639f5f323f7a6e18f27060e367f7ca`. Every retained raw report, log, fixture, driver and candidate has both raw and deterministic-gzip byte counts and SHA-256 values in `evidence/2026-11-23-capture-getter-provenance-and-presence/manifest.json`; the archive was decompressed and verified against the original bytes when prepared.
