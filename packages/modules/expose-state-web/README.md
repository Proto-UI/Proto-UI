# @proto.ui/module-expose-state-web

Proto UI module that provides web state expose capability for adapters.

## Purpose

Projects branded Expose State external handles into Web `data-*` attributes and CSS custom properties. The bounded draft authority is [M-EXPOSE-STATE-WEB-0001](../../../spec/modules/M-EXPOSE-STATE-WEB-0001.yaml); target responsibilities are defined by [HC-EXPOSE-STATE-WEB-TARGETS-0001](../../../spec/host-caps/HC-EXPOSE-STATE-WEB-TARGETS-0001.yaml).

The Module has no author facade and grants no State write or ARIA authority. It maps semantic names, applies type-dependent defaults and optional mode overrides, and subscribes to current values without structural rendering. The canonical boundary remains the owner; optional presentation mirrors receive only selector context.

Web subscriptions stop on host loss, unmounting, detach and terminal disposal. Remount replays current upstream State. Cleanup revokes bindings and future writes; restoring or deleting previously emitted DOM attributes/variables after target, mapping or mode changes remains an explicit open question. Rule optimization and native variant policy are a separate downstream slice.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0-alpha.2` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/module-expose-state-web@0.3.0-alpha.2
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`
- `src/utils.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-expose-state`
- `@proto.ui/types`

## License

MIT
