# Sprint 2: frozen primitive array admission

## Scope and authority

- Execution: human-assisted, current-user request to complete Sprint 2.
- Issues: bounded #732/#1145 source admission and actual generated-consumer evidence.
- Integration base: `902b259fe22c30cacb723f71c86535187e1094fe`, after merging #1732 with current main and replaying the separate Context inference repair.
- Authority: the existing ordinary-value source contract, `C-COMPILER-ECMASCRIPT-0001-BINDINGS`, `C-COMPILER-ECMASCRIPT-0001-ORDINARY` and the target-specific admission boundary. Draft contracts remain draft.

## Failure and implementation

The unchanged Shadcn Tabs visual module declares `Object.freeze([...SHADCN_STYLE_IDS])`. The integrated frontend rejected its unshadowed builtin receiver as an undeclared authored module binding. Independently, the intrinsic type checker admitted records but refused checked arrays. Frozen module arrays consequently could not supply static enum options or the existing finite loop expansion.

The repair separates the builtin receiver from its authored operand reads during ESM initialization, preserving operand TDZ checks. The intrinsic now retains an array's element type, identity and readonly outer permission. Static primitive extraction follows a checked frozen module initializer; it does not replay a setup-time freeze of an existing array. Finite loop extraction supports the frozen module key list and its primitive spreads. No prototype source, component-name dispatch, runtime replacement or source execution was introduced.

The existing #1732 Partial style-table implementation works after this repair. A dedicated combination case uses a frozen imported-style key sequence, a `Partial<Record<..., StyleHandle>>`, a missing key, a `continue` guard and Rule installation. Its unguarded missing-field control still rejects. This is evidence for that bounded combination, not a claim that every style-table or consumer condition is accepted.

## Evidence

The initial 21-test file on the integration base reported **13 failed / 8 passed**. With the repair it reported **21 passed**. Adding the frozen-key/Partial/continue combination brought the focused file to **22 passed**.

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/frozen-primitive-arrays.test.ts \
  packages/compiler/test/static-object-key-order.test.ts \
  packages/compiler/test/module-initialization-order.test.ts \
  packages/compiler/test/consumer-shadcn-admission.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Result: **4 files, 78 passed, 0 failed, 0 skipped**.

A TypeScript program rooted at the three changed source files and the new test, using the repository's compiler options and their complete imported dependency graph, reported **0 diagnostics**. This is a bounded source check, not the workspace-wide type gate.

The evidence includes source-free IR revalidation; ordered imports/re-exports and duplicate values; number, boolean and empty arrays; missing-field, opaque-input, shadowed-factory, readonly-mutation and serialized-IR controls; and eight ordinary generated framework consumers across React, Vue 3, Vue 2 and Web Components. The consumers assert duplicate ordering, array identity, and the actual thrown write through an older mutable alias. The framework consumers run in Happy DOM; this is not physical browser, paint, AT or non-Web acceptance.

The unchanged real Shadcn Tabs content compile now passes the frozen-array boundary and reaches a separate `syncCurrentFromContext` structural State-setter argument rejection at `packages/prototypes/base/src/tabs/content.proto.ts`. That remaining diagnostic is retained for follow-up. This receipt does not close #732 or #1145 and does not replace their full library-by-profile denominator, differential lifecycle matrix or final integrated gate.
