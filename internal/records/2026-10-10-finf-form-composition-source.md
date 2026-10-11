# Finf Form and composite-control source follow-through

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

User-directed source-first successor for PR #872. This is a WIP implementation record, not lifecycle promotion or full acceptance. Previous source slices are 21f2c4e (Progress/Meter), e819f807 (Fieldset/Form/Checkbox Group), and 5b8ab2e3 (Slider/Number Field/Input OTP).

## Implemented

- FormReset and requestReset restore mounted initial uncontrolled values through actual control commands. Controlled values receive proposals and remain owner-owned. Pending validation and editing are canceled. resetValidation remains validation-only.
- Implicit Enter submits from a focused, eligible single-line Field/Number/OTP editor. Modifiers, repeated keydown and composition do not submit. Form disabled reaches contained Fields.
- Explicit NumberFieldControl, InputOtpControl and SliderFieldThumb atoms bridge canonical typed values, local policy, FieldLabel activation/naming, validation, Form serialization and reset. Standalone Input/Thumb atoms retain their own labeling relations. Each new atom has all four visual projections.
- CheckboxGroup optionally acts as a Field control, including required array validation, reset and group focus. Runtime delay coalesces item blur/focus so internal focus transfers do not trigger group-blur validation; teardown cancels the task.
- Nested Fieldsets OR their local disabled choice with ancestor scope without losing author-owned policy.
- Bilingual docs and the existing five Form DemoSpecs now expose the real composed controls and reset action. Base receives inspection-only demo layout, not prototype styling.

## Shared dependencies and integration points

- Context ancestor participation: original 59d2ff51b0a2ad4eb7cd8952dc3bdc41d0b154d3.
- Web keyboard repeat payload: 109ac801. One normalized boolean field, no native-event escape.
- TextControl resetValue command: 2f6bef16. Replaces editing lease, retires stale events/reentrant listener delivery, never mutates controlled canonical owner values.
- Brutalist shadows use the existing --pui-border variable: 1af933e9.
- Integration owns global exports, registry/sourceOnly mapping, generated CSS, navigation and lifecycle. No new catalog identity is invented to count completion.
- New local named exports for each of base/shadcn/brutalist/bootstrap-2-3-2/liquid-glass: formReset, numberFieldControl, inputOtpControl, sliderFieldThumb. Names use family-form-reset, family-number-field-control, family-input-otp-control and family-slider-field-thumb. Their existing component subpaths and doc slugs are unchanged.

## Focused evidence and failures

- Existing 80 group-A/Field tests passed before this successor.
- Successor composition tests cover actual host editor reset, controlled proposals, Enter/IME/repeat, typed serialization, effective disabled round trips, three nested Fieldsets, composition lease cancellation, Number onChange stepping, Checkbox Group required/group blur and all four family projections.
- 87 TextControl tests and 13 event-router tests passed. The affected 80 bilingual MDX documents compile with the actual MDX compiler; existing 30 form-related MDX regression tests pass.
- Initial focused runs found real teardown notifications, missing repeat projection and internal-focus blur errors; those failures were repaired and rerun. Early test-only failures also corrected reading protocol payload from CustomEvent.detail and querying composing on the control snapshot rather than the validity snapshot. No failed run is counted as passing.
- Unscoped root tsc includes unsupported website/script/consumer fixture paths and fails on missing declarations, aliases, generated artifacts and consumer dependencies. The intended workspace project separately reports the existing missing generated Shadow import in shadow-s3/admission and shadow-s4/dialog. No type gate is relaxed or claimed green.

## Still open

Formal coherent contracts/lifecycle, packaged consumers, full Adapter/Compiler/GPUI semantics, native IME/assistive technology, safe-area audit, screenshots and exact-head CI/independent acceptance remain open. No Rust/native execution occurred here. Slider currently has one thumb; this checklist names Slider but does not explicitly select multi-thumb collision policy. Number locale formatting, null/empty numbers, scrub/wheel and native HTML first-Legend behavior remain explicit feature boundaries, not completed acceptance.
