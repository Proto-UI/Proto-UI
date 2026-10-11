# Prototype-state style collection: owner handoff

Date: 2026-10-10. This is a source-bound failure report, not a new language definition or collector implementation plan.

## Reproduced input and result

At local source `498c50be8689938ac37b8fce875cc3466601e70a`, invoking the existing `collectProtoStyleTokens` separately on each family's `src/calendar` directory produced:

| Family          | All collected tokens | Collected `data-*` state-variant tokens |
| --------------- | -------------------: | --------------------------------------: |
| Shadcn          |                   35 |                                       0 |
| Brutalist       |                   34 |                                       0 |
| Bootstrap 2.3.2 |                   34 |                                       0 |
| Liquid Glass    |                   35 |                                       0 |

The actual Calendar Day sources declare rules over captured `selected`, `disabled`, `outside`, and `focusVisible` states. The zero state-selector result is a real generated-resource gap; broad family or website unions can accidentally contain similar tokens from unrelated components and hide it. A successful runtime state test does not prove that those components' required conditional CSS is in a generated consumer artifact.

Read-only reproduction uses `collectProtoStyleTokens(path.resolve('packages/prototypes/<family>/src/calendar'))` from `packages/cli/src/services/prototype-style-tokens.ts` and inspects the returned conditional tokens. No input prototype is executed by that source collector.

## Applicable definitions and implementation observation

- `C-AS-HOOK-0006` and `C-AS-HOOK-0007` are **draft** contracts describing captured caller results, borrowed state handles, declaration-name identities, and preserved nested child results. In particular, `C-AS-HOOK-0007-F/G/H` distinguishes declaration identity from expose keys and forbids implicit nested-state flattening.
- `D-AS-HOOK-STATE-HANDLE-NAMING-0001` is **draft** and records both the naming direction and remaining state-name/semantic projection questions. It is not permission to invent CSS identity from a component name.
- `C-AS-HOOK-0005-D` and `D-AS-HOOK-CAPTURE-BUCKET-0001` keep runtime capture buckets internal. A public definition review must not stabilize those buckets merely because an implementation currently uses them.
- The present collector resolves relative imported token bindings, then uses `resolveKnownAsHookStateHandles` for a finite hardcoded hook-name table. It has no general source-derived interpretation of the Calendar hook result or its nested public `getAsHookHandle('as-button')` access. This is an observation, not a request to extend that table.

The prototype owner must still establish that each actual declaration follows the applicable shared definitions. The collection result alone does not prove that the declaration is invalid, and valid prototype syntax must not be distorted merely to satisfy this source-analysis subset.

## Current workstream boundary

The owner explicitly reserved Compiler and prototype-interpretation work to the existing responsible owner. This includes semantic source tracking in a tool named CLI: package naming does not relax the boundary. This workstream therefore made **no Calendar whitelist or generic capture-interpreter repair** and will hand the failure and definition references to that owner.

The earlier unpublished commit `fdbbfb2918d048ce66c2bcef9b7e48a775c1b4fa` added Form/CheckboxGroup known-hook state mappings before this boundary was clarified. It remains a separately recorded historical candidate and is **excluded from the fifth publication candidate**. The local Form quality suite's conditional-CSS successes depend on that candidate; they must not be attributed to a fifth source that excludes it. The prototype owner's eight focused selector checks are expected to expose that missing capability there, and must remain intact. Other behavior and public-type results require their own candidate-bound rerun.

Normal resource-list generation and review of the independently scoped static family dependency closure may continue. Neither a resource refresh nor existing website-union output cures missing state interpretation. Calendar/Form visual completion and a completion-score promotion remain blocked until the appropriate owner's real implementation and source-bound consumer evidence close the gap.
