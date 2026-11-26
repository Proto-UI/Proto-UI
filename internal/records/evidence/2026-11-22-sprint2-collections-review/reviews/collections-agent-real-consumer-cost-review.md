# Independent local review: real Shenko replay and retained family costs

Reviewer: `/root/collections`; no downstream or implementation edits. This extends the earlier pinned-CLI review to the additional replay/cost scripts in `d53d9cb41b90258c467b5614bcf4dd318786f256`. Executed tool bytes are retained under `compiler-consumers/`, with their hashes checked in `compiler-pinned-tool-snapshot-readback.json`.

## Actual Shenko source and application boundary

The actual retained run is `/tmp/proto-shenko-replay-pAS88o/summary.json`, using Shenko `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42` and upstream compiler `3ea9e34545615ce4a981e2e19c3c3fcc9de3b0bb`. I independently compared all **39** recorded authored `web/src` and `web/prototypes` files with their exact Git blobs at the Shenko pin and with the retained checkout. Every byte matches. The prior concern about using a prepared replacement application does not apply to this result: the real authored application and two own prototypes are unchanged.

The replay intentionally changes only the disposable checkout's upstream pin, compiler loading seam, build evidence emission and a compiler-identity expectation. The exact patch is retained. Its original source-loading lane performs generation, TypeScript checking, production build and **51/51** Node tests. The supported pinned-artifact lane performs the same chain and also finishes **51/51**. All nine command statuses, signals and start errors were independently read back. Before updating the identity expectation, the original four-test identity file genuinely fails one case with `@proto.ui/compiler-pinned` versus `packages/compiler`; that failure remains recorded. The identity update asserts the declared delivery and matching per-prototype compiler provenance, rather than suppressing source or behavior tests.

Both lanes retain the actual two compiled prototypes, `transport-badge` and `message-bubble`. The same nine framework families remain Adapter consumers. The replay does not add collection widgets or claim their aggregate vendor presence as authored usage. The application's existing React 19.3.1 dependency is reported separately from the admitted React 19.2.6 ordinary-family lanes. A successful build here does not widen the compiler profile's admitted version range.

The original executed script and the committed d53d9cb script differ only by a new guard requiring an OS-temporary checkout. The actual execution used `/tmp/proto-s2-shenko-3ea9e34` and satisfies that guard. The exact historical execution snapshot remains distinct from the later committed script.

### Source-pin enforcement improvement

The original script checked the checkout HEAD plus equality of authored-source hashes before and after the replay. That alone would not reject a caller supplying pre-existing dirty authored files at the same HEAD. This reviewer raised the gap to the implementation owner. Commit `ee943e59d6f6bd9a418c2ba6f11487e349d5ccc1` now compares each authored file with its exact Git blob before changing the pin, generating outputs or building the application. A pre-existing edit therefore rejects before the replay can claim the frozen application. The historical pAS88o result is independently proven clean by the 39-file Git comparison above and remains bound to its original compiler pin.

The new retained run is `/tmp/proto-shenko-replay-DG5q4h/summary.json`, using compiler `a165c4058188aa802b475d1d50ce46ab0d574320` and the same frozen Shenko revision in `/tmp/proto-s2-shenko-a165c40`. I independently compared all 39 authored files with both exact consumer Git blobs and retained checkout bytes again. The initial Git-blob check and final unchanged-source check are true. Both lanes finish 51/51 tests, and all nine command statuses match the preserved stdout logs, including the explicit original identity test failure. `compiler-shenko-a165c40-readback.json` binds this new receipt and log hashes. The two application prototypes remain compiled and the same nine families remain Adapter consumers; initialization remains explicitly untested. The owner performed the original replay; this reviewer performed retained-source and result readback only.

## Application production artifact observations

I recomputed the recorded metafile sums and checked the retained source-byte attribution. Both original source-seam and pinned-artifact lanes report the same figures:

| Quantity | Bytes | Scope |
|---|---:|---|
| Production JavaScript modules | 1,231,311 | Listed app modules, excluding theme-bootstrap.js; CSS is separate |
| Sum of gzip module sizes | 351,937 | Each listed module independently compressed |
| Generated-prototype input source | 112,132 | Source read by the production bundler |
| Retained generated-prototype contribution | 43,850 | Metafile attribution inside the listed production outputs |

These values come from the application build, not a synthetic Button-only substitution. Shenko application initialization is explicitly **UNTESTED**. No Rust Harness process, backend/live-model interaction, browser journey, physical input, AT or downstream PR was executed by this replay.

## Family cost measurement source and artifact readback

`release-family-costs.mjs` reuses the exact isolated ordinary-family installation, builds production browser ESM with esbuild 0.25.12, retains the exported component APIs, and distinguishes generated/support source bytes, whole retained bundle bytes, per-input attribution and gzip bytes. It records a one-module Base case and an N=3 Base/Shadcn/Brutalist case for each target. It does not claim that source bytes equal retained runtime cost or invent a comparison with an Adapter baseline.

I independently checked all eight retained bundle hashes, byte lengths, input-file hashes and metafile attributions. I also recomputed gzip using the declared Node runtime's zlib level 9; `compiler-production-cost-gzip-readback.json` records exact agreement. A separate exploratory Python gzip computation used a different compression engine and produced different compressed lengths, so it is not used as an oracle for the declared Node/zlib measurement.

| Target | Base-only bundle | Three-family bundle | Base-only gzip | Three-family gzip |
|---|---:|---:|---:|---:|
| React source | 82,452 | 169,598 | 27,574 | 44,184 |
| Vue 3 source | 88,633 | 171,517 | 30,803 | 47,469 |
| Vue 2 source | 68,586 | 162,527 | 23,141 | 40,408 |
| Web Component source | 71,441 | 150,659 | 23,870 | 38,842 |

All values are bytes. The production React owner observation separately mounts one or three actual generated components, checks exposed disabled state, unmounts them, verifies zero remaining Root nodes and rejects retired handles. Its timing is explicitly one observation of already-imported production React mounting in Happy DOM, including framework flush. It is not browser layout latency, a repeated benchmark, allocation accounting, a budget guarantee or a speed comparison. Other targets do not acquire a fabricated initialization measurement.

Independent readback: `compiler-real-consumer-cost-readback.json`. The original builds/runs were performed by the implementation author; this reviewer did not rerun those heavy workloads or recast their measurements as independent executions.

## Conclusion and remaining scope

No additional defect was found in the bounded cost arithmetic or the actual retained application's evidence. The reusable Shenko source-freeze gap is corrected as described above, with a separately bound later replay. The real application's full session/transport/scroll/focus/cleanup journeys remain separate S7 acceptance, while browser, AT, GPUI and complete compiler differential criteria retain their original owners and conditions. This report is not whole-PR readiness or lifecycle promotion.
