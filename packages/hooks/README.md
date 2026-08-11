# @proto.ui/hooks

Proto UI built-in author-facing hooks.

## Purpose

Provides the built-in `as-*` hook DSL used by prototypes, while keeping runtime bridge mechanics out of `@proto.ui/core`.

## Package Role

Author-facing hook package for focus, overlay, trigger, collection, boundary, hit-participation, scroll-surface, and text-control helpers.

## Install

```bash
npm install @proto.ui/hooks@0.2.0-rc.7
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
