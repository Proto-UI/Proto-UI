# Agent Operations

This directory defines the operational control plane for Agent-assisted GitHub work in Proto UI. It is not a project truth source and does not define Proto UI semantics. Applicable `spec/**` entities remain authoritative according to lifecycle.

Ordinary contributor Agents enter through `$pui-dev` and the composable skill registry in `skills.yaml`. Their capability and assessment rules live in `capability-policy.yaml` and `contributor-agents.md`. These files define task eligibility and routing; they do not grant GitHub permission.

Agent Operations coordinates multiple workflow families without flattening their domain-specific protocols:

- `issue-steward`: classify and route GitHub Issues;
- `pr-steward`: summarize pull-request state and route the next review or decision;
- `reposteward-pr-portfolio`: manually trial RepoSteward's read-only PR portfolio snapshot as an external `pr-steward` evidence source;
- `autonomous-maintenance`: delegate bounded discovery and remediation to the separate workflow under `internal/autonomous-maintenance/**`.

`autonomous-tasks.yaml` is the machine-readable catalog of deployed, manual, and candidate recurring task families. `autonomous-tasks.md` explains which parts actually run today. Candidate entries are designs, not active automation.

## Active path: intake, review, and exact-head integration

Agent Operations now has an active end-to-end local path. The hourly repository workflow and Event shadow provide sanitized intake and reconciliation signals. The credentialed local runner re-collects canonical live state, performs evidence-bound review, submits authorized dispositions, and integrates clean exact heads. Each lane has one job; the read-only intake token is not the capability ceiling of the downstream system.

The scheduled shadow runs once per hour at minute 17 UTC and may also be dispatched manually. It collects bounded Issue and PR facts, validates a structured route, and preserves artifacts. Event-driven delivery is the primary direction; until its controller is deployed, the hourly sweep is the automatic trigger and later becomes reconciliation fallback. The manually dispatched RepoSteward trial remains an optional external evidence source whose incomplete results stay visible.

The live GitHub repository is the source for Issue and PR state. Downstream mutation primitives always re-read it and bind actions to an exact target, so intake artifacts never become a second tracker or a portable authorization credential.

## Event shadow contract, not a deployed listener

`event-shadow.yaml` defines the first contract-only slice of the intended event-driven path. It does not register a webhook, deploy a listener or controller, receive a GitHub token, run a Coding Harness, or change the current scheduled workflow. The scheduled shadow remains the only automatic repository workflow described here.

The Event shadow runtime authenticates the exact raw request bytes with `X-Hub-Signature-256`, then cross-checks declared transport headers and payload identities against runtime-supplied repository, hook, installation, and dedicated-Agent anchors. GitHub's raw-body HMAC does not authenticate those headers, so they remain transport claims and never grant authority. Its normalized envelope contains identity and revision facts, not Issue bodies, pull-request bodies, comments, patches, commit messages, or filenames. An external contributor or fork may wake read-only collection; neither identity grants action authority.

The current allowlist covers selected `pull_request` lifecycle actions for offline shadow replay. The replay key binds the trusted repository ID to the authenticated raw-body digest instead of unauthenticated delivery or hook headers. Rewriting those headers therefore cannot re-key the same signed body; byte-identical deliveries collapse to one observation, which is safe because E0 can only request a fresh live read. A per-pull-request cursor detects older or tied revisions, but it does not pretend GitHub deliveries have a total order. Those cases return `reconcile-live-state`. An admitted event returns only `collect-live-state`; it is permission to observe again, not permission to review or mutate.

The CLI accepts a captured raw delivery, deployment-bound public trust anchors, and optional prior state. The webhook secret must come from a named environment variable. Schema-valid unique delivery keys may arrive in any order; the runtime canonicalizes them before producing its pure `nextState`. It does not persist or consume that state, so a future controller must provide the globally consistent store and atomic lease before deployment.

```sh
corepack pnpm@10.32.1 agent:event-shadow -- replay \
  --delivery <raw-delivery.json> \
  --trust <deployment-trust.json> \
  --state <prior-state.json>
```

Every envelope and receipt fixes `mutationAuthorized` to `false` and `writeOperationsPerformed` to `0` because this layer authenticates and orders signals; it does not carry a GitHub credential. An admitted event triggers canonical live recollection, after which `pui-review` and `pui-integrate` may act under their active standing scopes. A consumer that does not trust the process boundary must retain the signed raw body and reproduce normalization. A production controller still supplies durable replay storage, leases, acknowledgements, and independently authenticated transport provenance.

## Maintainer-controlled local review and integration schedule

The Codex desktop task `proto-ui` is separate from the intake workflow and runs with two active standing scopes. `proto-ui-scheduled-review-v1` submits complete, finding-backed `REQUEST_CHANGES` and clean `APPROVE` dispositions. A spec path is not a blanket gate: governed refinements and evidence repairs may be approved automatically, while a packet that exposes unresolved product direction stops with that exact decision. `proto-ui-scheduled-merge-v1` squash-merges a clean exact head after an approval independent of the PR author and every commit contributor, no active change request, resolved threads, trusted CI, trusted DCO status, live permission, and GitHub `MERGEABLE`/`CLEAN` state agree.

The local repository cannot authenticate a Codex task name, and a process holding the live GitHub credential could bypass these scripts. The effective boundary is the standing policy intersected with the live credential, the content-specific review class, a C2 mutation floor, canonical input reconciliation, exact-head API writes, single-runner operation, and GitHub repository rules. Strong runtime attribution, service-side leases, and atomic replay protection are added before overlapping privileged runners are enabled.

The intake token remains read-only. Downstream review and merge commands bind `commit_id` or `sha` to the inspected head, reconcile stale or unknown outcomes, reject review dispositions from the PR author or any commit author/committer platform identity, fail closed when a contributor identity is unavailable, never count an approval with unknown reviewer identity, preserve active `CHANGES_REQUESTED` even when its reviewer identity is unknown, require separately trusted CI and DCO conclusions plus resolved threads, and never force or bypass repository rules. Source/license provenance remains part of the independent content review; DCO success does not replace it. Those technical invariants enable automatic progress; they are not repeated human approval points.

## Execution boundary

The hourly scheduled and manually dispatched workflow in `.github/workflows/agent-operations-shadow.yml` uses this sequence:

1. check out the default-branch repository state with persisted Git credentials disabled;
2. collect a bounded GitHub snapshot using read-only repository permissions;
3. validate the versioned policy, workflow registry, schema, and fixtures;
4. run the commit-pinned Codex Action with Codex CLI `0.138.0`, the `:read-only` permission profile, and no network access when `OPENAI_API_KEY` is available;
5. validate the structured report against the snapshot and Phase A invariants;
6. upload the input and report as artifacts without writing from the intake credential; eligible exact-target continuation is handed to the credentialed local mutation leaves.

Issue and pull-request bodies are untrusted data. The collector strips HTML comments and control characters, applies length bounds, and records truncation. Deterministic validation, exact-action authorization, and live preflight keep authored text in the evidence plane while allowing eligible work to continue automatically.

## Decision boundaries and standing automation

The default is `none`: ready governed work continues through claim, implementation, validation, review, ready-for-review, and exact-head integration. Only two decision classes interrupt that path:

- `unresolved-product-direction`: existing authority cannot decide a material semantic, ownership, public-guarantee, lifecycle, or compatibility choice;
- `privileged-or-irreversible-operation`: publication, release, access, secrets, rulesets, security disclosure, a provenance exception, or another action that cannot be safely bounded and recovered.

A decision packet asks only for the unresolved choice and names the automatic continuation. Finding disposition, commit grouping, review disposition, and merge are evidence-driven workflow states rather than separate human gates.

## Files

- `policy.yaml`: permission gradient, allowed Phase A proposals, attended decision classes, notification limits, and graduation criteria.
- `event-shadow.yaml`: contract-only webhook authenticity, allowlist, replay, ordering, and zero-write boundary; it is not a deployed workflow registry entry.
- `workflows.yaml`: workflow registry and delegation boundaries.
- `autonomous-tasks.yaml`: recurring-task status, capability, inputs, outputs, and stop conditions.
- `autonomous-tasks.md`: human-readable deployment boundary for recurring Agent work.
- `skills.yaml`: lazy-loaded ordinary development and maintenance skill transitions.
- `schemas/skill-handoff.schema.json`: strict one-leaf handoff contract used by the resolver.
- `capability-policy.yaml`: execution modes, local comprehension bands, autonomous ceilings, standing automation, and the two attended decision classes.
- `capability-rubric.yaml`: public philosophical anchors for unsigned self-assessment; it contains no repository answer key.
- `contributor-agents.md`: readable policy for ordinary Contributor Agents.
- `schemas/shadow-report.schema.json`: structured output contract used by Codex and deterministic validation.
- `schemas/capability-challenge.schema.json`: dynamic assessment challenge contract.
- `schemas/capability-response.schema.json`: evidence-backed answer contract without a score or answer key.
- `schemas/capability-self-result.schema.json`: deterministic unsigned U0-C4 local task-fit result.
- `schemas/review-input.schema.json`: canonical v4 PR author/state, base ref, changed files, full commit messages, commit author/committer identities, review/conversation state, check source/provider/repository/workflow provenance, check results, and external evidence used for review hashing, trusted-CI/DCO evidence, contributor-independence enforcement, and spec-entity classification.
- `schemas/review-packet.schema.json`: revision-bound local review evidence contract.
- `schemas/collaboration-request.schema.json`: closed purpose-bound request envelope; the runtime additionally validates each action's exact target and expected/desired state.
- `schemas/collaboration-receipt.schema.json`: closed zero-or-one-mutation receipt with request, target, pre/post state, platform object, and reconciliation bindings.
- `schemas/event-envelope.schema.json`: raw-body-authenticated, identity-only GitHub delivery envelope with explicit unauthenticated-header provenance.
- `schemas/event-shadow-{delivery,trust,state,receipt}.schema.json`: raw replay input, deployment trust anchors, controller-owned state, and deterministic no-write outcome contracts.
- `.agents/skills/pui-integrate/SKILL.md`: exact-head integration transition after independent approval and repository-rule readiness.
- `.agents/skills/pui-collaborate/SKILL.md`: exact-target reversible Issue, pull-request, thread, and CI continuation under current-user or standing authorization.
- `fixtures/**`: positive and negative replay controls.
- `scripts/agent-operations/collect-github-state.mjs`: bounded, sanitizing GitHub snapshot collector.
- `scripts/agent-operations/reposteward-portfolio.mjs`: validates a raw RepoSteward portfolio snapshot and writes the stable trial envelope and Actions summary.
- `scripts/agent-operations/check-agent-operations.mjs`: policy, registry, schema, fixture, and optional live-report checker.
- `scripts/agent-operations/assessment-runtime.mjs`: snapshot, challenge, response, self-result integrity, and local scoring primitives.
- `scripts/agent-operations/skill-registry.mjs`: strict lazy registry and handoff validator.
- `scripts/agent-operations/resolve-skill.mjs`: deterministic one-leaf resolver.
- `scripts/agent-operations/validate-capability-response.mjs`: challenge-bound response validator.
- `scripts/agent-operations/derive-self-assessment.mjs`: unsigned U0-C4 task-fit result derivation.
- `scripts/agent-operations/review-runtime.mjs`: canonical review-input hashing, packet binding, prior-packet reconciliation binding, strict schema-matched validation, and submission checks.
- `scripts/agent-operations/collect-live-review-input.mjs`: live GitHub collection of the canonical review input plus viewer identity, permission, and CI state at the submission boundary.
- `scripts/agent-operations/review-packet.mjs`: CLI used by `pui-review` and `pui-integrate` to hash input, validate, inspect, submit one exact-head review disposition, or perform one exact-head merge after a fresh live preflight.
- `scripts/agent-operations/collaboration-runtime.mjs`: strict purpose-bound request and receipt validation plus current-user/standing-scope authorization, exact-state no-op detection, and action-specific stale-state rejection.
- `scripts/agent-operations/collect-live-collaboration-state.mjs`: live GitHub collection and the seven exact collaboration mutation primitives, each limited to one write. Synchronous actions use one post-write verification read; GitHub's asynchronous update-branch action uses bounded read-only polling for head and ancestry convergence. Unknown outcomes receive one reconciliation and no blind retry.
- `scripts/agent-operations/collaboration-packet.mjs`: `pui-collaborate` CLI that seals or validates a request, performs the live preflight, and emits a schema-bound no-op or applied receipt.
- `scripts/agent-operations/event-shadow.mjs`: HMAC verification, normalized envelope, allowlist, replay, and revision-order primitives.
- `scripts/agent-operations/event-shadow-cli.mjs`: offline replay CLI that emits an envelope, receipt, and pure next state without persistence or network access.
- `.github/workflows/reposteward-portfolio-shadow.yml`: manual, read-only RepoSteward portfolio trial pinned to the registered external commit.

## Collaboration execution contract

A collaboration request names exactly one of the seven actions in `proto-ui-scheduled-collaboration-v1`, carries an empty attended-decision list, binds current-user instruction or governed-outcome evidence, and includes the exact repository, object identity, `updatedAt`, and head, base, thread, or workflow identity that the action needs. Metadata requests carry complete expected and desired metadata; update-branch requests bind `expected_head_sha`; ready-for-review carries validation evidence; thread resolution and CI rerun carry resolution or diagnosis evidence; bounded comments receive a request-digest marker.

Run `agent:collaborate -- request-digest` after the request is complete, then put `sha256:<requestDigest>` on the handoff's `collaboration-request` artifact and the exact authorization ID on its `mutation-authorization` artifact. Autonomous handoffs also bind the loaded self-assessment through the `capability-envelope` digest. `apply` rejects a stale or mismatched preflight before writing, emits a zero-write receipt when the desired state is already live, or performs one write followed by verification. Update-branch verification polls read-only state up to 12 times over roughly 11 seconds while the pull request stays open and its exact base remains unchanged; it tolerates GitHub exposing the updated head before compare ancestry converges. Other actions use one verification read. Only the unique bounded-comment marker can prove an otherwise unknown write; every other unknown outcome stops after one reconciliation and says not to retry blindly.

Run:

```sh
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 agent:assess
corepack pnpm@10.32.1 agent:skill -- pui-orient --mode human-assisted --mode-source current-user
corepack pnpm@10.32.1 agent:review -- input-digest --input <review-input.json>
corepack pnpm@10.32.1 agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json>
corepack pnpm@10.32.1 agent:collaborate -- request-digest --request <request.json>
corepack pnpm@10.32.1 agent:collaborate -- apply --request <request.json> --handoff <handoff.json> --assessment <result.json>
corepack pnpm@10.32.1 agent:event-shadow -- replay --delivery <raw-delivery.json> --trust <deployment-trust.json>
corepack pnpm@10.32.1 agent:review -- submit-review --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --authorization explicit-current-user
corepack pnpm@10.32.1 agent:review -- merge-pull-request --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --authorization explicit-current-user
```

## Capability activation

Keep intake credentials minimal and activate mutations through exact-purpose downstream primitives. Accumulated shadow evidence can enable one reversible action class at a time through an evidence-backed policy change with zero unauthorized or duplicate mutations, complete decision-boundary recall, live reconciliation, and a disable path. This grows useful automation without turning the intake event itself into authority.
