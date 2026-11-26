# Homepage presentation and page-wide dogfood

Date: 2026-10-02 Issue: #776 Baseline: `1fd4c08a`

## Approved consumer scope

The homepage refresh combines a compact, readable bilingual presentation with real Proto UI dogfood. One page-level runtime choice should rebuild the homepage interactive component hosts using the existing Web Components, React, Vue and Vue 2 adapters. Static Astro content and service-owned facilities remain explicit boundaries. This is a website consumer integration, not a new Base behavior, Adapter admission, runtime parity guarantee or promise to migrate demo-local state.

The six presentation objectives are consistent sans-serif inheritance, a shorter balanced hero, visible shared-definition/runtime correspondence, less empty space, a restrained preview hierarchy and toolbar, and reader-facing wording with future host research below the working example.

## Existing authority and decisions preserved

- `D-ADAPTER-PROFILE-0001` and the website runtime registry bound the current browser adapters. This work does not alter their contracts or the published support matrix.
- The #578 projection transaction owns hidden/inert candidate preparation, latest-intent arbitration, activation, stale cleanup and focus restoration. Reuse it rather than constructing a second ad-hoc runtime switch.
- #769's consumer CSS layer precedence remains intact. Website layout may arrange components; it must not substitute styles for the selected Prototype family.
- #655's whitepaper entry remains available. The 2026-09-08 reader-guidance record continues to prohibit unqualified cross-framework equivalence and claims that every switch reloads framework modules.
- `D-AS-CHILD-OMISSION-0001` and Template restrictions do not allow adding `href` to Base Button. Native navigation semantics, modified-click/new-tab behavior and no-JavaScript links must survive the homepage integration. Any site-local host/Prototype composition must identify that split without asserting a new Base Link contract.

## Evidence plan

Capture the actual baseline and candidate at 1440 × 1000 and 390 × 844, light/dark, with computed font family and overflow measurements. Exercise the real selector and inspect rendered runtime/owner markers in header, actions and example, including repeated transitions, keyboard focus, disposal, error/stale candidates and native links. Run the applicable existing projection regressions and new homepage tests, type checks and production build on the final tree. Uploaded captures and exact-head results belong on the PR; this plan alone is not completed evidence.

Co-author by OpenAI Dots

## Follow-up scope and dependency reconciliation

The same maintainer request now includes the other public Runtime Box variants and complete library-route presentation. The supplied examples identify Base Toggle's toolbar/canvas, Shadcn Radio Group's different control placement, and Brutalist Tooltip's nested square/rounded frames with a still-Shadcn site shell. The shared Runtime Box layout must be consistent while real styled Prototypes retain their own grammar.

The #559 accepted option 2 is preserved: navigation, social and hero anchors remain **application-owned native-link recipes**, not Proto UI Prototypes or a new Base Link. The website's existing multi-runtime renderer may materialize those native anchors; `href`, modified clicks, target, browser context menus and SSR fallback stay native. Actual Select/Button controls and example Prototypes use the selected library's own published implementation. The private website demo DSL accepts only `div` and `a` host boxes; this does not expand Proto Template or a package API.

The homepage owns one transaction for all its declared action groups plus its live example. `{runtimeId, projectionFamilyId}` are independent coordinates; the selected example component is separate controlled host state. All target hosts prepare before activation, share the committed generation and dispose stale or failed candidates. A failed example candidate must not activate the header or CTA candidates. Static Astro prose/layout and document search remain explicit shell/service boundaries. Successful remounts reset component-local state; no state migration is promised.

Component-library document routes determine their library presentation, independently of the saved Adapter preference. Website-owned Select/Button controls must use matching family tags, including language, theme, runtime, copy and package-manager controls and their portaled content. Native sidebar/TOC/pagination/navigation recipes consume document presentation tokens. A family switch must not overwrite canonical Shadcn source tokens used to prepare a reverse switch; actual Proto surfaces retain their isolated family theme values.

Dependencies checked against live GitHub on 2026-10-02:

- Reused, already merged: #567, #576, #578, #571, #655 and #769. #566/#577/#573 are closed; #574 was superseded by #578, including the implementation. They are not pending blockers.
- #563 is the open matrix/bundle-boundary carrier. Its runtime-ID/lazy-import changes are compatible with this consumer work, but the old WC-only homepage-shell assumption and affected source-bound matrix rows need reconciliation. The scope change is homepage-specific, not a claim that all of #420 is complete.
- #559 supplies the accepted native-anchor boundary described above. #420 and #568 remain broader ongoing programs.
- #596 and #509 are parallel with no missing component/runtime capability dependency. #744/#747/#740 add independent Prototype loader entries; preserve their additions during eventual integration. #652's opt-in Shadow work is not a prerequisite to this Light DOM slice. #775's bounded contrast audit is separate, not an unaccepted visual gate for this work.
- #772 changes the deployment/Node baseline; follow main's actual toolchain when it lands rather than silently assuming an unmerged PR.

The first implementation checkpoint is `da2bd762`. It carries code, focused tests and a readonly Actions workflow that compares the immutable baseline and exact candidate head through the same Chromium capture scripts. Before/after screenshots and actual computed/platform fonts are required review evidence; source inspection or passing unit tests alone do not prove the visual result. Local Chromium execution was blocked by environment infrastructure, and cloud-browser localhost access was denied; no denied route was bypassed.

## Design-review correction after rendered evidence

The maintainer rejected the first candidate's visual composition even after its focused interaction matrix passed. Functional success and zero overflow did not resolve the fragmented mobile navigation, inconsistent header treatments or the preview's layered information hierarchy. The earlier proposal to shorten the slogan is superseded: preserve the accepted text exactly and solve its presentation with line width, natural wrapping and type hierarchy.

- Chinese title: `组件可以独立于框架或设计体系`
- Chinese supporting line: `而不是在不同框架中被反复实现`
- English title: `Components should not depend on frameworks or designs.`
- English supporting line: `Defined once — not rebuilt per framework.`

The revised composition uses one shared homepage/documentation header layout. Its compact first row contains brand, search, theme and navigation disclosure; the runtime selector has a deliberate compact context row rather than accidental wrapping. Locale and social links live in one settings region, and document contents remain a distinct contextual control. The homepage disclosure uses the real selected-family Button through its runtime transaction, while application code owns expansion, ARIA relationships, Escape and focus return. Native links remain native recipes.

The home example has an external short heading, one controls toolbar and the actual demo surface. The source link, selected-example explanation and precise implementation boundary follow the demo. Successful readiness remains available to assistive technology without occupying another visual band. Loading and errors remain visible. Documentation Runtime Boxes share the same label/control arrangement; family identity changes visual tokens, not information order. The representative Tooltip page keeps its technical qualifications after the working example instead of placing two dense paragraphs before it.

Use one spacing/type rhythm and shared page gutters across these surfaces. Brutalist application frames retain square corners and hard offset shadows, but use a complete theme-visible foreground border instead of an invisible dark edge with a detached bright shadow. This changes website-owned framing, not the published Prototype palette, state rules or style ownership. Actual PUI control density is an explicit normalized surface input; global website selectors must not patch Prototype internals.

### Reference method and acceptance

The comparison considers the current [shadcn homepage](https://ui.shadcn.com/) and [component examples](https://ui.shadcn.com/docs/components/button), [Kill AI Slop's design questions](https://killaislop.com/#principles), and [Apple HIG layout](https://developer.apple.com/design/human-interface-guidelines/layout), [typography](https://developer.apple.com/design/human-interface-guidelines/typography) and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). They inform hierarchy, coherence, adaptation and affordance. Apple-platform point sizes or native materials are not asserted to be Web requirements, and shadcn is not substituted for Proto UI.

Recapture and inspect the actual revised interface at the established desktop/mobile, locale and theme dimensions, including open navigation, runtime switching, focus and library states. The 390 × 844 homepage should show the first row of actual demo controls without requiring a scroll through source metadata. Record visual judgment, accessibility measurements and functional results separately. Do not close a visual finding using an old image or a passing behavior test. The prior images and failed checks remain historical evidence, not proof of this revised design.
