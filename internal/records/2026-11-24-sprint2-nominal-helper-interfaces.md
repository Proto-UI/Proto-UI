# Sprint 2: nominal receivers in closed helper interfaces

## Scope and reproduced gap

This human-assisted #732/#1145 slice continues the unchanged Shadcn Tabs source from the frozen-array repair. The existing `syncCurrentFromContext` helper describes the methods it needs through structural parameter annotations. Passing real State and Focus handles failed with `PUI1006: Callable argument 3 type mismatch`, even though those handles already possess the declared methods. A minimal ordinary helper taking `{ set(next: boolean, reason?: string): void }` independently reproduced the same refusal on the integration baseline.

The repair verifies the declared subset against the shared operation table and retains the original nominal receiver inside the closed helper. It does not manufacture a capability from a structural value. Actual field types, optionality, State value types and receiver permissions remain checked; operations in the helper body continue through normal phase and ownership validation. The helper cache also distinguishes nominal payloads, so a shared getter helper cannot reuse the Boolean State specialization for a Number State.

This admission currently derives only simple method signatures. Callback-bearing methods, field-dependent arguments and variadic signatures need their own evidence and remain unsupported by this compatibility rule.

## Validation

```sh
NODE_OPTIONS=--max-old-space-size=3072 corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/nominal-helper-interface.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Result: **12 passed, 0 failed, 0 skipped**. The cases include source-free IR validation; distinct Boolean and Number State specializations; generated React, Vue 3, Vue 2 and Web Component consumers; wrong State payload, Observed-write, Owned-watch and setup-phase refusals; null/unknown empty-interface refusals; and a serialized IR mutation that replaces nominal receivers with empty structural records.

The four generated consumers execute in Happy DOM. They establish the authored helper behavior within that environment, not physical-browser, paint, auxiliary-input or native-platform acceptance.

A bounded TypeScript program rooted at `parser.ts` and this test file, using the repository options and their complete imported dependency graph, reported **0 diagnostics**. It is separate from the workspace-wide type gate.

The unchanged Shadcn Tabs source now passes the original helper argument boundary and reaches a separate explicit gap: its first-class `run.lifecycle` argument is not yet admitted. This result does not claim that Tabs or the original full-library/profile denominator has passed. The new Transition integration has a separate source-type boundary and is tracked independently.
