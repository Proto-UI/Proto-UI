# Sprint 6: bounded held-image reuse and failure retirement

This record binds the uncommitted candidate based on `34cbf089c3e5ff638a27372ab973b54fd364b54b` to executed host-unit evidence. It does not close #1053, #1050, or Sprint 6.

## Source and behavior

The image-cache implementation and original eight cache tests originate from [E9](https://github.com/Proto-UI/Proto-UI/commit/e9d6a66e4c42813e42471573543573c3eb5f70b0) and its [source-ready record](https://github.com/Proto-UI/Proto-UI/blob/e9d6a66e4c42813e42471573543573c3eb5f70b0/internal/records/2026-11-23-sprint6-source-ready.md). Original source blobs, the previous candidate, patches and failed results are preserved in the archive below. This port excludes E9's unrelated Text, CLI and generated changes. Attribution does not create a DCO attestation or review approval.

Each material binding may reuse an already decoded, exact held-contact PNG after its previous lease releases. It retains at most two idle entries within the existing 1 MiB decoded-pixel/string estimate beyond active leases. Active and pending requests remain independent. Every request still renders and revalidates current source, geometry, palette, preferences, tokens and contact ownership; release-animation frames are not retained. `imageReuseHits` counts lookups, including cancelled requests, rather than paint or successful publication.

Independent review found additional host-fault defects. Retirement now detaches the complete starting cohort before invoking host cleanup, so a reentrant successor survives `clear()` and is refused after `dispose()`. Release completes its idle transfer and all budget detachments before cleanup; every selected retirement is attempted and the first explicit cleanup error is rethrown. Cold and cached asynchronous failure notify exactly once even when cleanup also throws. A retired cold decode cannot seed reuse. These changes preserve the existing failure channel and separate decoder/publication counters.

`program.ts`, source admission, optical quality, browser fixtures, original deadlines and budgets are unchanged. The material definitions remain at their existing draft lifecycle.

## Executed evidence

Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9 and happy-dom 15.11.7; one worker. The final combined run collected seven intended files and passed **325/325**, with no pending tests: adoption 15, image cache 20, image 6, independent image/sink controls 7, initial paint 120, preferences sequence 8 and sink 149. Strict TypeScript for the isolated image module, Prettier and `git diff --check` also passed; this is not a workspace typecheck.

| Original independent probe | Earlier candidate | Repaired source |
| --- | --- | --- |
| Clear reentry | Four images; successor readiness zero | Two images; successor readiness one |
| Same-source release failure | Four idle decoded images, 2,560,000 pixel bytes | One idle decoded image, 640,000 pixel bytes; cleanup failures still reported |
| Cached publication plus cleanup failure | Failure callback suppressed; uncaught microtask error | Failure callback once; no uncaught error |
| Cold publication plus cleanup failure | Dead decode reused without a new Image | Failure callback once; new Image must complete its own decode |

The three independent scripts cover these four observations. Both implementation and independent review reran the original scripts successfully against source SHA-256 `3668b4d200b2da4fbe830038d41f15060b57ab352dbbe1b8ade4279a1aa4da29`. Original reds remain. The added regression suite was 12 pass / 6 fail on the prior source and passed after repair. An initial teardown repeated an injected eviction fault; a `finally` now disables only that teardown injection, and the unchanged product assertions again produced the same six baseline failures.

A separate final-source mutant disables only idle lookup. Its selected reuse test fails for the expected eight Image constructions instead of seven; the other 19 tests were deliberately unselected. Production source was unchanged. The archive contains the mutant, configuration, raw failure and final 325-case report.

## Reproducible carrier and remaining acceptance

The [manifest](./artifacts/2026-11-24-sprint6-held-image-decode-reuse/manifest.json) binds all seven candidate files, original E9 files, old/new source snapshots, patches, raw results and independent probes by SHA-256. The [evidence archive](./artifacts/2026-11-24-sprint6-held-image-decode-reuse/evidence.tar.gz) contains only the explicit project evidence list with deterministic metadata; no credentials, environment files or Git configuration are included. Old failures have not been replaced by green summaries.

These injected-host checks prove bounded ownership, cleanup, failure notification and observable decode reuse. A throwing host primitive is not claimed to have physically released its backing. Exact-byte reuse may provide no benefit for a moving source that produces unique PNGs. Fresh matched browser performance, optical/visual acceptance, physical 120 Hz/input-to-photon, full workspace/package/CI acceptance, integration and live Issue readback remain separate work. No current-candidate latency improvement or complete Sprint acceptance is asserted.
