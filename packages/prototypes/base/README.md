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

## License

MIT

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

`asFieldControl` is the generic finite-value reporting/association bridge; `asFieldTextControl` is the default text-editor authoring entry. A custom control explicitly consumes the effective policy and reports its canonical value; it declares its existing focus/activation operation with `asControlLabel().target(callback, FIELD_LABEL_PAIR)` to reuse the actual native-input and lifecycle guards. The pair is setup-only, never a Prop or Context value.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.
