# Compiler foundation: source bindings after the RC main merge

## Source identity receipts and preserved history

The current user authorized integration of current main while preserving the compiler retirement and the new 0.4 foundation.

The source merge is `524365a3b1f97dbf9dd6a3408ce231fbb4ee4af3`, with tree `ab72bc14daff2876c38a2baddd70852d05348cd4` and parents `91d65b9fb6f8c6ee25c9ac661d8a77f148f94e39` and `c8e700ff06ef7a96e7ec8b406859268918d158c6`. The latter is main's [PR #1918](https://github.com/Proto-UI/Proto-UI/pull/1918) integration. This metadata follow-up names that real source commit, rather than assigning uncommitted source to an earlier revision.

The complete preceding markup reference is preserved byte-for-byte as [website-markup-provenance-8635852.json](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-8635852.json), with SHA-256 `25a94091426c8241753748ce49684a44ee499e45edcb9af3f68e8e600715be8a`.

The [previous integration record](2026-11-25-compiler-retirement-markup-integration.md), earlier references and the original failed or unexecuted browser cases remain unchanged. The successful production website build at foundation `91d65b9f` remains evidence for that earlier source; this refresh does not transfer that build result to the combined source.

## Reviewed markup changes

The [current reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json) retains all 32 owners. Three reviewed source hashes change, and 29 remain identical, including the lockfile, Astro configuration, CodePanel, formatting producer, source maps, route documents and Copy pipeline. The two retired optional compiler-panel owners remain absent.

| Owner | Reviewed source difference | Details and limits |
| --- | --- | --- |
| `previewer-client.ts` | Re-exports the existing demo-module count and warm-up functions for the Matrix's preparation boundary. | The retired compiler selector exclusion remains absent. |
| `previewer-bootstrap.ts` | Shares one IntersectionObserver across pending previewers, rejects records from an earlier observation, tracks per-target observation time, and exposes a Matrix warm-up hook with ownership and connection checks. | Removal and disposal retire the hook and observation state. |
| `previewer-removal.ts` | Runs registered removal checks only when a mutation record contains removed nodes. | Existing registration, error isolation and shared-observer ownership are retained. |

Every current profile entry matches both its Git blob at the source merge and the working source bytes. This is a bounded direct-source inventory; existing helper and runtime dependencies still require separate transitive-closure evidence. This update changes no browser test, assertion, timeout or acceptance rule and leaves `sourceAdmission` as `unverified`.

## Prototype inventory and governance receipts

The merge first reconciled consumer rows from the canonical Website ledger through the existing `consumerLedgerRows` producer and retained main's original `94d322e659d40168903300896a54631b8bc65339` candidate proof.

The source commit preserves the entire pre-refresh JSON at `internal/coverage-matrices/prototype-coverage-matrix.json`; its SHA-256 is `f0f191d6aac57946be47102042b4f5e68556bee31ceec8e0d8ba20b6353e6928`. The old website source audit remains explicitly historical, including its original runtime evidence limits, and does not certify this merge's inputs.

After the source commit existed, the official generator ran with `node scripts/coverage-matrices/prototype-coverage.mjs --refresh-candidate 524365a3b1f97dbf9dd6a3408ce231fbb4ee4af3 --write`.

- Its proof binds all 6,059 source entries to the real source commit and tree.
- Of those entries, 6,057 hashes remain unchanged; the Website ledger and the Base Number Field formatting test are renewed.
- That test retains its independent formatter cases after the foundation removed its retired compiler harness.
- No source entry is added or removed.
- The historical main inventory, comparison pins, consumer identities, issue links, migration records, delivery conditions and acceptance fields are unchanged.
- The generated views retain 71 comparison rows, 22 Base projection rows, 142 consumer rows and 101 migrated links.

The official governance normalization and reconciliation functions also read the six bound Issues and PR #580 through the authenticated GitHub connector at 20:23:53 UTC on 2026-11-25. The regenerated snapshot is byte-identical to the foundation `91d65b9f` snapshot, including the actual #1323 retirement-governance body and later observation time. No GitHub state is changed by this refresh.

## Evidence boundary

### Source checks

Validation uses Node v24.22.3. The official prototype `--check` passes, as do the two existing focused controls for source refresh and consumer-ID migration (2/2, zero skipped).

The complete existing markup-provenance and governance control files pass 101/101 tests, with zero skipped. The exact markup preflight reports no source-binding issues, verifies all 32 current Git/worktree inputs, and confirms that the archived profile bytes are identical.

### Scanner outcome

The ordinary `node scripts/coverage-matrices/check-coverage-matrices.mjs` structural scan reached its 240-second local timeout before producing output. It has no completed result and is not counted as passed.

This follow-up did not retry that scan or run the full aggregate control suite. Public-docs validation passed with 438 maintained repository documents; formatting and diff checks passed.

### Remaining evidence

Source binding and focused metadata validation are recorded separately from browser execution. This refresh does not execute the 17 markup browser cases, establish served-source identity or complete transitive closure, promote any lifecycle, or supply release acceptance. The earlier CI failures and unrun cases retain their original results and revisions.
