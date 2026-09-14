# @proto.ui/module-focus

Proto UI module that provides focus capability for adapters.

## Purpose

The draft `M-FOCUS-0001` catalogs the instance-owned Focus Module and shared FocusCenter. `asFocusable`, `asFocusEntry`, `asFocusRoving`, and `asFocusScope` separate observed target facts, entry delegation, sibling navigation, and scope policy. Event and State are dependencies; host target/readiness and entry projection are governed by `HC-FOCUS-TARGET-0001` and `HC-FOCUS-ENTRY-0001`.

Current Adapter evidence covers Web hosts. The center still uses host DOM order and one shared center; this is not a claim of completed non-Web ordering or independent cross-document focus domains.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-focus@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/center.ts`
- `src/create.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-event`
- `@proto.ui/module-state`
- `@proto.ui/types`

## License

MIT
