# Adoption review: retire at mutation delivery

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Independent review of `a8169d91c32d043c4368f8c7f0f1a929c6f5a42f` found a concrete lifetime/safety blocker: its automatic adoption detection still depended on a queued old-window geometry RAF. When only the destination gets rendering opportunities, destination reduced-transparency and geometry changes are not observed; the old self-optical paint and resource leases persist. This is a product defect, not merely missing native evidence. The previous candidate's passing tests and historical record remain intact and do not establish acceptance.

The existing shared geometry MutationObserver now notifies only migrated hosts at actual child-removal delivery, before scheduling ordinary geometry work. The sink then retires the old document resources and registers the destination binding. No polling loop, timer or per-surface MutationObserver is introduced. A shared observer with stationary users keeps their coalesced geometry RAF; when the last user retires, no new old-window RAF is queued.

The added sink negative control reproduces the review with the old window's RAF never resumed: it is red on `a8169d91`, green after the correction. A separate real-MutationObserver control verifies migrated-host immediate notification, stationary-host RAF coalescing and cancellation on final cleanup. These are Happy DOM lifecycle observations with controlled rendering schedules, not native adoption, GPU paint or OS-media evidence. Exact-head native subtree adoption and repeated round-trip checks remain open independently.
