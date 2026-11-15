# @proto.ui/module-scroll

Proto UI module that provides host-mediated scroll capability for adapters.

## Purpose

Owns stable logical surface identity, observed normalized facts, requests and system/composed projection negotiation. State stores facts; Context and Anatomy bind composed Scrollbar/Thumb controls to the same session. The host owns geometry, scrolling engine, physics and input integration.

Only current mounted session facts are accepted. Host replacement, detach and terminal disposal invalidate previous callbacks and release the lease. Missing host support leaves projection unresolved; an unavailable required projection diagnoses rather than silently downgrading.

The draft `M-SCROLL-0001`, `HC-SCROLL-SURFACE-0001` and `T-SCROLL-0001` graph covers four Web Adapters, including composed Thumb Move Gesture. Simulated geometry evidence does not certify browser physics or non-Web accessibility. Virtualization and A11y API redesign remain separate work.

## Optional end-follow

Prototype and composition authors reach end-follow through the privileged `asScrollSurface()` handle:

```ts
const scroll = asScrollSurface();
scroll.configure({
  axes: 'vertical',
  projection: 'auto',
  endFollow: { mode: 'while-at-end', axis: 'vertical' },
});
```

The handle exposes per-axis `atEnd` plus read-only `endFollow.state` and `endFollow.requestStatus` facts. A jump control sends `scroll.request({ kind: 'to-end', axis: 'vertical' })`; it never receives a DOM node, offset, extent, or pixel threshold.

The policy is off by default. The host owns proximity, layout observation, coalescing, input interruption, and direct end movement. Message counts, unread state, focus, announcements, visual-anchor preservation, and virtualization remain separate owners.

## Target reveal (draft Web runtime)

The draft `C-SCROLL-TARGET-REVEAL-0001` profile adds a vertical request through the same handle. The caller passes the current `AnatomyFamily` and `AnatomyPartView` obtained from its logical composition:

```ts
scroll.request({ kind: 'reveal', axis: 'vertical', family, part });
```

The target must be a current descendant in the same family whose nearest ancestor with the surface's role is this surface. The Module validates this membership and the mounted lease; the Web host resolves the physical target and performs the nearest movement within that surface. It preserves input focus, horizontal position and ancestor scroll positions. Scroll padding and target scroll margins affect the preferred alignment, which is clamped to the native range. A row taller than the viewport can expose its nearest edge without becoming fully visible.

Unavailable, pending, unsupported or retired targets are rejected. Reveal requests are never queued or replayed onto a later view. A `dispatched` outcome confirms current host delivery; it does not guarantee visibility through external clipping. Callers still own a usable bounded layout and the decision to request reveal after an accepted navigation change.

This profile currently covers the Web runtime path. Compiler lowering, non-Web hosts and horizontal reveal require separate implementation and acceptance evidence. `T-SCROLL-TARGET-REVEAL-0001` distinguishes model regressions from the native Search consumer journeys; the draft status is not a cross-target compatibility guarantee.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0-alpha.2` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/module-scroll@0.3.0-alpha.2
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
