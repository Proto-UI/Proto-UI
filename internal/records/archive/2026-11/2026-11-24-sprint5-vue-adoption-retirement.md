# Sprint 5 Vue adoption retires the actual native application

## Scope and authority

This correction starts from `c99a224ad2221d886422cda2335b4a24b09619c0` in the Sprint 5 owner lane. It follows the existing draft `C-LIFECYCLE-OWNER-INITIALIZATION-0001-D/E`: terminal disposal wins over pending startup, and a rejected or partially started candidate retires its acquired resources. It addresses #896 without changing the draft lifecycle, data trust policy or public target admission. The complete target-initialization implementation remains missing in the draft test catalog.

## Reproduced failure

The generated Vue 3 `hydrate` helper owns the native application it creates. Previously its failure path closed the logical Proto session, but did not unmount that native application. The same gap existed when deferred logical startup failed after the helper had returned. Actual native slot children retained their effect scopes and event listeners after the candidate was rejected.

The first valid counterexample compiles the authored prototype through the actual parser and private SSR emitter, renders its real server output with a native button slot, then hydrates using a native child whose button text differs. Vue reports the actual hydration mismatch and the helper rejects it. The child has mounted by then, but its effect scope remains active: expected `0`, observed `1`. This is a resource failure after correctly detected invalid adoption, not an assertion that mismatching HTML should be accepted.

A native mounted-hook error exposed a second part of the same boundary. Vue calls mounted hooks before its application mount stack records that the application has mounted. Throwing from the generated framework error handler interrupts that stack, leaving ordinary `app.unmount()` unable to traverse the partially mounted tree. A synchronous terminal unmount request inside a native mounted hook also needs to finish native retirement after that stack returns.

## Correction

The generated receiver now records the first framework error during initial mount, lets Vue complete that mount stack, and then retires the actual application. Retirement is idempotent, closes the logical session, and preserves the initiating value, including `false`. Native teardown errors are observed without interrupting Vue's remaining cleanup traversal; a consumer error observer cannot replace the first error with its own later exception.

After mount, the real application retirement function is registered with the logical session. A later deferred startup failure therefore retires native scopes and listeners as well as Proto owners. A terminal request made during the native mounted hook closes logical work immediately and finishes native unmount as soon as Vue's mount stack returns. The pending logical startup callbacks cannot run after that terminal close.

This is ordinary Vue ownership and lifecycle cleanup. The generated output does not inspect private Vue instance fields, replace framework renderers, simulate native cleanup, or add a component-specific exception.

## Executing consumers and counterexamples

`packages/compiler/test/vue-owner-hydration.test.ts` evaluates the complete emitted artifact closure against the installed Vue 3 and Vue server renderer. Its native children are real Vue components with `watchEffect`, `onScopeDispose`, mounted and unmounted hooks, and actual DOM event listeners. The assertions observe those resources independently of the generated session implementation.

The four journeys are:

1. Reject an actual hydration text mismatch, retire its native child, then explicitly create a fresh successful application from the selected original server projection. The rejected scope stays retired, the new child responds to its own signal/event, and normal unmount disposes it exactly once.
2. Preserve a native mounted-hook `false` as the first error while a before-unmount callback throws `cleanup-second` and its diagnostic observer throws `observer-third`. The native scope, watcher and event listener still retire.
3. After `hydrate` has returned, reject the deferred logical `created` publication through its real native event listener. Both logical disposal and native application retirement complete; later signal changes and events do nothing.
4. Request terminal disposal synchronously from the native mounted hook, before the framework marks the application mounted. Native retirement finishes, logical `created` never runs, and a later repeated unmount cannot revive or dispose the child twice.

The initial fixture attempt used a browser-resolved URL for Node's `createRequire` and failed before test collection. It is preserved in `vue-owner-adoption-red.log` and is not a product failure. The corrected first fixture's valid product red is `vue-owner-adoption-red-valid.log`.

The final first-three-case fixture was replayed against the exact original emitter in `vue-owner-adoption-baseline-final.log`, then the candidate source was restored. All three failed; because the old mounted-hook throw can leave Vue's scheduler unsettled for the subsequent test in the same process, the deferred case was also run independently. `vue-owner-adoption-baseline-deferred.log` contains that independent scope-leak failure, with the other two cases intentionally filtered out. The terminal fourth case has its own independent original-emitter scope-leak failure in `vue-owner-adoption-baseline-terminal.log`, with the other three cases intentionally filtered out. The baseline replays never changed the candidate tests or their expectations.

## Verification

The final candidate run passed **22/22** with no skips:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/vue-owner-hydration.test.ts \
  packages/compiler/test/vue-source.test.ts \
  packages/compiler/test/vue-context-source.test.ts \
  --maxWorkers=1 --minWorkers=1
```

This comprises the four new adoption journeys, fifteen existing Vue source consumers, and three existing Context composition consumers. The raw receipt is `vue-owner-adoption-final-four.log`. Expected mismatch and deliberately thrown-error warnings remain in the output.

The affected Vue request and held-serializer cases also passed **22/22**, with the other **65** target cases explicitly filtered out rather than reported as passing, in `vue-owner-request-regression.log`. The final terminal-disposal addition changes only the client hydration path and does not change the verified request path. Previous React, Vue 2, WC and full request receipts are retained for their unchanged source boundaries; they were not rerun as extra claims here.

The focused strict TypeScript program resolved **421 source files with zero diagnostics** for the changed emitter and final four-case suite. The catalog-authoring check passed for the one changed input against `c99a224ad2`. Raw receipts are `vue-owner-adoption-types-final.log` and `vue-owner-adoption-spec.log`. Formatting and `git diff --check` also passed. The draft catalog maps this executing witness as `needs-review`; a green local test does not itself complete independent review.

## Remaining acceptance

These are real emitted consumers in happy-dom, not physical-browser adoption receipts. Full source/compiler/helper/request binding, application-controlled input authority and trust, complete Context reconstruction, all target consumers, original author/owner decisions and independent acceptance remain distinct #895/#896 conditions. No draft is promoted and no canonical SSR profile is admitted by this change.
