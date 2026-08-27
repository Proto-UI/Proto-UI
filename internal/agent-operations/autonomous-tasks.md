# Autonomous task catalog

This catalog separates tasks that run today from tasks that are only designed. It does not turn a candidate into deployed automation.

## What is live

The Issue and pull-request observers run as a read-only shadow workflow on a schedule or by manual dispatch. They collect bounded GitHub facts, treat Issue and pull-request text as untrusted data, ask an Agent for proposals only when its runtime secret is available, validate the result, and upload artifacts. A successful snapshot with a skipped Agent step is not an Agent analysis run.

The pull-request portfolio observer is a narrower manual trial of an external engine. Its errors remain part of the result. It cannot prepare, repair, submit, approve, or merge a pull request.

The maintainer also operates one local Codex scheduled task for `Proto-UI/Proto-UI`. It is not the repository Phase A workflow. The active standing scope `proto-ui-scheduled-review-v1` allows complete, finding-backed `REQUEST_CHANGES`, and allows `APPROVE` only for a clean packet whose trusted repository CI is successful and whose canonical changed-file set contains no current or previous path for a YAML entity in the nine `spec/**` entity collections. The companion `proto-ui-scheduled-merge-v1` scope allows the task to squash-merge an exact head only after a clean packet, an independent exact-head approval, no active change request, resolved review threads, trusted CI, live write permission, and GitHub `MERGEABLE`/`CLEAN` state all agree.

The repository does not pretend that a caller-provided desktop task name is authentication. A local process holding the GitHub credential could bypass repository scripts entirely, so the effective safety boundary is the maintained standing policy together with live credential permission, canonical input reconciliation, exact-head API writes, single-runner operation, and GitHub repository rules. Strong runtime identity and a global lease remain necessary before widening these writes to multiple or concurrent runners.

Autonomous maintenance is still a manual protocol. `pui-mission` defines the candidate-to-frozen transition. A maintainer currently freezes one mission and starts each fresh Agent context outside an autonomous controller. There is no scheduler, callback service, or globally atomic lease service for that state machine, so competing runners and automatic external writes remain unavailable.

## What is only a candidate

CI diagnosis, collaboration-governance audits, deployment evidence audits, and dependency drift audits are useful read-only task families, but no deployed controller currently dispatches them. Their proposed boundaries are recorded in `autonomous-tasks.yaml` so future automation starts from explicit inputs, outputs, permissions, and stop conditions.

Candidate status means the control surface is designed. It does not mean credentials, runtime, schedules, retention, or operational ownership exist.

## Rules for a task that stays running

A recurring Agent task needs more than a cron expression. It must have:

- one bounded source snapshot and a stable deduplication key;
- a completion rule that accepts no-work and no-finding outcomes;
- a service-side lease if two runners could select the same work;
- a capability band and task class for the exact transition;
- a fixed read or mutation ceiling;
- output validation that does not trust the model's wording;
- stop conditions for missing evidence, stale state, permission loss, and human gates;
- bounded runtime, tool calls, data volume, retry count, and artifact retention;
- a callback or ledger update that is idempotent;
- an owner who can disable it and inspect its residual risk.

Local state cannot coordinate separate clones or runners. The active review and merge scopes therefore apply only to the maintainer's single local scheduled runner and use live canonical reconciliation plus exact-head writes. Broader or concurrent runners require a service-side lease, stronger runtime attribution, and globally atomic replay protection. Semantic admission that lacks an independent approval, publication, release, access, secrets, and repository rules still stop for a human.

## Maintenance transition

Maintenance observation may end with a candidate finding or a supported no-finding result. A fresh verifier handles a candidate finding. Non-remediation terminal outcomes need their own recorded closure transition; accepted remediation still needs independent review before closure.

The task catalog is a routing projection. `internal/autonomous-maintenance/**` owns the maintenance procedure, and `spec/**` owns product semantics.
