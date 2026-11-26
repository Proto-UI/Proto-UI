# Sprint 2: first-class runtime lifecycle module

## Scope

The unchanged Base Tabs Content passes `run.lifecycle` to a helper. Its source previously failed at the member read. Core already exposes that module, and active `C-LIFECYCLE-0008` gives its `setPresent` operation the callback-only ViewIntent contract. This implementation preserves that existing surface; it does not activate the draft ViewOperation contract.

The portable graph now has an internal `run-lifecycle` receiver derived only from the actual Run member. The module call shares the existing `setPresent` argument, phase, callback-origin and effect rules. Core indexed type resolution can name the checked member. An ordinary object or type assertion cannot manufacture the nominal receiver.

React and Vue 2 output retain their existing module object. Vue 3 creates one module object bound to its real logical Run owner only when that source member is reached. The initial WC implementation retained the module inside a callback but its owner recreated Run on the next callback; independent follow-up review caught that missing identity condition. The [WC owner follow-up](2026-11-24-sprint2-wc-run-identity.md) repairs and independently verifies one Run/module per logical owner. GPUI, Qt and Flutter explicitly refuse reached first-class module use until they implement it. The unrelated `captureViewOperation` member remains unsupported.

## Evidence and limits

A bounded standalone source probe passes parsing and cold JSON IR validation and generates all four Web profiles. The GPUI probe reports `PUI4003` for the module member and its operation. A larger fixture retains the same member identity and passes source/IR validation.

The focused regression completed with **21/21 passing**: 17 source/runtime cases and four complete generated-artifact strict TypeScript checks. It covers typed member identity; serialized owner forgery; before-dispose/render, public escape and cast refusals; the unsupported ViewOperation member; non-Web target refusal; unreachable Vue allocation; and four generated consumers with initial detachment, repeated view epochs and terminal old-callback isolation. Those consumers execute under Happy DOM; this is not browser or assistive-technology acceptance.

The first run passed 13/15. Two tests confused the public Qt/Flutter registry gate (`PUI4001`, profile unimplemented) with the direct candidate emitters. A direct probe then found that Qt would generically spell the new operation without owning an implementation. Both direct emitters now explicitly reject the reached module (`PUI4003`), while the unchanged public registry continues to reject those profiles. The new gate conservatively retains the program when callable provenance cannot prove absence, matching target admission. The two paths have separate tests; a public gate is not evidence about a direct emitter.

The command was:

```sh
NODE_OPTIONS=--max-old-space-size=3072 corepack pnpm@10.32.1 exec vitest run packages/compiler/test/lifecycle-module.test.ts packages/compiler/test/lifecycle-module-types.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The strict generated tests include each artifact's supporting TypeScript/JavaScript modules under `strict` and `checkJs`, including the actual Vue 2 dependency types. A separate bounded source/test TypeScript program checks 14 changed frontend/emitter/test roots and their complete imported graph. It initially caught a missing required observer method in the new direct gate; after implementing that method, the final program completed with **zero diagnostics**. The 17-case source/runtime file was rerun after that correction.

At this initial slice, the unchanged Tabs source advanced from an undeclared module member to a separate local-closure parameter-compatibility boundary: its local helper declares a structural subset of the module. The [later closed-local-helper proof](2026-11-24-sprint2-local-nominal-helpers.md) addresses that bounded frontend input. Neither slice claims full Tabs, all targets, AT or the original library/profile denominator has passed.
