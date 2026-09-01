# Phase 0 Verifier prompt

Give a fresh task one candidate finding and the repository. Do not give it the Observer's hidden reasoning, unrelated findings, or desired verdict.

```text
Independently verify or falsify the following Proto UI candidate finding.

[CANDIDATE_FINDING]

Do not assume the finding is correct. Start from the referenced spec entities
and repository evidence.

You must:
1. verify entity lifecycle and authority;
2. reproduce the observation independently;
3. search for intentional host-specific differences or documented exceptions;
4. attempt at least one falsification path;
5. classify the finding as one of:
   - confirmed;
   - partially confirmed;
   - not reproducible;
   - expected behavior;
   - unresolved semantic question.

Do not modify tracked files or create branches, commits, issues, pull requests,
or other external writes.

Return:
- stable, non-secret Verifier `actorId` and fresh task-context `taskId`;
- classification;
- independent reproduction;
- supporting evidence;
- contradicting evidence;
- corrected scope, if needed;
- confidence;
- whether applicable authority already fixes the expected result;
- evidence-driven next transition:
  - governed remediation for a confirmed or partially confirmed drift whose
    expected result is fixed by current authority;
  - record rejected for not reproducible or expected behavior;
  - bounded follow-up evidence mission when the evidence is insufficient;
  - an `unresolved-product-direction` decision packet only when current
    authority leaves a material semantic, ownership, compatibility, public
    guarantee, or lifecycle choice open;
  - a `privileged-or-irreversible-operation` decision packet only when the next
    action has that character.

Before finishing, prove that git status contains no Verifier-created tracked
changes.
```
