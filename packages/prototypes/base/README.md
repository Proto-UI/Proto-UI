# @proto.ui/prototypes-base

Base Proto UI prototype library for reusable interaction prototypes.

## Purpose

Provides the base Proto UI prototype library and reusable interaction prototypes that work with Proto UI adapters.

## Package Role

Prototype library package intended to be consumed together with Proto UI adapters.

## Install

```bash
npm install @proto.ui/prototypes-base@0.3.0-alpha.1
```

## Family Imports

Prefer anatomy-family subpaths so consumers and generated facades do not load unrelated prototypes:

```ts
import button, { asButton } from '@proto.ui/prototypes-base/button';
import { selectRoot, selectTrigger } from '@proto.ui/prototypes-base/select';
import { radioGroupRoot, radioGroupItem } from '@proto.ui/prototypes-base/radio-group';
```

The root package export remains available for compatibility. Compound anatomy parts share one family subpath. Shared authoring capabilities are available through `transition`, `tools`, and `behaviors` subpaths.

## Internal Structure

- `src/async-region/`
- `src/behaviors/`
- `src/button/`
- `src/checkbox/`
- `src/dialog/`
- `src/dropdown/`
- `src/hover-card/`
- `src/index.ts`
- `src/live-region/`
- `src/radio-group/`
- `src/scroll-area/`
- `src/select/`
- `src/separator/`
- `src/switch/`
- `src/tabs/`
- `src/textarea/`
- `src/toggle/`
- `src/tools/`
- `src/tooltip/`
- `src/transition/`

## Behavior Authoring Constraints

- Behavior-layer helpers in `src/behaviors/` own interaction semantics, but they should depend on public hook/runtime surfaces instead of internal ports.
- Behavior correctness must not depend on microtask timing or any other host thread-model assumption.
- Behavior correctness must not depend on event bubbling/capturing order. If one keyboard event must only trigger one navigation step, use an explicit event-local guard and document it.
- It is acceptable to consume normalized keyboard data such as `event.detail.key`. Avoid reading host-specific `event.target` details unless the behavior contract explicitly requires it.

## Radio Group Boundary

- Root is the sole selected-value owner; Items derive checked and effective-disabled state and only request selection.
- Focus Roving owns selected-or-first entry, wrapped both-axis arrows, Home/End, and disabled-item skipping. Space selects; Enter does not.
- Indicator is passive visual feedback. Native radio inputs, form behavior, public orientation/loop, Toolbar rules, and Shadcn/Radix compatibility remain outside this draft slice.

## Select Interaction Notes

- `select.item.selected` tracks the committed select value.
- `select.item.active` tracks the transient popup navigation cursor and may move independently of selection.
- `select.content` delegates ArrowUp/ArrowDown/Home/End movement to `asFocusRoving`; the removed `useFocusRoving` compatibility helper must not be reintroduced.

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-text-control`
- `@proto.ui/module-image-view`
- `@proto.ui/module-table-structure`
- `@proto.ui/module-native-link`

## License

MIT

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

`asFieldControl` is the generic finite-value reporting/association bridge; `asFieldTextControl` is the default text-editor authoring entry. A custom control explicitly consumes the effective policy and reports its canonical value; it declares its existing focus/activation operation with `asControlLabel().target(callback, FIELD_LABEL_PAIR)` to reuse the actual native-input and lifecycle guards. The pair is setup-only, never a Prop or Context value.

`fieldSelectTrigger` opts an existing Select into Field composition without replacing its Root value ownership. Controlled requests notify Field only when owner props change the canonical value, including acceptance after outward delivery. Each accepted canonical change retains a notification, including nested synchronous requests; notifications wait for the outermost outward callback to return, and view retirement cancels pending work. Rejected proposals do not validate their proposed values.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.

## Optional Field multiline composition

Use `fieldTextarea` or `asFieldTextarea` from `@proto.ui/prototypes-base/field` when a multiline editor participates in Field label, description, current error, policy and validation semantics. They call the same `setupTextareaRoot` as ordinary Textarea. They do not introduce a second editor or validator, and are not design-family-specific alternatives.

`setupTextareaRoot` and `TextareaRootSetupOptions` are public from the `textarea` entry. Its definition-time `{ fieldBinding: true }` option selects the existing Field anatomy pair and optional Field binding. AsHook calls remain argumentless. Custom definitions must reuse `asTextareaRoot.modules`. Default configuration keeps the existing independent `InstanceAssociations.controlLabel` association and external ID relations. The association modes are not combined at runtime.

Field composition rejects nonempty `labelledBy`/`describedBy` inputs because Field owns those relationships. `ariaLabel` remains available. The shared Props schema remains visible; those two conflicting values fail closed rather than silently replacing the Field relation. Read borrowed invalid/pending through `handle.getAsHookHandle('as-optional-field-control').state`, not a second local invalid state. Without a parent Field, local policies remain effective and invalid stays false. Native HTML validity is not a Field validity source.

Field policy-only updates preserve editing and do not report a partially updated policy back to Field. Canonical editing reports use the existing Field bridge; view disposal during an outward callback prevents late reports. Form reset and implicit submission are not added by this composition. Synthetic tests are not native input, assistive-technology or complete design-family visual acceptance.
