# @proto.ui/runtime

Proto UI runtime that executes prototypes under the Proto UI contracts.

## Purpose

Implements the runtime execution flow that adapters can host under the Proto UI contracts.

## Package Role

Runtime package that coordinates setup, rendering, lifecycle, module orchestration, and host execution boundaries.

## Captured setup feedback

An authored asHook captures setup style contributions made through both `def.feedback.style.use(...)` and `def.feedback.style.to(target).use(...)`. Its `disposers.feedback` and `disposers.all` can withdraw those contributions during setup without removing independent Root or target contributions. The returned disposers remain setup-only; capturing a targeted contribution does not change its target identity or grant a later runtime write.

## Install

```bash
npm install @proto.ui/runtime@0.3.0-alpha.1
```

## Internal Structure

- `src/index.ts`
- `src/instance/`
- `src/kernel/`
- `src/orchestrator/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-a11y`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-as-trigger`
- `@proto.ui/module-axis-input`
- `@proto.ui/module-base`
- `@proto.ui/module-boundary`
- `@proto.ui/module-collection`
- `@proto.ui/module-context`
- `@proto.ui/module-control-label`
- `@proto.ui/module-event`
- `@proto.ui/module-expose`
- `@proto.ui/module-expose-event`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-image-view`
- `@proto.ui/module-native-link`
- `@proto.ui/module-overlay`
- `@proto.ui/module-positioning`
- `@proto.ui/module-presence`
- `@proto.ui/module-props`
- `@proto.ui/module-rule`
- `@proto.ui/module-rule-expose-state-web`
- `@proto.ui/module-rule-meta`
- `@proto.ui/module-scroll`
- `@proto.ui/module-state`
- `@proto.ui/module-state-accessibility`
- `@proto.ui/module-state-interaction`
- `@proto.ui/module-table-structure`
- `@proto.ui/module-test-sys`
- `@proto.ui/module-text-control`
- `@proto.ui/types`

## License

MIT
