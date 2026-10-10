# HoverCard consumes fresh Focus observations before authored mounted

<!-- prettier-ignore -->
Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Independent finding HCF-01

The owner-bound contribution repair `bcca88375dc75555d21ff52e087080aa8acaab76` correctly withdrew removed views but dropped a new Focus transition that arrived before its authored mounted callback. An independent source-runtime fixture started focused=false, actually unmounted the retained Trigger, requested keyboard focus while its host target was unavailable, then made the target ready and mounted. Focus correctly fulfilled the request under `C-AS-FOCUSABLE-0001-G`: one native focus application and focused=true. Its module mounted-phase callback ran before the prototype's onMounted, so the Trigger had no contribution ID yet and discarded the observed next event. Root stayed open=false/triggerFocused=false with no request.

This is a HoverCard consumer-ordering defect. Shared Focus, Runtime Session, delayed scheduling and Adapter ownership are unchanged. A retained focused=true followed by another same-value host event is a different negative control: without a new watch next transition, it must not replay old intent.

## Bounded correction

The draft Trigger criterion `P-BASE-HOVER-CARD-TRIGGER-FOCUS-READINESS` was independently reviewed before implementation. Trigger temporarily retains only the latest actually observed focused.watch next value until its contribution owner is ready. On mounted it first borrows/allocates the owner, takes and clears the observation, then publishes through the existing interaction channel. Clearing before publication preserves synchronous reentry. Actual unmount, disabled and terminal teardown discard unpublished observations; disabled-generated false events cannot refill the buffer. No focused.get() sampling, fabricated blur, Focus state write, new capability or Root API is introduced.

The previous two commits remain unchanged. This correction does not upgrade lifecycle or Full-delivery acceptance.

## Executed evidence

`packages/prototypes/base/test/hover-card-focus-readiness.test.ts` uses the actual source Runtime/Focus modules, replaceable EventTargets, and deterministic host queues/timers. The initial eight-case run failed the pending new-focus case and the latest false-to-true readiness case, while six negative/normal controls passed. The repaired fixture has eleven passing cases:

- New pending keyboard focus observes false-to-true before author mounted, then opens exactly once after configured openDelay.
- Unchanged retained true is never sampled or replayed.
- Actual unmount cancels an epoch after Focus next occurred but before queued author mounted; another mount with no new input cannot reopen.
- Readiness true-to-false and true-to-false-to-true orders consume only the latest observation.
- Controlled open=false can refuse the resulting request.
- Own or Root disabled before author mounted clears observations and re-enable does not replay.
- A physically replaced, already-unbound old EventTarget cannot report new focus; the replacement still works.
- Root/Trigger terminal teardown prevents delayed publication.
- A fresh focus request after authored mounted remains a positive control.

The original independent seven-line probe also changes only the defective pending outcome: it now records a fresh contribution ID, triggerFocused=true, Root open=true, and one openChange; the unchanged-true negative remains closed. These are source-runtime and happy-dom observations, not real browser/native input, pixels, AT or full host admission.

Final focused scope includes the existing Base/Shadcn/Brutalist and React/Vue 3/Vue 2 suites: nine files / 45 tests. Source/public types plus the new fixture, spec authoring and agent snapshot/check are part of this local validation. Integrated CI, browser/native/Compiler/AT/packed-consumer gates and independent exact-head acceptance remain separate.
