# Label click receipt retirement

A review report was independently reproduced with a host negative test: an early capture listener swallowed the pointer sequence's click, then a later synthetic click-only call borrowed the still-released gesture and activated the associated control. The initial focused run retained one failure and 35 passes.

The Web host now consumes a release receipt at click capture and binds it to that exact event. A subsequent click cannot reuse a swallowed bubble event. A task-bound release expiry retires a receipt even when an earlier capture listener prevents this host from seeing the click. Timer cancellation and event-ticket retirement follow disable, cancellation, replacement and terminal disposal. Pointer receipts also require consistent host trust facts across down/up/click. Trusted non-pointer classification and synchronous cancellation remain unchanged; no target synthetic click or portable timer/state is introduced.

Ticket retirement deliberately uses a task, not a microtask: native event listener boundaries can drain microtasks before bubbling. Activation still occurs synchronously in the matching click listener. Native browser evidence remains required; Happy DOM does not certify browser scheduling or assistive technology.

Validation: two negative controls cover swallowed capture and same-dispatch receipt reuse, then prove a fresh pointer sequence still works. All 80 ControlLabel module/projection tests passed, and workspace TypeScript passed. An intermediate TypeScript error from a flow-narrowed type query was corrected with an explicit local receipt type before commit; it was not ignored.

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
