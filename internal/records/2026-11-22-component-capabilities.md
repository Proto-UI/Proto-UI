# Calendar, Number Field, Carousel and Resizable capability completion

## Requested scope and provenance

The current user identified four concrete gaps after comparing source and docs: Calendar/Date Picker range and multiple selection; Number Field localization, nullable values and scrubbing; Carousel continuous scrolling and responsive multi-item viewports; and Resizable multi-panel and nested groups. This change implements that bounded scope in one contributor PR.

OpenAI Codex authored the implementation, tests and documentation under that request, with separate local agents reviewing components they did not implement. Those reviews are local engineering evidence, not a GitHub independent approval. Existing repository implementations and hooks were extended; no external source implementation was copied. Original contribution provenance and the repository's MIT license remain applicable. No human DCO certification is inferred or added.

The working branch was advanced to main `9c1afbc70c852c9be2372495e342634aa1311b85` before the aggregate validation below. No Compiler files are changed. Existing draft entities remain draft; these results do not confer native-host or stable catalog admission.

## Bounded behavior

| Area | Implemented semantics | Compatibility and boundaries |
| --- | --- | --- |
| Calendar / Date Picker | `mode`, `values/defaultValues`, `range/defaultRange`; selection constraints; per-day endpoints/interior/pending state; popup completion tied to accepted selection | Single `value` remains available. Multiple selection remains open. Unavailable interior dates reject a range. Incremental additions may approach `minSelected`; removals and batch replacements respect the minimum. |
| Number Field | `Intl.NumberFormat` formatting and strict localized parsing; explicit null and `allowEmpty`; continuous Label scrubbing with cancellation; IME editing lease retirement | `getValue()` and events carry `number \| null`; `empty` distinguishes the legacy numeric state retained for compatibility. Scrub is opt-in. No physical IME or native wheel adjustment claim. |
| Carousel | Actual Scroll requests during drag; native scroll settling; nearest snap and controlled rollback; `slidesPerView`/`minSlideSize`; actual capacity; RTL and vertical logical axes | Equal-size items and bounded end alignment. Loop means endpoint wrap, not an infinite cloned strip. Offscreen slides retain layout. |
| Resizable | Complete percentage vector, per-panel constraints, indexed adjacent boundaries, continuous dragging, nested independent groups, keyboard/collapse and controlled proposal streams | Legacy two-panel scalar requests remain. Collapsed size is discrete. Full-vector projection finds a feasible topology; it does not promise a globally nearest discrete solution. |

Base owns these semantics. Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass inherit them and project their appearance. The change updates all five families' English and Chinese pages and actual public-atom demos. Bootstrap and Liquid Glass retain their experimental status.

Generic host changes are separately defined by `C-SCROLL-AXIS-SYNC-0001` and `C-AXIS-INPUT-DELTA-BASIS-0001`: callback-time Scroll axis synchronization, logical RTL offsets, and an optional owned-part displacement basis. There is no component-specific DOM geometry in the portable prototypes. Resizable uses the sum of actual panel extents, excluding fixed separators. Floating point summation noise is tolerated without ignoring real subpixel extent changes.

## Discriminating regressions found and repaired

- Controlled Number Field scrubbing must report returning to the original value after a rejected/deferred proposal. Reset, owner replacement and disabling invalidate an active IME draft; detached Labels cancel their original session.
- A multiple Calendar with a minimum greater than one must be able to grow from an empty selection. Synchronous selection observers must not consume a Date Picker's accepted completion before its current Context publication.
- Resizable rejects sparse vectors, searches alternative feasible collapse combinations, and projects the latest canonical vector after synchronous owner reentry. Nested commit/cancel actions retire old terminal events; an uncommitted nested proposal preserves the legacy outer commit without clearing the newer proposal. Percentage sizing items carry no padding floor, and explicit Root direction is independent of ancestor direction.
- Carousel retains `defaultIndex` during incremental slide registration, updates navigation disabled state through the inherited Button, and tears down Scroll and Axis Input without a stale-owner callback.

## Executed local evidence

Node 24.22.3 and pnpm 10.32.1, frozen workspace dependencies:

| Evidence | Observed result |
| --- | --- |
| Aggregate affected regression selection | **36 files, 593 tests passed**, one worker; includes new cases and existing selection, numeric, Field/Form, collection controls, host modules and four-Adapter Calendar journeys |
| Independent Resizable/Axis reproductions | Five previously failing cases passed after repair; additional terminal/reentry review cases passed |
| Documentation type/MDX check | 1,258 files; **0 errors**, 31 informational hints |
| Public Calendar, numeric, Carousel/Resizable consumer type probes | Passed during each slice; new API and all-family types are explicitly exercised |
| Full workspace type check | Passed with `NODE_OPTIONS=--max-old-space-size=4096`, including the actual four-Adapter browser fixture |
| Prototype catalog and lifecycle authoring | Passed; new edges have explicit `since: 0.3.0-alpha.2` |
| Public package source manifests | Regenerated through the official generator to include the three new source helpers |
| Generated website tokens | Regenerated through the official generator, including its Shadow companion |

The local default-heap full workspace type check exhausted Node's approximately 2 GiB heap. Its bounded 4 GiB rerun passed after correcting test-fixture declarations; the initial failure is retained as environment evidence. The existing esbuild `ES2024` warning is also retained.

## Native browser acceptance and publication

`scripts/analysis/component-capabilities-browser.mjs` is the maintained native input runner. Its actual public-prototype fixture mounts WC, React, Vue 3 and Vue 2 across all five families. It records source revision, input digest, browser and viewport, per-journey assertions, failures and screenshots. It checks intermediate drag state, final geometry, nested resizing, controlled refusal, physical collapse, ancestor RTL, localized input/null, native wheel/drag snap, responsive capacity, range/multiple selection and popup completion.

Run after generating styles:

```sh
PUI_CHROME_EXECUTABLE=/path/to/chrome \
PUI_EVIDENCE_DIR=/path/to/disposable-output \
node --import tsx scripts/analysis/component-capabilities-browser.mjs
```

The existing manual/callable `projection-family-evidence.yml` runs this evidence on its exact checked-out revision and retains the output as an Actions artifact. It gains no automatic PR/push trigger or new permissions. The PR records the actual exact-head run and its result; merely adding this command is not a pass.

The local browser launch stopped before a page existed because the execution environment disallowed Chromium's Unix socket. The permissions policy rejected an escalation. An available browser connection also rejected inline data-URL navigation under its URL policy; that route was stopped. Neither attempt is native acceptance evidence. A self-contained preview builder is retained for ordinary supported local review, not as a policy workaround.

Physical IME, hardware touch, assistive technologies, non-Web hosts and compiled consumer parity remain outside these observed results. The PR's native artifact must be inspected before claiming actual paint/geometry acceptance. Uploaded Actions screenshots and local-only captures are distinguished; no generated illustration stands in for a running component.

## First published candidate and visual review

[PR #1666](https://github.com/Proto-UI/Proto-UI/pull/1666) published candidate `63cfa393b7a9a1e9283281e5b2f7406b2303b363`, whose remote tree matched the staged local tree exactly. [Actions run 44929210569](https://github.com/Proto-UI/Proto-UI/actions/runs/44929210569) ran all **100/100 native interaction journeys successfully** on Chromium 157.0.8103.78. Its subsequent existing preset-manifest gate failed because generated style inventories were stale; the overall workflow was not green.

The uploaded artifact contains the source-bound report and 220 screenshots. Downloaded ZIP SHA-256: `25d049f410867ae70322d61d778129d207bc773fc8a392e419666beded0039dc`. Inspection covered all four Adapters and all five families. Resizable geometry and responsive Carousel content relationships were consistent, but several captures were unsuitable for completed visual acceptance: long navigation text overflowed icon-sized controls, WC Number Field sizing targeted the owner host instead of its native editor, Brutalist lacked its official theme, and immediate captures caught Calendar transitions and Date Picker departure before completion. These observations do not overturn the successful interaction assertions or establish a portable selection/presence defect.

The follow-up uses named compact navigation controls, the supported Number Field surface sizing input, family-owned themes, and settled presence/paint observations. The style gate also exposed unsupported `cursor-grabbing`; Carousel now uses the already supported `cursor-move` feedback without changing its drag semantics. Official generators supply the corresponding preset manifests. The final candidate incorporates main `2c7eae25357d0c5bae29bd5e92caae3a4ea39730`, preserving its existing focus-scroll, contact-paint and Toggle-fixture repairs. The PR records the new candidate's actual validation result separately; this first run is retained as historical evidence.

The strengthened runner also exercises Chromium's native composition engine with the public CDP `Input.imeSetComposition` and `Input.insertText` commands: 20 Adapter/family combinations each cover uncontrolled localized completion and controlled refusal. It records trusted composition/input events and checks that candidates remain drafts until completion. This is browser-engine IME integration coverage, not physical OS IME coverage. See the [official Input protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/); native execution of this additional slice is reported with the final candidate.

After incorporating the inspected main changes, all 47 public packages built successfully. The official preset check and its 13 palette tests passed. The package-budget policy's nine tests and current advisory-mode measurement completed; six entries remain factually over their older limits. No budget baseline or blocking policy was changed. A separate read-only GPUI fixture check found existing broader generated-data drift; Compiler/IR implementation and those unrelated fixture files remain unchanged by this PR.

## Concurrent integration and remaining evidence

While the evidence follow-up was being prepared, PR #1666 was independently merged as `a8bf56087e5836e3c14c153cafbd796bd98bff37`. Its source-equivalent signed candidate was `4a59696bda68bd862154c1faa9a33eb0ed48e90e`. The follow-up starts from that actual main revision, preserves the original acceptance history, and supplies the remaining generated-style and native-evidence repairs in a separate reviewable change.

Main also incorporated the regression-baseline repair in PR #1664 and the projection-theme inheritance repair in PR #1668. The former restores strict default package budgets with separately recorded numeric ceilings. The earlier advisory result above remains historical; a new clean, exact-head strict measurement is required for this follow-up. Native composition, settled range paint and completed popup departure likewise require the strengthened runner to execute on the published candidate before acceptance is claimed.
