# Portal layer acquisition recovery: PORTAL-REVIEW-001

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Independent review found a regression in the direction/reentrant-lease candidate: a throwing layer `attach` left a pending receipt with no release callback, so the same target never retried attachment. The original provider error propagated, but later reconciliation could acquire modal state without a layer. The review's exact counterexample passed on d12 and failed on the candidate.

`applyLayerIfNeeded` now records successful completion only after `attach` returns. A failed attempt clears only its own still-current receipt; its original error remains visible. Existing provider/generation checks and pending-aware release behavior are preserved.

The additive packet retains all 16 original reentry controls plus the review's failed-attach retry case and three acquire-stage deactivate/reactivate controls. Reproduction: 19 passed, retry case failed. After the three-line implementation repair: all 20 reentry controls and the complete 38-test Overlay module suite passed. Workspace type checking is recorded in the accompanying delivery evidence. No candidate browser result, budget reconciliation, formal approval or publication is claimed.
