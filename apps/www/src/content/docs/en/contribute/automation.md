---
title: 'Agent automation'
description: 'Know which recurring Agent tasks run today, which remain manual, and which exist only as bounded designs.'
---

Proto UI does not describe a task as autonomous merely because it has a schedule or an Agent prompt. A running task also needs bounded input, deduplication, a completion rule, validated output, a lease where runners can overlap, and a safe terminal state.

## What runs today

The Agent Operations Shadow workflow collects bounded Issue and pull-request snapshots on a schedule or by manual dispatch. It has read-only GitHub permissions. It runs Agent analysis only when the runtime secret is available, validates the structured proposal, and uploads artifacts. If analysis is skipped, the snapshot is still useful, but it is not an Agent result.

The pull-request portfolio trial is manual and read-only. It preserves incomplete external-engine results instead of presenting them as complete facts.

The maintainer's single local Codex schedule has two conditional write paths. It may submit an exact-head `REQUEST_CHANGES` or a narrowly eligible `APPROVE` through `proto-ui-scheduled-review-v1`, and it may use `pui-integrate` under `proto-ui-scheduled-merge-v1` after independent approval, resolved threads, trusted CI, live permission, and GitHub merge readiness all agree. These standing scopes do not widen the repository shadow workflow.

## What remains manual

Autonomous maintenance has a real mission queue and a state protocol, but no scheduler or controller. A maintainer currently freezes one mission outside an autonomous controller, starts the Observer, starts a fresh Verifier when needed, records human decisions, and starts later stages. Each autonomous transition must stay inside the fresh local task and review ceiling and the recorded mission lease.

A no-finding result is valid. `pui-record` closes supported no-finding, rejected-finding, and blocked terminal outcomes. Accepted remediation still requires independent review before `pui-maintenance-close`.

## Candidate recurring tasks

The machine catalog also defines bounded read-only candidates for CI failure diagnosis, collaboration-governance drift, deployment evidence, and dependency drift. Candidate means the boundary is designed. It does not mean a scheduler, credential, runtime, or owner exists.

## Why most writes remain attended

A local ledger cannot prevent the same external action from running in another clone. Automatic external mutation therefore needs a globally atomic consumer or a service-side idempotency key, plus a way to bind the running process to the authorization it presents.

The current local runner is deliberately narrower than a general automation service: one maintained credential, one repository, one schedule source, canonical live reconciliation, exact-head API parameters, and fail-closed GitHub rules. That boundary is sufficient for its reviewed standing review and merge scopes, but not for concurrent or multi-runner writes.

Ordinary local autonomous work may proceed within its measured ceiling and recorded scope. Semantic admission without independent approval, publication, release, access, secrets, and repository rules still stop for a human. Expanding the current review or integration action set requires another explicit standing-policy change.

The exact catalog is `internal/agent-operations/autonomous-tasks.yaml`. The maintenance procedure remains under `internal/autonomous-maintenance/**`.
