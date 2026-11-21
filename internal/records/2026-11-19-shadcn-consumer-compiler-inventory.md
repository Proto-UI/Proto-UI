# Compiling the shadcn families a consumer adopts: inventory after the first patch

Date: 2026-11-19. Non-normative record.

## Context

Shenko, a downstream consumer, adopts nine shadcn families: button, textarea, scroll-area, collapsible, drawer, toggle-group, input, separator and toggle. It wants to ship them as `react-dom-source-v1` compiler output instead of `adapter-react`. At `f29738eb`, every family stopped at the same first two layers:

1. **Missing source exports.** `@proto.ui/prototypes-base/<family>` had no `proto` source export.
2. **Module-scope data rejected (PUI1004).** Top-level data such as the shadcn style-id list, per-family token tables and `[...].join(' ')` was rejected as a runtime binding.

## What this patch changes

- **Source exports.** Every Base family export that has `src/<family>/index.ts` now declares a `proto` source export. The publish manifest derives the staged source closure from these exports, as it already did for Transition.
- **Immutable literal data at module scope.** The definition is in `internal/compiler/source-language.md`. In short:
  - such data is stored as a read-only view at every depth;
  - a `join` of literal strings is folded at compile time;
  - a `let` binding remains scalar-only;
  - the portable IR validator checks the same rule.
- **Inherited module requirements.** A descriptor may state `modules: <hook>.modules`, which reuses the Module declarations of a static `defineHook` or `defineAsHook` declaration.

## Where each family stops now

These are the first remaining diagnostic for each family, found by compiling the shadcn source with `react-dom-source-v1`:

| Family | Next diagnostic |
| --- | --- |
| button, toggle, separator, collapsible trigger | PUI1004 `Use a simple static identifier`: object destructuring in setup (`const { a, b } = handle`) |
| toggle-group root | PUI1020 `Array elements must be data values` (`base/src/toggle-group/root.proto.ts:56`) |
| toggle-group item | PUI1006 `Read of undeclared prop value` (`base/src/toggle-group/item.proto.ts:28`) |
| scroll-area root | PUI1006 `Context value does not match its declared key type` (`base/src/scroll-area/root.proto.ts:10`) |
| scroll-area viewport | PUI1006 `Arrays cannot leak semantic handles into data` (`base/src/scroll-area/viewport.proto.ts:31`) |
| collapsible root | PUI1020 `Unsupported ordinary value type TypeReference` (`base/src/collapsible/root.proto.ts:48`) |
| collapsible content | PUI1006 `Undeclared object member part` (`base/src/collapsible/content.proto.ts:22`) |
| input | PUI1006 `Outward payload does not match its declared data boundary` (`base/src/input/root.proto.ts:180`) |
| textarea | PUI1004 at `base/src/field/shared.ts:167`: an `Object.freeze({...})` table |
| drawer | PUI1003: Axis Input lowering is not implemented (`base/src/drawer/handle.proto.ts:2`) |

Object destructuring blocks the most families. It needs its own definition: a binding pattern with static keys, lowered to member reads of one evaluated value. It is the next delivery unit.

## Update: object destructuring

Object destructuring in declarations is now admitted (see `source-language.md`). With it, button, toggle and separator stop one step later, at `asX().stateHandles`, and report `Undeclared object member stateHandles`.

Core types an as-hook result's `stateHandles` as the borrowed handles of its named states, and the runtime collects them after setup. The compiler instead models an as-hook result as an opaque capture that is read through `getState(name)`, and its capture schema is an upper bound in which every state may be absent. To lower `stateHandles`, two things need a definition first:

- which states an installation definitely declares;
- whether `stateHandles` is present whenever an as-hook has no `projectHandle`.

Writing the definition is the next delivery unit.

The `scroll-reveal-consumers` React case failed intermittently in full-suite runs. It fails in about half of the runs on this branch, and passes when run alone and when run on `origin/main`. The family's generated output (`compilation.json`, `writer.json` and `output/`) is byte-identical between `origin/main` and this branch, so the failure is timing in the test harness, not a change in lowering.

## Update 2026-11-20: `stateHandles` defined

The `stateHandles` lowering is now defined in `source-language.md` ("As-hook `stateHandles`"), but not implemented. Implementing it touches three places:

1. the parser: definite-declaration analysis over the winning as-hook setup, and the `capture.stateHandles` member read;
2. the operation result typing;
3. native support: the JS support object and the GPUI Rust support each gain the frozen record.

It then unblocks button, toggle and separator as far as their next diagnostic.

## Update 2026-11-21: String(), joined tokens, helper-returned rule states

Upstream main now implements `stateHandles`. This patch admits three more forms:

- `String(value)`;
- joined style-token constants;
- helper-returned state handles in rules.

| Family | Next diagnostic |
| --- | --- |
| separator | Clears the frontend. It now stops at the target: `react-dom-source-v1` does not implement `props.watchAll` or `props.watchRaw`. |
| button, toggle | `for...of` statements (resolved below) |

The other families are unchanged.

## Update 2026-11-21: static loop unrolling

Static `for...of` loops are now unrolled, and literal-only branches are decided at compile time.

| Family | Next diagnostic |
| --- | --- |
| toggle | Clears the frontend. It now stops at the target: `props.watchRaw` is not implemented by `react-dom-source-v1`. |
| separator | Also stops at the target: `props.watchAll` and `props.watchRaw`. |
| button | Stops at rule `w.meta('colorScheme')`, which appears 101 times across the families. Rule metadata needs its own host-capability definition. |
