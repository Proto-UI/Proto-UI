# Numeric part public type correction

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This type-only prototype change addresses the independent range/geometry review's actual `Record<string, unknown>` leak in Slider, NumberField and OTP non-Root Exposes. It changes no numerical algorithm, editing, input ownership, Template, state allocation or lifecycle behavior.

## Surface correction

The Base and four family entries now explicitly carry concrete Exposes for the 15 non-Root identities:

- Slider Track/Label/Indicator/Value expose their six real value/range/policy/direction readouts; Thumb additionally exposes the actual focus-visible, focus/reset and internal Field-notification methods. FieldThumb adds the actual Field policy/validity state readouts.
- NumberField Input exposes its numeric value, policy/focus state and actual focus/reset/submit-eligibility/Field-notification methods. Control adds Field policy/validity states. Increment/Decrement expose only disabled and focusVisible; they do not invent Button focusSelf or a value owner. Label has an empty public Exposes surface.
- OTP Input exposes the actual disabled/focus-visible and focus/reset/submit-eligibility methods, not the Root's value owner. Control adds Field policy/validity states. Slot exposes character/active/filled and no editor commands. Separator has an empty public surface.

The three Field-bound authored hooks also declare their existing typed `as-field-control` child-handle map under `C-AS-HOOK-0009`; validity is not flattened into direct borrowed handles. This follows the existing Field binding contract, without another hook application or state owner. Implementation-only bridge diagnostics not listed in these public types are not newly admitted capabilities.

Explicit Base `defineAsHook` and `definePrototype` generics, followed by each family's prototype generics, prevent broad inference from erasing public types. Existing public `export * from './types'` entries expose the names; no shared registry or package manifest is changed.

## Evidence

- The unchanged capability assertions first produced 342 actual TypeScript diagnostics against the old public surfaces, including unknown getters and unused negative directives showing that invented keys were accepted. This is independent positive/negative consumer evidence, not equality between two unknown surfaces.
- The final public-subpath fixture covers all 75 Base/family non-Root entries. It verifies concrete getter/return domains, valid commands and child lookups, rejects invalid domains/commands/keys and explicitly rejects flattened Field validity.
- That same fixture passes against source entrypoints and against the freshly built declaration entrypoints: public Base/Shadcn/Neo dist plus the actual private Bootstrap/Liquid draft-build staging outputs. This is declaration-consumer evidence, not an npm publication or packed installation claim.
- Sixteen real WebComponent tests cover all 75 part instances in valid compositions, plus the three public child handles. Empty Label/Separator Exposes are checked as empty; no focus method is invented for Number step buttons or OTP slots.
- The final five-file focused run passes 70 tests: 16 public-part compositions, 6 numeric inputs, 12 family projections, 9 Form bridge/control cases and 27 arithmetic cases. The normal public builder passes its 16-package dependency closure; each private family's normal draft builder also passes. Existing Form parity consumer types remain green.

The public typing is intentionally tighter: arbitrary indexed Exposes are no longer accepted, and Root-only/editing capabilities are rejected on passive parts. No runtime method is removed or added. Full protocol definitions, richer Slider/OTP geometry, packed/host/native/visual evidence and independent admission remain open. No Full delivery item is checked.
