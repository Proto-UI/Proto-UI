# Runtime-switch layout and loading-mask acceptance

The maintainer has added two required follow-ups to Finf #872's existing #858/runtime-demo consistency work. These do not add completed items or reduce any of the 68 full-delivery obligations.

1. Reproduce and repair the vertical-spacing difference when an otherwise identical demo switches from WC to React or Vue. Compare the same family, content, viewport, theme, font, and input state; keep real-input before/after geometry and source-bound screenshots. Identify the responsible prototype, adapter, or composition layer instead of masking the difference with page-only margins.
2. Replace the bottom runtime-switch notice with a region-bound loading mask built from actual Proto UI primitives. Keep ownership at the preview region and cover rapid repeated switching, superseded loads, failure and retry, cancellation/unmount, pointer and keyboard interaction, focus, and accessibility announcements. The mask must clear for the accepted render, including failure recovery, without accepting stale work or trapping focus.

Both subitems are unaccepted. Existing source-unit or synthetic-DOM passes do not establish native layout, interaction, paint, or accessibility acceptance. Matched runtime screenshots and the complete applicable four-family/GPUI boundaries remain due.

This is a tracking record, not evidence that either user-visible repair has shipped. Implementation and exact-source evidence belong in the same Finf PR; no new implementation PR is required.

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
