# @proto.ui/module-expose-event

`@proto.ui/module-expose-event` owns Proto UI's Component-to-App-Maker outward signal bridge.

The module depends on `@proto.ui/module-expose` for the shared outward key namespace. `def.expose.event(...)` records a branded declaration in that registry, while `run.expose.emit(...)` validates the declaration and forwards one immediate emission through `EXPOSE_EVENT_SINK_CAP`.

Adapters attach the sink to the `expose-event` module. The host may translate a signal to a callback, framework emit, `CustomEvent`, message, or another equivalent carrier. Missing sinks are a compatibility no-op and do not qualify an Adapter for standard outward-signal support.

The legacy `EVENT_EMIT_CAP` name and the former exports from `@proto.ui/module-event` remain deprecated source-compatible aliases during the 0.3 migration. Adapter wiring must move from `event` to `expose-event`.

## Install

```bash
npm install @proto.ui/module-expose-event@0.3.0-alpha.0
```

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-expose`
- `@proto.ui/types`
