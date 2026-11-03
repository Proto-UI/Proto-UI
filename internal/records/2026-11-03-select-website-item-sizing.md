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
