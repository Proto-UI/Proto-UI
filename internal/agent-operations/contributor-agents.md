# Contributor Agents

This document governs Agents that enter ordinary Proto UI development through the repository skill system. It does not define product semantics. Applicable entities under `spec/**` remain authoritative according to lifecycle.

## Two entrypoints

`pui-dev` routes ordinary contribution work. It establishes context, traces authority, selects a bounded skill chain, validates the result, and stops at human gates.

`pui-maintain` routes the autonomous-maintenance protocol. It performs one recorded transition at a time and preserves fresh-context independence between observation, verification, remediation, and review.

The entrypoints are routers. Domain work belongs to the atomic `pui-*` skills registered in `internal/agent-operations/skills.yaml`.

## Effective capability

Repository participation has separate axes:

- live GitHub permission controls which platform operations the credential can perform;
- Discord and Poppy trust control which community and Bot surfaces are available;
- assessed comprehension limits which task classes an Agent may attempt;
- task risk limits the mutation allowed for that item;
- current human authorization controls semantic, integration, security, and release decisions.

The effective capability is their intersection. No assessment score, Discord role, model claim, or task label can increase GitHub permission.

If a permission source cannot be checked, writes fail closed. Read-only investigation may continue when it stays within the request.

## Comprehension bands

`internal/agent-operations/capability-policy.yaml` defines the machine-readable bands. The dimensions are source authority, relation tracing, semantic reasoning, verification design, governance safety, and epistemic discipline. Every dimension must meet a band's minimum; scores do not compensate across dimensions. A zero score derives U0, and any cataloged critical failure caps the result at C1.

An unsigned local self-assessment is useful for orientation, but C1 is only its maximum, not a guaranteed result, and it cannot authorize repository or GitHub writes. Higher bands require an independent, versioned, expiring attestation bound to a clean committed repository snapshot, the exact challenge and response, and the Agent subject. The claimed band must equal the score-derived band and its task classes must be a policy subset.

No band grants approval, merge, publication, release, access management, secret handling, or repository-rule changes.

## Dynamic assessment

The local cold-start path is executable but deliberately read-only. It produces a dynamic challenge, a challenge-bound answer form, deterministic response validation, a public self-scoring form, and an unsigned U0 or C1 result. It never produces a trusted attestation.

Generate a local self-assessment challenge and its response form with:

```sh
pnpm agent:assess > <challenge-path>
pnpm agent:assess:response -- --challenge <challenge-path> > <response-path>
```

The no-argument challenge creates an ephemeral subject and binds the complete non-ignored worktree. Fill every response answer from that bound snapshot, including located evidence, unknowns, and human gates. Set `submittedAt` to the actual RFC 3339 completion time within the challenge window, then validate it:

```sh
pnpm agent:assess:validate -- --challenge <challenge-path> --response <response-path>
```

For automation, the validator also accepts `--bundle <path-or->` containing `challenge` and `response`; `-` reads one JSON bundle from standard input. Deterministic validation checks the exact challenge, subject, digest, time window, answer cardinality, evidence shape, unknowns, and gates. It checks structural truth and binding, not semantic correctness.

Generate the public self-evaluation form, apply every 0-through-4 anchor in `capability-rubric.yaml`, record all applicable critical failures, and derive the unsigned result:

```sh
pnpm agent:assess:evaluation > <evaluation-path>
pnpm agent:assess:self-result -- \
  --challenge <challenge-path> \
  --response <response-path> \
  --evaluation <evaluation-path>
```

The derivation command also accepts a single `--bundle <path-or->` containing `challenge`, `response`, and `evaluation`. The same inputs always derive the same result. Every dimension must be scored independently; compensation across dimensions is forbidden. A self-result is unsigned, is capped at C1 even when every score is higher, has `mutationCeiling: none`, and explicitly states that it neither authorizes mutation nor substitutes for trusted attestation. A zero in any dimension derives U0. Critical failures are preserved in the result and enforce the policy ceiling.

An independent assessment uses the same answer contract but requires a stable subject fingerprint and a clean committed worktree:

```sh
pnpm agent:assess -- \
  --assessment-mode independent \
  --subject-key-fingerprint sha256:<64-lowercase-hex>
```

The generator binds repository identity, subject, commit and tree identities, complete snapshot digest, catalog, policy and generator digests, random nonce, challenge ID and digest, and expiry. It publishes no answer key. The questions test application of repository authority, relations, negative boundaries, evidence design, task eligibility, and permission intersections. Live queue facts must be timestamped because they are not part of the repository snapshot.

The Agent returns one answer per question using `schemas/capability-response.schema.json`. Each answer separates its conclusion, located evidence, unknowns, and human gates; the response contains neither a score nor an answer key. The public rubric defines philosophical scoring anchors without encoding repository answers. A trusted independent evaluator may apply a stricter private assessment surface, but this repository does not implement, emulate, or claim such an evaluator or issuer. A valid external attestation records the exact challenge and response digests, evaluator identity and version, dimension scores, limitations, issue time, expiry, and subject binding.

Trusted issuers are public Ed25519 keys in `trusted-capability-issuers.json`, scoped separately to `capability-attestation` or `task-probe`. The initial registry is empty, so every purported higher-band attestation fails closed. Registering or revoking an issuer is an attended access decision; no private key belongs in this repository. Verify a supplied attestation with `pnpm agent:verify-attestation -- ...`; schema conformance alone is never signature or trust verification.

The repository also has no external runtime-subject verifier and cannot prove that a model claim, a locally supplied fingerprint, or an exportable key belongs to the current Agent process. Attestations therefore record `runtimeAttestation.status: unavailable`, and every C2-or-higher mutation fails closed. A future verifier must supply a non-exportable, current proof through a separately governed adapter; an issuer signature alone is not that proof.

Obfuscating an answer file is not a security control. The repository contains no signing key and cannot issue a trusted high-band result to itself.

## Task-specific probe

Before a claim or mutation, bind a fresh probe to the work item, its update time, selected leaf ID, registry task class, minimum band and mutation kind, base and head SHAs, current worktree and diff, entity graph, requested action, current permission snapshot, and capability attestation. Verification requires `--leaf-id` and `--scope-file`; the scope file must equal the scope inside the signed probe.

The probe must state:

- governing authority and lifecycle;
- acceptance boundary and exclusions;
- affected semantic, host, Adapter, package, and public projections;
- focused evidence and escalation checks;
- stop and rollback conditions;
- required human gates;
- current ownership and linked work.

The signed scope names the only allowed repository paths and operations. A postflight verifier must compare the actual changed paths and performed operations with that scope; any path or operation outside it rejects the run.

Task mutation, permission change, repository drift, or expiry invalidates the probe. `pnpm agent:verify-task-probe -- ...` rechecks those live bindings and atomically consumes the probe in the repository's Git common directory. Callers cannot select a different consumption ledger. The capability attestation keeps its original clean commit, tree, catalog, policy, and generator baseline while the probe binds the current dirty continuation. The local ledger cannot coordinate separate runners, so every automatic external mutation is unavailable. Every C2-or-higher mutation is also unavailable until an external runtime-subject verifier exists. An attended human decision remains necessary for high-risk work and every always-human gate, but attendance does not replace missing subject proof.

## Claiming work

An Agent may claim only work that is explicitly ready, bounded, unclaimed, within its verified capability, and within live permission. It must inspect assignees, recent comments, linked pull requests, labels, milestone, and Project fields when available. Posting or releasing reversible claim metadata requires the applicable C2 task class, a verified probe, current human authorization, and live GitHub permission; C1 may only prepare a proposed claim.

Unassessed, oversized, design-blocked, ambiguous, or already active work is ineligible. If no item qualifies, the correct outcome is to report that no safe claim exists.

The future Project board will expose readiness, claim expiry, required comprehension, evidence state, and permission ceiling. Until that board is operational, live issue facts and a maintainer's recorded boundary remain necessary.

## Composition and handoff

Invoke only the skills needed for the current state transition. Pass explicit artifacts between them: capability envelope, authority map, decision packet, approval, change plan, evidence report, review verdict, residual risks, and next gate.

Use a fresh Agent context when a protocol requires independence. Pass raw artifacts and exact baselines, not hidden reasoning or a requested verdict.

Repository artifacts follow their governed language. Agents communicate progress, decisions, blockers, and handoff in the user's current language while preserving canonical identifiers and paths.
