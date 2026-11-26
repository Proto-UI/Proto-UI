# Shadcn Slider: source-bound paint translation, incomplete upstream parity

Date: 2026-10-10 UTC. Base: `ce9b96d0f18e9635552efb3a075753bc38486d2c`.

## Reference and provenance

- Official component documentation: https://ui.shadcn.com/docs/components/base/slider
- Official current Base/Nova registry: https://ui.shadcn.com/r/styles/base-nova/slider.json
- Retrieved registry SHA-256: `646bcd7913417b786bbf7578484f851bf89c81a62f70ef9c4f3522e2af80a951`.
- Embedded `registry/base-nova/ui/slider.tsx` SHA-256: `1fd32ee03ddaa382aabccce0bd88669aa8f91e4fe487622a68745d2ed1d5f5b9`.
- The served registry has no package/release version. These hashes pin the inspected deployed bytes; this record does not invent a version or claim that a repository HEAD produced those bytes.
- Separately observed upstream repository main: `c2a67849be260701852b0977ba15eb5f3a0ce2a4` (commit date 2026-10-10T10:10:36Z).
- MIT license, copyright (c) 2023 shadcn: https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/LICENSE.md . Retrieved license SHA-256 `1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f`.
- Static source inspection only. No newly downloaded third-party source was executed. The implementation is a Proto translation, not a React/Base UI vendoring exercise.

## Hit-geometry provenance correction

The pinned registry above declares Thumb `size-3 border` and `after:absolute after:-inset-2`. Under the default 16px rem, a 12px border-box with two 1px borders leaves a 10px padding box; the absolute pseudo-element containing block therefore suggests `(12 - 2) + 8 * 2 = 26px`. This is a static CSS inference, not a measured official hit target. See [CSS2 containing-block definition](https://www.w3.org/TR/CSS2/visudet.html#containing-block-details). The separately observed [Shadcn package manifest](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/package.json) pins `@base-ui/react` 1.6.0; [that version of SliderThumb](https://github.com/mui/base-ui/blob/v1.6.0/packages/react/src/slider/thumb/SliderThumb.tsx) positions the Thumb absolutely. With no horizontal Control height/padding and an in-flow `h-1` Track, the basic upstream horizontal Control cross-axis is source-derived as 4px. These static dimensions assume a 16px root font, 0.25rem spacing unit and no consumer override. Exact-version native boundary probes remain outstanding. The candidate keeps its existing 28px Thumb hit rectangle and 12px Track owner; this correction changes only the record, not implementation dimensions or tests.

## Actual change and explicit remaining differences

Measurements below use the reference's default 16px rem. The same rem-based tokens preserve user font scaling.

| Subject | Prior Proto | Official Base/Nova | This candidate | Evidence limit |
| --- | --- | --- | --- | --- |
| Rail paint | 12px | h-1 / w-1, 4px | 4px passive Template container | Source/token match; exact browser output awaits this commit's CI |
| Thumb paint | 20px, 2px primary border, background token | size-3, 12px, 1px ring border, white | 12px passive container, same border/color tokens | Actual color depends on theme; no full upstream pixel match claimed |
| Thumb hit box | 20px | size-3 border plus after:-inset-2; padding-box CSS inference suggests 26px, not browser-probed | Candidate rectangular Thumb root is 28px, centered round paint 12px | 28px is the candidate geometry, not established upstream equality; the inferred boundary difference needs exact-version native probing |
| Track/control hit cross-axis | 12px owner | Horizontal Control has no height/padding; in-flow Track is 4px and Thumb is absolute, suggesting a 4px base hit cross-axis | Existing 12px Track root retains input/geometry | Candidate 12px differs from the source-derived upstream 4px base geometry; native propagation/overflow bounds remain unverified |
| Hover/focus/active ring | focus only, 2px + offset | 3px ring-ring/50 for hover/focus-visible/active | 3px ring on borrowed hover/focus/accepted thumb-origin press | Captured-active means accepted Root session, not a claim of browser :active identity in every path |
| Disabled/readOnly | thumb-only dimming | Control data-disabled opacity-50; Thumb disabled styles | One control opacity-50, disabled hit/focus gating; readOnly stays focusable/hoverable | Exact native disabled pseudo-class behavior and all theme states await upstream comparison |
| Vertical | fixed 192px, 12px rail | full height, minimum 160px, 4px rail | full height, minimum 160px, 4px paint | Default docs example uses 160px owner height |
| Edge alignment | centers at interval endpoints | thumbAlignment=edge | Unchanged interval centers | OPEN: not visually shifted independently of AxisInput |
| Range/multiple thumbs | one scalar | array/range/multiple | one scalar retained | OPEN: cardinality, ownership, constraints, keyboard and a11y protocol |
| RTL | existing reversed horizontal coordinate path | supported | retained | Source/token assertions plus requested official CI; not native all-host admission |
| Cross-host rendering | draft | React/Base UI implementation | ordinary portable div identifiers, no DOM/host API in prototypes | No Compiler/CLI semantics changed; no native/Compiler fidelity asserted |

The pointer interval currently comes from the entire Track target. AxisInput exposes only a normalized interval and accepts only same-role/ancestor geometry targets. It has no public inset/domain-transform input. A future common geometry contract must define the visual thumb extent, interactive interval and endpoint mapping together (including reverse/RTL, resizing, disabled, cancellation and zero span). Adding CSS endpoint offsets alone would make rendered values disagree with pointer samples and is intentionally absent.

## Ownership and lifecycle

`C-TEMPLATE-0002/0003` permit style-only structural containers; the required generic `div` identifier maps to a host container. Paint children own no component channels. Track, Thumb and FieldThumb retain their existing anatomy and input/focus identities. No new Trigger, event owner, hidden input, Web selector or raw host geometry was introduced.

Base Thumb owns `hovered` and `pressed` facts. Pointer origin alone is insufficient to press: existing Root/Track AxisInput must accept a session. Root publishes the existing gesture phase in its context. Leaving Thumb ends hover but preserves accepted captured press. End/cancel, disabled/readOnly, cancellation and teardown release it. Keyboard edits never create pointer pressing. New P/T entries remain draft and cover only this bounded surface.

A new teardown regression exposed an existing error: an AxisInput cancellation after domain retirement called strict `partsOf` and threw `ANATOMY_CLAIM_INVALID`. An initial `missing: empty` attempt was rejected by workspace types: it exists internally but is not granted by public RunHandle. That attempt was removed. The final Track observes the existing Root part lease before registering AxisInput and invalidates it on unmount; a cancellation with an observed ended Root lease performs no late query. Ordinary input retains strict lookup, with an invalid-live-claim negative control. Root subscribes to required Track/Thumb retirement and remains the session cancellation owner. HappyDOM ordering is not universal native-host acceptance.

## Verification and failures

- Shadcn paint baseline red: 6/6 failures; candidate passes both standalone Thumb and FieldThumb.
- Base session baseline red with the new 23 cases: 21 failures, 2 passes, 9 unhandled failures; preserved as negative evidence. Initial frozen candidate: 23/23 pass; independent review below exposed missing continuation coverage.
- Bounded existing numeric, finite-extreme pointer and Form-composite regression tests remain required. The ce9 finite convex-combination interpolation is preserved unchanged.
- Workspace type checks passed after narrowing type assertions to Slider public surfaces and replacing the unsupported optional-query call. Earlier type failures are retained, not counted as passes.
- Catalog-wide pre-existing debt remains. This slice adds two bounded draft P identities and one T identity; it does not waive or erase unrelated catalog debt.
- Formal current-source browser screenshots are pending publication and the existing Finf evidence workflow's new `slider` group. The suite has four Runtime journeys and six real documentation variants; checks dimensions, native pointer/keyboard transitions, disabled/readOnly, both Thumb entries and vertical/RTL, and captures endpoint debt. It records exact source SHA/tree, image SHA-256 and failure receipts.
- This is not an upstream same-state screenshot diff, native GPUI/Qt evidence, full Finf completion, full shadcn equivalence or a claim that every test passed. Independent review and exact-head CI remain required.

## Source-to-CSS closure blocker found before publication

The actual nine-file Slider source collection emits passive `h-1`, `size-3`, `size-7`, `ring-3` and color/border tokens, and the existing CSS generator translates them to 0.25rem, 0.75rem, 1.75rem and 3px respectively. The separate dynamic paint container therefore does not need CSS pseudo-state selectors.

However, the shared static collector currently omits every Rule variant borrowed through Slider's authored asHook handles, including vertical dimensions/position, RTL endpoint position, disabled opacity/hit gating. The revised focus-visible forced-colors outline is a collected literal token on passive paint, with its own source-to-CSS test. Another component happens to seed some matching whole-site CSS; that is not valid package closure. `packages/prototypes/shadcn/test/slider-style-closure.test.ts` records one passing static-paint test and one intentionally unskipped, failing source-to-Rule-to-CSS regression. This candidate must be combined with the separately owned generic collector repair and rerun before full styled-state acceptance. No Compiler/CLI semantic implementation, whitelist, authored Web variant token, or manual generated CSS was added here.

Initial frozen candidate bounded evidence: 122/122 focused implementation/demo/harness-source tests; 124/124 runtime-test planner tests; 3/3 catalog evidence-integrity cases after materializing unchanged `docs/` and `native/` source from the exact base tree (no native execution); workspace type checks; spec authoring against ce9; generated preset check. The initial test-case IDs lacked the schema's `CASE` segment and were corrected before validation. The normal `tsx` command wrapper was blocked opening its IPC pipe; the same pure scripts passed through `node --import tsx` without that incidental IPC server. The generated Agent projection is disposable and excluded from the patch. Whole prototype-catalog remains at 552 diagnostics versus the baseline's 554. The independent source-to-CSS Rule regression remains red and must not be represented as a pass.

## Independent-review revision: actual gesture lease cancellation

The initial tree `00ff05b3dc69bf1d8541fec1c9a8cbfb02cc05ff` is blocked and its packet remains immutable. Independent review reproduced pointer start 25→45, removal of Thumb, Root rollback to25, then an old same-pointer Track move incorrectly writing85. Root reset had the same stale-stream defect. Expanded negative evidence produced20 failures/45 passes plus2 Shadcn disposal errors. These failures are retained; the initial23-case green was not sufficient cancellation evidence.

The revision keeps Root as value/cancellation owner and Track as the sole AxisInput owner. Track eligibility now requires observed live Root and Thumb parts; public `AxisInputHandle.sync({disabled:true})` closes the actual host gesture/capture lease on retirement. Root begin also checks required Track/Thumb cardinality. A Track-local accepted-session guard rejects already-delivering samples and Root reset/cancel revokes that lease before public configuration rearms fresh input. The public handle has no `cancel()` method: no private cast, invented parameter, Adapter change or swallowed error is used. Restoring a part only permits a fresh pointer start; old move/end cannot write or commit. Capture-release spies supplement the behavioral tests, but do not replace native capture evidence.

The expanded tests cover five families×Thumb/FieldThumb for retirement, restore, stale samples, reset, Root/Track reentry; Field disabled/readOnly changes; and actual capture release for Thumb retirement/reset/Root cancel. The Shadcn paint watcher previously tried scheduling delay during terminal disposal. The revision uses the ordinary `run.update()` path (whose lifecycle controller safely ignores terminal updates) rather than creating a new timer, and blocks refresh after onBeforeDispose while leaving subscription cleanup to State ownership (state-watch v0 §4.1). No timer, lifecycle catch, or shared runtime modification remains.

This Proto candidate's28px hit owner no longer carries a round border radius: roundness belongs solely to12px paint. The forced-colors focus outline also moves to12px paint, driven by the existing borrowed focusVisible fact; it is absent from the focus owner, so there is one contour. Static collector-to-CSS assertions cover this literal outline and forced-colors rule. Browser evidence now includes native four-corner hits outside the paint/Track cross-axis, an outside-corner negative control, and a forced-colors focus screenshot. Actual hit equivalence and high-contrast visual parity are still pending native/upstream comparison; these are implementation/evidence gaps, not a claim that Template cannot express them.

Eight existing borrowed Rule variants remain missing from the shared collector. The regression stays unskipped and red; moving the focus outline onto its correct paint owner legitimately closes the former ninth variant through literal paint CSS, rather than removing a required assertion. No full test-suite or native acceptance is claimed.

Revision bounded results:170/170 focused cases (including71 Base session cases and6 Shadcn paint cases), workspace types pass,3/3 catalog evidence-integrity cases and lifecycle authoring pass. Source-to-CSS static dimensions/ring/forced-colors test passes; borrowed Rule closure remains8 missing variants. The6 actual-capture-release spy cases cover both entries and3 cancellation causes. All are isolated authorized-source tests, not a native-browser completion claim.

## Second independent-review revision: paint update eligibility

Tree `5d6c656e236fbc8c641b7ad648df2e43b7871678` also remains blocked and immutable. The reviewer added a combined focus/press/whole-Field teardown: after keyboard focus, focus an external button, then start a Thumb drag with focusVisible and pressed true, and remove the entire Field tree. The new synchronous paint refresh invoked inherited FieldControl onUpdated after the Field provider had retired, yielding CONTEXT_DISCONNECTED. The same sequence passed for pure Base and the previous Shadcn skin, proving this was introduced by the new paint refresh rather than existing Form debt. The raw failure and controls are preserved.

The repair subscribes only to the existing required anatomy-root leases and tracks mounted eligibility before explicitly requesting a paint update. Track/Thumb require their existing Slider Root; FieldThumb additionally requires its already-inherited Field Root. Once any root lease ends, paint does not request an update that could enter inherited onUpdated logic. There is no new claim, owner, role, exposed state, optional Context read, suppressed error, manual watch cleanup, scheduler escape or shared Field/Context/Adapter change. Initial paint still reads current facts normally; actual hover/focus/press/disabled updates remain covered. Native teardown ordering remains separately unverified.
