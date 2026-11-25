# Brutalist public control bindings and Tooltip first paint

This repair follows the current public examples and the existing Tooltip component contract. The raw negative and positive reports, source hashes, original source history, motion samples and local checks are archived in `evidence/2026-11-25-brutalist-controls-and-tooltip/receipts.json`. Browser runs used an isolated dirty checkout based on `5f0844907895a4ae0db506fe6a5d0bf162318329`; they are diagnostic evidence and do not replace the integrated clean-head Actions gate.

## Public control bindings

The original six selected cases failed against removed labels, controls or prototype counts. Switch now uses the current Airplane Mode example; Tabs selects the actual Password tab; Dropdown requires the current 24-part projection and keeps the original placement and native transform assertions. These changes preserve the public components rather than recreating old examples for the tests.

Textarea now binds the five current public examples: hero, Field, disabled, invalid and Button. It verifies each real native control, the Field label and description associations, the invalid control's `aria-errormessage`, the actual Send message button and native editing. The original text contrast, border contrast, focus modality and 320px containment limits remain. The test does not claim that the removed event-log or synthetic focus controls still exist.

## Tooltip theme ownership and undeclared interpolation

The hero's two Tooltip Content instances did not use the existing generic portal theme owner. Their first visible paint inherited the document's 10px radius even though the public Brutalist preview uses 5px. Stable Content refs and `previewTheme: 'portal'` now connect those instances before first materialization. The disabled, shortcut and four-side examples use that same supported path.

That repair exposed two independent defects. In dark mode, the native border was the theme foreground, while `P-BRUTALIST-TOOLTIP-CONTENT` requires a fixed black border. The archived source history shows that implementation change in #1818 (`c049606db4a93fa15e7e9a97708d2ea6364a0557`), while the component P file is byte-identical to its prior version at `c7a7309a987293768d744db0f73987bf5d2f9953`. The existing maintainer ruling in [#398](https://github.com/Proto-UI/Proto-UI/issues/398#issuecomment-5378973550), archived in the earlier Hover Card reconciliation, preserves component-specific P semantics. This repair restores `border-black` and aligns both public-language descriptions; it does not introduce a new design decision or alter P lifecycle status.

The second defect was native CSS interpolation. The Tooltip duration utility also supplied an implicit `transition-property: all`. Recorded failing frames show radius, background, foreground, border and position transitions running alongside the intended `pui-enter` animation. One first-visible radius was 5.73763px, and another theme transition produced an intermediate gray fill. Waiting for those values to settle would conceal the first-paint failure. The source now declares `transition-none` for property transitions while retaining its existing enter/exit, fade/zoom and 150ms/100ms keyframe rules. The original immediate paint assertion remains immediate.

## Verification and preserved limits

The final single run passes all **7 selected cases**: the original six affected cases and the additional public Tooltip example check. Four unrelated cases in that file are explicitly filtered, not counted as passes. The original hero case passes in 27.1 seconds within its unchanged 90-second budget. The additional case passes in 61.5 seconds and checks 48 real opens across the disabled, shortcut and four-side examples, two themes and all four Web hosts. It requires the exact Content owner, first-visible 5px radius, 2px black border and real trigger description association.

The final run records **740 actual animation samples**. Every host has intermediate opacity frames in both directions: WC 81 enter / 60 exit, React 75 / 64, Vue 87 / 50 and Vue 2 94 / 57. The measured native animations retain their 150ms enter and 100ms exit durations. No animation clock, fixture CSS, opacity, native input path or product timing budget is overridden.

The original Tooltip unit suite passes **4/4**, including fixed-border and property-transition negative assertions together with positive keyframe assertions. The earlier border negative control remains archived as **3 passed / 1 failed**. Public documentation validation passes for 332 routes and 449 documents. The final Brutalist token/theme closure check reports the existing **737 tokens current**. No generated inventory refresh was required for these source paths.

The staged failures remain separate failed evidence: missing theme ownership, dark border mismatch, and intermediate theme paint are not rewritten as passes by the final repair. The original public example labels, native associations, geometry, focus behavior, 100ms cold and 300ms warm delay checks remain independently enforced.
