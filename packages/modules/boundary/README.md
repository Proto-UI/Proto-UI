# @proto.ui/module-boundary

Proto UI module that provides interaction-boundary capability.

## Purpose

Provides boundary judgments such as click-outside and focus-outside so prototypes can react to interactions that happen beyond their own region.

## Current focus observation

`boundary.observe('focus.move')` requests host-proven current-focus samples. The Web bridge validates focusin against the current active element; Boundary reuses its disjoint-region classifier and emits `observation: 'focus.move'`. Pointer/focus samples share one press owner until release/cancel or a new key/press, without moving focus. Missing host support fails closed and reports a diagnostic. Native/Compiler focus sampling and browser-chrome focus loss are not implemented by this slice.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-boundary@0.3.0-alpha.1
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`
- `src/web/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-event`
- `@proto.ui/types`

## License

MIT
