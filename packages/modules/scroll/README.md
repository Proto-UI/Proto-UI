# @proto.ui/module-scroll

Proto UI module that provides host-mediated scroll capability for adapters.

## Purpose

Owns stable logical surface identity, observed normalized facts, requests and system/composed projection negotiation. State stores facts; Context and Anatomy bind composed Scrollbar/Thumb controls to the same session. The host owns geometry, scrolling engine, physics and input integration.

Only current mounted session facts are accepted. Host replacement, detach and terminal disposal invalidate previous callbacks and release the lease. Missing host support leaves projection unresolved; an unavailable required projection diagnoses rather than silently downgrading.

The draft `M-SCROLL-0001`, `HC-SCROLL-SURFACE-0001` and `T-SCROLL-0001` graph covers four Web Adapters, including composed Thumb Move Gesture. Simulated geometry evidence does not certify browser physics or non-Web accessibility. Virtualization and A11y API redesign remain separate work.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-scroll@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/projection.ts`
- `src/types.ts`
- `src/web/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-base`
- `@proto.ui/module-context`
- `@proto.ui/module-state`
- `@proto.ui/types`

## License

MIT
