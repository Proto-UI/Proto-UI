# Previewer lifecycle source-reference renewal

This review prepares the four fixed source bindings that stopped the Website markup-provenance suite's preflight at [`d10d0e72b305bf9228f3e92ee1677cab19120d77`](https://github.com/Proto-UI/Proto-UI/commit/d10d0e72b305bf9228f3e92ee1677cab19120d77), in [CI run 45663672911](https://github.com/Proto-UI/Proto-UI/actions/runs/45663672911). The original 17 scenarios did not provide a result after that preflight failed. This record supplies source review only. Final source-commit binding and fresh browser execution are separate steps; it does not promote any matrix row or change release acceptance.

## Preserved reference and review boundary

The preceding reference at `5f0844907895a4ae0db506fe6a5d0bf162318329` is archived unchanged as [`website-markup-provenance-5f08449.json`](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-5f08449.json). Its SHA-256 is `964bb99c7df94d8080f2d69ba4a31dfa427260f73a113a7d6b94384214c0ff5b` and Git blob is `1b2a4db23d864f62f52fb98cc1a4c3cdaf19bad4`. Earlier archived profiles and native receipts retain their original bytes and revisions. The profile still has exactly 33 direct source identities and `sourceAdmission: unverified`.

The review compares the four complete files at the old reference with their [d10 source revision](https://github.com/Proto-UI/Proto-UI/compare/5f0844907895a4ae0db506fe6a5d0bf162318329...d10d0e72b305bf9228f3e92ee1677cab19120d77). Both copies were checked against their Git blob identities before reviewing their diff. The exact old/new SHA-256 and Git blob pairs are retained in [`source-review.json`](evidence/2026-11-25-preview-lifecycle-source-renewal/source-review.json).

| Reviewed direct source | Change and retained ownership |
| --- | --- |
| `PrototypePreviewer/previewer-client.ts` | The initial projection theme watcher joins the existing scheduled read batch. Its complete latest map is retained while shell appearance preparation is pending and republished after the current surface takes ownership. Failed and superseded preparations stop their own watcher before destroying the renderer. Generation, destruction and active-surface checks still guard publication; family changes replace the watcher. The additional re-export exposes the existing demo module warmer/count. Code-panel update, raw/highlight producers, Copy and runtime-event ownership are not changed by this diff. |
| `PrototypePreviewer/previewer-bootstrap.ts` | One document IntersectionObserver replaces one observer per lazy preview. Pending entries record observation time; stale observer/target records are rejected, targets are individually unobserved, and disposal disconnects the shared observer. Removed subtrees are walked by tracked node identity; connected moved/reinserted roots retain their owners. The Matrix's warm-module hook checks its current connected owner around the client import and is cleared on replacement/disposal. Abort, pending-owner, connection and visible-panel checks remain around activation. |
| `PrototypePreviewer/previewer-removal.ts` | Deliveries without any removed nodes no longer check every registered owner. Actual removals still use the snapshot plus membership check, preserve independent cleanup errors, and disconnect the shared observer after the final registration is released. |
| `docs-header-preparation.ts` | Concurrent Header/Search preparations now hold unique leases in one document barrier. Releasing a lease is idempotent and only the last lease resumes waiters. Deferred work still rechecks a newly reserved barrier, connection and document ownership; cancellation unregisters and resolves its own waiter. |

These changes affect initialization, theme publication and teardown scheduling. They do not supply a new trusted HTML producer or substitute a source snapshot for the browser's recorded response. The sampled highlighted-code, raw-code and Copy direct owners retain their original fixed digests. This bounded review does not establish the served build or its transitive dependency closure.

## Bind the committed candidate

After the final source commit, run the one-use [`renew-reference.mjs`](evidence/2026-11-25-preview-lifecycle-source-renewal/renew-reference.mjs) from the repository root with that full commit SHA:

```sh
node internal/records/evidence/2026-11-25-preview-lifecycle-source-renewal/renew-reference.mjs FULL_SOURCE_COMMIT_SHA
```

The script requires that SHA to equal HEAD. It checks the exact preceding profile and archive, the 33-member inventory, the four reviewed new digests, and the other 29 unchanged digests. Each source must match both the committed Git object and working bytes. A fifth changed member, a different version of any reviewed member, or uncommitted source bytes aborts the renewal before writes. The script then writes the new fixed current profile and a `source-ledger.json` in the evidence directory. The ledger names the full source commit; the following metadata commit must retain those same source bytes.

No browser or checker implementation is changed by this renewal. In particular, the suite still writes its actual `source-binding.json`, checks any supplied candidate SHA, and rejects changed source bytes before starting the Website. The reference is never recomputed as an expectation inside a test.

## Required verification after binding

The existing discriminator controls run with:

```sh
node --test scripts/coverage-matrices/test/website-markup-provenance.test.mjs
```

The existing retained-scope native job must run the unchanged `apps/www/src/content/docs/zh-cn/website-markup-provenance.browser.test.ts` against the final candidate. It retains all 17 scenarios: eight actual response/runtime/Copy/remount cases, four JavaScript-disabled response cases, three hostile-producer cases, and two Install Copy keyboard cases. Original response identity, receiver ownership, raw bytes, clipboard markers, the named code-scroll focus transformation, stale-remount negatives and source admission assertions remain in force. The original per-case and preflight deadlines are unchanged.

No fresh unit, browser, served-source or release result is asserted by this source-review patch. Append execution evidence at its actual candidate revision after those checks have run; earlier passing receipts do not stand in for it.
