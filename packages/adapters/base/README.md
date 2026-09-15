# @proto.ui/adapter-base

Base package for building Proto UI adapters.

## Purpose

Provides the base template, shared host wiring, and common runtime bridges for building Proto UI adapters.

`createDefaultWebColorSchemeSource(getter)` pairs a `createDefaultWebMetaGetter()` reader with lazy document-theme invalidation. Within one loaded module, subscribers share a root MutationObserver and color-scheme media-query listener; the last release removes both. Root dark markers take precedence, followed by explicit light and the system preference. Without Document or MutationObserver no source is supplied; without matchMedia the existing root-marker and light fallback behavior remains.

This is the default same-document light-DOM realization of [HC-COLOR-SCHEME-INVALIDATION-0001](../../../spec/host-caps/HC-COLOR-SCHEME-INVALIDATION-0001.yaml), which remains draft. It is not a general custom-provider, subtree-theme, cross-document or SSR interface.

## Package Role

Adapter foundation package used to translate Proto UI contracts into concrete host integrations.

## Install

```bash
npm install @proto.ui/adapter-base@0.3.0-alpha.0
```

## Internal Structure

- `src/events/`
- `src/gate/`
- `src/gestures/`
- `src/host/`
- `src/index.ts`
- `src/lifecycle/`
- `src/platform/`
- `src/public-types.ts`
- `src/types.ts`
- `src/wiring/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-expose-state`
- `@proto.ui/runtime`
- `@proto.ui/types`

## License

MIT
