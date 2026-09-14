# @proto.ui/module-rule

Proto UI module that provides rule capability for adapters.

## Purpose

Compiles setup declarations into RuleIR and evaluates current Props and State into a semantic style Plan. The default driver delegates style output to Feedback. Standard Runtime installs Rule; prototype authors can choose whether to use it.

The bounded catalog is [M-RULE-0001](../../../spec/modules/M-RULE-0001.yaml), with executable evidence in [T-RULE-0002](../../../spec/tests/T-RULE-0002.yaml). These entities remain draft. `RuleHandle.dispose()` cancels a declaration only during setup; `onCreated` and later calls reject.

Declarations survive view detach/remount; State watches stop while detached and resume with current values on remount. Terminal disposal clears Rule resources. Rule owns no direct host capability.

Context identity/serialization and reactive evaluation are incomplete, and Context path access remains deferred. `intent.state` is recorded but not executed by the default evaluator. `module-rule-meta` is deployed for theme inputs but its API remains evolving; downstream optimizations are outside this core support claim.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-rule@0.3.0-alpha.0
```

## Internal Structure

- `src/compile.ts`
- `src/create.ts`
- `src/eval.ts`
- `src/impl.ts`
- `src/index.ts`
- `src/intent-builder.ts`
- `src/types.ts`
- `src/when-builder.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-context`
- `@proto.ui/module-feedback`
- `@proto.ui/module-props`
- `@proto.ui/module-state`
- `@proto.ui/types`

## License

MIT
