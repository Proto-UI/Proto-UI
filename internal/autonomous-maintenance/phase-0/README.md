# Phase 0: Autonomous Observer

Phase 0 evaluates autonomous discovery before building a scheduler, controller, or mutation workflow.

## Phase 0.1 execution surface

The repository-scoped Skill at [`.agents/skills/proto-ui-autonomous-maintenance/SKILL.md`](../../../.agents/skills/proto-ui-autonomous-maintenance/SKILL.md) routes one eligible protocol stage at a time. It does not replace this workflow or project authority. Independent Observer, Verifier, and remediation-review roles still require fresh task contexts.

Machine-readable experiment state lives in [`runs.yaml`](./runs.yaml). Candidate discovery, control, and targeted follow-up work lives in [`mission-queue.yaml`](./mission-queue.yaml). Run `corepack pnpm@10.32.1 check:autonomous-maintenance` after changing packets, run state, or the queue.

Phase 0.1 remains manually triggered. It does not schedule tasks, infer permission to create a new task, or authorize commit, merge, publication, or release.

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
5. Record human disposition and finding-triage time using the finding template.
6. For an accepted finding, enter the remediation review gate below. Finding acceptance does not grant semantic approval or mark implementation technically complete.
7. Promote only accepted durable observations to a dated file under `internal/records/**`, an Issue, or the normal spec/test workflow.
8. Confirm the final tracked diff contains only intentionally authored experiment infrastructure, not Observer mutations.

## Human decision packets

When a run reaches a human finding, semantic, or integration gate, the controller must collect decision-relevant material into one concise approval packet. Progress updates and linked evidence may support the packet, but the maintainer must not need to reconstruct the requested decision from them.

The packet must state:

- the verified fact and confidence;
- the recommended decision;
- the exact scope that approval would authorize;
- explicit exclusions and material residual risks;
- the next automated stage after approval;
- actions that remain separately gated, especially commit, merge, publication, and release.

Keep finding disposition, semantic direction, and integration authorization distinguishable even when the maintainer chooses to approve more than one of them in a single reply.

## Remediation review gate

The Observer and Verifier remain read-only. Remediation has two human gates with automated implementation completion between them:

1. Create a review packet from the accepted finding before changing code. Mark new draft semantics as proposals, distinguish them from pre-existing active authority, and request semantic approval.
2. After semantic approval, implement the bounded change and update the packet with the actual diff, behavioral state transitions, direct/indirect/excluded impact surfaces, evidence limits, alternatives, and residual risks.
3. Run `corepack pnpm@10.32.1 check:autonomous-review`. This deterministic check validates packet structure, finding baseline, referenced entity identity and lifecycle, criterion anchors, paths, and declared change inventory. It does not judge whether the semantics or impact analysis are correct.
4. Give the finding, packet, repository, and actual diff to a fresh task using the Review Synthesizer prompt. Do not provide hidden Remediator reasoning or a desired verdict.
5. Correct any `incomplete` or `misleading` packet. If review exposes a product, compatibility, or scope tradeoff, return to the human semantic gate. Do not ask a human to re-verify ordinary code correctness.
6. Mark implementation remediation complete automatically when independent review is `adequate` and every required validation is `passed`. The deterministic checker enforces this completion rule.
7. Keep commit, merge, release, and change-grouping decisions as the separate human integration gate. Technical completion neither creates a commit nor authorizes publication.

For the retrospective first pilot, the code existed before the gate was added. Its packet must use `post-implementation-pilot` and may be marked `revision-required`; this is evidence that the gate found decision-relevant work, not a reason to silently repair or approve it.

Reviewability is part of the experiment outcome. Capture whether the reviewer could restate the behavioral delta and impact boundary, how long the decision took, what the packet omitted, whether automated completion criteria passed, and the eventual integration decision.

## Files

- [`AUDIT-2026-08-20.zh-CN.md`](./AUDIT-2026-08-20.zh-CN.md): Phase 0.1 audit covering workflow assets, three completed runs, maturity, limits, and recommended next experiments.
- [`TUTORIAL.zh-CN.md`](./TUTORIAL.zh-CN.md): maintainer-oriented Chinese tutorial with applicability guidance, task prompts, real examples, no-finding behavior, and integration boundaries.
- [`prompts/observer.md`](./prompts/observer.md): reusable Observer prompt.
- [`prompts/verifier.md`](./prompts/verifier.md): independent verification prompt.
- [`prompts/review-synthesizer.md`](./prompts/review-synthesizer.md): fresh-task reviewability and impact-analysis prompt.
- [`templates/finding.md`](./templates/finding.md): finding and human-disposition template.
- [`templates/remediation-review.md`](./templates/remediation-review.md): proposal and post-implementation review packet template.
- [`runs.yaml`](./runs.yaml): machine-readable run outcomes, missing metrics, completion rules, and integration evidence.
- [`mission-queue.yaml`](./mission-queue.yaml): bounded candidates for discovery, no-finding, repeatability, and targeted follow-up work.
- [`reviews/AM-P0-002-F1.md`](./reviews/AM-P0-002-F1.md): retrospective first remediation review pilot.
- [`missions/run-001-props.md`](./missions/run-001-props.md): frozen first mission scope.
- [`missions/run-002-remediation-review.md`](./missions/run-002-remediation-review.md): historical fresh-task prompt used for the first remediation review; its approval wording predates the automated-completion rule.
- [`missions/run-002-remediation-rereview.md`](./missions/run-002-remediation-rereview.md): historical fresh-task prompt used for the narrowed re-review; its approval wording predates the automated-completion rule.

Raw trajectories, screenshots, terminal logs, and temporary reproductions are not committed here by default.
