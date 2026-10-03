# GPUI conformance: Base Checkbox before the Overlay-blocked families

Date: 2026-09-30

Status: non-normative short-term direction for #687. It changes the execution order of one family and nothing else.

Baseline: `2026-09-22-gpui-adapter-architecture-decision.md`, section "Conformance order": families run in project-history order, a wave reorders only by capability closure, and the Wave 0 remainder comes before Waves 1 to 4 in order.

## Observed facts

- Wave 0 Button, Toggle, Switch and Tabs, and Wave 1 Transition, have pull requests on GPUI (#713 to #731).
- The rest of Wave 0 (Hover Card, Dropdown Menu) and of Wave 1 (Dialog, Select) need the Overlay Module on GPUI. Whether its target-opaque change needs a decision packet first was asked on #687 on 2026-09-24 and is still open.
- The baseline gives Wave 2 Checkbox the closure "same closure as Switch plus indicator part". Every Module in it already has a GPUI realization with evidence in the Switch slices (#716 to #718). The indicator is a presentational part, as the Switch thumb is.

## Decision

The owner of #687 runs Base Checkbox now, ahead of the families that wait on Overlay.

- Checkbox stays in Wave 2. Its evidence counts for Wave 2 and claims nothing about Waves 0 and 1.
- Once the Overlay question is answered, the Wave 0 remainder and then Wave 1 continue in the baseline order.

## Non-goals

- No other family moves.
- No Overlay, Positioning or Boundary work.

## Review trigger

The answer on Overlay, or another family whose closure is complete while Overlay still blocks. That family would need a record of its own.
