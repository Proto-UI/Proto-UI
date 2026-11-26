# Select Escape: public Root selection witness

Review 4194642120 reproduced four false acceptances on #775 `b2ce5453667ae1b22a31ef3b9f5febe066d97234`: one missing `aria-selected`, foreign owner, stale generation and partial option disconnection. Trigger text alone remained unchanged. A changed still-valid selected flag was already rejected; it remains a negative control.

## Existing public contract, not a new product API

The Base Select Root owns committed value and textValue (`P-BASE-SELECT` Root ownership, requests and selection invariant; the Brutalist Root inherits Base behavior). Its existing `expose.state` projections are public DOM facts: `data-value`, `data-text-value` and boolean `data-open`. Draft `M-EXPOSE-STATE-WEB-0001` B/C defines the string and boolean mapping.

The actual installed WC, React, Vue and Vue2 adapters were checked with no extra input or reopen: the same physical Root retained `paper` / `Paper`, while `data-open` changed from present to absent after Escape. Owner/generation alone would match toolbar Selects too, so the witness binds the unique current `brutalist-select-root` that contains the exact original Trigger. It retains that physical Root reference and requires prototype, owner, generation, connectedness and its non-detached view to remain valid.

## Secondary option projection evidence

WC retains valid options; React/Vue fully disconnect their option DOM. Vue2 keeps the baseline option nodes connected and owned, but its closed detached Content withdraws all role/id/aria-selected projections. `C-HOST-VIEW-ATTACHMENT-0001` keeps children initialized/collection-registered: this is not semantic selection retirement. A temporary all-connected-must-have-ARIA guard correctly exposed that distinction and its rejected Vue2 result is retained as investigation evidence.

The final predicate always requires the same live public Root value/textValue across open-to-closed, plus unchanged Trigger display. Secondary option evidence may be:

- all baseline options physically disconnected;
- all still-connected options in the exact owned popup retain valid option roles and unchanged IDs/text/selection facts;
- the complete same-lease closed option view is withdrawn: Content is detached and unpainted, every baseline option is still its owned Item, every role/id/aria-selected is withdrawn, and its label text is unchanged.

Mixed connectivity, partial/incomplete withdrawal, changed ownership/generation, corruption of retained facts, wrong Root/toolbar borrowing, Root replacement, changed/missing public selection fields or failure to close remain rejected. There is no new unknown exception, product mutation, private-state inspection or corrective input.

## Evidence boundary

- Four original corruption controls: red against baseline, green after repair; the existing changed-selection negative remains.
- Dedicated installed-adapter/helper suite: 56/56 passed, including all four normal adapter paths, public Root value/text/open observations, replacement/identity/field negatives and corrupt Vue2 withdrawal cases.
- DOM tests use the suite's explicitly controlled paint/geometry harness. They establish actual installed-adapter state and helper attribution, not native rendering. Current-head native family execution remains required and will save before/after public Root facts in the existing Escape record.
- No new journey, Prototype guarantee, semantic lifecycle change or full conformance claim is introduced.
