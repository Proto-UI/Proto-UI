# Same observed target: native visibility resampling

## Initial preparation status and authority (03:45 UTC)

Static candidate against main `89199db6de3be507aa7137949083aeda679bb564`. No new product or test source has executed. This is a bounded part of #1177, linked to #1159, #1132 and #1149, not closure of the full Focus group or Apple visual acceptance. Existing draft `C-AS-FOCUSABLE-0001`, `C-FOCUS-0001` and `D-FOCUS-STATE-INTERACTION-BOUNDARY-0001` retain their lifecycle.

## Independent responsibilities

1. A new explicit request is still a new latest-wins intent, including policy, readiness, retry accounting, cancellation and reentrant supersession.
2. An already observed current owner's visibility can need refreshing without another focus event. A supported native query remains authoritative, including true after a pointer request. Unsupported/throwing queries retain the existing modality fallback; a request does not manufacture ownership.
3. Omitting a redundant native effect requires a separate reliable proof that the requested physical target is already satisfied in its current view epoch. This candidate provides no such certificate and removes no host calls.

`isWebFocusTargetActive` checks only the target's own tree. It is not a deepest composed-target query. `:focus` also matches a shadow host with a focused shadow-including descendant, so neither is sufficient to skip a necessary focus request. Logical instance tokens and retry generations do not, by themselves, certify the physical target. No closed shadow traversal, Select state owner, component-name branch or new general runtime interpretation layer is introduced.

## Candidate

The sole product file is `packages/modules/focus/src/create.ts`. After a native request succeeds and remains current, the Module refreshes visibility only when the request target equals its already host-observed target. The helper retains its focused/disabled and target-generation checks and adds the caller's original operation guard around the native query, preventing a reentrant newer request from receiving an older sample. Pending, rejected and throwing host effects do not enter the new refresh branch. Programmatic synchronous fact ownership is unchanged. Host capabilities, public API, four Adapter implementations, retry identity, readiness budgets and compiler code are unchanged.

Cost is one existing query on an accepted already-observed target request and a current-operation guard; there is no new subscription, DOM, state owner or stored modality. Repeated native focus cost is intentionally not optimized without exact-target proof. A family blur or `if (focused) return` shortcut would respectively erase legitimate UA visibility or lose modality refresh.

## Planned evidence, not results

The new Runtime/FocusCenter fixture has 14 statically enumerated cases. A controlled host effect deliberately emits no second host focus event. Only one element's `:focus-visible` query is controlled; other selectors delegate to its original method. The matrix includes supported true/false, keyboard/pointer fallback, unavailable/throwing query, unobserved target, rejection/replay, host exception, replacement target, same-target supersession, blur/disable, owner transfer and disabled admission. Repeated pointer requests explicitly retain all host calls. This is not native focus, cascade, paint or input-trust evidence.

First validation scope is the exact 26 source suites in the preparation plan, plus scoped types, format and contract/test authoring checks, on the same baseline and candidate with unchanged locked dependencies. The existing group B failures must be retained and compared, never relabeled as this fix.

Four real Adapter same-target lifecycle journeys, closed/nested-shadow native controls, independent compiled consumers and real browser/high-contrast paint remain separate acceptance. The current compiled Web support in `packages/compiler/src/native-interaction.ts` has its own direct `focusSelf` and visibility implementation; this Module change does not update it. Its native-equality and same-target behavior require independent owner work and source-bound evidence, not a claim of automatic parity.

## References

- [Issue #1177](https://github.com/Proto-UI/Proto-UI/issues/1177)
- [WHATWG focus and shadow-host semantics](https://blog.whatwg.org/focusing-on-focus)
- [CSS focus-visible heuristics](https://www.w3.org/TR/selectors/#the-focus-visible-pseudo)

No source publication, native execution, merge or production deployment is claimed by this record.

## Measured source-only checkpoint (03:59 UTC)

Exact candidate patch `e2178cdc85364bbec3afd73f406786aa22db0622881ffab0206549206b42efaa` and tree `0d6adf539476fc7a69c79f2231a3a9477890dca4`, against the same main89199 baseline with the identical new fixture, completed the fixed 26-suite matrix. The new controlled cases passed 14/14 on candidate versus 4/14 on baseline. All other 618 case statuses were identical: 10 existing preflight reentrancy failures remained with the same names and error headlines. Totals were 612/632 for baseline and 622/632 for candidate, not an all-green result.

Both scoped TypeScript checks passed. Spec stdout/stderr were byte-identical with seven existing schema/graph issues and no new changed-entity authoring error; full active mappings remained gated by those graph issues. Format found three own files needing restoration: this record, the new test, and T YAML. Product source and C definition format passed. Every source/output postguard was clean; original failures and complete logs/archives were retained.

The successful cases use actual Runtime/FocusCenter plus controlled host and query seams, not a native browser or four independently emitted consumers. No native-effect deduplication, native high-contrast paint, full Group B closure or production deployment is established. Pure formatting and subsequent metadata updates must retain their own hashes and verification, not relabel this checkpoint as execution of a later whole tree.
