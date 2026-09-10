# @proto.ui/hooks

Proto UI built-in author-facing hooks.

## Purpose

Provides the built-in `as-*` hook DSL used by prototypes, while keeping runtime bridge mechanics out of `@proto.ui/core`.

## Package Role

Author-facing hook package for accessibility semantics, focus, overlay, trigger, collection, boundary, hit-participation, scroll-surface, and text-control helpers.

## Install

```bash
npm install @proto.ui/hooks@0.3.0-alpha.0
```

## Internal Structure

- `src/index.ts`
- `src/as-*.ts` (public hook entrypoints)
- `src/collection/`
- `src/privileged.ts` (privileged runtime bridges)

## Authoring Constraints

- Public author-facing hooks should prefer `def` / `run` public handles and should not depend on internal module ports unless the hook is explicitly privileged infrastructure.
- Runtime reads should target runtime-safe public APIs. Do not assume callback-only execution when the operation is a readonly query.
- Hook behavior must not rely on host thread scheduling details such as `queueMicrotask()` to stay correct.
- Hook behavior must not depend on event propagation phase semantics such as bubbling or capturing order.
- Reading normalized event data like `key` is allowed. Reading host-specific event target internals should be avoided unless the hook contract explicitly documents that dependency.

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-collection`
- `@proto.ui/types`

## License

MIT

## Accessibility semantics (0.3)

`asAccessible()` returns the current instance's `AccessibleHandle` (exported by `@proto.ui/core`). Repeated calls during setup return the same handle without resetting declarations. All declaration methods are setup-only, even on a saved handle; runtime values follow bound State handles. Scalar fields and same-key bindings use the final setup declaration; tree patches merge by field.

```ts
import { asAccessible } from '@proto.ui/hooks';

// Inside prototype setup:
const accessible = asAccessible();
accessible.role('button');
accessible.nameFromContent();
```

This declares host-projectable semantics; it does not install keyboard handling, focus movement, or guarantee complete accessibility. State and interaction owners remain unchanged. The handle has no dispose, generic runtime mutation, arbitrary host target, or public internal-relation port.

0.3 replaces `def.a11y` and `A11yDefAPI` directly, without compatibility aliases. 0.2 release history is unchanged; this migration is not backported.

A setup cannot register both an authored and a privileged hook under the same name. Runtime rejects that collision explicitly before reusing a handle or skipping setup; rename the authored hook when its name conflicts with a built-in.
