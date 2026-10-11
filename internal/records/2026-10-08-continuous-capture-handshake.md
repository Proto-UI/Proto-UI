# Continuous optical fixture: exercise an effective pointer capture before release

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Original native evidence

Human-assisted #872 continuation from `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7`, tree `2feebcf1159b9bf4c8dfc4edf64ef7ce587cc93b`. [Official optical run 37801215747](https://github.com/Proto-UI/Proto-UI/actions/runs/37801215747), job `113393634365`, artifact `11560676644`, has verified ZIP SHA-256 `053ddb713ac323145d8b5f7bc4df4e38020a7565248f638c7dff499d734d2b82`. Both source and packed manifests identify that clean head.

Both ordinary optical runs pass. Both continuous runs complete the WC, React, Vue and Vue2 principal down/move/out/in/up flows, live-source and actual paint-preservation assertions, and their repress checks. WC's native CDP touchCancel case also passes. The next WC fixture-release assertion fails at `continuous-browser.test.mjs:445` with the original `4 !== 3`. Later cancellation, preference, source-withdrawal and remaining journeys have not run. This failure does not invalidate the newly observed four-runtime principal paint results or establish a recurrence of the old white-flash bugs.

The retained source trace shows mouse down `11679ms`, element blur `11684.4ms` (`windowTarget=false`), move `11756ms`, then up `11918.2ms`. WC contact session 5 ends with `reason=up`. There is no mouse gotpointercapture or lostpointercapture. Packed shows the same sequence at `11816.1`, `11822.3`, `11928.2`, and `12093.5ms`. The only got/cancel/lost events belong to the earlier touch pointer 2. The inspected failure PNG shows optical surfaces and counts `[4,3,3,3]`; it is not a white-flash image.

Source asset SHA-256 is `9a7d6643191f20111e5d5643c41d6bdbcaaef576f79fd4175f2ec7feb5c40d84`; packed is `96f5b736fb94de8c6f2c11831de76f26b84673fd4123bb3d1749cd2206f24225`. Original result, native/contact timelines, screenshots and assertion failure remain preserved in the official artifact.

## Cause and bounded evidence repair

The fixture called setPointerCapture during down, waited 40ms without another pointer event, then released it before its first move. Under [Pointer Events pending-capture processing](https://www.w3.org/TR/pointerevents3/#process-pending-pointer-capture) and [setting/releasing capture](https://www.w3.org/TR/pointerevents3/#setting-pointer-capture), these calls update a pending override. Releasing that still-pending request can prevent either capture event from occurring. Elapsed time and hasPointerCapture do not prove gotpointercapture. The observed up activation therefore did not exercise the intended cancellation boundary.

Only the fixture and its evidence controls change. It now drives a real move after down and requires a trusted gotpointercapture for the current runtime, regular control and mouse pointer ID before releasing. A second real move processes the release; a matching trusted lostpointercapture and terminal `lostcapture` for the same held router session are required before up. It then waits on that session's resting optical receipt and keeps the original activation-count equality. No fixed sleep, synthetic event, mismatched pointer, previous touch event, or implicit loss after up can satisfy this capture case. The activation callback in `browser-entry.ts` updates the output count synchronously.

The result records the matching native chain and held/ended contacts, and captures held/cancelled endpoint images for subsequent visual review. The earlier no-product-capture assertion remains. No router, material sink, source, shader, Adapter, Prototype or initial-paint/seed code changes. The draft material contact criterion and existing input-owner cancellation semantics remain unchanged.

## Verification and remaining work

- A fixture-source ordering control fails against the original 63a driver and passes with the explicit event handshake. Its first run failed on a Vite-transformed import URL rather than the intended condition; correcting the file read produced the retained discriminating red result.
- Pure evidence mutation controls reject the original pending-only trace, untrusted or wrong-pointer/runtime/control capture events, loss after up, and a stale/still-active/up-ended contact. These synthetic data tests validate the evidence checker, not browser behavior.
- The fixture-specific suite passes 4 files / 26 tests. Existing pointer-contact router controls pass 14 tests. Narrow helper TypeScript, exact Node/tsx helper import, browser-script syntax, Prettier and diff checks pass.
- No heavyweight build or local native-browser attempt was made for this fixture-only repair. The known socket restriction was not bypassed. New exact-head source/packed native runs must prove actual got/lost delivery, zero activation, subsequent cancellation and later safety/invalidation journeys before completion can be claimed.
- The local commit uses real Git hooks, the existing cyjin-yl DCO identity and the dot declaration. The connected-service read confirms the public, unarchived repository and authenticated cyjin-yl with maintain permission and no admin permission; local gh remains logged out, so agent:publish is not claimed as run. No remote write or deployment occurs here. Parent coordination owns independent review and the official CI closure.
