# Phase 0: Autonomous Observer

Phase 0 evaluates a governed discovery-to-integration path while preserving independent evidence roles. The current entry may be manually invoked until a controller is deployed; that invocation shape is not a reason to insert maintainer approval between already governed transitions.

## Phase 0.1 execution surface

The repository-scoped [`pui-maintain` entry skill](../../../.agents/skills/pui-maintain/SKILL.md) routes one eligible protocol stage at a time and lazy-loads only the required stage skill. It does not replace this workflow or project authority. Independent Observer, Verifier, and remediation-review roles still require fresh task contexts. A supported no-finding result, an independently rejected finding, or a fully evidenced blocked terminal result is synchronized through `pui-record`; a confirmed governed drift proceeds through remediation, independent review, and `pui-maintenance-close`.

Machine-readable experiment state lives in [`runs.yaml`](./runs.yaml). Candidate discovery, control, and targeted follow-up work lives in [`mission-queue.yaml`](./mission-queue.yaml). Run `corepack pnpm@10.32.1 check:autonomous-maintenance` after changing packets, run state, or the queue.

Phase 0.1 is currently entered by a maintainer-controlled invocation or governed queue rather than a deployed repository scheduler. Current-user or standing authorization may cover the complete bounded maintenance path, including coherent commits, pull-request updates, review disposition, and exact-head integration; the workflow revalidates that scope at every mutation instead of requesting it again. Publication, release, access, secrets, rulesets, security disclosure, and provenance exceptions remain outside that ordinary path.

## Hypothesis

When given one bounded semantic slice, broad read and experiment permissions, and no known bug, an Agent can discover findings that are:

- reproducible;
- grounded in an external oracle;
- independently verifiable;
- previously unknown;
- valuable enough to investigate or fix.

## Run contract

Each run has one objective and one stopping condition. This follows the Codex long-running-work guidance to define the objective, constraints, input material, validation artifacts, checkpoints, and verifiable end state before starting: <https://learn.chatgpt.com/use-cases/follow-goals>.

An Observer run may inspect the repository and Git history, generate the local Agent projection, run checks, build packages, launch local applications, use browser tooling, and create temporary reproduction artifacts outside tracked paths.

An Observer run must not:

- modify tracked files;
- create branches, commits, issues, pull requests, or other external writes;
- promote a draft or open question into a stable guarantee;
- report a host implementation difference as a defect without proving a shared semantic requirement;
- recommend mutation without an external oracle.

The run finishes when it has either:

1. reported no more than three findings that survived falsification; or
2. exhausted the selected slice and explicitly reported that no verified finding was discovered.

## Workflow

1. Record the baseline commit and initial `git status --short`.
2. Start a fresh task with the Observer prompt and one mission scope.
3. Preserve the task output outside the repository while it is unreviewed.
4. Give the strongest candidate finding to a fresh task using the Verifier prompt. Do not provide the Observer's hidden reasoning or unrelated findings.
5. Record an independently rejected finding directly through `pui-record`. For a confirmed finding, determine whether existing authority already fixes the expected result.
6. Route governed drift directly into the independent remediation path below. Request one product-direction decision only when the verifier exposes a material semantic, ownership, public-guarantee, lifecycle, or compatibility choice that existing authority does not decide.
7. Promote durable confirmed observations to a dated file under `internal/records/**`, an Issue, or the normal spec/test workflow without rewriting historical run records.
8. Confirm the final tracked diff contains only the authorized remediation and coordination surface, never Observer or Verifier mutations.

## Exceptional decision packets

Most runs need no decision packet: finding disposition, implementation completion, commit grouping, review disposition, and merge follow current authority, independent evidence, standing authorization, and repository rules. The controller prepares one concise packet only when a run reaches either:

- `unresolved-product-direction`: existing authority does not decide a material semantic, ownership, public-guarantee, lifecycle, or compatibility choice;
- `privileged-or-irreversible-operation`: publication, release, access, secrets, rulesets, security disclosure, a provenance exception, or another action that cannot be safely bounded and recovered.

Progress updates and linked evidence may support the packet, but the maintainer must not need to reconstruct the requested decision from them.

The packet must state:

- the verified fact and confidence;
- the recommended decision;
- the exact scope that the decision would authorize;
- explicit exclusions and material residual risks;
- the next automated stage after the decision;
- any privileged or irreversible action that remains outside the bounded path.

Do not add a product-direction packet when the active spec, contract, accepted draft direction, or regression oracle already fixes the expected result. Do not add an integration packet when exact-head review, trusted CI, live permission, and repository rules already resolve integration.

## Independent remediation path

The Observer and Verifier remain read-only. Remediation then advances through independent evidence boundaries:

1. Create a review packet from the verified finding before changing code. Cite the authority that fixes the expected result. Mark genuinely new draft semantics as proposals and request product direction only when no existing authority decides them.
2. Implement the bounded governed change and update the packet with the actual diff, behavioral state transitions, direct/indirect/excluded impact surfaces, evidence limits, alternatives, and residual risks.
3. Run `corepack pnpm@10.32.1 check:autonomous-review`. This deterministic check validates packet structure, finding baseline, referenced entity identity and lifecycle, criterion anchors, paths, and declared change inventory. It does not judge whether the semantics or impact analysis are correct.
4. Give the finding, packet, repository, and actual diff to a fresh task using the Review Synthesizer prompt. Do not provide hidden Remediator reasoning or a desired verdict.
5. Correct any `incomplete` or `misleading` packet. If review exposes a product, compatibility, or scope choice that existing authority does not decide, request the one product-direction decision. Otherwise return technical gaps directly to remediation.
6. Mark implementation remediation complete automatically when independent review is `adequate` and every required validation is `passed`. The deterministic checker enforces this completion rule.
7. Continue technical completion through authorized commit grouping, pull-request review, and exact-head integration when live conditions agree. Publication, release, access, secrets, rulesets, security disclosure, and provenance exceptions remain separate privileged or irreversible operations.

For the retrospective first pilot, the code existed before the review-packet requirement was added. Its packet must use `post-implementation-pilot` and may be marked `revision-required`; this shows that independent review found decision-relevant work, not a reason to silently repair or approve it.

Reviewability is part of the experiment outcome. Capture whether the reviewer could restate the behavioral delta and impact boundary, how long the decision took, what the packet omitted, whether automated completion criteria passed, and the eventual integration decision.

## Files

- [`AUDIT-2026-08-20.zh-CN.md`](./AUDIT-2026-08-20.zh-CN.md): Phase 0.1 audit covering workflow assets, three completed runs, maturity, limits, and recommended next experiments.
- [`TUTORIAL.zh-CN.md`](./TUTORIAL.zh-CN.md): maintainer-oriented Chinese tutorial with applicability guidance, task prompts, real examples, no-finding behavior, and integration boundaries.
- [`prompts/observer.md`](./prompts/observer.md): reusable Observer prompt.
- [`prompts/verifier.md`](./prompts/verifier.md): independent verification prompt.
- [`prompts/review-synthesizer.md`](./prompts/review-synthesizer.md): fresh-task reviewability and impact-analysis prompt.
- [`templates/finding.md`](./templates/finding.md): finding evidence and disposition record template.
- [`templates/remediation-review.md`](./templates/remediation-review.md): proposal and post-implementation review packet template.
- [`templates/run-ledger-entry.md`](./templates/run-ledger-entry.md): schema-v2 run closure and exact integration receipt template.
- [`runs.yaml`](./runs.yaml): machine-readable run outcomes, missing metrics, completion rules, and integration evidence.
- [`mission-queue.yaml`](./mission-queue.yaml): bounded candidates for discovery, no-finding, repeatability, and targeted follow-up work.
- [`reviews/AM-P0-002-F1.md`](./reviews/AM-P0-002-F1.md): retrospective first remediation review pilot.
- [`missions/run-001-props.md`](./missions/run-001-props.md): frozen first mission scope.
- [`missions/run-002-remediation-review.md`](./missions/run-002-remediation-review.md): historical fresh-task prompt used for the first remediation review; its approval wording predates the automated-completion rule.
- [`missions/run-002-remediation-rereview.md`](./missions/run-002-remediation-rereview.md): historical fresh-task prompt used for the narrowed re-review; its approval wording predates the automated-completion rule.

Raw trajectories, screenshots, terminal logs, and temporary reproductions are not committed here by default.
