# @proto.ui/module-anatomy

Proto UI module that provides anatomy capability for adapters.

## Purpose

Owns family role claims, nearest-root domains, Expose-backed part views, diagnostics and host order. It consumes static Core family declarations and depends on Expose.

The bounded catalog is [M-ANATOMY-0001](../../../spec/modules/M-ANATOMY-0001.yaml), with [logical structure facts](../../../spec/host-caps/HC-ANATOMY-STRUCTURE-0001.yaml), [private host order observation](../../../spec/host-caps/HC-ANATOMY-ORDER-0001.yaml), and [T-ANATOMY-0004](../../../spec/tests/T-ANATOMY-0004.yaml). These entities remain draft.

`claim` and `subscribeParts` registration are setup-only. The unsubscribe function returned to an author is also setup-only. Queries are runtime reads; public PartView never exposes host targets.

Claims and subscription declarations survive repeatable view detach/remount; host observers stop while detached. Terminal disposal removes owner claims and releases listeners. Internal domain and target ports serve downstream modules without becoming author APIs.

After updating logical ancestry, the Web Component Adapter calls the internal `AnatomyPort.syncStructure()` ingress. Retained membership subscriptions reconcile independently of view mounting; this does not restart detached host-order observers or add an author API or Host Capability.

On reconnect, the Web Component Adapter recomputes its inferred logical parent, including moves outside all Proto ancestors. If `syncStructure()` rejects a reused owner's structural admission, the Adapter restores the previously accepted logical binding and reconciles membership before propagating the original error. A failure of that restoration is reported together with the admission error. This is not a transaction for author-owned DOM moves; other Adapters' explicit logical ancestry remains unchanged.

Family derivation, non-hook requirements and ordinary author missing-query policy remain outside this slice. Anatomy does not own A11y relationship semantics, collection interaction policy or host materialization.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-anatomy@0.3.0-alpha.1
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/error.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`
- `src/web/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-expose`

## License

MIT
