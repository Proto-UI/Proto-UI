# Calendar and Date Picker public type contracts

Date: 2026-10-10 UTC. Separate from Calendar visual fidelity and complete Finf acceptance.

## Actual failures and correction

The supplied fixed-snapshot TypeScript audit reproduced an unused expected-error for styled `month: 23` and `requestValue` resolving to unknown. Calendar's unannotated styled `definePrototype` wrappers had lost their Props and Exposes. Several Base Date Picker setups also used `any` before styling.

- Base Calendar atoms now declare their actual public Props and Exposes, including the Collection/CollectionItem instance surface and inherited Button controls. Empty-layout atoms reject arbitrary props.
- Date Picker's own and inherited Calendar/Popover/Transition instance surfaces are explicit; styled wrappers for both components use the specific atom's Props/Exposes.
- AsHook contracts describe real capture frames, not a flattened approximation of instance Exposes. Calendar's captured collection count is `collectionCount`; authored Button/Calendar/Popover children are reached through `getAsHookHandle`.
- Runtime capture exposed a pre-existing upstream typing mismatch: `asPopoverRoot` declares direct `stateHandles.open`, while its real open state lives in authored `useOpenState`. This patch does not alter the separately owned Popover source. Date Picker's local nested handle contract follows the proven `as-popover-root -> useOpenState -> stateHandles.open` path instead of repeating the false flattening claim; the owning integrator has the finding.

## Evidence

- Compile-only consumers cover every Calendar/Date Picker atom across Base plus four families, with invalid prop-domain and unknown-method negatives, real method/state positives, and captured/nested handle domain checks. Their file is `packages/prototypes/base/test/calendar-public.types.ts`, included by ordinary workspace TypeScript discovery as well as the focused check.
- Runtime witness prototypes verify actual capture shapes and nested child paths. Their initial test caught the Popover direct-open mismatch before the local contract was corrected; final witness tests pass 2/2.
- Calendar, controlled navigation, public-handle witnesses, compositions and family consumers: 61/61 passed across five files.
- Focused Calendar/Date Picker source, family wrappers, public consumer fixture and runtime witness TypeScript passed with pinned offline pnpm 10.32.1.
- The original audit also reported an unrelated FormSubmit focusVisible type error; this record does not claim that separately owned subject was repaired.
- No styling recipe changes, native GPUI/Rust run, packed-package proof, real-browser visual acceptance or independent acceptance is claimed here.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
