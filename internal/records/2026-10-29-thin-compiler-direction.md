# 2026-10-29 — Thin compiler direction and outstanding acceptance

This dated record preserves the maintainer's engineering decision and observed work; it is not normative public semantics or evidence of completion. See [the compiler completion standard](../compiler/atomic-lowering-completion.md) and the existing `spec/**` authority/lifecycle rules.

## Decision

Compile authored prototypes and their reached atomic abilities through compile-time IR into the direct final target representation. Do not deliver runtime IR interpretation, a second framework runtime, component-identity business dispatch or copied component protocols as the final design. React/Vue use their native reactive/lifecycle/component conventions; ordinary imports, props/events/slots and native mixing must work without a dedicated launcher. Necessary platform mediation such as overlay geometry, target-native state, event callbacks, ownership and cleanup remain allowed only when required by reached abilities.

The requested scope is full compiler completion, not a minimum Button implementation or a temporary universal interpreter. Patches may be bounded for safety, but all selected backend/operation/consumer acceptance remains due. No time estimate or percentage was measured.

## Static findings and deduplicated queue

Audited public baseline: `9ab0fcad0fd9b5b49513a6b335e5007abea2d844`; newly prepared compiler changes were not executed.

- [#1055](https://github.com/Proto-UI/Proto-UI/issues/1055): React source's broad interaction gate reaches `createNativeInteraction` -> `createNativeAdapterModules`, with eager shared state/support. Context/style artifacts are unconditional. Some attach functions guard declarations: this is not evidence that every capability executes or every emitted byte survives bundling. Extend actual reached-capability closure and native framework behavior consistently across four DOM source backends.
- [#1056](https://github.com/Proto-UI/Proto-UI/issues/1056): GPUI's emitted `Value::Template`/Node and generic `paint` path performs runtime semantic projection; typed/direct native lowering and reached host support remain due. The copied SDK is generated-source delivery, not a measurement of final linked retention.
- No direct production switch on Button name/path was found in this bounded static audit. Transition is nevertheless specially recognized through `PACKAGED_HOOKS` and its phase/duration/interrupt/public-expose protocol is duplicated in DOM/GPUI helpers. Preserve existing [#1018](https://github.com/Proto-UI/Proto-UI/issues/1018) history and verify status/ownership before continuing that canonical subject. Overlay role-default policy and `focusSelf` parameter-name inference are additional red-test candidates, not proven failures from execution.
- [#732](https://github.com/Proto-UI/Proto-UI/issues/732)/[#733](https://github.com/Proto-UI/Proto-UI/issues/733) remain general pipeline/native-mixing coordination; [#758](https://github.com/Proto-UI/Proto-UI/issues/758) owns neutral cost measurement. [#902](https://github.com/Proto-UI/Proto-UI/issues/902)'s frozen private source bank is not taken over.

## Existing work preserved

Relational PR [#1024](https://github.com/Proto-UI/Proto-UI/pull/1024) head `43acbc4b4c5ab32bfe35863c562d1f0142577ab6` remains independent. Its approved fixed `418a42b` + test-patch projection has 221 compiler tests, type-check and documented native original/equivalent/negative evidence; those results do not certify the new atomic architecture or the whole current tree. Its exact-head aggregate CI still fails at the catalog baseline (497 errors), before compiler tests; successful individual checks do not make the aggregate green. Earlier cache-contaminated native evidence remains excluded, and failed controls/history are preserved in that PR's record.

## Ordered next work and stopping boundary

1. Complete source/IR/target/helper and operation-family inventory; resolve shared-definition gaps without copying implementation into authority.
2. Bind bounded ownership, then implement the transitive demand plan and complete DOM native vertical slices under #1055; propagate across all four DOM targets.
3. Implement direct typed/template GPUI lowering under #1056, preserving relational, ownership and host semantics.
4. Reconcile canonical Transition work and other independently reproduced protocol/heuristic findings; no duplicate issue or blind intrinsic deletion.
5. Complete every implemented backend's full ordinary-consumer/operation matrix, semantic controls and separate generated/bundle-link/initialization evidence.
6. Close only on actual independent acceptance and exact-head checks. Qt/Flutter/SSR remain explicitly unavailable until separately implemented and accepted; registry implementation is not whole-component parity.

New queue creation and this documentation are not a published implementation claim or passing runtime evidence. Future executions require their own applicable fixed-source approval. No product source, dependency, target feature, workflow, protection or spec lifecycle changes are made by this record.
