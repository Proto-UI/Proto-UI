# Finite physical style resource coverage

Date: 2026-10-10.

The owner approved a bounded extension to the existing style resource table, while reserving prototype interpretation, capture/state tracking, parser, and IR work to the other owner. This change adds six already-authored physical recipes to that table: negative quarter-rem inline margin, 100ms timing, a 1px composed ring, widest letter spacing, the literal 0.6875rem font size, and the literal #f5f5f5 background color.

The last two are exact, finite resource keys following the existing literal font-size and color entries. No new arbitrary-value parser, interpolation, general evaluation, component-name dispatch, or prototype semantic interpretation was introduced. Unknown or malformed values remain unsupported; the tests cover injected declarations, nonfinite text sizes, unregistered color forms, and invalid ring/timing tokens. Document and Shadow output share the same existing rendering path.

A real negative run produced six missing-resource failures and 45 passing tests. The repaired renderer passes all 51 tests. An earlier negative assertion incorrectly matched the existing baseline `color: inherit`; it was corrected to reject the actual forbidden injected/new declarations rather than the baseline, and the six resource failures were reproduced before implementation.

This does not fix the separately recorded Calendar/Form captured-state selector collection gap. It does not prove browser geometry, upstream visual fidelity, or non-Web realization. No budget or completion score changes here. Normal family manifests still need generation on the eventual selected source; this table does not manually insert conditional tokens into them.
