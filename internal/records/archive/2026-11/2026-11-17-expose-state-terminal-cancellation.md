# Preserve issued State cancellation through terminal public disposal

This is a bounded 0.3 repair under the current draft `P-SHADCN-INPUT-SHELL-BINDING-LIFETIME`, `M-EXPOSE-STATE-0001` and `C-EXPOSE-STATE-0001` requirements. It does not promote their lifecycle or establish release acceptance. The implementation and fresh baseline start at `c22e02f4613b5a890e436f633309f3c2debbf9a3`.

## Why cancellation failed

`ExposeStateModuleImpl` returns a `trackedOff` closure from a real external State subscription. That closure removes its own subscription and calls the State unregister function; it does not read State, install work or execute an authored callback. The raw cancellation already works without a live callback scope.

The Adapter reader projected every function return as an ordinary owner-bound callable. A public `subscribe()` therefore returned a wrapper that rejected before reaching `trackedOff` once the reader was invalidated. Vue2 `beforeDestroy` invalidates that reader before disposing its Runtime owner. The real terminal State disconnect then reached InputShell, which correctly attempted both unsubscriptions, but the Adapter rejected those cancellation attempts.

The original error was `[AdapterHost] cannot invoke an exposed callable after terminal disposal`, with `base/src/host/exposes.ts` followed by `input-shell/bind-control.ts:74` in the stack. The exact two Vue2 Search cases reproduced three such unhandled rejections on this current baseline. Their messages and all ten reported stack frames also match the earlier `bf8b1f55` observation. State already attempted final raw cleanup, so these exceptions alone do not prove a permanent subscription leak.

## Ownership-preserving repair

ExposeState now records only the actual `trackedOff` closures it creates in a private `WeakSet`. Its package exposes a read-only identity predicate; there is no public registration function or writable marker. The Adapter reader preserves these exact cancellation closures instead of wrapping them as authored methods.

The identity remains recognizable for repeated cancellation while the caller retains the closure. Weak membership does not retain otherwise unreachable closures. Ordinary authored functions, factory returns, records named `subscribe`, and records carrying the exported external-handle symbol still receive the existing callback-scope and terminal guards. The fix does not authorize new subscriptions or reads after disposal, and it does not make `unsubscribe(anyFunction)` an unrestricted terminal execution path.

InputShell, State, Vue2 lifecycle ordering and Search product code are unchanged. InputShell still attempts every cancellation, releases its owner and identities, rejects later writes, and preserves the first actual cleanup failure, including falsy values. The existing error aggregation policies are unchanged.

## Discriminating evidence

The new Node fixture composes actual RuntimeSession, State, ExposeState, Adapter reader and `bindInputShellControl`. Its State-port observation layer delegates registration and cancellation to the real implementation. Configured failure injections happen only after the real unregister. The passive target and explicit binding owner are test models; this is not browser layout evidence.

The test checks that both cancellations run _inside the real terminal disconnect delivery_. Later module fallback cleanup cannot satisfy this assertion. It also checks repeated cancellation, ordinary-callable rejection, spoofed subscription names/brands, repeatable detach identity, and first-error identity for `undefined`, `null`, `false`, `0`, `-0`, `NaN`, the empty string and an `Error` after every cleanup attempt.

| Run | Actual result | Process outcome |
| --- | --- | --- |
| New 15-case fixture on unchanged product | 4 passed, 11 failed, 0 skipped | Exit 1; all 11 raw-log failure diffs contain the terminal Adapter error, with no fixture setup failures or unhandled rejections |
| Same new fixture with the repair | 15 passed | Included in the 86-case affected run below; fixture bytes unchanged |
| Four affected files | 15 new + 16 Adapter-record + 9 ExposeState + 46 InputShell cases passed; 0 skipped | Exit 0, no unhandled rejections, 6.102 seconds |
| Exact two Vue2 Search cases on unchanged product | 2 assertions passed; 32 other cases not selected | Exit 1 from 3 real unhandled terminal-cancellation rejections, 8.261 seconds |
| Same two Vue2 Search cases with the repair | 2 assertions passed; the same 32 cases not selected | Exit 0, no unhandled rejections, 7.979 seconds |

The two selected integration identities are:

- `Docs shadcn/vue2 returns focus to the current opener after a runtime replacement`
- `public-mode Search through the actual projection materializer vue2/shadcn: staged activation, close/reopen and generation replacement retain the live query`

The new fixture has SHA-256 `56f9d3cc2755ba49d8412fe237a5788a00038fa143dc810844df8a2dda6ac911` in both red and green runs. Each run's ten explicitly bound inputs remained unchanged. The three pre-existing affected fixture files were additionally audited against their unchanged `c22` blobs after execution; their hashes were not individually listed in the original runner input receipt. The [source-bound evidence record](evidence/2026-11-17-expose-state-terminal-cancellation.json) retains commands, case identities, input hashes, original failure identity, exact selections, process exits and log/report hashes.

## Remaining boundaries

These checks do not establish full CI, native-browser, CSS, Search performance-deadline or release acceptance. They do not claim the other 32 Search cases executed. Mutable exposed-record identity and late callable mutation are a separate repair; this change leaves the existing data projection unchanged.

## Parent review and integration

The parent independently read all three source changes and the complete 15-case fixture, verified all six frozen file hashes and the four original run log/report/receipt hashes, and read the actual process exits and unhandled-error counts. The repair applied cleanly to published parent `5b2fa32be7e2ea9673997cf1878e33355231bdef`. Relevant Runtime, Adapter, ExposeState, InputShell and Search inputs were unchanged from the tested c22 base; product and fixture bytes remain identical. This is not a claim of an additional combined execution or formal approval. The independently published mutable-record repair in PR #1491 is being checked in a separate combination.
