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
npm install @proto.ui/adapter-base@0.3.0-alpha.1
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
- `@proto.ui/module-feedback`
- `@proto.ui/runtime`
- `@proto.ui/types`

## License

MIT

### Draft bounded accessibility preferences

`createDefaultWebPreferenceSource(getter)` is a separate, fixed-key source. It is paired only with the default getter in WC, React, Vue 3 and Vue 2. Authored Rules can read `preference.reducedMotion`, `preference.reducedTransparency`, `preference.contrast` and `preference.forcedColors`. Values follow the explicit media-query alternatives; unavailable, ambiguous, unobservable or unmatched input is `unknown`. Existing `reducedMotion` remains sampled.

Rule Meta exposes the new keys only with a matching active mounted lease. Source loss or getter mismatch immediately removes the current Rule contribution, rather than retaining stale enhancement. Subscriptions are dependency-driven, shared per Document/query and released on detach/disposal. These facts do not claim native/Compiler support or any material rendering fidelity; see `C-RULE-PREFERENCES-0001` and #793.

`createDefaultWebStyleSupportSource(getter)` separately declares two finite default-Web pipeline facts: `styleSupport.alphaFill` and `styleSupport.backdropBlur4px` (`true | false | 'unknown'`). The exact alpha path is the token pipeline's 80% `color-mix(in oklab, var(--pui-secondary) 80%, transparent)` fill; blur is only `backdrop-filter: blur(4px)`. The provider applies necessary CSS syntax checks, while real consumer pixel evidence remains a separate admission requirement. This is not full Glass, arbitrary optical rendering, native or Compiler support. Source loss fails closed through the same mounted lease discipline; custom getters are never implicitly paired.

### Web Portal direction

`retainWebPortalDirection(target, getOrigin)` is the shared Web host projection used by the four Overlay portal bridges. It leases an inherited `dir` from the actual author position, follows ancestor `dir`/class/style changes, origin reparenting and viewport resize, and releases its own attribute, observers and resize listener on detach. The resize signal refreshes viewport-dependent CSS media queries; arbitrary CSSOM edits, media-preference changes and container queries have no dedicated invalidation signal. An explicit target `dir` (`ltr`, `rtl` or `auto`) and target CSS keep their authored priority. React and Vue retain a hidden, inert renderer-owned origin marker so ordinary DOM wrappers between Proto owners are included. Minimal renderer runtimes without `Fragment` retain the logical Proto-root fallback.

This is bounded Web direction preservation under draft `HC-OVERLAY-PORTAL-0001`; it is not a portable Proto direction state, a blanket copy of inherited CSS, or a native paint certification. React, Vue and Vue 2 expose `dir` as a host prop as well as retaining a Prototype's declared `dir` input when present.
