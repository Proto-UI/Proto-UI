# Preserve pointer completion across implicit capture release

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Verified regression

PR #872 review discussion `4216274698`, against `0a3fac594103bf1c6fd60fa511ace2e733adb97c`, correctly identified that `lostpointercapture` emitted semantic `pointer.cancel` even when the primary contact had already ended on `pointerup`. Consumers such as state-interaction clear hover on that cancellation. A completed contact is not a capture loss of an active session.

The router now translates capture loss only for its matching active contact. Native `pointercancel` remains unchanged. This implements the current draft `C-FEEDBACK-MATERIAL-0001-CONTACT` without introducing a new input owner or changing activation routing.

## Evidence

- Baseline: five added synthetic-event negative controls failed for extra cancellation; nine existing controls passed.
- Candidate: 31 tests pass in `pointer-contact`, `event-router-work`, `native-focus-event-router` and `web-move-gesture-host`.
- Cases include normal up then implicit capture release, other pointer IDs, matching capture loss, repeated loss, native cancel, Enter/Space with no pointer session, replacement router generation and terminal teardown.
- Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9; one worker. Tests inject PointerEvent ordering and bounds in Happy DOM. They do not prove native implicit capture delivery or browser paint. Official exact-head browser CI remains required.

No browser screenshot was produced for this internal routing correction. It contains no intentional visual redesign. Independent review and publication remain separate from these local regression results.
