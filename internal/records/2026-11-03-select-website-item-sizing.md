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
