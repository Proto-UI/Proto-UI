# Native overlay observation ordering

The first integrated CI at `d0392fb31513b12f55b9e99b1fcf26a6338569c9` retained two distinct observation failures. Original logs and candidate parameters are in `evidence/2026-11-23-overlay-observation-order/`. Neither repair changes product behavior or claims that its native rerun has passed.

## Dialog partial remount

[Browser job 137596891706](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596891706) could not produce the required trusted pointer sample between Mask's normal 150ms detachment and Content's normal 200ms detachment. Its five attempts therefore failed the original precondition before testing the reported partial-remount dismissal behavior.

The observer previously waited for that 50ms window and then spent another page protocol round trip installing the pointer listener before sending the real click. It now installs the same passive, capture-phase observer after closing the mask and before waiting for the window. The actual pointer sample still determines whether Mask was detached while Content remained in its leaving phase; the wait predicate alone cannot satisfy this assertion. A missed window aborts and removes the listener before the next attempt. Successful sampling also clears its temporary observer state.

The original five attempts, 150ms/200ms clocks, 1000ms partial-window wait, 2000ms dismissal wait, trusted-input assertion, mask hit target, actual dismissal, body-overflow restoration, reopen and Escape assertions remain intact. No synthetic click or extended animation window is introduced.

## Menubar settled geometry

[Browser job 137596893964](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596893964) recorded four widths between 143.8813px and 143.8823px where the unchanged minimum is 143.9px. The public Rhea surface explicitly uses a 100ms `animate-in fade-in-0 zoom-in-95` keyframe. Keyboard focus and visibility can be available before its transform reaches the final geometry. Other cells measured the expected 144px and 288px widths.

The fixture now observes completion of the actual menu's native animations within the existing 1000ms polling budget before measuring its final item and content geometry. Every reported animation must be non-pending and finished or idle. It never cancels, finishes, replaces or disables an animation. Original size tolerances, viewport bounds, focus/paint assertions, native keyboard and pointer journeys remain unchanged.

An independent review found no blocking issue in these two fixture changes. This is source review only. The original full native suites remain required on the integrated candidate; transient geometry cannot be reported as fixed merely because the observation boundary is now explicit.
