# HoverCard view-generation interaction cleanup

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

Fixed implementation baseline: `c2cbb8d6fce71e949f84f0358189184783505989`. Definition-first predecessor: `30dafcf014ea17da98c988514ba6c2f845a47b5b`. The independently reviewed definition keeps P-BASE-HOVER-CARD, its parts and their T entities draft. Its new `INTERACTION-LIFETIME`, `INTERACTION-RELEASE`, and `INTERACTION-OWNER-BINDING` criteria govern only HoverCard contributions. No Full-delivery gate is completed by this repair.

Root alone owns open, controlled input, delay and requests. A removed part cannot resolve its former Root by a fresh Context lookup. `C-ANATOMY-0009-E` and `C-EXPOSE-0007-F` already support explicitly exposed, target-callback-bound operations. Root therefore declares the additive, typed `releaseInteraction(part, contributionId): boolean` cooperation method. This is visible in Base and inherited family public types; it is not a hidden runtime capability or a replacement for open/close commands.

## Failure and repair

The independent fixture enters Trigger, enters Content, leaves Trigger, then removes Content without pointerleave. With openDelay=0/closeDelay=20, the baseline still has Root open=true after 100ms even though Content is disconnected and Trigger is neither hovered nor focused. Clearing only Content's local hovered state leaves its Root contribution. A diagnostic alternative using Context.update during onUnmounted also failed because the removed part could no longer resolve the original provider.

Each attached Trigger/Content view borrows its own Root release operation and receives a globally non-reused positive safe-integer ID within this Context/Anatomy family implementation. Exhaustion throws before publishing, never wraps. Context stores only numeric/null identity. Cleanup retires the local borrowed reference before calling the Root so synchronous reentry cannot erase a new local binding. Root clears only the matching part/ID. Invalid/stale/duplicate IDs are true no-ops; an already-false contribution retires without restarting a pending close delay. Root shutdown nulls its private callback handle before late cleanup. No child obtains Root run/session/host state.

The existing interaction scheduler remains responsible for the resulting close request. Controlled owners may reject it. No shared Runtime, Delay, Focus, Adapter, Compiler, family appearance, or TODO acceptance code changed.

## Evidence and limitations

- `hover-card-content-removal.test.ts` preserves the independent red sequence and observation; repaired output is contentConnected=false, triggerHovered=false, triggerFocused=false, rootOpen=false.
- `hover-card-lifecycle.test.ts`: 19 executed cases cover both part removals, independent contributions, actual closeDelay boundary, controlled rejection, retained L1 and terminal remount, stale/new publishers, invalid/duplicate IDs, false-source deadline preservation, Root destruction/rebuild, both pending timer directions, synchronous helper reentry and exhaustion.
- An overlapping two-Content negative is deliberately invalid anatomy. It demonstrates stale cleanup isolation, not new multiple-Content support.
- The first retained-view fixture incorrectly treated an early hidden attribute as completed unmount. WC Portal has an existing two-rendering-opportunity conceal barrier. The corrected fixture waits that host boundary, then asserts actual contribution withdrawal and reuse of the same state handle. No Runtime workaround was added.
- Focused source tests: Base, Shadcn, Brutalist, React, Vue 3 and Vue 2 total 8 files / 34 tests passed on Node 24.19.0, Vitest 2.1.9 and happy-dom. These are synthetic input tests, not real browser/native input or AT evidence.
- Source TypeScript checks include the changed Base/family entries and a public type fixture proving the cooperation signature propagates through Base/Shadcn/Brutalist exports.
- Aggregate workspace TypeScript was attempted but remains unverified in this fresh worktree: unrelated package-local React/Vue dependency links and generated website style modules are missing. The focused source/public-type check above passed; it does not replace integrated aggregate checks.
- Spec authoring and generated agent snapshot passed after materializing three already-tracked sparse-checkout Rust test paths from the exact baseline. No Rust source was edited or executed. Prototype catalog still reports pre-existing uncataloged Finf protocols and remains a separate gate.

Exact commands are reproducible from the checkout:

```sh
node node_modules/vitest/vitest.mjs run packages/prototypes/base/test/hover-card*.test.ts packages/prototypes/shadcn/test/hover-card.test.ts packages/prototypes/brutalist/test/hover-card.test.ts packages/adapters/react/test/hover-card.test.ts packages/adapters/vue/test/hover-card.test.ts packages/adapters/vue2/test/hover-card.test.ts --maxWorkers=1 --minWorkers=1
node --import tsx scripts/spec/check-lifecycle-authoring.mjs --base c2cbb8d6fce71e949f84f0358189184783505989
node --import tsx scripts/spec/generate-agent-project-understanding.mjs
```

Browser screenshot/pixel proof, complete cross-host removal journeys, AT, native/Compiler conformance, final packed consumers, integrated CI and independent implementation acceptance remain separate gates. The definition review is not an implementation review. This record grants no publication, release or merge approval.
