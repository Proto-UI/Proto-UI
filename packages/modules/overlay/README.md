# @proto.ui/module-overlay

Proto UI module that provides overlay capability for adapters.

## Purpose

Provides overlay capability to adapters running Proto UI prototypes.

## Focus-outside policy

`overlay.configure({ closeOnFocusOutside: true })` consumes Boundary current-focus observations and closes with `focus.outside`. Trigger, anchor, content and provably owned children stay inside. Pointer outside remains a separate opt-in policy; the same press does not cause another focus dismissal. Overlay does not restore or redirect focus for this policy. Components with dynamic alert/controlled-owner rules can observe Boundary `focus.move` directly and request their owner before changing logical open. Missing host focus support does not fabricate close.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0-rc.1` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/module-overlay@0.3.0-rc.1
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/escape-coordinator.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`
- `src/web/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-base`
- `@proto.ui/module-boundary`
- `@proto.ui/module-event`
- `@proto.ui/module-positioning`
- `@proto.ui/types`

## License

MIT
