# Same measured tuple at actual review dispatch

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Independent review of frozen `0d4229a52884dfc09910d13e66f59536214a0297` found a real freshness gap despite that source's 1629 passing agent-operation tests: the final authorization precedes `await consumePublicationAttempt`, whose remote implementation performs ledger IO. A receipt can expire during that await. Refreshing only policy afterward allowed the expired tuple to reach one mock POST.

The independent frozen-clock counterexample was retained, and this worktree reproduces it with a separate exact-boundary regression: at one millisecond before expiry publication succeeds; at expiry, the old source incorrectly makes one POST. The minimal repair validates freshness/scope and the exact intent body's disclosure against the same already-cloned tuple immediately after the consumed-attempt await and policy refresh, before calling submit. The transport reaches its connector call without another preceding await. It neither swaps to a fresh receipt nor changes any authorization requirement.

When expiry is found after consumption, the existing catch path retains unknown intent, false publication confirmation and `retryAllowed:false`. The regression also proves a second publication attempt cannot dispatch. Both boundary cases plus the six existing measured-input controls pass (8/8). The old red, new green, independent review log and complete-suite rerun are separately retained. The earlier 1629 green result belongs only to 0d4229 and does not override this independent red or establish the amended source's aggregate result.
