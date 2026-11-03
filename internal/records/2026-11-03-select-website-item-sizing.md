# Website Select sizing consumer: explicit opt-in, native evidence pending

This is a non-normative implementation and evidence record for #1159 / Draft #1229.

## Scope and compatibility

The English and Simplified Chinese Shadcn Select pages reference the same authored demo. Its Root now explicitly requests `itemSizing: 'match-trigger'`; the public Base and Shadcn defaults remain `intrinsic`. Content still omits `position` and retains the Shadcn `item-aligned` default. This is not a Popper-mode switch, a family-wide default change, or a page-specific height override. Existing labels, grouping, disabled Solid option, appearance and anatomy remain intact.

The independent Rhea contribution in #1211 wraps this same demo with `withShadcnRheaDemo`. Its author, wrapper and appearance must be preserved when combining the branches. The isolated c435 parent here does not include that wrapper; source compatibility was coordinated, but combined runtime/native validation is separate.

## Preserved observations

At 2026-11-03 06:38:15 UTC, an ordinary external browser opened the public English Select page. The deployment SHA was not identifiable; these measurements are **not** attributed to this candidate or c435:

- Trigger border-box 224 × 36, 1 px borders, vertical/horizontal padding 8/12 px.
- Surface border-box 224 × 203, 1 px borders, no padding.
- Viewport border-box 222 × 201, 4 px padding and no border.
- Each Item border-box 214 × 32; no border, padding top/right/bottom/left 6/32/6/8 px. React held actual DOM focus; Solid was disabled.
- No horizontal overflow was observed in this settled state. The 10 px width difference contains Surface borders and Viewport padding and is not by itself a width defect. The 36 versus 32 px height difference is a real observation.

The retained baseline screenshot is JPEG (SHA256 `fd11f2e236e04b00db953f72806aef1d18fd6a40661b785ae0f607850e43d460`); an initial local `.png` filename was incorrect, and a byte-identical `.jpg` copy records the correction. It is not a candidate screenshot.

## Validation boundaries

- Prior B4b c435 evidence: 251/251 adapter-level cases, types/spec/format passed; sole size-delivery rollback 240/251 and sole Content-focus rollback 245/251. These remain logical/controlled-layout evidence, not styled browser acceptance.
- This consumer's new five cases check authored opt-in and real public Root context, retain Base/Shadcn intrinsic defaults, and remove only the consumer prop as a control. Actual execution results must be bound to the published commit comment and retained raw reports; they are not inferred from this authored carrier.
- The independent browser workflow is a temporary #1229-only evidence entry; it must be reviewed for durable dispatch before integration. It executes eight cases (two page languages × four actual runtimes), not only collection. It binds checkout SHA/tree and captures Trigger/Content/Surface/Viewport/Item geometry, borders, padding, horizontal overflow, actual DOM focus, selection/reopen and a narrow viewport. It checks Item border-box equality rather than assuming the decorative Surface must equal Trigger width.
- Chromium retains its normal sandbox. The carrier starts the checkout's own server and rejects unverified external base URLs. A workflow report is not a production deployment.
- First-visible frame timing, 200% text scaling/RTL, long-text variants, compiled consumers, assistive technology, other family demos and Header controls remain unverified. The current carrier samples settled entry and reentry only.

No stable lifecycle promotion, merge, deployment or broad Issue closure is claimed. Native acceptance requires actual checkout-bound results and readable screenshots, not this record or an authored test.

## First falsifier and format evidence

On 2026-11-03 at 06:59 UTC, fixed c435 products plus only the five new tests produced **3 pass / 2 fail**: the authored Root prop was undefined and the real public Shadcn Root context remained intrinsic, both against the explicit match-trigger expectation. Base and Shadcn default-intrinsic controls and removal of only the opt-in passed. No skip/todo/unhandled error; source, 105 dependencies and lifecycle guards were clean, cleanup zero. This locates consumer adoption, not styled geometry.

A following read-only official formatter export completed with four of four exact semantic comparisons and all sixteen negative controls; original inputs and raw results were retained. Candidate execution, native browser execution and durable post-integration workflow dispatch are not inferred from that formatting result.

## Lease ownership repair note

Review found two neutral-lease defects against `C-TARGET-SIZE-MATCH-0001-OWNERSHIP` and `-PENDING` in `packages/modules/positioning/src/web/border-box-size-lease.ts`:

- The authored-sizing guard treated `box-sizing` as author-owned only by `important` priority. An authored `box-sizing` value at normal priority, present initially or inserted during a pending interval, was silently overwritten by the lease's `border-box` write. The guard now treats a `box-sizing` value as authored sizing consistently with the other size fields, in both the initial conflict check and the later admission guard, while still-owned internal claims continue to transfer by identity.
- `verify()` returned terminal `invalid-geometry` when called again before any positive `prepare()` stored a size. Repeated verification of a pending-only lease now returns recoverable `pending`, ordered after terminal, detachment and ownership checks so those real failures are not masked.

Discriminating cases were added to `border-box-size-lease.test.ts`: initial authored `box-sizing` at normal and `important` priority is untouched; a `box-sizing` inserted during the initial pending interval survives; repeated `verify()` stays pending until a positive `prepare`/`verify` recovers the same lease; and a pending-only lease stays fenced from a same-valued admitted successor. This note records the repair intent only; execution evidence belongs to the review run that runs the focused suite.

## 2026-11-04 bounded review execution

The ownership/pending lease suite actually passed 42/42. Edge-frame review found a separate constraint problem: growing through `min-width` rejects an authored smaller minimum merely because its declaration exists and can defeat an authored maximum. Growth now claims only an otherwise unowned inline `width`; authored width/inline-size conflicts remain unavailable, while min/max declarations and their priorities are left to native layout and verified used geometry.

The first expanded controlled-layout run passed 60 cases and failed one new assertion requiring an inline `width:194px` write. Its auto-growing fixture never exercised the conflict path. That incidental write assertion was removed; the fixture now supplies an independent stylesheet width requiring real frame growth, checks the resulting used geometry and restoration, and preserves the original author constraints. Controlled resolved geometry is not native CSS conformance evidence.

After the frame-chrome correction and scoped formatting, the final focused run passed all 62 cases across `border-box-size-lease.test.ts` (42), `edge-size-match-host.test.ts` (16) and `edge-size-match-delivery.test.ts` (4). No cases were skipped or cancelled.

A subsequent source-bound TypeScript program checked both changed sources and both changed tests with the actual workspace compiler options: 346 source/declaration files, zero foreign-worktree workspace sources and zero diagnostics. This is not the full workspace/docs typecheck. Independent repair-delta review found no source defect within these five files.

An actual Chromium run loaded a source-bound bundle of the current neutral positioning host, without another checkout's workspace source. At a 200×600 viewport, five authored minimum controls (`60px`, `6em`, `5%`, `calc(50px + 1em)` and `60px !important`) applied with 180×36 targets and a 194×50 outer frame. Oversized minimum, restrictive maximum and authored-width controls remained named `size-conflict` failures, with declarations intact and partial target writes rolled back.

That native run also exposed a content-box frame false rejection: the border-box minimum was written directly as CSS content width, counting padding/borders twice. The repair converts only resolved frame padding/borders for a content-box width; it never parses authored min/max units or changes the frame's box-sizing. The repeated nine-case native run passed every expected outcome, including the content-box frame at 194×50 with a 180×36 target. Native disposal restored the width and target styles while retaining authored minimum, priority and content-box choice. The final content-box capture was visually inspected; it fits within the actual 200px viewport.

These are neutral-host/ownership controls, not complete public Select acceptance. The retained website Item/Trigger deviation, first-frame ownership, four-adapter/profile/RTL/text-scaling coverage, independent review and exact-head CI/DCO remain separate work. No original failure was waived, no tolerance changed, and no lifecycle or umbrella criterion was closed.

## Historical 11:10 UTC checkpoint — actual native failure and motion prerequisite repair (then unrun)

Exact 8dbb run41594826103/job125779620440 is 0/8, all first-entry assertions; eight JSON and official artifact13224745456 SHA2567ee61394adf373d4669dc34bd60270c6acc31e11fb7395023ee5de69ad7608c2 retained. Item layout224×36 matches Trigger, but Surface zoom0.95–0.996 shrinks painted boxes. The previous carrier waited only for focus while labeling the sample settled; this prerequisite was false. Fixed upstream f31ed819/02cad611 explicitly includes zoom-in95; draft P-SHADCN-SELECT-CONTENT retains150ms entering. Do not remove legal animation or erase original failures.

The new bounded pre-action sampler records every same-owner frame, real browser animation state, layout/paint/transform and preserves early samples. It waits for actual non-pending finished animations plus two rAF observations, not for a size threshold or fixed sleep. A paused/running animation, owner replacement, deadline or frozen non-unit final scale remains failure. Original eight cases,0.5px dimensions,overflow/focus,keyboard/reopen/narrow assertions remain; their settled measurement now has an explicit prerequisite. Twelve independent sampler controls are authored, not yet executed. No product/default/position/animation changes. Native new-head results and durable CI routing remain pending.

## 2026-11-03 23:32 UTC — resumed sampler repair, native acceptance still open

The branch's later `9676b5cd69b3c8d880b4c0dbad37caa32a81a220` website run41727622987/job126236446834 also failed all eight cases at first-entry. Official artifact13275168332 is 860,218 bytes, SHA256 `f52684e9771ea06e589a61652f14736e1d19cc1ea656317cff4cf550dd22654f`. All eight records retain layout224×36 and Surface scale0.95–0.996231, with no secondary errors. Selection/reopen/narrow actions remained unreached. Those failures and the earlier 8dbb artifact are separate observations, not relabelled evidence for this repair. The scheduling changes at `4c4a2fb843c942ef52008da6a014bcf07f6eafed` are retained without modification.

The original twelve sampler controls actually passed. Four new falsifiers then failed against that helper: disappearing/cancelled Animation objects incorrectly appeared settled, changed owner identity was not rejected by the trajectory checker, and a NaN timestamp was not rejected. The helper now keeps every observed Animation object and requires its finished state; cancellation is an explicit interrupted result. Additional review controls found a missing or hidden Content interval could be skipped between terminal samples. After the first observed open frame, disappearance or hidden Content/Surface now invalidates that trace rather than joining non-contiguous samples. Initial hidden preparation can still wait within the unchanged 1,200 ms/96-frame bounds. No product animation, focus, default policy or positioning code is changed.

The isolated helper controls reached 18/18 with zero skips. The first removed-Content control lost focus on removal and timed out against the old helper; that failure remains, and the control now explicitly refocuses the returned same node so it isolates the discontinuity. All 52 original browser expect-related AST calls, seven keyboard press calls and the complete facts/assertGeometry functions remain structurally identical. The same original 0.5 px dimensions, overflow/focus, two locales and four runtime identities remain. Native results must still run on the published head; DOM mocks, type checking and browser test collection are not native acceptance.

Execution preparation failures are retained separately: the first minimal sandbox lacked its existing hosts mapping; one formatter command included a duplicate node argument; initial formatting comparison code mishandled template tokens and SourceFile text; a stricter AST comparison identified formatter-added ternary parentheses in the test fixture. These were preparation/audit defects, not product failures. One intermediate 16/16 run overlapped addition of read-only type inputs and failed the whole-directory unchanged-source check, so it is not used as the final guarded pass. Final evidence is rerun without concurrent source writes, with the same 105 hash-bound dependencies, no account credentials and inherited syscall-level network denial.

No new browser screenshot is available at this point. A pre-action rAF trace retains sampled early frames and all subsequent measured frames; it is not a claim of compositor-frame video or proof that no rendering interval can occur between callbacks. Final new-head native eight-case geometry, readable screenshots, full repository checks and independent acceptance remain pending.

### Later review closure and final scope

At the fixed 4c4a source, complete Select composition disables the Content's legacy animation branch. `surface.proto.ts` delegates to `setupSelectPaint` in `visual.ts`, which owns the New York fade/zoom entry; `viewport.proto.ts` has no entry animation. The sampler nevertheless now observes every measured Trigger, Content, Surface, Viewport and Item's own animations, preserving each Animation object's target label and CSS name. New Content and Viewport running-animation controls and a declared nonzero animation cancelled before the first sampled frame failed the Surface-only implementation (19/22); the expanded implementation passed22/22. A matching declared-name positive control and explicit zero-duration declaration raised that helper collection to23. A final function-serialization control executes the actual transpiled installer without its module closure; all24 helper cases passed before final formatting. Infinite running animation is a bounded mock rejection, not native browser proof.

A declared nonzero CSS animation whose matching Animation object was never observed is now `missing-animation`, not assumed finished. This also conservatively rejects a first sample taken too late to establish that declared motion. A CSS declaration removed before all sampling, ancestor animation outside the measured nodes, compositor intervals between rAF callbacks, and real browser reduced-motion/cancellation behavior are not proven by these mocks. Native acceptance remains an open gate. The implementation retains sampled early frames even when it rejects missing/cancelled motion; no geometric threshold controls when it stops.

The 4c4a workflow now provides callable/manual evidence through the production serial chain; the historical temporary-dispatch debt above describes its earlier state. This motion-only commit does not change that scheduling policy or claim a new cycle has executed.

### Final opacity review correction

A finished animation with unit scale but Surface opacity0 was still accepted by the helper. A new independent falsifier fails that earlier candidate (24/25). The fixed New York full-composition paint uses `animate-in fade-in-0 zoom-in-95`: its entry begins at opacity0 and returns to the Surface's normal opacity1. The terminal two samples must therefore have Surface opacity1 within1e-6, separately from the unchanged0.5px Item/Trigger geometry rules. This check does not require disabled Item opacity1 and does not change production CSS.

Animation coverage is exactly the eight measured nodes' own animations: Trigger, Content, Surface, Viewport and four Items. It is not a full-subtree, arbitrary descendant or ancestor animation claim. Final native eight-case execution, real reduced-motion/cancellation and screenshots remain pending; all helper controls are DOM mocks.
