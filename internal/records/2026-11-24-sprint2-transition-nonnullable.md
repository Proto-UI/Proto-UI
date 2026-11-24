# Sprint 2: Transition's checked nonnullable source type

## Integration failure and repair

On integration tree `9622febc3b1ae5b2bc0fdc03d2501b032015c76d`, the unchanged Base Transition failed in both React and GPUI compilation. Its new `contextOpen` helper describes its source with `NonNullable<typeof openContextSource>`; the ordinary type parser reported `PUI1020` at that annotation. Existing enter/leave controls reference this helper, so deleting it as dormant would change authored behavior.

The type parser now filters null and undefined from an already checked value domain. It preserves the remaining types and permissions and keeps ordinary local/imported aliases ahead of the builtin utility. Unknown and any remain refused because their nonnull subset has no representation in the current type grammar. No prototype source or component-name dispatch was changed.

## Bounded evidence

A standalone Node check, capped at 768 MB, passed eight independent assertions covering false/zero/empty-string preservation, the empty result, nested nullability and readonly fields, Borrowed State identity, a shadowing local alias, a renamed type re-export, and unknown/any refusal.

The real Base Transition entry then compiled successfully for `react-dom-source-v1` and `gpui-source-v1`. These are source-generation results, not native execution receipts. The existing authored Transition regression expectation was updated to retain the newly authored `transitionClosedViewRetained` State, rather than erase that contribution from the checked source.

The coordinated regression completed with **39/39 source-value tests and 4/4 authored Transition tests**. The latter includes cold IR, original dependency provenance, changed machine behavior from supplied source and packaged source-resolution checks. A bounded TypeScript program over the five changed source roots and six related test roots plus their complete imported graph reported **0 diagnostics**. This is separate from the workspace-wide gate.

Other real consumers still have explicit separate boundaries: Drawer currently reaches Context aggregate evaluation-order analysis, and Bootstrap Collapsible reaches the `AsHookResult` intersection's indexed member type. This repair does not claim either consumer, the reached block-size channel, or the full original issue denominator is accepted.
