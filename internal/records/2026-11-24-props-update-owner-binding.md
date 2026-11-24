# Sprint 1 #1453: exact update-flow owner and compatibility disposition

This follow-up resolves the existing identity/ownership question `C-PROPS-0014-Q-CORE-UPDATE-OWNER`. It does not promote lifecycle drafts, change a host default, add a synchronous-render guarantee, or claim that catalog authoring proves an application journey.

## Binding and authority

The current user asked to finish Sprint 1, including #1453's owner and compatibility condition. Tracing the current catalog identifies an existing owner: `C-LIFECYCLE-0003` already explicitly refines `C-PROPS-0014` and owns author update intent, runtime/host entry points, channel/render separation, scheduling and coalescing. Its `C-LIFECYCLE-0002` dependency owns ordering through actual commit completion. There is no competing cataloged owner to select or new lifecycle API to design for this question.

The change names that existing owner in `C-PROPS-0014`'s bilingual statement and criterion E rationale. Two related-contract links start at `0.3.0-alpha.2`, and the same-version revision records the resolved question ID. The obsolete owner question is removed from the open-question list. All five existing criteria texts, active status, historical version fields and previous revisions are retained. `C-LIFECYCLE-0003`, `C-LIFECYCLE-0002` and `C-COMPILER-OBSERVABLES-0001` remain draft. The separate render-time write-surface question remains in its existing owner; its latest catalog revision already states that it no longer blocks the read/re-entry criteria.

The earlier [implementation record](./2026-11-24-props-update-analysis.md) accurately retained the question as open at that stage. This is its later bounded ownership disposition. It is based on the user's completion request and the existing catalog's direction, not a fabricated human approval of all lifecycle semantics.

## Compatibility and migration

| Existing consumer/profile | Retained default and explicit choice |
| --- | --- |
| Runtime React Adapter | `autoUpdateOnPropsChange` continues to default to `true`; choosing `false` leaves Props delivery separate from requesting a view update. |
| Compiler React runtime-backed profile | Existing `host` Props update policy stays unchanged. |
| Compiler Vue 2 source | Existing `host` Props update policy stays unchanged. |
| Compiler React DOM, Vue 3 and Web Component source | Existing `explicit` policy stays unchanged; callers can select another admitted `propsUpdatePolicy`. |
| Compiler GPUI source | Existing `explicit` policy stays unchanged; unsupported host-policy selection still diagnoses. |

These are the current implementation/profile compatibility decisions from `packages/adapters/react/src/adapt.ts`, `packages/compiler/src/observable-semantics.ts`, `packages/compiler/src/targets.ts`, and the draft `C-COMPILER-OBSERVABLES-0001`. Recording them here does not activate that draft or assert universal Adapter parity.

An explicit consumer whose visible template should follow an input change retains a lawful update request at its intended refresh boundary. A Props watcher is one such boundary; event/lifecycle callbacks, authored helpers or an actual external public-handle request can also be lawful. Consumers that deliberately render only after a different signal remain valid. An admitted host policy makes the extra request a host-owned action; it does not change `applyRawProps` into an implicit commit. State and Context delivery remain their existing explicit-update channels. A remount keyed to the label is not required by this migration and would lose the continuity being verified.

The Compiler advisory remains non-rejecting and conditional. It warns about a closed authored graph with a direct render-time Props read and no authored request; it preserves unknown/external callable behavior and does not require a direct watcher. The current Shenko application already authors `watch(['label'], run => run.update())` and keeps the same component without a `key={label}` remount. That source fact and its independent application/browser acceptance are recorded separately; this catalog edit is not substitute evidence for them.

## Validation and retained failures

The base-aware whole-catalog authoring check passed for the one changed catalog input against `f14bdf350b0fed011b4817a60f691fc884436982`, using the same checker with Node's `--import tsx` entry. A focused before/after readback verifies identical criterion IDs/texts, lifecycle fields and old revisions, retained lifecycle draft statuses, and the exact versioned owner/profile links. No runtime source changed, so no new behavioral test or lifecycle-promotion evidence is invented. The existing `T-LIFECYCLE-0002` and `T-PROPS-0012` executable mappings remain the relevant direct-apply/no-render evidence.

Two failed attempts remain visible. The ordinary `tsx` CLI failed before running the checker because the local environment denied its IPC socket (`EPERM`); Node's loader executes the same script without that CLI transport. The first actual catalog run then rejected an unversioned new relation that would start before `C-COMPILER-OBSERVABLES-0001` existed. Explicit `since: 0.3.0-alpha.2` bounds corrected that authoring error, and the final checker passed. Neither failure is relabeled as a successful validation.

Exact source, prior candidate, logs, authority trace, readback and local handoff are preserved in [the owner-binding receipt](./evidence/2026-11-24-props-update-owner-binding/receipt.json). Parent integration owns the independent final review, commit, GitHub criterion write and readback. This record establishes the prepared and validated ownership change; it does not claim those external operations already occurred.
