# Progress/Meter definition review and finite-range repair

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This is a review/decision packet, not a new normative contract, catalog admission, or acceptance. Progress and Meter have implementation/draft documentation but no dedicated P entity or legacy protocol contract in this snapshot. A passing source test records behavior; it does not retrospectively make every current policy normative.

## Common Proto definitions, independently applied

- `D-PROTOTYPE-ENTITY-NAMING-0001-F` (draft) explicitly leaves ordinary JS/TS language and execution semantics unchanged by the `.proto.*` suffix. No reviewed clause forbids pure `Array.map`, `Object.keys`, object-held State handles, named callbacks or ordinary lexical closures. Compiler rejection alone is not a prototype violation.
- `C-CORE-SYNTAX-0001/0002` (draft) separate setup declarations from current-invocation runtime capabilities. Progress currently exposes States in setup and updates owned States/Context from runtime callbacks. Its pure range helper does not obtain host objects or import another protocol hook.
- `C-CORE-SYNTAX-0003/0004/0005` (draft) define named setup objects, callback registration and renderer-returned TemplateChildren. `C-CORE-SYNTAX-0006-D/F` permits render Context reads and disallows render-time recursive update. The current Value closure caches Context-derived text and explicitly requests update outside render. There is no established basis here to ban this cache solely because a parser rejects it; `C-STATE-0001-B` internal-continuity expectations should be considered when admitting its final protocol.
- `C-PROPS-0001` (active) owns app-maker configuration; `C-EXPOSE-0001` (draft) owns caller-visible capabilities. Progress is not an editing owner merely because it exposes a numerical value. Its public State types must remain concrete for all five atoms and four design projections.
- `C-CONTEXT-0004/0011/0012` (draft) govern nearest logical scope, rebinding and cleanup. `C-LIFECYCLE-0003` (draft) governs explicit update intent and detached-view behavior; Context changes are not an implicit rendering license.
- `C-STATE-0006` (draft) requires JSON-compatible numerical domains. Finite arithmetic inputs must not cause NaN to enter an exposed percentage State.

The uncommitted parser-oriented source rewrite was withdrawn. No Compiler/parser/intrinsic code, `.map` expansion, callback renaming or closure replacement is part of this repair.

## Concrete repair and evidence

The old percentage formula returned 0 at the midpoint of `[-Number.MAX_VALUE, Number.MAX_VALUE]` and NaN at its upper endpoint. A strict failing-before test observed both results. The repaired helper rescales both coordinates only when the finite endpoints' difference overflows; ordinary and subnormal spans keep their existing calculation. This mathematical repair does not choose a new invalid-input or degenerate-range product policy.

- 23 new focused cases verify five-family passive unknown progress, all-part owner updates, no keyboard editing, scope movement/reconnect, finite extreme endpoints and the shared Meter/Slider callers. Together with existing range/numeric regressions, 51 tests pass.
- The range source-consumer TypeScript project passes with actual positive numerical/boolean/string reads and negative editing/type checks for all 25 Progress atoms. This is stronger than Base/family type-equality checks alone.
- Existing equal-range output is tested as regression behavior, not declared accepted semantics. Native input/paint/accessibility, compiler conformance, real pixels, packed artifacts and full acceptance remain unverified.

## Proposed protocol ownership for governance review

Candidate Progress subject: an application-owned task-completion readout. Root resolves configured values and publishes one shared fact; Label supplies naming, Track/Indicator present the fact, and Value supplies readable text. None edits the task, creates focus/activation, or independently fabricates value ownership. Task execution, cancellation and region busy/live announcements belong to their owning compositions.

Candidate Meter subject: a bounded scalar measurement readout, not task completion. Root owns one measurement and optional meaning-bearing thresholds; parts consume that fact without acting as editors. A family may choose geometry/color/material but cannot alter the measurement or silently reinterpret it as progress.

These subject distinctions align with [WAI-ARIA 1.2 Progressbar](https://www.w3.org/TR/wai-aria-1.2/#progressbar) and [Meter](https://www.w3.org/TR/wai-aria-1.2/#meter): Progress is read-only and omits current value while unknown; Meter represents a bounded measurement. Those external roles constrain accessibility projections, not the complete Proto public API. The [APG Meter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/meter/) also expects a strictly ordered range and no keyboard editing.

An eventual `P-BASE-PROGRESS` or `P-BASE-METER` should capture a coherent subject with real authoring entries, core-contract dependencies and a T graph. Five files are not evidence for five independent P subjects. Neither protocol may become active from this packet.

## Decisions still needed before protocol admission

1. **Degenerate/reversed ranges:** current implementation collapses a reversed maximum to minimum and exposes 0% for an equal range. Decide whether a degenerate range is accepted, rejected with a diagnostic, or normalized to a nonzero interval. Meter's APG strict ordering makes silently treating this as final especially questionable. Test equal/reversed/negative/finite-extreme ranges against the selected policy on every applicable host.
2. **Missing and invalid values:** Progress currently uses omitted value or explicit `indeterminate=true` for unknown progress; `indeterminate=false` does not fabricate a missing value. Meter currently defaults its missing measurement to the lower bound. Decide whether Meter instead requires a value and how invalid/nonfinite values are rejected or normalized. This decision includes nullable-value API compatibility; the current type only admits number/undefined.
3. **Threshold semantics:** define whether low/high/optimum describe meaningful zones, their ordering/defaults, and the externally promised status vocabulary. Current `optimal/suboptimal/critical` arithmetic is implementation intent, not independent authority. Test threshold boundaries, inverted thresholds, optima outside bounds and value updates without inventing ARIA threshold attributes.
4. **Readable versus accessible formatting:** current Value and default accessible valueText use the raw canonical number. Decide whether default accessible valueText should be omitted so assistive technology can report a percentage, with authored valueText used only as an override. Define empty-string treatment and the Label-versus-ariaLabel naming policy explicitly.
5. **Part lifetime and structure:** define required/optional parts, orphan behavior, duplicate labels, reparenting and whether decorative Track may contain only noninteractive content. Current five-family reconnect tests pass, but that is not a universal host-lifecycle guarantee.

After those decisions, write draft criteria and positive/negative test mappings; independently review Base and family implementations against them. Preserve full finite range, unknown progress, Context, accessibility, exposes and owner-update behavior throughout. Neither the Compiler's accepted syntax nor today's implementation can substitute for the common definition.
