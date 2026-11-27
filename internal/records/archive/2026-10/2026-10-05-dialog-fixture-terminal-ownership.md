# Dialog fixture terminal ownership

This bounded #815 test repair starts at 8872ecc5fcdec924d612fea42af563a32f4ca44d. CI run 37334186565, general job 111845481327, passed all 3821 assertions but failed with two unhandled Overlay unmount rejections after the Dialog test environment was destroyed. It does not modify Adapter, Runtime, Dialog, Overlay or lifecycle semantics.

## Evidence and existing boundary

The original 15 tests pass in isolation. A diagnostic copy sampled actual body children at each test return and at the next Node task. Tests ending open remove their Root but retain physically connected portaled parts; the complete file leaves three Mask and five Content hosts in body. The next-task sample still has those eight hosts. This is not evidence that another fixed number of microtasks completes teardown. The CI stack returns a portal through WC modules.ts originalParent.appendChild after Happy DOM's internal window has become null. That matches live fixture hosts surviving until environment destruction, though the exact CI exception was not reproduced by the isolated original run.

A-WEB-COMPONENT-0001-G and C-LIFECYCLE-0007 describe terminal ownership of each persistent Custom Element and disposal after confirmed disconnection. HC-OVERLAY-PORTAL-0001-A revokes a portal on view detach/provider replacement. These catalog entries are draft. Dialog Root owns semantic open/context/request facts; this repair does not infer a new rule that removing only Root must cascade terminal disposal of all physically portaled host elements. That Root-only product boundary remains a separate follow-up.

## Bounded repair

The fixture registers every Dialog Custom Element it directly creates and explicitly removes its own still-connected hosts during afterEach, including portaled parts. It does not sweep body or remove unrelated elements. Supported structured instance.created and instance.dispose.done diagnostics count each prototype's fixture owners; the hook waits for matching terminal completion and asserts that every owned element is disconnected. The existing interaction assertions remain unchanged.

A new real open-portal test verifies that cleanup retires Root, Mask and Content exactly once, leaves unrelated DOM intact and is idempotent. The original fixture with lifecycle assertions but without explicit owned-host removal fails: Mask and Content each report created=1, disposed=0. With owned-host removal the complete six-file Dialog/Select/Tooltip/WC Overlay/lifecycle group passes 55/55 without unhandled errors.

A separate temporary negative-control copy injects a throw into the real OverlayModuleImpl.onMountPhase unmount boundary. The new cleanup still fails its terminal-completion assertion, and Vitest reports the injected unhandled rejections with nonzero exit. The helper does not catch or suppress a real disposal failure. This fault-injection copy is evidence, not a production patch or a successful test run.

## Validation limits

No original assertion, global timeout or Search 1000 ms oracle is relaxed. There is no sleep, retry-until-green loop, null-window guard, catch-and-ignore, dependency change or publication in this repair. Full type-check and exact-head hosted CI results are recorded separately. These local tests do not establish browser paint or settle automatic Root-only cascade ownership. Independent review and the resulting commit's general CI remain required acceptance evidence.

Co-author by OpenAI Dots
