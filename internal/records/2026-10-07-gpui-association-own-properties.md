# GPUI association lowering: own-property boundary

Date: 2026-10-07. Review: https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4205015894.

The finding was reproduced against the unchanged GPUI association ledger, not inferred from the analogous Core guard. Two controls failed: an empty record inherited a valid `Object.prototype.controlLabel` renderer key and created an association; an unsupported nonenumerable own field was ignored. A positive nonenumerable own `controlLabel` key control passed.

The bounded repair enumerates every own property name and reads `controlLabel` only when it is an own property. Existing symbol/prototype/key validation and commit-before-owner-retirement behavior remain intact. Core's existing guard is unchanged. This is protocol input validation, with no UI or native-pixel claim.

Verification: paired two failures and one positive control before the change; all three pass after it, together with the existing ControlLabel transport controls. The raw red/green outputs are retained in the implementation evidence packet. This patch does not perform a review-thread mutation or change a PR ref.
