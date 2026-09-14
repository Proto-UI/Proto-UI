# @proto.ui/module-hit-participation

Proto UI module that provides hit-participation capability.

## Purpose

The draft `C-HIT-PARTICIPATION-0001` and `M-HIT-PARTICIPATION-0001` govern region eligibility independently from Event, Boundary and modal policy. The Web bridge supports same-mode shared owners, rejects conflicting modes atomically, and restores the original pointer-events declaration when the final owner releases a target. `HC-HIT-PARTICIPATION-0001` defines that host boundary.

`asHitParticipation(patch)` retains its current migration compatibility shape; setup configuration is also available on the returned singleton handle.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-hit-participation@0.3.0-alpha.0
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
- `@proto.ui/types`

## License

MIT
