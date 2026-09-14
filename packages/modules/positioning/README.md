# @proto.ui/module-positioning

Proto UI module that provides host-mediated anchored positioning for overlays.

## Purpose

Provides collision-aware placement policy and host leases so prototypes can position floating content relative to an anchor without owning browser geometry APIs.

## Contract and lifecycle

The draft catalog is defined by `C-ANCHORED-POSITIONING-0001`, `M-POSITIONING-0001`, and `HC-ANCHORED-POSITION-0001`. The module retains a connection and categorical snapshot; Overlay owns active-view connection lifetime. The Web host uses Floating UI for geometry and preserves `transform` for downstream styling.

Only the current computation of a live lease may publish coordinates, size variables, or resolved placement. Replacement and disposal invalidate pending work; disposal stops observation and cannot be reversed by updating the old lease. A missing host retains the declaration without projecting geometry.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-positioning@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`
- `src/web/floating-ui-host.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`

## Runtime Dependency

- `@floating-ui/dom`

## License

MIT
