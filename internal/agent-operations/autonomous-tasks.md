# Autonomous task catalog

This catalog distinguishes deployed execution from designed task families while making the active continuation path explicit. A candidate is not presented as deployed, and a read-only evidence stage is not presented as the capability ceiling of the downstream workflow.

## What is live

The scheduled Issue and pull-request intake workflow collects bounded GitHub facts, treats authored text as untrusted data, validates Agent routing output, and preserves artifacts. That repository token remains read-only. Each eligible item can then continue through the credentialed local runner, which re-collects canonical live state before any mutation.

The local `proto-ui` schedule is currently read-only: it observes and reconciles Proto UI pull requests but cannot submit review dispositions or merge. `proto-ui-scheduled-review-v1`, `proto-ui-scheduled-merge-v1`, and `proto-ui-scheduled-collaboration-v1` remain pending until a Poppy-specific signed/OIDC execution envelope proves broker-verified workload identity at the final write boundary.

When that identity boundary is admitted, review and integration will still require the exact canonical input, independent identities, trusted CI/DCO, live permission, and GitHub repository rules. These are not active write scopes today.

The manually dispatched RepoSteward portfolio trial remains an optional external evidence source. The trial itself is read-only and preserves incomplete results, but a validated item may hand off to the same canonical review and integration path; the trial boundary does not block downstream authorized work.

The repository does not treat a caller-provided task name as authentication. Effective authority is the current-user or standing scope intersected with live credential permission, the content-specific review class, canonical input reconciliation, exact-target writes, trusted DCO and CI status, independent source-provenance review, and GitHub rules. DCO success proves the configured sign-off check only; it does not replace source/license review. `pui-collaborate` additionally requires a canonical purpose-bound request digest and emits a validated receipt; it performs zero writes for an already-satisfied state, otherwise at most one write, and after an unknown outcome exactly one reconciliation without a blind retry. Single-runner operation is current reality; independently authenticated identity, item leases, and atomic replay protection are added before overlapping privileged runners are enabled.

Autonomous maintenance is currently entered through a maintainer-controlled invocation or governed queue rather than a deployed controller. Once a bounded mission is active, fresh read-only Observer and Verifier contexts feed governed drift directly through remediation, independent review, closure, and authorized integration. A supported no-finding or independently rejected finding closes through `pui-record` without a maintainer disposition.

## Designed task families

CI diagnosis, collaboration-governance audit, deployment evidence audit, and dependency drift audit have explicit inputs, outputs, permission ceilings, and stop conditions in `autonomous-tasks.yaml`. The deployed local `pui-collaborate` continuation handles exact-target reversible metadata, update-branch, ready-for-review, fixed-thread, review-request, bounded-comment, and CI-recheck mutations through `agent:collaborate`; callers cannot bypass its live preflight, request binding, one-mutation ceiling, or receipt validation. Candidate evidence lanes can attach to that continuation incrementally instead of waiting for a new mutation design.

Read-only collection is safe to schedule broadly. Mutation remains action-specific: exact run or revision binding, live permission, idempotency or exact-head reconciliation, and rollback determine whether a task acts. A missing mutation path isolates that item and records the next transition without stopping unrelated work.

## Rules for a task that stays running

A recurring Agent task has:

- one bounded source snapshot and a stable deduplication key;
- a completion rule that accepts no-work and no-finding outcomes;
- an item-bound lease when two runners could mutate the same target;
- a capability band and task or review class for the exact transition;
- a fixed read or mutation ceiling;
- deterministic output validation that does not trust model wording;
- refresh or stop conditions for missing evidence, stale state, permission loss, unresolved product direction, and privileged or irreversible operations;
- bounded runtime, tool calls, data volume, retry count, and artifact retention;
- an idempotent callback or ledger update;
- an owner who can disable it and inspect residual risk.

Read-only work may proceed concurrently. A conflict or stale snapshot stops only the affected item; the runner refreshes it or continues the portfolio. Overlapping external mutations require stronger attribution, a shared item lease, and globally atomic replay protection before multi-runner rollout.

Only two decision classes interrupt an otherwise eligible chain:

- `unresolved-product-direction`: existing authority does not decide a material semantic, ownership, public-guarantee, lifecycle, or compatibility choice;
- `privileged-or-irreversible-operation`: publication, release, access, secrets, rulesets, security disclosure, a provenance exception, or another action that cannot be safely bounded and recovered.

## Maintenance transition

Maintenance observation ends with a candidate finding or a supported no-finding result. A fresh Verifier independently classifies a candidate. Rejection and no-finding outcomes are recorded directly. A confirmed drift whose expected behavior is already governed advances to remediation; a fresh reviewer then attempts to falsify completion. Adequate review plus required validation closes the run and hands the resulting change to the ordinary review and exact-head integration path under current authorization.

Historical `AM-P0-*` runs, packets, and records remain unchanged evidence. The task catalog is a current routing projection: `internal/autonomous-maintenance/**` owns the procedure, and `spec/**` owns product semantics.
