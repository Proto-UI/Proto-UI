# Gallery author font boundary — static candidate, not acceptance

Owner: dot for cyjin-yl. Scope: #803 / draft #1227. Prepared 2026-11-02.

## Observed failure, exact source

The [official fixed-source run](https://github.com/Proto-UI/Proto-UI/actions/runs/41483779188) compared parent `d850c28a40bfbc31f10d244b075d6f27038f46fa` with product `026db20ca1c99310e538f211db072ab81f2e8860`, not the workflow carrier `58f2ae5d7d7eb947459caf584ed925957a8ba3be` or the event merge checkout. The source manifests preserve the original 22 product-path differences and equal lockfile.

- [Original Card9](https://github.com/Proto-UI/Proto-UI/actions/runs/41483779188/job/125408635721): parent 9/9; candidate 1/9. All eight site-preference/theme cold cases fail the unchanged strict first/enhanced equality. Base action width changes 124.0625 → 120.609375; Lucide title 84.703125 → 72.53125 and action 137.109375 → 132.34375. These candidate records stop at upgrading; they do not establish reload success.
- [Quick start](https://github.com/Proto-UI/Proto-UI/actions/runs/41483779188/job/125408635233): both sources 14 failed / 6 passed, with 4/4 fragment controls on both.
- [Density](https://github.com/Proto-UI/Proto-UI/actions/runs/41483779188/job/125408635210): both sources fail the same Shadcn 34 versus 32 and Brutalist 36 versus 32 heading checks. These paired baseline failures are not relabeled as new font regressions.

The PageFrame declares a Shadcn family scope; the candidate makes that scope use Geist. Base and Lucide neutral Text inherit their author context. Their recorded CSS family already contains Geist before and after held fonts are released, while the requested font face changes loading state and geometry changes. The existing CDP helper records only Brutalist by default, so these facts do **not** prove the actual Base/Lucide glyph font. Shadcn Card still resolves to its system stack; the Gallery does not explicitly opt it into the optional Shadcn typography preset.

## Narrow product change

1. Resolve `--site-default-font-sans` at `:root` from the existing ordinary site `--font-sans`; do not redefine that stack or introduce a font resource.
2. Provide an application-private `[data-site-font-scope]:not(:root)` author rule in the base layer, after family/projection defaults. Its input is `--site-font-sans`; it supplies the scope's font-family and Tailwind sans input.
3. Explicitly declare the existing Gallery section to use the independent root bank. No layout, family recipe, runtime ownership, or appearance choice changes.

Contract: the scope belongs on a descendant, not the root bank's node. An author must supply a complete literal or independent font bank, not a circular reference to this same scope's `--font-sans`. Same-node author scope wins over the family and projection defaults by specificity/order. Higher-layer utilities and authored inline font-family still win. An explicit nested family/projection may select its own font. This is an app-private convention, not a Prototype/runtime marker.

Static review found and corrected two earlier candidate issues before any run: root use could create a custom-property cycle, and an earlier/less-specific rule could lose to a same-node family or projection default. Browser proof remains required; source presence of a theme variable does not prove its compiled value.

## Test plan and negative controls

- Preserve the original Card9 file byte-for-byte, including first-frame sampling, every-distinct-frame equality, reload, native focus, no-script and strict widths. The new diagnostic cannot substitute for this acceptance suite.
- Append source guards; retain every original source/helper assertion.
- Extend the existing CDP helper's accepted family type, leaving its default and implementation unchanged. Append selector tests for Base, Lucide and Shadcn.
- Prepare a separate real-page diagnostic for all four site preferences and both themes on the actual WC Gallery: capture root/body/section custom properties and complete Text inheritance chains, actual held/enhanced platform-font glyph records, geometry and endpoint images. The first read precedes additional CDP work; only the enhanced endpoint waits for fonts. Reuse the bounded direct-CDP screenshot helper, not Playwright's implicit font-ready wait. Block non-test origins.
- Ordinary authored DOM controls cover utility and inline priority, nested scopes, same-node family/projection combinations, missing marker, circular input and excluded root marker. A separately disclosed DOM intervention removes/restores the real Gallery marker and observes the inherited family. It is not a source revert; frozen product source-revert controls remain necessary.

The new browser file is now explicitly listed as a dedicated suite with its existing library-card workflow owner; this is a separate, coordinated row, not a rewrite of Rhea Card/Navigation or Motion registrations. Discovery and owner mapping checks remain unrun. The suite has **not** been executed, formatted, typechecked, built or accepted. No browser permission is inferred from a Chromium executable or from earlier unrelated runs.

The original Card9 job and the existing three paired lanes/budgets are preserved. The paired candidate changes from the historical hard-coded 026 to the real PR event head; d850 remains fixed. The complete actual changed-path set is checked, and each role's full tracked bytes, HEAD/tree and clean state are recorded before, after and at completion. The original d850/026 run remains separate evidence. No self-referential commit SHA is fabricated. An additional PR1227-only 20-minute job runs all eight supplemental cases, with its own full source/clean guards and exact coverage count. That is explicitly additional verification cost, not an expansion of the original Card9 count or budget. Its ongoing owner must be resolved before merge-ready if this diagnostic remains. No new permissions or deployment.

Candidate cleanup rejects capture/session cleanup issues and records context-close failure as failed, never a passed observation. Context setup itself is inside the failure/cleanup boundary. These are static safety properties, not executed cleanup or native acceptance results.

## Cost and remaining work

No new font bytes, font request, inline font payload, font-loader code, runtime package or dependency is introduced by this slice. This is **not** a zero-cost claim: the source CSS and Gallery markup grow. Measure emitted HTML, final CSS/JS bundle bytes, network font bytes and initialization timing on the same fixed source/browser before and after. No 225 KB Geist base64 copy is proposed.

This slice addresses the accidental Base/Lucide inheritance boundary only. It does not decide or implement the Gallery's optional Shadcn preset, critical Geist loading, a performance optimization, or a global first-frame guarantee. The existing Shadcn acceptance draft and Rhea appearance decisions remain intact. Keep #803 open. Keep prior 34 typography native passes, 45 glyph records, and all historical failing suites distinct from this unrun candidate.

Public evidence: [paired diagnosis](https://github.com/Proto-UI/Proto-UI/pull/1227#issuecomment-6590626724), [issue update](https://github.com/Proto-UI/Proto-UI/issues/803#issuecomment-6590647417), [prospective exact-path scope](https://github.com/Proto-UI/Proto-UI/issues/803#issuecomment-6590756892). The scope starts with that actual publication and does not retroactively cover the previous expired claim. No merge, review approval, or protection bypass is granted.

## Actual Gallery host coverage correction (2026-11-03 00:37 UTC)

The original Card9 writes four adapter preferences to localStorage, but LibraryCardPart.astro emits fixed `wc-library-*` tags and library-card-client.ts registers them directly with AdaptToWebComponent. Those eight cold combinations are four site preferences by two themes of one actual WC Gallery, not four Card host implementations. The d850 9/9 versus 026 1/9 result and all eight strict cold failures remain unchanged; no reload success is inferred. Independent typography 34/34 and 45 glyph records keep their own page/source coverage.

The supplemental eight cases now distinguish requestedSitePreference from the actual host. They record pre-enhancement tags/registration and, after release, each exact held node's unique selector match, connected document, registered constructor equality and instanceof result. Constructor names alone are not proof. Read-only Playwright handles are acquired after the first held-font observation, disposed after the identity read or by context retirement on failure; no app marker or global is installed. This is still static and unrun. The original Card9, product CSS/Gallery, fonts, three paired lanes and budgets are unchanged. Gallery architecture is not changed merely to create four-host coverage.

## Actual fixed data checks and format attribution (2026-11-03 01:28 UTC)

The earlier unrun descriptions above are preserved checkpoints. The host-corrected O3 tree `c1c48e2aa9dd6fe8e72c6779bb0d2600e7f47d29` was actually checked on the fixed d850 execution base: full five TypeScript roots plus the two existing ambient inputs exited 0; the official ten-file format check exited 1 with seven warnings. These are data checks, not a browser or source-test run. The original 105 locked dependencies, source/dependency postguards and cleanup remained intact.

A separate read-only official format export then exited 1. Four of the five TypeScript inputs passed the original structural AST/raw-literal/comment/declaration-kind checks and three stable passes; all three original test prefixes and all six rejection controls were preserved. The supplemental browser file was rejected because the formatter added two `ParenthesizedType` nodes: `typeof consumers[number]` became `(typeof consumers)[number]` in the two Map type arguments. That strict rejection is retained, not relabeled a pass or hidden by changing the comparator.

Complete finite-diff review attributes those two additions to grouping the exact existing `typeof consumers` type before the unchanged indexed access. They do not change the type or emitted runtime code. The only other non-whitespace browser change is one optional trailing comma after the record's `startedAt` property. Reversing only these named changes reproduces the same protected literals/templates/comments and intervening non-whitespace source. All assertions, first-sample placement, held-node ownership, waits, failure handling and the 90-second case timeout remain unchanged; this finite review is not a general parser-equivalence theorem. The rejected file did not reach its second or third export pass.

The Astro export changes only whitespace inside two existing `LibraryCardPart` opening tags; every attribute/value/expression and all bytes outside those tags are unchanged. Markdown changes only line wrapping, with all 22 blank-separated blocks, inline code and links retained. The exact first official outputs form this next candidate after that review. Its final source/type/format checks, registry/YAML checks, product-revert controls, original Card9 and supplemental eight real-browser journeys remain pending. No inherited old green, actual glyph result, emitted HTML/bundle cost, screenshot or four-host Card coverage is claimed.
