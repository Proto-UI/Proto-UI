# Addendum: disabled focus rejection is representation-neutral

**Current disposition: changes required before freeze.** This addendum supersedes the source-adequate disposition in `review.json` (SHA-256 `c77ed629076e7d8e7e5572ced4e4fe79a96827a630d7fc8eac5a762670bd308d`). The earlier report is preserved. ORACLE-01, ORACLE-02 and ORACLE-03 remain corrected in source.

## ORACLE-04 — false rejection of a permitted ARIA-disabled control

Reviewed observer: `5076ef9cfc3abb26a3b83963a9fc70cb03991419b939e026a495697c6b3dbc7d`. The `disabledCanFocus=false` branch asserts `element.matches(':disabled')`. This conflicts with the common scope, which admits native disabled or `aria-disabled=true` and does not require the latter to retain programmatic focus.

An ARIA-disabled control can legitimately release focus immediately or retire its focus ownership while disabled. Requiring native `:disabled` after that behavior rejects a permitted implementation. I missed this valid branch in the initial source review; the adequacy verdict is withdrawn pending correction and calibration.

After an unsuccessful focus attempt, re-read both native and ARIA disabled state and require that at least one remains true. Record the representation, focus rejection and **keyboard not dispatched**. Keep actual Enter/Space checks for controls that retain focus. Do not replace this with synthetic event dispatch, route the events to another control, or count undispatched keyboard input as attempted or passing.

The owner reports that the exact generated artifact failed this branch while a native positive control passed. I have not independently read those browser artifacts, so this addendum makes no verified browser-result claim. The finding is independently established by the source predicate and the stated common contract.

Retain the original failure, fix the branch, and recalibrate a native disabled control, an ARIA-disabled control that rejects focus, and an ARIA-disabled control that retains focus. The targeted disabled-keyboard leak mutation must still fail when keyboard input is actually delivered. Follow-up acceptance must bind the corrected source and real calibration outputs.
