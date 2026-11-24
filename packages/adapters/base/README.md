# @proto.ui/adapter-base

Base package for building Proto UI adapters.

## Purpose

Provides the base template, shared host wiring, and common runtime bridges for building Proto UI adapters.

React and Vue keep a pending view hidden until its authored style is ready. On reveal the shared guard suppresses incidental CSS transitions. A view with an explicit Overlay Presence binding begins its authored keyframes on the first visible frame.

When terminal Runtime disposal completes synchronously, `createAdapterHost().dispose()` invokes `afterUnmount` once and rejects with its thrown value, including falsy values. An earlier Runtime disposal failure remains the primary rejection on this path; repeated disposal returns the same completion.

An issued Expose State cancellation keeps its identity when returned again through the same Adapter reader, including inside a public record. A Module-issued cancellation revokes its own subscription without entering the retired owner, so it stays effective after reader invalidation. Every other authored function, including a `subscribe` method and a record carrying the external-handle symbol, stays an owner-bound callable with the callback-scope and terminal guards. New exposed calls still require a live callback scope.

`createDefaultWebColorSchemeSource(getter)` pairs a `createDefaultWebMetaGetter()` reader with lazy document-theme invalidation. Within one loaded module, subscribers share a root MutationObserver and color-scheme media-query listener; the last release removes both. Root dark markers take precedence, followed by explicit light and the system preference. Without Document or MutationObserver no source is supplied; without matchMedia the existing root-marker and light fallback behavior remains.

This is the default same-document light-DOM realization of [HC-COLOR-SCHEME-INVALIDATION-0001](../../../spec/host-caps/HC-COLOR-SCHEME-INVALIDATION-0001.yaml), which remains draft. It is not a general custom-provider, subtree-theme, cross-document or SSR interface.

## Package Role

`@proto.ui/adapter-base/web-material` exports `contactPaintOutset(width, height)` for layout space around the current draft Web contact profile. Pass the host's bounding rectangle width and height in CSS pixels; the result is the profile's paint outset in CSS pixels. It does not admit source pixels, optical effects or input ownership, and is not a general margin for other material profiles.

The canvas backdrop lease withdraws its frame before invalidating observers. It notifies the entire listener snapshot, then reports the first thrown value, including falsy values; disposal still retires its listeners. If painting has already failed, a secondary notification error does not replace that primary failure.

Adapter foundation package used to translate Proto UI contracts into concrete host integrations.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0-alpha.2` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/adapter-base@0.3.0-alpha.2
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
- `@proto.ui/module-positioning`
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

### Draft explicit shader scene source

The draft shader graph can request an application-owned scene by a finite slot, for example `source: { kind: 'owned-scene', slot: 'mainScene' }`. Bind that slot at the application host boundary. A Prototype never receives the canvas, lease, DOM element or a capture callback.

```ts
import { createWebShaderHost } from '@proto.ui/adapter-base';
import { createCanvasBackdropLease } from '@proto.ui/adapter-base/web-material';

// scope and canvas belong to the application; canvas is a direct scope child.
const lease = createCanvasBackdropLease(scope, canvas);
lease.draw((context, width, height) => {
  context.fillStyle = '#406080';
  context.fillRect(0, 0, width, height);
});
const shader = createWebShaderHost({ ownedScenes: { mainScene: lease } });
// Supply { shader } to the existing React, Vue, Vue2 or WC Adapter options.
```

The four native scene outputs export `createShaderHost` and `createComponent`. `createComponent(createShaderHost({ ownedScenes: { mainScene: lease } }))` returns the configured framework component, or a WC class for explicit `customElements.define`. The ordinary named/default export remains usable without configuration and shows the complete opaque fallback. Configuration is outside component Props, attributes and serialized state. Other native outputs do not add these exports.

This provider uses the entire opaque sRGB canvas frame as a texture over the shader surface's normalized UV coordinates. It converts that independent snapshot to the shader's linear premultiplied RGBA8 input. It does not crop an in-app backdrop, capture DOM paint or relabel the existing material backdrop path. The current source must share the shader surface's Document and contain it in its composed scope, including applicable ShadowRoots and slots. Frames must meet the shader's 1024-axis, 262144-texel and 16 MiB aggregate resource limits.

The application draws, revokes and finally disposes its lease. The shader only borrows `current` and `subscribe`; source change, scope loss, detach or disposal retires old decode and observation. Keep a published frame immutable and announce every change with a newer revision. Losing the source keeps the opaque fallback, and a restored current source can be accepted again. Read, subscribe, cleanup and reentrant-acquisition failures have explicit bounded handling.

This remains draft under `C-FEEDBACK-SHADER-PRESENTATION-0001` and `HC-FEEDBACK-SHADER-PRESENTATION-0001`. It does not establish other source-provider families, in-app-backdrop or non-Web shader support. The original 28 browser controls and nine scene controls require a current sandboxed-browser receipt and independent acceptance.
