# Header, information-note and disclosure follow-up

This is a source-bound engineering record, not a new public guarantee.

## Trigger and boundary

The user found Shadcn text links too crowded after the framed Brutalist Header spacing repair, and the Quick Start information note retained a visually unrelated square blue Starlight treatment. They requested family-appropriate presentation while preserving existing authored words. A new review also identified three consumer defects on `fbd90df092369e6d2aab73c66848f4236ba83a29`: orphaned Select portals after history dismissal, stale boxed Shadcn Select appearance after compact-to-desktop reparenting, and desktop TOC visibility below the existing xl breakpoint.

This follow-up consumes existing draft Base-derived Surface/Text/Select atoms. It adds no package API, Prototype identity, paint token, theme or ownership protocol. Existing contributor prose, order and MDX are unchanged. Search retains its 1000ms acceptance; role readiness retains500ms.

## Owning changes

- Shared Header geometry now distinguishes unframed Shadcn text (32px brand-to-navigation,24px between links) from Brutalist framed-control edges (existing12px spacing including the Surface's reserved shadow extent). Compact navigation remains its own vertical layout.
- Native informational Asides use the same existing four-runtime passive Surface lifetime as code frames, with purpose-specific public props and coordinates. Shadcn consumes outline/all/lg; Brutalist consumes outline/all/default. The native aside, aria-label, decorative SVG, paragraphs, links and text nodes stay in place. Existing public Text projects the title as the website's label role; no public Alert protocol is invented. CSS removes only the old competing fallback paint after successful projection and supplies native layout. Other Aside types keep their existing meaning and treatment.
- Website Select-owner bindings call the existing public requestOpen method before hiding their parent or traversing history. Framework control bindings retire with their composition; weak native bindings do not create an independent open state. History dismissal also closes an inline desktop Select and preserves meaningful focus.
- Shadcn Header preferences derive appearance from their stable preference role plus the current media query, even before the shared owner has moved. Permanently labelled panel fields stay default.
- The text-relative TOC reflow remains constrained by the existing80rem visibility breakpoint. It no longer reveals the desktop TOC on normal1024–1279px pages.

## Discriminating evidence

A real Web Component negative suite on fbd failed5/5 for the intended reasons: both families retained open=true after popstate and pageshow, and Shadcn retained border-input after the completed compact-to-desktop move. An initial fixture-upgrade error was corrected by registering public controls before creating their live DOM; it is not counted as defect evidence. The same5 assertions now pass.

Focused validation executes121 tests across Header disclosure, actual Select lifetime, public control bridge, projection composition, layout and passive Surface suites. Four installed real adapters verify original note nodes/words, native link focus, family changes, live dark theme and teardown. These unit tests inject media state and synthetic history notifications; they are not browser paint or physical-device evidence.

The exact-source hosted probes now retain original fbd before images and candidate Quick Start/Header/notes, normal1024/1279 TOC visibility, completed responsive reparenting and actual browser Back with an explicitly authored same-document history fixture. Homepage history checks include four real runtime generations. Their source-bound screenshots and browser results are pending at commit time and require manual visual inspection. Older successful fbd CI remains historical.

Local workspace typechecking was killed with exit137 in the shared resource-constrained environment. It is retained as failed/unverified local evidence, not a pass; exact-head hosted type/General/browser checks remain required. No repeated identical resource-heavy typecheck is used to claim recovery.

An additional native-order negative control after the first push found that prepending the decorative note plane made the original title stop matching `:first-child`, allowing the existing paragraph-spacing rule to add an unintended top gap. Four real adapter cases failed this retained structural assertion. Appending the absolutely positioned passive plane keeps the native title first; the full23 passive-surface cases pass after the correction. The initial121 test set had preserved node identity but had not asserted this CSS-relevant sibling fact.

Current-head review then found a second closing path: `toggle()` had flipped visibility directly, so click-only/programmatic Menu activation could bypass the new nested-Select cleanup even though ordinary pointerdown masked the issue. Four real Select tests failed at4c2 (two families, direct toggle and click-only), and the closing toggle now delegates to the same `close(true)` path. The browser probe exercises click-only Menu closure in each of the four runtime generations before its actual Back journey. This later failure is not erased by the earlier green CI or132 inspected4c2 pictures.

The density workflow also restores its original ec6 whole-increment baseline. A separate fbd checkout serves only the latest-feedback first pair; changing the feedback comparison no longer replaces the original83-file change's before tree. The evidence contract tests bind these two distinct purposes. All original4c2/fbd images and results remain historical, source-labeled evidence.

Restoring ec6 requires the probe to retain its historical missing history-close listener: source inspection confirms ec6 installs neither popstate nor pageshow handling. Its Back state is captured before ordinary Escape/Menu cleanup; only the candidate waits for and asserts closed state. This corrects the capture fixture's scope, not the candidate acceptance, Search budget or earlier negative result.

The next exact-head review found an independent current-heading flaw: an in-range component heading without a generated TOC link could win the geometry calculation. A hidden gallery modal title has a zero rectangle and left the old current link stuck. The new negative control reproduced Overview remaining selected instead of the visible Section on6c2; earlier green suites did not cover this case. Heading collection now admits only generated TOC destinations, preserving document order, encoded fragment IDs, the visible-section set and native link ownership. The focused regression also follows scroll down and back to Overview and verifies every emitted section has a real link. The browser density anchor journey includes a clearly labelled hidden-component-heading fixture, removed before subsequent stress captures; no authored document content is edited.

The 2a511832 candidate passed all nine specialized Actions workflows, including the complete Homepage capture, density28/28 and mobile10/10. Main CI retained one failure among47 cases in browser shard5: the Contents command stayed at Vue while the Vue2 selection's original1000ms observation expired. Other general/types/browser jobs passed. This is a real failed observation, not an established flaky test or a demonstrated missed preference event. The same candidate's complete Homepage dogfood suite passed in its separate job. The original failure artifact lacks transition-time state, so the next test-only change preserves that deadline/error and records preference events, current Header/Contents generations, same-origin resource timing, long tasks and a bounded post-failure observation. Even a late successful commit is rethrown as the original failure. Diagnostic output is placed inside the existing runtime-CI artifact root, so ordinary browser-shard failures retain it. No Adapter or production timing behavior changes.

The original contributor comment about deduplication/document order is restored verbatim next to the new linked-destination explanation. Its earlier removal was unnecessary. No published documentation text or content order was modified.

## Review and delivery

Continue on #816 above the synchronized #777 base. Publish a per-commit progress report and replace pending visual debt with this source's actual images. Do not relabel d657/fbd screenshots as the new source. Resolve the three exact review threads only after the new implementation and hosted browser evidence establish their fixes. Independent maintainer approval and the real external Vercel quota failure remain separate integration gates.
