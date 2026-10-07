# Preserve optional candidate binding at validation

Follow-up to PR #825 finding `4192969611`, exact parent `3081d2b9faee6336e2270e10f004babeb0c52eb1`.

The original handoff contract declares digest/revision optional (`internal/agent-operations/handoff.md`, material metadata section). Ordinary regression, spec and test producers do not promise bound digests. Validation owns reading the actual diff, executing checks and reporting evidence. The preceding refresh repair mistakenly required an unchanged digest-bound input at review exit without allowing validation to bind valid optional input.

Both v1 and v2 producer→validation→review tests reproduced this dead end on 3081. The bounded repair allows only missing→bound enrichment: keep the exact reference and all existing fields, fill the missing digest, and for v2 fill a missing revision with the current head. Changed existing hashes, identities or metadata still reject. No new universal entry gate or producer round trip.

Received reports that lack digests can accompany validation. The final report must then use a distinct reference plus a digest; known old digests still reject even when renamed. Failed/partial/not-run fresh evidence remains available for independent review.

## Verification and scope

The new paired v1/v2 tests compute the fixture's actual SHA-256 and exercise both resolver and review CLI without returning to the producer. They reject changed references, changed established digests and reuse of a digestless old report reference. They also explicitly demonstrate the trust limit: a newly supplied well-formed digest is structural metadata, not authenticated bytes. Opaque/unavailable references do not cause the generic validator to read any file or fetch any URL. The implementation adds no filesystem or network I/O. Actual authorized artifact inspection/hashing remains validation's job.

All eight focused refresh/binding tests pass. Full AgentOps, formatting and repository checks are recorded with the exact publication comment. No product source, package budget, dependency, permission, secret or protection changes. Independent review and final-head hosted CI remain separate.

The resumed diagnosis/repair/validation chain has its own red-to-green control: its provenance aggregator originally rejected the permitted missing-to-bound enrichment. After validating each adjacent step, aggregation now coalesces only missing candidate digest/revision fields; established-field conflicts still reject. The separate eight refresh/binding tests and this resume control all pass.
