# Finf Calendar input follow-up

Date: 2026-10-10 UTC. Successor source fix; no frozen Finf snapshot or lifecycle status is rewritten.

## Findings verified against actual consumers

The PR 872 reports identified by discussion IDs `r4236865842` and `r4236865845` were treated as hypotheses and independently reproduced in the local Web Component consumer:

- `defaultValue: '2026-10-10'` and controlled `value: '2024-02-29'`, without month props, both displayed `1970-01`. The defaulted `defaultMonth` prevented the existing selection-derived initialization path.
- `unavailable: {}` and an array-like object threw `TypeError: (p.unavailable ?? []) is not iterable` during mount. An array with non-string entries also lacked a shape boundary.
- The new negative suite had five failing cases and ten passes before the source repair.

## Repair

Remove only the implicit `defaultMonth` prop default. Existing month initialization now derives from the initial selected date when no month props are supplied, retains explicit controlled month/defaultMonth precedence, and still uses deterministic `1970-01` for empty or invalid initialization.

Keep the existing object Prop kind and add an array/string-item validator. Invalid initial shapes fall back to the empty default; invalid later updates retain the previous valid array according to the existing Props boundary. Date availability continues to consume a copied validated array. No new host special case or invented array Prop kind is introduced.

Bilingual Calendar docs now describe month precedence and invalid input handling. Four family consumers and the Date Picker composition exercise the inherited selected-date month initialization.

## Evidence and limits

- Calendar focused tests: 15/15 passed after repair, including explicit month/defaultMonth precedence, empty fallback, controlled/uncontrolled initial dates and malformed initial/update shapes.
- Six-file Group C suite: 57/57 passed.
- Scoped Calendar/Date Picker/composition TypeScript and `git diff --check` passed with pinned offline pnpm 10.32.1.
- This source/test checkpoint does not claim native GPUI/Rust, real-browser visual acceptance, whole-workspace success or complete Finf acceptance. The prior ExposeStateWeb record retains its actual broader type/spec-check blockers.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
