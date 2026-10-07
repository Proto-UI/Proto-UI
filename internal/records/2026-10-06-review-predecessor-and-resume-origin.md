# Review predecessor commands and resume origin preservation

Bounded follow-up to PR #825 findings `4193104823` and `4193104832`, based on `a0ca6111073b2484ad209badc26343dfbbfad67a`.

## Historical candidate reference control

The preceding generic candidate enrichment was too broad. A repair could reuse an interrupted candidate's unbound reference, and subsequent aggregation could assign the repaired digest/revision to that historical material. The new negative control reproduced acceptance on a0ca before repair.

Aggregation now retains the first origin of each material. Missing binding fields can be coalesced only when the material first appeared in the actual adjacent input of a validation step, that exact input object matches the retained material, and the already-validated output comes from that validation step. Interrupted/history references, repair output and currentArtifacts cannot claim this enrichment. They must retain the old material or use a distinct reference. Existing-field conflicts still fail. No new artifact type, schema, I/O, permission or broader workflow change.

Controls cover direct repair reuse, reuse followed by validation, and refresh reuse of a historical reference; the legitimate adjacent missing→bound chain continues to pass. The assertions concern declared metadata provenance, not authentication of hidden file bytes.

## Command and caller audit

Audited current nonhistorical Markdown command examples across the repository. Updated the AgentOps README runnable validate/inspect/eligibility/submit-review commands, its compatibility statement, the pui-review leaf examples, and CLI help. Retain the actual received validation input and use --prior-handoff for validation-origin review; --prior-packet is a different review-history input. Other intake routes and read-only legacy ingestion remain supported.

Inspected every validateSkillHandoff production caller: the resolver passes its predecessor; review CLI supplies it at all four review entry commands; resume validates adjacent steps and its assembled output; the collaboration consumer selects pui-collaborate rather than a validation-to-review transition. Historical records are left intact. Real review CLI tests now include validation-origin validate/inspect/eligibility and a mocked submit-review write, with their actual predecessor, in addition to existing no-predecessor rejection and legacy intake tests. Documentation regressions keep these command examples from silently dropping the predecessor again.

The focused suite passes 41/41 on Node 24.19.0/Linux. Full AgentOps and repository checks are reported in the exact-head publication comment. Independent local review and final-head hosted CI remain separate. No fabricated UI screenshot; this is executable internal provenance and CLI evidence.
