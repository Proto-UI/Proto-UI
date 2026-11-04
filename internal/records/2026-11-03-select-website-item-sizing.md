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

## 2026-11-04 authored chrome conflict classification

Independent published-delta review identified a narrow failure-reason question. A negative authored child margin can cancel frame chrome in the measured gutter; after an owned width write, larger authored padding can then require a nonpositive content width even though every measured box and CSS input is finite and valid. The retained regression actually failed before the repair: the host returned `invalid-geometry` instead of `size-conflict`.

The finite authored-constraint defeat now reports `size-conflict`; nonfinite width and negative chrome still report `invalid-geometry`. The new regression also verifies rollback of only owned width/height while preserving authored padding and negative margin. The post-repair ownership/host run passed59/59 (42 lease and17 host cases). This controlled-layout result does not rebind the earlier nine-case native capture to this later source or establish public Select acceptance.

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

## 2026-11-04 composed neutral-host native verification

The original-author scheduling commit `4c4a2fb843c942ef52008da6a014bcf07f6eafed` and motion-observation commit `f11902519542b0f44fc75d06e1796a3c3ff5bcd0` were preserved through normal merges with the authored-chrome repair and main `ba733f51a076eda8fc44fbbcc3d4724478b042ad`. The two inventory conflicts retain both sizing and Brutalist Motion suites and their separate existing owners; the historical record conflict retains both complete additions. No original-author object or certification was replaced.

At composed source `8a2a77eb160515e786e39714de3d8537c8bd50ae`, tree `d7857c917e7cdd8424fa766462abbf893e9ba0c6`, the three positioning suites plus the actual motion-observer suite passed **88/88** (42 lease, 17 host, 4 delivery, 25 motion controls). The actual scheduling-policy suite passed **18/18**. Before the motion-only merge, the executable global browser inventory also accepted all 121 discovered suites with both sizing and Motion owners retained. Existing ES2024 and donor Astro-config warnings remain visible; none of these runs is a full-repository check.

A newly bundled current neutral positioning host was exercised in actual Chromium at a 200×600 CSS-pixel viewport, without mocked geometry. All ten native cases met their expected outcomes. Small, em, percentage, calc and important minimums plus the content-box case produced a 180×36 target and 194×50 frame. Oversized minimum, maximum and authored width returned `size-conflict` without losing authored values or priorities. The new dynamic case first applied, then accepted real authored padding-left 225px and child margin-left −220px, returned `size-conflict`, and rolled back only owned dimensions while preserving those authored declarations.

The separately captured applied content-box frame ended at x=194 within the 200px viewport. Actual disposal restored empty owned width/height while retaining minimum 60px and content-box choice; the owned tab was closed. Raw case observations, bundle/metafile and the inspected screenshot are retained under `/tmp/release03-sizing-final-native-20261104/`, `/tmp/release03-sizing-final-native-observation-20261104.json`, `/tmp/release03-sizing-final-native-visible-20261104.json` and `/tmp/omp-sshots-15c04220078d621b.png`. These are local source-bound neutral-host evidence, not permanent public uploads.

This does not re-label the earlier nine-case receipt or establish the eight real public website cases, four-runtime/profile coverage, motion/compositor coverage or the outstanding public Item/Trigger deviation. New-head native DCO, independent motion review and full CI remain separate conditions; the source above is the executed source, not a later record-only commit.

### Independent observer cleanup correction

Independent review found that the observer reported cleanup from handles after setting them to null, making its negative cleanup check unreachable. Two new cancellation-failure regressions actually failed before the correction, throwing `0` and `false`. The observer now records each actual cancellation acknowledgment independently, attempts the other cleanup even after a failure, preserves the primary outcome/error, resolves the result with truthful failure fields, and cannot report successful settlement when cleanup failed. It does not claim independent visibility into the browser's scheduling queue.

The complete four-suite related run then passed **90/90** (the prior 88 plus these two cases). In a separate real Chromium observer fixture, a trusted click started actual 150ms CSS motion: the retained 12-frame trajectory settled with no issues and both cleanup acknowledgments true; a second explicit stop returned `stopped` with both acknowledgments true. The fixture's raw source-module and compiled-module hashes, dirty-source boundary and results are retained in `/tmp/release03-sizing-current-observer-native-20261104.json`; the inspected local screenshot is `/tmp/omp-sshots-15c04480d7b2b0d0.png`. The owned tab was closed and the single native slot released. This proves the observer fixture, not the original eight public Select journeys; the neutral-host ten-case result above remains separately bound to its executed source.

## 2026-11-04 review findings, actual integration and CSSOM fixture correction

Native GitHub review of `70fcab4fa551d2bb33e244f64bdbacbaf882ca65` found three concrete P2 defects: edge sizing observed only border-box changes, admission ignored narrower horizontal clipping ancestors, and temporary DOM removal permanently retired a still-current size lease. Five discriminating assertions failed before repair; the three focused suites then passed **96/96**. The complete Positioning directory passed **275/275**. These are controlled-layout tests, not public-browser acceptance.

Repair `1ad3d172bc9da954a1a0e790ae2bd2f3b6bd6e5d` installs separate content-box/border-box observers, checks horizontal clipping within the owning frame using the existing scroll-adjusted layout coordinate model, and suspends detached nodes without releasing their claims. Disposal, owner loss and foreign-document adoption remain terminal. PR #1229 actually merged at `8f621173585c37cb1e975b31168177076fd80ac4`; its merge tree equals that repair head's tree, `9cfb85ea74a042db68c23bcb85bee9c855cfdfdf`. Exact-head native DCO and the lightweight PR CI succeeded; that CI result is not a complete scheduled regression cycle. The three historical review threads were not falsely marked resolved, and no later bot approval was inferred.

A separate real Chromium fixture first exposed a mistake in the new controlled observer test: CSSOM `clientWidth` includes padding. Increasing padding does not by itself imply overflow. Native content that fits before a 100px padding change but no longer fits afterward transitioned from `applied` to `size-conflict` after content-box notification. The short-content control remained `applied`. A narrower hidden-overflow ancestor was rejected without an `applied` delivery, and a removed/reinserted same target transitioned through `pending-target` back to `applied` at 180×36; disposal cleared only owned dimensions. The native fixture and local receipt are retained under `/tmp/release03-pr1229-3p2-native-20261104/` and `/tmp/release03-pr1229-3p2-native-receipt-20261104.json`. They exercise the edge host and shared clipping helper; native target-alignment composition is not established by this fixture. Measurements in failure callbacks occur after rollback, not before it.

The follow-up fixture now models padding-inclusive `clientWidth` and overflowing-content `scrollWidth` separately, with both overflowing and still-fitting cases. Those corrected three focused suites passed **97/97**, including a repeat after formatting. A source-confined TypeScript program using the workspace compiler options included all three changed suites and their dependencies: **347** source/declaration files, **zero** foreign-worktree source files and **zero** diagnostics, retained in `/tmp/release03-pr1229-scoped-types-three-findings-20261104.json`. The attempted full workspace typecheck failed with 1,406 diagnostics including missing React/Vue/Playwright dependencies; none named Positioning. That failure was not compared with a baseline and is not evidence of a clean workspace or exclusively inherited debt. Original eight public Select journeys, four-runtime/profile/RTL/text coverage, compositor evidence and complete release acceptance remain open.
