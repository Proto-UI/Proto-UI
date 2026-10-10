# Finf Field independent review repairs: FIELD-R1 / FIELD-R2

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Source and scope

This is a successor delta for [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872), over the frozen Field family patch `af9dc939893f04e07aa23aed3cfab5c62cf8766d8eb30af18653c21cad9775cd` and its ControlLabel anatomy dependency `9d9c5a7df128fed5cd996b4a9d93d9967dddd3442773fc7298da1679e3c4fda6`, both based on commit `7f4590c66497c4650459fb7e96398affde40be8e`. The frozen packages remain unchanged. No Fieldset/Form, native host, module bridge, publication or repository-rule change is included.

Independent review reproduced three failing cases: a Control-local readOnly true→false transition accepted an old validation result; sparse values passed `Array.every`; and sparse errors spent the pending request before Context rejected undefined, leaving poisoned state. The exact reviewer tests were copied to the separate successor workspace and rerun before the repair: 3/3 failed, including the Context error and its unhandled cleanup consequence.

## Repair

- Compare both edges of effective disabled/readOnly policy, rather than only the rising edge. A readonly request cannot survive re-enabling edits.
- Capture dense arrays by own index, with one read of each item. Holes and inherited slots are rejected. Caller-provided iterators cannot replace the values that were validated.
- Normalize the complete Field control report and validation result before changing retained state or consuming a pending request. Invalid initialValue/errors are rejected even when the field would otherwise ignore or not display them.
- Do not wrap payload-read exceptions: preserve their exact identity and the still-valid pending request. After a potentially reentrant payload read, recheck the original pending object/revision/Control lease; a newer request or report wins.

## Evidence boundary

The original three reviewer cases are retained, with ten additional cases covering sparse initial values, holes at each array position, inherited slots, same-id recovery, payload-read exception identity, single reads and newer reentrant owners. The successor passes all 13 cases plus the prior 24 Base tests. The four Web Adapter suites each pass 25 shared cases across Base and four actual style families (137 total for this focused group).

The delivery packet retains the red and green logs and full affected-scope checks. These are synthetic-DOM/runtime/peer checks. Native Chromium remains blocked by socket EPERM; actual GPUI TextControl, native accessibility, AT and optical gates remain open. The full Finf completion checkbox remains open. Apply this delta only after independent review on the integrated source, then rerun exact-head checks.
