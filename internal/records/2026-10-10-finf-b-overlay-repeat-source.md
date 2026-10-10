# Finf B: repeated Toast windows and Popover focus-observation correction

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Source follow-up, not acceptance.

- Closing Toast clears transient pointer/focus pause reasons, while explicit `paused` and manual pause ownership remain intact. Reopening starts a fresh duration and recomputes current pause policy. Hidden Toast does not accept new transient hover/focus pause reports.
- Added real WC host tests for hover-close-reopen timeout and explicit owner pause across repeated windows. The hover case reproduced a stuck timer before the fix. An initial owner-pause test accidentally replaced the complete Web Component prop input and reset duration; it was corrected to preserve the duration explicitly, consistent with `setElementProps` replacement semantics.
- `FocusScope.hasFocused` records scope history and becomes true on scope activation. It does not observe current descendants leaving. Removed the invalid Popover watcher instead of claiming focus-exit dismissal from that fact. Earlier overlay-source notes that implied working focus-outside dismissal are superseded by this observation. Escape, outside press, close commands, controlled open ownership and focus restoration remain tested.
- Shared capability request sent to integration: realize `Overlay.closeOnFocusOutside` or a portable Boundary focus observation, keeping trigger/content boundaries and controlled requests. Current Overlay only stores the config; Boundary observes pointer press only. No DOM listener workaround was added to the prototype.

Validation: pinned offline pnpm 10.32.1; `controls.test.ts` 11 passed, `overlay-windows.test.ts` 10 passed. Ordinary Astro tsconfig and AlertDialog startup description warnings remain. Native/GPUI, browser visual, compiler/consumer and independent acceptance remain pending.
