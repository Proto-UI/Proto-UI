# @proto.ui/module-positioning

Proto UI module that provides host-mediated anchored positioning for overlays.

## Purpose

Provides collision-aware placement policy and host leases so prototypes can position floating content relative to an anchor without owning browser geometry APIs.

## Contract and lifecycle

The draft catalog is defined by `C-ANCHORED-POSITIONING-0001`, `M-POSITIONING-0001`, and `HC-ANCHORED-POSITION-0001`. The module retains a connection and categorical snapshot; Overlay owns active-view connection lifetime. The Web host uses Floating UI for geometry and preserves `transform` for downstream styling.

Only the current computation of a live lease may publish coordinates, size variables, or resolved placement. Replacement and disposal invalidate pending work; disposal stops observation and cannot be reversed by updating the old lease. A missing host retains the declaration without projecting geometry.

The separate available-space lease refreshes on the Runtime's updated phase. A retained Web Component's document-adoption update can therefore release its former document's observation and measure the new root-content region without waiting for a resize from the former document. Inactive, missing and terminal leases acquire no resources from this notification. Repeatable mount phases remain distinct from the legacy terminal `unmounted` notification.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-positioning@0.3.0-alpha.1
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

## Experimental ContextMenu input origin (source runtime)

`asContextMenuInput()` binds only the current instance's claimed anatomy role. Its accepted intent contains `pointer`, `keyboard`, or `long-press` plus an opaque `InputOriginAnchor`. Coordinates, contact identity, native input events, and geometry never enter portable props, State, or Context JSON. Consumers retain the association in private capability storage and pass it to `overlay.registerInputAnchor()`. Ordinary anchor anatomy continues to own boundary membership and focus restoration. A null input association restores element anchoring.

The four Web adapters recognize right-click, Menu/Shift+F10, and a 600ms primary touch/pen hold. The host cancels a pending hold after movement beyond 10 CSS pixels, release, native cancellation, another contact, scrolling, loss of visibility/focus, disable, target detach, or unmount. It uses the Runtime's existing cancellable delay scheduler and never captures pointers or overrides touch-action. An accepted hold suppresses one compatibility menu and one pointer click from that sequence; a later real contact or expiry after release clears suppression. Ordinary click and accessibility activation are preserved.

Host-issued tokens resolve to zero-area virtual references with the trigger's context element, or to trigger geometry for keyboard input. Replacement, disable, and disposal revoke old tokens; rejected requests preserve the last accepted token. Floating UI retains collision/Portal separation and rejects stale asynchronous writes after revocation.

This is source-runtime Web capability evidence. Compiler/native lowering and real native GUI gesture evidence remain unsupported or pending; synthetic adapter tests do not prove them.
