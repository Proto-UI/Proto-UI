# @proto.ui/prototypes-base

Base Proto UI prototype library for reusable interaction prototypes.

## Purpose

Provides the base Proto UI prototype library and reusable interaction prototypes that work with Proto UI adapters.

## Package Role

Prototype library package intended to be consumed together with Proto UI adapters.

## Install

```bash
npm install @proto.ui/prototypes-base@0.2.0-rc.7
```

## Family Imports

Prefer anatomy-family subpaths so consumers and generated facades do not load unrelated prototypes:

```ts
import button, { asButton } from '@proto.ui/prototypes-base/button';
import { selectRoot, selectTrigger } from '@proto.ui/prototypes-base/select';
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

## Select Interaction Notes

- `select.item.selected` tracks the committed select value.
- `select.item.active` tracks the transient popup navigation cursor and may move independently of selection.
- `select.content` delegates ArrowUp/ArrowDown/Home/End movement to `asFocusRoving`; the removed `useFocusRoving` compatibility helper must not be reintroduced.

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-text-control`

## License

MIT
