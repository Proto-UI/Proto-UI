# @proto.ui/module-context

Proto UI module that provides context capability for adapters.

## Purpose

Provides context capability to adapters running Proto UI prototypes.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-context@0.3.0-alpha.1
```

## Optional ancestor reads (draft Runtime extension)

Nested providers can observe the same key from the nearest strict logical ancestor:

```ts
def.context.provide(key, ownInitialValue);
def.context.trySubscribeAncestor(key, (run) => {
  const outer = run.context.tryReadAncestor(key);
  // Compose outer with owned state, then update this provider if needed.
});
```

Declare ancestor intent during setup. Reads return `null` when no ancestor currently provides the key. This intent is independent of ordinary `subscribe` / `trySubscribe`; those retain self-first resolution. Ancestor intent grants no ordinary read or consumer write authority.

Reads and notifications resolve current supplied logical ancestry. Removal or reparenting alone does not emit a value callback; consumers that need to refresh derived state after a lifecycle change must read again in that lifecycle callback. Unsubscribe stops the named callback, and terminal disposal removes the owner records. Provider replacement, reparenting and disposal invalidate pending ancestor delivery.

This draft extension is exercised through the four Web Runtime Adapters. It does not add a renderer read API. Compiler profiles, GPUI, Qt and Flutter do not implement it and reject the source operation; they are not supported paths for this extension.

## Internal Structure

- `src/caps.ts`
- `src/center.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/types`

## License

MIT
