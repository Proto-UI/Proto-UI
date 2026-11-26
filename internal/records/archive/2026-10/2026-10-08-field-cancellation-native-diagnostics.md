# Field cancellation: preserve the native failure and distinguish event delivery

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Independent red result

The Liquid WC case in [official run 37743002077](https://github.com/Proto-UI/Proto-UI/actions/runs/37743002077), job `113199024125`, fails after `fill('taken')`, Cancel activation and 650 ms: `Unavailable · 已被使用`, with the async editor `aria-invalid=true` and `aria-busy=false`. Artifact `11535825321` binds this to merge `0c2e667957e44abb78408b1d0c37a6b1794b67da`, whose tree equals source `0a3fac594103bf1c6fd60fa511ace2e733adb97c`. Its actual failure PNG was inspected. This is independent of the fifteen direct-input selector failures.

The old recorder captured trusted pointerdown and focusin without a target, pointerup, click, request identifier or event timing. It does not establish that the intended Cancel command was committed. No shared cause with pointer adoption/lost-capture work is established.

## Observed source and discriminating checks

Draft `C-FIELD-0001-ASYNC` requires cancellation to retire the old request. It does not make cancellation clear an already completed invalid result; that is reset's separate operation. `C-FIELD-0001-CHANGE-ONLY` admits a subsequent explicit change as new work even when its text equals a previously canceled request. Root cancellation invalidates its lease; the demo also clears `currentRequest` so a retired timer cannot overwrite Canceled. The demo's 500 ms delay and Button's `press.commit` path remain unchanged.

`field-demo-cancellation.test.ts` runs the actual `createFieldDemo`, `renderDemo`, WC adapter, Base/Liquid Button and Field atoms, with registry lookup bounded to those public prototypes. Fake timers and synthetic events are explicit injections. There is no native pointer/default action or live optical material source in this test.

Eight checks pass on the unchanged product source, four for each family:

1. A delivered pointer command retires the pending request; its late reply is rejected and Canceled survives the timer; a fresh edit later resolves Available.
2. A subsequent explicit same-value change creates a distinct request, while the canceled identifier remains rejected, and may resolve Unavailable.
3. Pointerdown alone, with no committed command, leaves the request active and resolves Unavailable. This reproduces the observable symptom under an injected missing-command condition, not its unproved native cause.
4. Cancel after an already completed invalid result changes the demo status to Canceled while preserving the established invalidity.

These checks narrow the investigation. They do not demonstrate that Liquid WC's native cancellation is fixed, and no speculative Root, Button, timer or demo behavior change is included.

## Next official native observation

The same 25 native cases remain collected. The recorder now includes pointerup, pointercancel, native/custom click, change/focus transitions, validation events, timestamp, exact composed-path refs, request ID and current async value/status/invalid/busy. Failure evidence includes final status and Cancel geometry/focus through array reads, so missing or duplicate refs do not abort capture. Capture exceptions are logged separately and the original journey error is rethrown. An additional immediate Canceled observation distinguishes early failure from the retained post-650-ms assertion; the original timer, final Canceled and `aria-invalid=false` assertions remain intact.

Official native execution must establish whether a Cancel command arrived, whether a new request followed it, and whether layout/material/input timing affects delivery. Do not treat a synthetic pass, collection-only result or a different source revision as that acceptance. Parent integration, exact-head native evidence and independent review remain outstanding.

## Local validation

Final focused execution passes 184 tests across seven files: Base Field 24, four Web adapter files 140, owner oracle 12, and cancellation discriminators 8. Canonical `check:types` passes with zero errors/warnings and seven existing hints after regenerating the worktree's missing Shadow style artifact through the standard generator. The initial direct checks failed on that absent generated import and are retained as setup evidence. This is not a docs production build or native browser run.
