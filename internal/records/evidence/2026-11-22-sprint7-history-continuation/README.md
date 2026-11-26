# Sprint 7 historical source checkpoint

This continuation restores the previously unpublished historical-accounting work for [#1147](https://github.com/Proto-UI/Proto-UI/issues/1147) onto main `38afc8942bfd245e12eaa661298c2feddbc63af8`. ChatGPT Codex prepared the restoration under the current user's instruction to continue the unfinished seven-Sprint portfolio. It does not close the all-history criterion. The existing [0.4 bookkeeping deferral](https://github.com/Proto-UI/Proto-UI/issues/1147#issuecomment-6684398558) remains in force; this recovery adds no 0.3 product acceptance requirement.

This record describes initial restoration commit `d8da090538873fefd555753f60d3fce69f3cbee9`. Its statements about the 17 byte-identical original files and the original generators' limitations refer to that immutable checkpoint. The subsequent [source-binding repair](../2026-11-22-sprint7-history-source-binding/README.md) separately changes the generators and archive reader while preserving the frozen data and all original sources at that checkpoint.

## Preserved work

The original signed commits `b42fd96b279787c8c9a6fb39a2a88f30918cec89` and `56362cea090710530685d12ca516405abec7ceb3` are retained in the complete original Git bundle, split into ordered 4 MiB volumes listed in [bundle-parts.json](bundle-parts.json). Concatenating those volumes reproduces all 15,842,049 original bundle bytes and SHA-256 `8baf2861bb8db97d48463590efba647f0abb139d51107fdf628f125355f49d76`. The split accommodates the connector's 16 MiB request limit without omitting objects. Original author, committer, message, tree and raw commit identities are in [source-preservation.json](source-preservation.json). The bundle requires original base `dc3b184ba10b0de53e40359c52d012b204b2cd01`; `git bundle verify` succeeded before splitting. A new connected continuation commit has a different SHA and certifies only its actual submitter's contribution. It does not rewrite the original commits or any published history.

All eight native source archive files, all six original governance scripts, the two compressed snapshot/decision files and the first-50 reading record are byte-identical to the old worktree. The 37,819,861-byte plain decision file is omitted as a duplicate: decompressing the preserved gzip recovers every byte, with SHA-256 `898ca78a8dc2e7e7a3366b3d1e48d1166b4d44c632fdf179ece1edb05fca97ea`. Both repository source ledgers referenced by the snapshot are unchanged between the original base and this candidate's base.

The two generators are retained as original source. This continuation validates the original generated snapshot and decisions; it does not claim a new GitHub capture or regenerated decisions. Their explicit raw-capture and manual-record inputs are separate from the read-only verification commands below.

Independent source review identified a follow-up in the original decision generator: it selects prior manual-reading records by number and `reviewMethod` text without first comparing their existing body/discussion hashes with a new snapshot. Reusing that input against changed sources could incorrectly carry a previous manual-reading label forward. The fixed snapshot's 50 recorded manual readings retain matching original body/discussion hashes; no changed snapshot is generated here. Before regenerating decisions from a new snapshot, the #1147 tooling owner must add exact source-hash checks and negative controls for changed/missing sources. This checkpoint does not claim the original generator is safe to rerun against changed sources.

The original snapshot generator also needs a source-binding check before reuse: it reads native captures from its raw-input directory, then substitutes the separately indexed archive without proving those two capture sets are identical. Before generating another snapshot, the tooling owner must compare the complete raw PR/inline/timeline capture set and every source hash with the decoded archive. The current frozen archive is verified independently; no new raw input is substituted by this continuation.

## Observed verification

The actual Node.js `v24.22.1` runtime ran the original nine tests successfully and checked the complete restored archive. [commands.json](commands.json) binds the commands, return codes and log hashes. The check counted:

| Observation | Count |
| --- | ---: |
| Objects in the frozen membership set | 1,697 |
| Issues / pull requests | 467 / 1,230 |
| Top-level comments / inline review comments | 8,106 / 4,128 |
| Objects reconciled to preserved sources | 1,697 |
| Original manual full-body/discussion reading records | 50 |
| Decisions independently accepted | 0 |
| Objects awaiting independent decision acceptance | 1,697 |
| Objects retaining conditions or source gaps | 1,697 |
| Later object excluded from the frozen denominator | 1 |

The `ready` command deliberately remains an actual exit-1 rejection: all 1,697 reconciled objects still await independent decision acceptance. Its original stderr is preserved in [ready.stderr.log](ready.stderr.log). Source reconciliation does not replace manual implementation review, original evidence recovery or technical acceptance.

## Reproduce the bounded checks

From a complete checkout, use Node.js 24 and run:

```sh
node --test scripts/governance/history-audit.test.mjs
node scripts/governance/history-audit.mjs check internal/records/2026-11-22-sprint-7-history.snapshot.json.gz internal/records/2026-11-22-sprint-7-history.decisions.json.gz
node scripts/governance/history-audit.mjs ready internal/records/2026-11-22-sprint-7-history.snapshot.json.gz internal/records/2026-11-22-sprint-7-history.decisions.json.gz
```

The first two commands should return 0. The third should return 1 until genuinely independent, source-bound decision acceptance exists. Do not alter that boundary to make a checkpoint green.

## Remaining work and limits

Membership is frozen at `2026-11-22T10:22:30Z`; this is not the current live population. The capture was not atomic, and inaccessible/deleted objects or original-at-creation body edit histories cannot be reconstructed from it. Complete accessible source values, stable IDs, original conditions, native metadata and explicit source gaps remain retained. The original first-50 reading record remains historical and does not become 1,697 newly performed reviews.

Continue independent decision review under #1147 and keep each remaining execution condition with its source-bound owner. Historical closure, merge, CI, DCO, review submissions or checked boxes are preserved observations; they do not establish current acceptance, revoke ownership, or authorize a three-hour takeover. No issue closure, merge, deployment, model run, browser run, spec lifecycle change or product reacceptance is performed by this checkpoint.
