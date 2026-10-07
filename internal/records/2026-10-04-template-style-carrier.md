# Ordinary Template style carrier prerequisite

Non-normative implementation record for [#788](https://github.com/Proto-UI/Proto-UI/issues/788), independently of the Scroll Area corner consumer in #779 / #783. Baseline: `d05d1a00`.

## Boundary and choice

Draft `C-TEMPLATE-0002` and `C-TEMPLATE-0003` permit ordinary structural nodes with style-only props. Draft `C-FEEDBACK-STYLE-0003` separates author tokens from host artifacts; its `Q-TEMPLATE-STYLE` portable static-feedback question remains open. Legacy WC commit G6 permits ignoring an unconfigured `tw` handle but does not require it. Its historical CSS-handle wording does not expand the current tw-only core API.

The bounded implementation adds the existing `data-pui-style` carrier at the four existing ordinary Template realization points. WC uses the existing token merger; React, Vue and Vue 2 retain their existing merged `className` / `class` compatibility output. A configured WC resolver still receives the exact original token string and its inline result takes normal CSS precedence. The helper is called only for freshly created Template elements; host roots, caller slot nodes and SVG output keep their previous owners. No new props, component channels, PrototypeRef composition, Base identity, lifecycle promotion, Shadow CSS injection or conformance claim is introduced.

This does not make a caller-authored root carrier a new input API. Existing root feedback translation remains unchanged. Tests snapshot that root output before Template updates, while the caller-owned slot retains its exact conflicting carrier and classes and the same DOM node.

## Executed evidence and procedure

- Four real adapter mounts exercise conflicting tokens (`p-2 p-4`, `opacity-25 opacity-50`), empty and absent handles, structural update, caller slot identity, root isolation and two mount/disposal generations.
- Sequential regression across all four adapter test directories: 236 files / 679 tests passed. Final focused tests after the empty/absent-case expansion: 5 files / 8 tests passed. A focused TypeScript project covering new tests, fixtures and their transitive source graph passed; runtime-browser inventory 4/4 and changed-file formatting passed. The independent fixture production bundle built successfully with a bounded heap and minification disabled.
- WC commit tests retain original resolver input and inline result across fresh-element replacement and disposal.
- The same focused tests with the four production inputs restored to the baseline fail six carrier assertions; the two existing invalid-prop/handle guards still pass. With the candidate implementation all eight pass.
- Browser fixture: `apps/www/test/fixtures/template-style/`. It mounts the actual four adapters and loads only `renderProtoStyleTokenCss` output, without Website CSS, global Tailwind or a default resolver. It observes actual paint, class compatibility, root/slot identity, empty/absent/rebuilt output, configured WC inline precedence and disposal.
- `apps/www/test/template-style.browser.test.ts` is registered in the sequential runtime browser inventory. The read-only pull-request evidence job captures baseline and candidate from the same head-bound fixture, replacing only the four implementation files with the pinned pre-change `d05d1a00a353b9e72326a05569233d5bb54456a9` versions for the labeled baseline. JSON records bind fixture SHA, implementation SHA, browser version and measured facts; PNGs are run artifacts, not product-tree images.

## Verification limits

Local Chromium execution is unavailable in this cloud sandbox. No browser result or screenshot is claimed before the exact-head pull-request job passes and its artifacts are inspected. Local workspace type checking was killed under shared memory pressure. Documentation checking first hit an unwritable default Astro config directory; its workspace-scoped config retry was also killed. Neither aggregate check is claimed passing. Exact-head CI, independent architecture acceptance and accessible inspected visuals remain acceptance conditions. This prerequisite alone does not finish the dependent corner.

## Provenance

Original repository-local changes assisted by OpenAI Codex: implementation, tests, fixture, workflow and this record. Existing repository patterns were reused; no third-party implementation or private code was supplied. No human review is claimed. DCO sign-off uses the authorized contributor's existing identity; independent review is tracked separately.

## Independent review: initial fixture commit boundary

Fresh independent review found a fixture-only P1: the initial slot and root-carrier snapshots were captured before Vue/Vue 2 committed their initial view. The native browser run [37226659184](https://github.com/Proto-UI/Proto-UI/actions/runs/37226659184) independently failed in its baseline phase with `p-1` compared to the prematurely captured `null`. This is failed verification, not evidence of a production ownership defect; the candidate browser phase had not run.

The fixture now awaits the existing initial framework/frame settlement, captures and validates all three original ownership snapshots, then publishes its API and ready marker. All update, resolver and disposal assertions remain. A new real Vue/Vue 2 readiness regression observes the actual pre-commit missing slot/carrier, proves capture stays pending across the readiness gate, and checks the committed identity and `p-1` carrier. It passes 2/2 against both the pinned pre-carrier implementation and the candidate; the candidate's existing eight checks also pass. Deliberately removing the awaited settlement makes both readiness cases fail. The four production changes are untouched. Fresh exact-head browser artifacts and full CI remain pending after this repair; earlier captures are not relabeled as the repaired head.

## Independent follow-up: retain the WC caller carrier

Incremental review of `fc33c4d5` confirmed the first-commit ordering repair and found a second fixture P1: the new readiness assertion incorrectly expected `p-1` for every adapter. The WC root is seeded with caller-owned `p-8`; its existing feedback sink intentionally keeps that token and appends its own `p-1`. The correct WC snapshot is therefore `p-8 p-1`, while the framework renderers retain their existing `p-1` output. The browser expectation now distinguishes those existing host behaviors. A real WC mount with the conflicting caller carrier joins the readiness regression and checks the same root and slot identities. No production root styling or carrier realization changes are made. The earlier failed run and pending-head evidence remain separately identified; this correction does not turn either into a pass.

Validation for this follow-up: all six focused files / eleven tests pass; the three WC/Vue/Vue 2 readiness tests also pass with the pinned pre-carrier production inputs. Focused TypeScript and diff whitespace checks pass. Native browser paint and exact-head aggregate CI still require the new pull-request run.

## Native browser diagnosis: fixture token support

Run [37228042564](https://github.com/Proto-UI/Proto-UI/actions/runs/37228042564), bound to `9a5b6eddeb7940df3e483067588c790687c54bb3`, passed the complete baseline scenario for all four adapters, including ownership transitions and configured resolver. The candidate then failed the blue-background assertion while its `16px` padding assertion passed. The downloaded baseline PNGs and JSON were inspected; they bind fixture head `9a5b6edd`, adapter baseline `d05d1a00`, and Chromium `154.0.8037.57`. No candidate pass or capture is claimed from that failed run.

The actual generated CSS lists the fixture's generic hex-color tokens and `opacity-25` as unsupported. The carrier path was not the missing color owner. The fixture now uses existing supported `bg-gray-100` → `bg-[#04c]`, `opacity-50` → `opacity-100`, and caller `bg-yellow-300`, retaining conflict merging and exact computed-color/padding assertions. No generator or production Adapter change is made. A new generator regression first fails on the unsupported-token comment, then passes for the corrected fixture and checks every fixture token has an actual PUI selector. All seven focused files / twelve tests pass. Initial native screenshots and source-bound observations are now saved before assertions, explicitly labeled as unverified observations; final facts are marked passed only after the complete scenario succeeds. Exact-head native verification remains required.

## WC owned-to-slot-only cleanup prerequisite

The dependent Scroll Area probe exposed an existing WC light-DOM fast-path gap: a view containing a slot and owned styled spans can switch to a slot-only template, but the session cleared its projector before removing the old owned spans. Even an explicit update left those spans attached and lost the ownership information needed to recognize them later.

The narrow fix collects caller nodes through the existing projector and replaces the root children with that pool before clearing the projector. Initial/repeated slot-only views with no projector still perform no child mutation. No Template syntax, root styling, caller attributes, or other Adapter implementation changes are made. Regression coverage exercises pending caller append before observer delivery, transition to slot-only, subsequent caller append/remove, return to owned structure, delivered removal, and a second slot-only transition. Caller element/text identity, class/carrier and absence of old owned spans are checked. The initial-slot-only control records both delivered and queued child mutations and expects none.

The exact WC regression is red on `8f7c9ef7` (one failure / seven passing controls) and green with the seven-line session repair. Related WC lifecycle, props and Template checks plus the existing three-framework carrier tests pass: eight files / twenty-one tests. Narrow TypeScript and diff checks pass. These are DOM-harness results; the previous `8f7c9ef7` native evidence does not certify this later production change, and a new exact-head CI/native run is required after publication.

An exploratory four-adapter topology round-trip additionally found pre-existing Vue caller-DOM replacement when returning from a slot-only root to the owned-sibling array shape. It is not repaired or admitted as a guarantee here. The new committed transition regression is WC-specific; existing framework carrier tests do not claim universal dynamic topology identity preservation. Keep that Vue observation as a separate follow-up instead of widening this cleanup fix.

## Caller-mutation review correction

Independent review of `28c9a9f1` found that the newly exercised slot-only cleanup path exposed stale slot-pool assumptions: it could resurrect a removed caller node, reclaim one reparented outside the host, or undo a pending prepend/reorder before MutationObserver delivery. All four independent cases failed on the candidate and passed when only the pre-cleanup `session.ts` source was substituted. The existing passing tests did not cover those windows.

The collector now snapshots current ownership before detaching anything, takes live caller roots in current document order, and preserves caller nesting rather than promoting nested children. A template with no slot may still intentionally park detached callers; that retained pool is preserved, while a parked node adopted by an external parent is not reclaimed. The old and new owned-node sets and slot-only initial fast path remain unchanged. No new public API or caller-style mutation is introduced.

The exact prior collector fails six cases with eight controls passing. The repaired candidate passes 31 related WC/Template contract cases and narrow TypeScript. Independent incremental review and new exact-head CI/native evidence remain required; the preceding 28c fixture images show that historical source only.
