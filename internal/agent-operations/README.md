# Agent Operations

Operational control plane for Agent-assisted GitHub work in Proto UI: lazy skill composition, sanitized intake, evidence-bound review, and exact-head integration.

## Scope & Limits

- Defines operational routing and safety gates, not Proto UI semantics (`spec/**` remains authoritative) and not GitHub permissions (enforced live by credentials and repository rulesets).
- The three generic scheduled writer scopes (`proto-ui-scheduled-collaboration-v1`, `proto-ui-scheduled-review-v1`, `proto-ui-scheduled-merge-v1`) are `pending-runtime-identity`: scheduled runs remain read-only observation and reconciliation until Poppy broker-verified workload identity is bound.
- Explicit human-directed connected operations ([contributor-agents.md](contributor-agents.md#explicit-current-user-connected-operations)) and verified durable owner delegation ([handoff.md](handoff.md)) are separate governed paths; neither activates the generic scheduled scopes.

## Architecture and workflow lanes

| Component | Entry / Owner | Responsibility |
| --- | --- | --- |
| Contributor skill routing | `$pui-dev`, [skills.yaml](skills.yaml), [contributor-agents.md](contributor-agents.md) | Lazy one-leaf transitions with optional `allowedNextSkillIds` gates (e.g., `pui-package-budget` → `pui-validate`) and `humanDirectedRequires` for explicit current-user connected operations. |
| Autonomous maintenance | `$pui-maintain`, [../autonomous-maintenance/README.md](../autonomous-maintenance/README.md) | Separate Observer → Verifier → Remediator → Reviewer → Closure protocol. |
| Read-only shadow intake | `.github/workflows/agent-operations-shadow.yml`, [autonomous-tasks.md](autonomous-tasks.md) | Hourly UTC :17 read-only collection (`issue-steward`, `pr-steward`, manual `reposteward-pr-portfolio`), sanitized via `collect-github-state.mjs`, validated with Codex CLI `0.138.0` (`:read-only`, offline). |
| Publishers & collaboration | [publishers-and-collaboration.md](publishers-and-collaboration.md) | Exact-target `agent:publish`, `agent:collaborate`, thread-revision digests, and offline `event-shadow.yaml` replay. |
| Review & exact-head merge | [review-and-merge-runtime.md](review-and-merge-runtime.md) | Canonical v5 collection, schema v2 `agentEvidence`, publication credit, squash merge verification, and cloud connector review boundaries. |
| Composable continuation | [handoff.md](handoff.md) | v2 interrupted-review resume, repeatable artifacts, and durable owner delegation. |

## Decision boundaries

Ready governed work defaults to `none` (continuing automatically through claim, implementation, validation, review, ready-for-review, and exact-head integration). Only two attended decision classes pause execution:

- `unresolved-product-direction`: existing authority cannot settle a semantic, ownership, lifecycle, public-guarantee, or compatibility choice.
- `privileged-or-irreversible-operation`: publication, release, access, secrets, rulesets, security disclosure, or provenance exceptions.

## Common commands

When `pui-review` consumes a handoff produced by `pui-validate`, pass `--prior-handoff` pointing to the actual input handoff received by validation (distinct from `--prior-packet`).

```sh
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 agent:assess
corepack pnpm@10.32.1 agent:skill -- pui-orient --mode human-assisted --mode-source current-user
corepack pnpm@10.32.1 agent:review -- input-digest --input <review-input.json>
corepack pnpm@10.32.1 agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --prior-handoff <received-validation-input.json>
corepack pnpm@10.32.1 agent:review -- inspect --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --prior-handoff <received-validation-input.json> --current-base <sha> --current-head <sha>
corepack pnpm@10.32.1 agent:review -- eligibility --handoff <handoff.json> --prior-handoff <received-validation-input.json> --review-class <class>
corepack pnpm@10.32.1 agent:review -- submit-review --mode human-assisted --mode-source current-user --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --prior-handoff <received-validation-input.json> [--prior-packet <prior-packet.json>] --authorization explicit-current-user
corepack pnpm@10.32.1 agent:review -- merge-pull-request --mode human-assisted --mode-source current-user --packet <packet.json> --input <review-input.json> --published-review-packet <original-approved-packet.json> --handoff <handoff.json> --authorization explicit-current-user
corepack pnpm@10.32.1 agent:collaborate -- thread-revision --repository <github.com:owner/repo> --pull-request <number> --thread <thread-id>
corepack pnpm@10.32.1 agent:collaborate -- request-digest --request <request.json>
corepack pnpm@10.32.1 agent:collaborate -- validate --mode human-assisted --mode-source current-user --request <request.json> --handoff <handoff.json>
corepack pnpm@10.32.1 agent:collaborate -- apply --mode human-assisted --mode-source current-user --request <request.json> --handoff <handoff.json> [--assessment <result.json>] --authorization explicit-current-user
corepack pnpm@10.32.1 agent:event-shadow -- replay --delivery <raw-delivery.json> --trust <deployment-trust.json>
```

## Directory map

| Path | Purpose |
| --- | --- |
| `policy.yaml`, `workflows.yaml`, `autonomous-tasks.yaml` | Permission gradient, workflow registry, and recurring-task catalog (`autonomous-tasks.md` documents what runs today). |
| `skills.yaml`, `capability-policy.yaml`, `capability-rubric.yaml` | Lazy skill transitions, U0–C4 local task-fit bands, and public self-assessment rubric (no answer key). |
| `event-shadow.yaml` | Contract-only webhook authenticity, allowlist, replay, and zero-write boundary. |
| `schemas/*.schema.json` | Machine-validated contracts for skill handoffs, shadow reports, assessment, review input v5 / packets, collaboration requests / receipts, and event-shadow envelopes. |
| `fixtures/**` | Positive and negative replay controls checked by `scripts/agent-operations/check-agent-operations.mjs`. |
| `visual-evidence.md`, `github-evidence-upload.md`, `diagram-design.md` | Agent-only visual evidence soft gate, storage/upload paths (no binaries in `main`), and diagram design rules. |
| `scripts/agent-operations/*.mjs` | Collectors, validators, publishers (`agent-publish.mjs`, `review-packet.mjs`, `collaboration-packet.mjs`, `event-shadow-cli.mjs`), and resolver (`resolve-skill.mjs`). |
