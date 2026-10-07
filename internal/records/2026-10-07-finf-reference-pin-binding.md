# Finf declared reference snapshot pins

Status: bounded checker repair for PR #872 review r4205635664; not prototype acceptance.

On source `f91b80c45edc992beb0cdb2e77224a67c9c998a5`, four independent mutations (a different SHA and a different repository for each of shadcn/ui and Base UI) remained accepted while the rendered summary retained the declared snapshot. The original valid matrix passed.

Each per-subject pin now requires the corresponding GitHub repository and exact declared 40-hex snapshot revision through a `blob` or `tree` path, with a concrete descendant and no transport, credential, query or fragment alias. Existing URL uniqueness remains separately checked. No reference version, source inventory, denominator, lifecycle or completion status changed.

Verification: all 61 matrix tests passed, including 14 new negative controls (wrong revision/repository/host/transport/query/fragment and malformed URL for both projects). This verifies reference identity shape, not remote content availability or implementation admission. The original 47 controls remain intact.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
