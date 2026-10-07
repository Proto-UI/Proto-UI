# Rendered audit: current content identity and independent RuntimeBox boundary

Date: 2026-10-06. This is a non-normative audit-reader and workflow record. It does not change Prototype behavior, promote lifecycle status, certify contrast or close #469.

## Exact native failure and its evidence limit

Published #775 head `a5bffc112d2722c06d79b8ca6290f929d048122f`, tree `b6d0738207967c759784b17aadb21c9ba26c1cf6`, ran the four-shard [rendered audit 37388503808](https://github.com/Proto-UI/Proto-UI/actions/runs/37388503808). The verified official artifact archives contain 32 binary/button, 24 popup, 56 passive/editor and 22 intent/tab cases: 134 failed cases across all 17 families, with zero frame attempts. Every failure stops at the initial projection-identity guard.

The apparent difference from 136 is the actual Tooltip page declaration: its supported runtimes are WC, React and Vue, while Vue2 is explicitly unavailable. The two Vue2 theme cases are outside that page's frozen matrix, not additional failures or newly skipped cases.

The archived runner discarded the initial `projectionObservation` result before throwing its generic error. Neither final reports nor journal checkpoints therefore contain the failed expected/observed identity coordinates. The successful separate calibration run does not supply those missing native DOM values. No local reconstruction is relabeled as an original CI snapshot.

## Two distinct reader mismatches

The current projected caller gives its content an explicit website recipe identity through `runtimePreviewRecipe`: for Button, `website-runtime-preview:demo-brutalist-button`. The actual component coordinate remains `data-projection-component="button"` on the previewer. The older audit compared content `data-projection-id` directly to `button`.

A source-bound, no-browser probe used unmodified production `initProjectedPreviewer` and the auditor function extracted from the real artifact. At the early scope-ready boundary, this reproduced the ID mismatch while the other sampled predicates passed. That was a limited observation, not a complete ready-publication proof.

Permanent tests wait for the actual previewer publication. The complete 17-page matrix exposed the second mismatch: the independently rendered RuntimeBox Surface had then appeared under projection content, and the old all-roots scan incorrectly required it to belong to the demonstrated recipe's owner and Prototype allowlist. The initial ID-only candidate retained a failed aggregate of 108 failures and three passes. It was not published or relabeled green.

This separation already exists in the producer: the content owner and passive shell each validate their own closed recipe. `browser-harness.ts` recognizes the single reserved RuntimeBox Surface ref, while `runtime-preview-surface.ts` reserves its shell, mount and retained-content refs against authored collisions. No new producer API or ownership rule is introduced here.

## Bounded correction

- Compare the previewer's actual component coordinate and the exact current content-recipe identity separately. The auditor's namespaced value is tested against the real producer for every family; importing the producer's rendering graph into the Node runner is avoided.
- Validate the single reserved shell, its public Surface Prototype, family, requested runtime, published independent generation, active renderer host, slot and retained-content topology. Reuse the existing pure `surfacePrototypeId` helper and include its source in the immutable audit source set.
- Require the reserved mount and retained-content wrappers to carry the current outer owner/generation/family/runtime coordinates. Every physical Proto root beneath projection content must be either the one independently validated shell or an authored root inside the retained-content wrapper. Misplaced and extra roots remain failures; Surface is not added to the authored recipe allowlist.
- Preserve all original authored-root owner/generation/Prototype and root-presence checks. The shell generation is independent of the outer generation; runtime-rebuild controls exercise that distinction. The existing before/after capture lease check additionally rejects a changed shell generation.
- Wait for published previewer readiness and requested runtime together with the existing scope-ready selector in the same wait. No timeout or interaction assertion is weakened.
- Save a failed observation in `projectionReadinessFailure` before throwing. The existing case catch still marks failure, retains its phase/error and journals the case with zero frames and zero achieved targets. Captured frames retain their existing pre/post identity diagnostics.

The independent shell controller does not publish a unique owner token or a directly queryable private lease. The reader rejects a shell advertising a contradictory owner attribute, validates the existing published DOM boundary and records the observed shell attributes; it does not claim to certify that hidden ownership object. Frame fingerprints and all other contrast/anatomy acceptance remain separate requirements.

## Toolbar review

[Review 4189958809](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4189958809) identified a separate fresh-runner setup omission: the dedicated evidence workflow started Astro without disabling its development toolbar. The current Astro config has no override and the locked Astro version defaults the toolbar on.

The workflow now uses the official disable/get commands before calibration and server startup. Unlike a read-back that only prints a value, this step fails unless the color-free output explicitly reports `false`; an enabled or unset value is not success. The dedicated socket-free contract is registered in this workflow. All four shards, 17 families, checkout provenance, job/readiness limits, fonts, audit thresholds and retention remain unchanged. The audit workflow is an explicitly authorized exception to the previous protected-file byte-preservation list.

## Initial front-guard validation and limits

- The first permanent-test attempt failed during fixture file loading because Vite rewrote a static `new URL` asset reference; using the existing repository-root file path fixed that harness issue. It is not counted as a behavioral red result.
- The unchanged four-runtime production Button controls then failed against the original identity reader for the governed mismatch.
- The ID-only implementation's failed 111-test run exposed the independent-shell boundary described above; that failure remains retained.
- The completed identity suite passes 155 tests: 67 real-production page/runtime positive controls, 83 field/topology/root negative controls, declared-matrix and producer-identity checks, original owner fallback, real runtime rebuilds, and actual readiness/catch/journal failure replay. The page declarations are parsed from actual MDX and use the production runtime selector and recipe resolver, including Dropdown Menu, Scroll Area and Tooltip's explicit runtime limit.
- The callback tests use the installed runner's `keepNames` transform mode and execute the serialized browser callback without its Node closure. This catches accidental transform-helper dependencies; no browser is launched.
- The toolbar-specific suite passes 14 socket-free controls, including executing the actual setup shell with controlled command responses for disabled, disable failure, get failure, enabled and unset outcomes. The renderer and real Astro preference operation remain unexecuted by those controls.
- Existing audit Node controls plus the toolbar controls pass 135/135. Workspace TypeScript passes; final documentation types cover 459 files with zero errors, zero warnings and six existing hints. An intermediate broad test-helper return type was corrected with an explicit validated family type; its failed type checks and separate fixture-edit failures remain in the evidence history.

Final independent review and complete combined-source validation remain outstanding. These bounded simulated-DOM and workflow results are not new native audit acceptance. The four original red artifacts and earlier prepared-candidate failures remain history. The separately frozen #832 successor `601f9d0a55f8deaa79f5beed463edb7a198c0ace` must be integrated normally and validated before the final unified #775 publication; this local repair is not pushed on its own.

## Withdrawn first freeze and downstream repair

The first local freeze, tree `871c4890620ef1b766e4a72d57108a10c0cf9d86`, was withdrawn after independent production-bound review. Its 155 passing tests established only the front identity guard, not a complete audit pipeline. The unchanged independent eight-case attack and a separate eight-case positive-expectation red run are retained. Across WC, React, Vue and Vue2, the real Button passed the front guard but failed anatomy because the independent Surface became the parent of all ten Buttons and had a foreign lease. Real Badge passed that guard but failed the passive reader's old component-as-recipe comparison and the ancestry of all three Badge instances.

The correction now lives in one audit-only `readContrastProjectionBoundary` resolver in `apps/www/scripts/contrast-probe.browser.ts`. The existing strict predicate was moved there, not relaxed. The Node runner derives its exact expectation from the requested case and manifest; front readiness, interactive anatomy and passive observation each re-evaluate that predicate synchronously. The existing serialized probe is installed before front readiness. No production previewer, shared package API or normative entity changes.

Interactive anatomy retains its full candidate inventory: roots inside outer content, including malformed/foreign roots, plus same-owner/current-generation document roots and real body portals, with the original reader-control relation exclusions. Only the unique successfully validated RuntimeBox root is excluded. Parent indices are rebuilt from the remaining roots. `withinContent` refers to the borrowed authored-content boundary, and `currentLease` also requires the fresh strict identity result. Extras, parent relationships, presence policies and the separate closed retained owner-shell policy in `compareContrastAnatomy` remain unchanged.

Passive observation uses the same strict result for readiness, removes only that validated shell from its candidate roots and derives authored Prototype ancestry inside borrowed content. Its physical visibility loop still visits every real ancestor, including the independent shell. All multiplicity, ref, count, visibility, Spinner motion and source-coverage checks remain intact. Every downstream result also retains its current expected/observed projection diagnostic.

The standalone instrument-calibration entry has deliberately supported fixtures without a Website shell. Its explicit no-expectation path remains compatible. The real runner always supplies a production expectation; a missing or damaged shell cannot fall back to calibration.

### Consumer inventory and preserved measurements

The complete reader survey also covers `currentProjection`, `readContrastState`, `collectContrastFrame`, painted visibility, pointer-pair observation, inherited inactivity, primary/ref selectors, current-owner lookup, Tooltip relations, Dialog mask, Hover Card, settling and fingerprint stabilization. The existing owner/generation selection already excludes the independently owned shell from measured component surfaces. Conversely, the shell must remain in actual composed ancestry for background compositing, opacity, clipping, filters, transforms, pixel adjacency and state fingerprints. Those functions and all contrast thresholds remain byte-identical to the withdrawn freeze. Semantic inherited inactivity still stops at a foreign lease.

One pre-existing separate limitation was noted: `currentProjection` and generic `owned` lookup do not perform anatomy's `aria-controls` reader-portal exclusion for toolbar content portaled into the body. This repair neither changes that behavior nor claims to settle it.

### Current bounded evidence

- The original eight production downstream positive-expectation controls changed from eight failures to eight passes after the reader correction.
- The final focused suite passes 407/407 with zero skipped tests. This includes the original 155 front-boundary controls, eight Button/Badge pipeline controls, 67 additional real-production family/runtime downstream topology cases, 166 downstream field/boundary mutations, six body-root/physical-ancestry/runner-wiring controls, and five actual case-entry controls. Runtime rebuilding also advances through the actual anatomy reader with distinct outer and shell generations.
- The actual case-entry statements are replayed from the running source, without first waiting for previewer readiness in the test. Across all four runtimes, an explicit test barrier delays only delivery of the real independent shell's completion promise. Scope readiness then precedes previewer readiness; the exact runner selector keeps waiting without injecting the probe or running the guard. Once the genuine completion is delivered, the previewer publishes readiness, the probe is injected, and the strict guard runs. A missing-shell mutation at that real guard boundary fails rather than entering generic calibration. Native accessible runtime selection is outside this no-browser control; the real producer is initialized with the requested runtime.
- An initial case-entry extraction mistakenly selected the earlier runtime-discovery block and failed to compile; that fixture failure is retained. A later unbarriered full run passed 406/407 but showed that a cached WC path can coalesce scope/root notifications into one MutationObserver batch. The explicit real-completion barrier makes the required transition observable without altering any production readiness attributes or timeout. Both prior outputs remain history.
- The finite downstream matrix executes the actual auditor functions and the actual serialized browser probe against production `initProjectedPreviewer`. Only CDN acquisition and explicitly controlled geometry/styles are substituted. The identity and authored topology are produced by the real previewer. Passive Spinner's native motion/CSS verdict is not inferred from that structural matrix.
- A first expanded run had 20 fixture-measurement failures because its blanket visible geometry ignored the Adapter-installed `data-pui-view-detached` rule. The fixture now models the actual installed pending/detached visibility rules; no production condition or audit assertion was removed. That failed aggregate is retained. A missing simulated `visualViewport` global in the fingerprint control is also retained separately from behavioral failures.
- New controls show that current-owner roots moved or added to the body remain visible to the downstream checks, and unexpected ones fail. Shell opacity, filters and clipping continue to affect visibility acceptance even while the shell is excluded from authored topology. The full fingerprint still includes the independent shell's physical node and background/style changes.
- The existing audit Node controls plus toolbar contracts pass 135/135. Workspace TypeScript passes. A noncanonical direct `tsc -p apps/www/tsconfig.json --noEmit` attempt reports 104 diagnostics in unchanged dependency/package files (principally type-only import settings); it is retained as a failed check and is not substituted for the canonical Astro check. No diagnostic names the changed runner, probe or identity test. The earlier 459-file canonical documentation check belongs only to the withdrawn candidate; current canonical documentation validation and full general remain deferred to combined-source validation.

`contrast-probe.browser.ts` is the third explicit exception to the original fifteen-file protected audit set, beside the runner and evidence workflow. The other twelve protected files, all four shards, all seventeen families, the 134 declared runtime/theme cases, calibration registration, thresholds and budgets remain unchanged.

A fresh whole-pipeline independent review is still required. These are simulated-DOM and instrument-input controls, not native browser evidence or contrast certification. No local browser was launched, no current screenshot exists, and neither this repair nor source `601f9d0a55f8deaa79f5beed463edb7a198c0ace` has been committed, merged or pushed by this worker.
