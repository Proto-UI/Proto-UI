# Progress and Meter nullable current-value projection repair

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Reproduced integration defect

The first shared range projector accepted only number-valued `valueNow`. Progress and Meter deliberately use a string state: the finite numeric value is serialized as decimal text and Progress uses an empty string for an indeterminate value. Consequently all five families rendered their values but omitted `aria-valuenow`.

The actual family readout test gained attribute assertions before the repair. All ten Progress/Meter tests failed on the missing current-value attribute. This was a real source integration mismatch, not an external CI warning. The prior entrypoint-only smoke did not inspect this attribute.

## Bounded repair

The shared Web A11y projector and generated native-DOM helper now accept decimal numeric text for `valueNow` only when it matches a finite JSON-number-shaped decimal/exponent representation. Empty strings withdraw the attribute. Whitespace, hexadecimal, leading-zero forms, leading plus, NaN, infinities, overflow and nonnumeric text are rejected. Number-valued minimum, maximum and current values retain their finite-number rules; no application value ownership changes.

## Verification

- The ten actual Base/four-family Progress and Meter tests now verify the current attribute, clamping/update and indeterminate withdrawal.
- Shared-projector tests cover valid zero/negative/fractional/exponent text and twelve malformed or indeterminate string cases.
- A generated Web Component source is executed with a string current value and then cleared to an indeterminate value.
- These focused tests supplement the first-source record. Native assistive-technology, GPUI/Qt physical output, all generated targets, visuals and full Finf acceptance remain pending.

This repair is appended after the frozen first-source evidence; earlier source commits, proof and failing observations are retained.
