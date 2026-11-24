# Restore the documentation image preview's buttonless zoom

## Request and regression boundary

Agent paraphrase of the renewed user request: restore the website's previously accepted Zhihu-like image zoom, with no persistent buttons, including whitepaper figures. The request does not add a new wheel, pinch, image-click toggle or double-tap protocol. The public historical authority is [#796](https://github.com/Proto-UI/Proto-UI/issues/796), implemented by [#797](https://github.com/Proto-UI/Proto-UI/pull/797). Its final source was `5defd2cf11b81825ed43393e3fa9a2e0307f1e6e`, merged as `a1af2e64fe16f2d6dd96f701feaeea98e651511c`; its earlier acceptance remains historical evidence.

The observed baseline is main `be2f4a9a04b3d3f9992b81fbd9c9fb65ebc6063c`. The later reading-mode exception, introduced in `d0392fb31513b12f55b9e99b1fcf26a6338569c9` through [#1736](https://github.com/Proto-UI/Proto-UI/pull/1736), selected `.whitepaper-diagram` images for a three-button toolbar and a separate native reading viewport. That branch also bypassed the measured source transform, so those figures faded instead of following the source-to-contain flight. Existing ordinary-image tests forbade a toolbar while the whitepaper cases required one; their earlier passing results did not prove the renewed request.

## Implementation and ownership

All admitted images now use the shared contained presentation. The application measures the original image and the available viewport, animates the media from that source rectangle to contain in 220 ms with linear easing, and reverses to the source when it remains valid. The synchronized scrim and reduced-motion path remain. Invalid or off-screen sources retain the safe fade fallback. Clicking the background or pressing Escape closes the preview; a keyboard-focus-only Close control and focus restoration remain. Clicking the enlarged image itself does not dismiss it.

The obsolete reading controls, their private projection and the bridge's public Base ScrollArea import are removed. Base Dialog retains modal presence, focus, dismissal and Transition ownership; public Surface/Text retain passive presentation. Source selection, geometry, loading and disposal remain application responsibilities. The finite import checker loses the retired projection's allowance and narrows the exact media bridge's import set. The coverage row remains `site-composition` and `blocked`; this repair does not promote draft catalog entities or certify complete website self-hosting.

The repair preserves the later `currentSrc`, asynchronous source preparation, request/generation guards, stale callback rejection, load/error recovery, keyboard Close positioning and changed-only geometry writes. It does not write scroll positions. Original article media, captions, accessible names, mobile figure assets and their layout stay intact. SVG admission and request policy do not change.

## Discriminating evidence

The new DOM-model regression opens otherwise identical ordinary and `.whitepaper-diagram` images. On the unchanged baseline it failed at the unexpected three-button toolbar; the failure is not an import or startup failure. The repaired candidate passes the same assertion and compares the source/contain geometry, retained source layout, accessible text and keyboard Close.

The first candidate run used Node 24.22.3 and pnpm 10.32.1 with one Vitest worker. The four collected image zoom, preview, geometry and source files passed **89/89**. An additional supplied filter named a nonexistent test-utils test; it collected no fifth file and is not counted as evidence. Searchable development logs preserve both the baseline failure and this first passing run. Later candidate-bound checks and hosted evidence must be reported with their own head and results.

The initial real-browser baseline attempt failed during Chromium startup because this executor denied its Unix socket (`Operation not permitted`). No browser assertion executed. The browser sandbox remains enabled, and this environment failure is not a product failure or a passing visual check. The repository's unchanged hosted image-preview workflow is the next execution path.

The updated browser plan retains the ordinary-image matrix, motion controls, media safety, reduced-motion and no-JS cases. Whitepaper coverage adds 320 px to desktop and 390 px in both locales, samples the actual opening and reverse-closing animation, and checks background/Escape/keyboard Close, source restoration and repeated activation. Stale load/error and retired Transition callbacks remain negative controls. Planned or collected tests are not recorded here as executed browser success.

## Candidate local validation

The later candidate checks below retain their original local outputs under `.tmp/image-zoom/`. They supplement the first 89-test pass and Chromium startup failure above; they do not replace either observation or establish exact-head hosted browser acceptance.

| Check | Observed result and retained log |
| --- | --- |
| Focused image tests | Five files, **91/91 passed**, including the two trigger-readiness cases; `focused-green-final.log`. |
| Diagram receipt and profile tests | **28/28 passed**, no skips; `receipt-schema-v2-final.log`. The schema v2 contain checks preserve the schema v1 reading checks and their negative controls. |
| Scoped strict TypeScript | Root compiler options plus the Website's actual `paths` resolved an 805-file closure with **zero diagnostics**; `strict-types-root-with-website-paths.log`. This is a scoped source/test check, not Astro or a complete application typecheck. |
| Complete coverage unit run | **2,506/2,507 passed**, one failed, no skips; `coverage-unit.log`. The media import test still expected the removed ScrollArea import to appear in a copied bridge. The failed run remains a failed run. |
| Affected coverage reruns | Correcting that obsolete expectation while retaining explicit rejection of a newly added ScrollArea import gave **7/7 passed**, no skips; `coverage-media-rerun.log`. Strengthening the six retired-viewport cases with the complete historical fixtures gave **7/7 passed** again, no skips; `retired-viewport-full-fixtures-green.log`. The full coverage suite was not rerun after these test corrections. |
| Coverage CLI | Still fails on two pre-existing source fingerprints; `coverage-check.log`. Both affected sources and their prior bindings are unchanged from the baseline by this repair. The image source bindings and current consumer row were separately reconciled. |

The strict-type attempts that preceded the passing scoped check remain available. `strict-types.log` records one unresolved Brutalist theme path under root-only resolution. `strict-types-app-config.log` records 80 diagnostics under the attempted Website configuration. Neither attempt is reclassified as passing, and no complete application typecheck success is claimed.

The historical negative-control fixtures are exact bytes from `be2f4a9a04b3d3f9992b81fbd9c9fb65ebc6063c`, stored only under `scripts/coverage-matrices/test/fixtures/`: `documentation-image-reading-viewport-be2f4a9.txt` has SHA-256 `38c40b79ba99dc444a43376052de3c39798f99db7eb965eb990eadc4d6cc77ec`; `documentation-image-controls-be2f4a9.txt` has SHA-256 `ad4fe9ae91198b871eb6a78cd05682e92a105f6d044d3a31547f8080f7c1aa07`. The retired import allowance required both identities. The tests assert both complete hashes before applying their original variants, so the exact-source case would qualify for that old allowance if it were mistakenly retained. The fixtures reproduce historical input; they do not restore production imports or authorize the withdrawn reading presentation.

At the readback, [#1803](https://github.com/Proto-UI/Proto-UI/pull/1803) remained an open draft at `fca048905ca8c8a97bb0cedb6311816670d3d318`, and main remained the baseline above. It owns both remaining fingerprint repairs: [d52a6a69](https://github.com/Proto-UI/Proto-UI/commit/d52a6a69df1c1a03d8579d9f5839d252492c515b) renews the unchanged Accordion source binding with source-review evidence; [6710e773](https://github.com/Proto-UI/Proto-UI/commit/6710e77363fd02fb77e8af6b24e1a1335f14af32) changes the passive Contents observer and [b57e7af3](https://github.com/Proto-UI/Proto-UI/commit/b57e7af30b97a087ae0c3ec9fa75e10c7ca268d8) binds that new source. Its Contents digest cannot be copied onto this candidate's different observer bytes. This image repair leaves that active workstream untouched.

## Presentation and evidence limits

Containing a very tall mobile diagram provides a whole-figure overview. It does not establish the retired oversized reading mode's 16 CSS-pixel minimum-label or native panning acceptance. The mobile source diagrams remain, but source preservation alone does not prove readable labels at every viewport. New captures must record actual contained geometry and text scale, and the visual review must disclose that tradeoff.

The capture/receipt migration uses an explicit new `source-contain` presentation; historical reading-mode reports keep their own strict validation. New contain reports must not be accepted as old reading-mode evidence. Historical reading records, original Issue checkboxes and their revision bindings remain unchanged.

At this record's initial preparation, full hosted browser execution, final rendered visual review, exact-head CI, independent review and production deployment are pending. Subsequent PR evidence records those outcomes without rewriting earlier failures or claiming this source record itself is acceptance.
