# Finf Form action and Checkbox Group quality repair

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This source successor addresses independent review findings for PR #872 on the 59218c40 snapshot. It does not promote any component lifecycle or assert full acceptance.

## Implementation and reference fidelity

- Base Form Submit/Reset now publish concrete FormActionExposes and FormActionAsHookContract, including disabled, hovered, pressed, focused, focusVisible and focusSelf. The shared local setup owns one asTrigger/asFocusable path, not a second Button protocol. Group/local disabled are combined without losing author policy; cancellation/unmount clears transient states. Actual consumer expressions are checked for Base and all four families, not merely equality between two possibly-erased surfaces.
- Shadcn Form actions use the existing Button skeleton, primary/secondary fills, hover, focus and disabled recipes. Brutalist reuses src/style.ts constants: DM Sans medium, 5px radius, 2px black outline, 4px hard shadow and the existing hover/press hit envelope. Bootstrap reuses button/paint.ts gradients and raised/pressed inset shadows. Liquid Glass keeps the existing opaque fallback and material intent, withdrawing the candidate when disabled or material=opaque and representing rest/pressed deformation separately.
- Every styled Checkbox Group Item/All now renders an aria-hidden passive SVG with an empty outline, check or mixed dash. Checked and mixed no longer rely on color alone. Existing Checkbox glyph grammar is retained per Shadcn, Brutalist and Bootstrap; this snapshot has no standalone Liquid Checkbox to claim as a local reference. SVG decoration owns no input, context, tab stop or activation.
- Rules stay in the owning setup for static source collection. Imported Bootstrap paint uses the collector-supported literal element access. No new generalized interaction or style abstraction was introduced.
- Twenty affected bilingual Form/Checkbox Group docs describe the concrete public surfaces and fallback boundaries. Existing DemoSpecs consume these actual atoms; no substitute fixture-only implementation was added.

## Focused evidence and failures

- 207 focused tests pass across the new 16 action/material/glyph cases, existing Form/composite/numeric/range/Field cases and TextControl tests. The new cases cover one activation, controlled proposal ownership, disabled round trips, focus-visible state, unmount reset, family glyph geometry, material candidate withdrawal and actual collector-to-CSS output.
- Source-consumer TypeScript checks include ten Base/family action usages, positive boolean/method calls, invalid assignments, invented methods, borrowed hook handles and Liquid material prop boundaries.
- All 20 edited MDX pages compile with the repository MDX compiler. Workspace TypeScript still reports two existing missing generated Shadow CSS fixture imports (shadow-s3/admission and shadow-s4/dialog); that project is not claimed green.
- Real collector failures were retained and repaired: helper-owned rules lost selector identity; the shared collector lacked Form/CheckboxGroup known-hook mappings; imported object dot access dropped Bootstrap fills. Rules were moved into setup, integration supplied fdbbfb29, and literal element access preserved the existing passive paint references. The final strict Form-only source scan proves focus/disabled/hover/press and Bootstrap/Brutalist physical CSS without relying on unrelated Button selectors.
- A tsx CLI diagnostic encountered an EPERM IPC socket restriction. It was not retried with escalation. Authorized Vitest source tests provide the collector evidence.
- The connected publication route uses live read-only GitHub identity/repository/write-permission checks and ordinary local git hooks/DCO. Prior unavailable gh publisher execution is not represented as a successful publication.

## Open gates

Actual browser pixel captures (including keyboard focus and mixed-state visibility), optical/native rendering, four-Adapter/compiler/GPUI behavior, packed-consumer verification, safe-area checks, exact-head CI and independent review remain separate evidence. A true focusVisible state or emitted CSS is not screenshot evidence. No native GUI or Rust execution occurred, and this repair alone does not justify a completion score of 1.
