# @proto.ui/module-positioning

Proto UI module that provides host-mediated anchored positioning for overlays.

## Purpose

Provides collision-aware placement policy and host leases so prototypes can position floating content relative to an anchor without owning browser geometry APIs.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-positioning@0.2.0-rc.7
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
