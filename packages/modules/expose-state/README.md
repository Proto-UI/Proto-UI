# @proto.ui/module-expose-state

Proto UI module that finalizes the Adapter-facing exposes record and projects internal State handles as read-only external handles.

## Purpose

Composes the Expose and State module outputs, preserves non-State entries, attenuates State authority, and publishes complete replacement snapshots through `EXPOSES_RECORD_SINK_CAP`.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-expose-state@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-expose`
- `@proto.ui/module-state`
- `@proto.ui/types`

## License

MIT
