# Retained Overview owner token reconciliation

The complete CI run `43796319938` on
`9c5cb80c4b015910fc18193b697003e2864b6b18` stopped its coverage-governance
job because Issue #420's retained owner tokens no longer matched the canonical
website matrix.

Commit `4d6a4aca5b6f979d18c5dad71f9d5e277d09fc76`, already in this source's
ancestry, changed the existing `www.gallery.prototype-library-cards` row from
the retired overview to native documentation navigation and package inventory.
It changed the literal owner token from `website prototype documentation` to
`website documentation and package inventory`. The retained GitHub snapshot
predates that change. Independent read-only triage found this single token
difference; the other 26 Issue owner sets and all referenced Issue/PR IDs match.

This correction synchronizes that existing matrix token into Issue #420's
sorted owner list. It does not assign a person, infer consent from an assignee,
change matrix semantics or rewrite the separately pinned historical coverage
projection. The checker and workflow remain byte-identical.

The original `sync-github-governance-snapshot.mjs --check` was executed against
an exact copy of the checker, both canonical matrices and the candidate
one-token snapshot, using fresh connected GitHub reads. It exited 0 for all
27 Issues and PR #580. The only unrelated live difference was Issue #745's
observation timestamp, which the existing checker explicitly excludes from
governed-fact equality; its retained record was not rewritten. This establishes
current factual reconciliation, not a complete CI pass or platform approval.

Prepared with ChatGPT coding agents under the current user's continuation
request. The original failing CI job and independent triage are retained.
