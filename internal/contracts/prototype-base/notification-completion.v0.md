# Base notification completion (draft v0)

This draft applies the active `C-LIFECYCLE-0008` instance/view boundary to the maintained Base caller paths below. It does not require cross-host synchronous notification delivery or change State, Expose Event, Context, Anatomy, selection, numeric, or controlled-owner policy.

When a State observer, Context subscriber, exposed request, or event consumer retires the calling view during a request, the old invocation stops before its next publication, dependent part call, or completion event. Unmount, terminal disposal, and unmount/remount retire that invocation; remount does not revive it. A request already accepted retains its existing return convention. A new invocation in the new view remains valid. This does not forbid instance-owned work that was already legal while alive and detached.

The caller boundaries covered here are Number Field request/commit text completion, Data Table request publication, Calendar month and value publication, Toast Root open application, Checkbox Group aggregate publication, Carousel index publication, Accordion open-count completion, Context Menu open request, Tree selection publication, OTP value/completion publication, Menubar Trigger Content entry, and Field Control input canonical reread/report. Normal completion, controlled-owner canonical rereads, and legal nested requests remain intact. Toast Action and Search Item are distinct callers with their existing contracts.

The current implementations may notify observers before their caller returns. Retirement checks belong to that caller; strict Anatomy domains and terminal State diagnostics remain in force. Errors from a still-current caller are not converted into empty parts, successful requests, or optional fallback behavior.

A returning Toast view reconciles its retained accepted open State with Context and the transition target before starting that view's transition. Stopping the retired application must not leave the new view describing the old open value.

Menu Root value requests and Drawer Content snap requests retain the calling owner/view epoch across State and Context publication. Their navigation/axis-input callers stop before old completion work after retirement; accepted requests keep their original return conventions. Drawer admission release and snap/extent/gesture numeric policy remain unchanged.

Executable evidence: `packages/prototypes/base/test/notification-retirement-lifecycle.test.ts` and `packages/prototypes/base/test/popup-snap-validation-lifecycle.test.ts`. Their RuntimeSession tests use public subscription and request boundaries, with synthetic EventTarget, role fixtures, a Text Control host connection and a Drawer snap helper/admission fixture; they do not establish physical browser focus, native gesture geometry or complete Adapter parity.
