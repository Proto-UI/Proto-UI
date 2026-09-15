# D-CONTEXT-NOTIFICATION-SCHEDULING-0001

The older context contract described callback notifications as synchronous and unmerged. The current v0 contract keeps the semantic part and relaxes the scheduling part.

Every successful context update must remain observable as a semantic transition. A delivered callback must receive the `next` and `prev` values for that transition, and ordering inside the same dispatch window must be deterministic.

However, the contract does not require every adapter to dispatch immediately and synchronously. Runtime or adapter scheduling may batch or align delivery with host loops as long as it does not drop updates, merge distinct semantic updates incorrectly, or change callback semantics.

J1 (0.3.0-alpha.0, still draft) orders reentrant deliveries within one provider generation and ContextKey by update commit order. The provider value commits immediately; reads may therefore be newer than a callback's historical next/prev payload. Nested callbacks can wait until the current transition finishes without requiring a microtask or a global order across channels.

Callbacks are eligible only if registered at commit and still subscribed to the same live owner at delivery. Disposal, rebinding and replacement invalidate old deliveries. For a finite synchronous dispatch window, callback errors are collected while other eligible deliveries finish, queue resources are cleared, and errors propagate without rolling back committed values. See C-CONTEXT-0010-F/G/H.
