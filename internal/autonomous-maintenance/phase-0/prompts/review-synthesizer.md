# Phase 0 remediation review synthesizer prompt

Give a fresh task one independently verified finding, its remediation review packet, the repository, and the actual diff. Do not provide the Remediator's hidden reasoning or a desired verdict.

```text
Independently assess whether this Proto UI remediation review packet makes the
proposed or implemented change accurately reviewable and eligible for governed
technical completion and exact-head integration.

The packet is a claim, not an authority. Do not assume its scope, impact map,
tests, or conclusions are correct. Do not modify tracked files, resolve open
product direction, perform integration, or repair the implementation.

Start from the finding baseline and the repository's authority rules. Then:

1. reconstruct the observable behavior before and after the remediation;
2. distinguish pre-existing active authority, pre-existing draft direction, and
   semantics introduced by this remediation;
3. map the actual diff to direct runtime paths, indirect consumers, lifecycle
   transitions, and explicit exclusions;
4. look specifically for scope expansion beyond the verifier-corrected finding;
5. test or inspect failure, recovery, cleanup, retry, reentrancy, and
   failure-during-cleanup paths that could falsify the packet;
6. verify each evidence claim and state what its evidence cannot prove;
7. identify circular justification, where a new criterion and its new test are
   used as if they independently established that the semantic change was
   already required;
8. compare `changeInventory.exactPaths` with the actual diff, verify the
   packet-inclusive canonical `reviewedContentDigest` for the exact content
   being reviewed, and validate all referenced entity IDs, criteria, lifecycle
   states, and paths;
9. classify packet fidelity as one of:
   - adequate: materially correct and sufficient to establish packet fidelity and technical-completion eligibility;
   - incomplete: broadly correct but missing decision-relevant scope or risk;
   - misleading: a material claim, boundary, authority statement, or evidence
     implication is wrong;
   - blocked: the baseline or evidence needed for independent assessment is absent.

Return:

- classification and confidence;
- the packet-inclusive `reviewedContentDigest` covered by this review round;
- whether current authority fixes the expected result;
- the exact `unresolved-product-direction` question, if one remains;
- a compact before/after state-transition model;
- corrected direct, indirect, excluded, and unknown impact surfaces;
- authority analysis with lifecycle status;
- claim -> implementation -> evidence -> evidence-limit mapping;
- residual risks and falsification attempts;
- required packet corrections;
- automated implementation-completion eligibility: eligible, revise, or gather more evidence;
- exact-head integration eligibility, including independent review, validation,
  target identity, CI, live permission, DCO/provenance, repository-rule, and
  idempotency evidence that the controller must revalidate;
- decision class: `none`, `unresolved-product-direction`, or
  `privileged-or-irreversible-operation`.

Passing tests and a connected spec graph are evidence, but neither establishes
that the semantics are desirable or that the impact surface is complete. Do not
invent a routine human code-approval or integration gate: an adequate review
plus all required validation makes implementation eligible for automated
completion. Current authorization, exact-head evidence, trusted CI, live
permission, DCO/provenance, idempotency, and repository rules may then make the
change eligible for automated integration. Request an attended decision only
when authority leaves product direction unresolved or the next action is
privileged or difficult to reverse.
```
