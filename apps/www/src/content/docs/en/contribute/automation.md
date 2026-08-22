---
title: 'Agent automation'
description: 'Know which recurring Agent tasks run today, which remain manual, and which exist only as bounded designs.'
---

Proto UI does not describe a task as autonomous merely because it has a schedule or an Agent prompt. A running task also needs bounded input, deduplication, a completion rule, validated output, a lease where runners can overlap, and a safe terminal state.

## What runs today

The Agent Operations Shadow workflow collects bounded Issue and pull-request snapshots on a schedule or by manual dispatch. It has read-only GitHub permissions. It runs Agent analysis only when the runtime secret is available, validates the structured proposal, and uploads artifacts. If analysis is skipped, the snapshot is still useful, but it is not an Agent result.

The pull-request portfolio trial is manual and read-only. It preserves incomplete external-engine results instead of presenting them as complete facts.

## What remains manual

Autonomous maintenance has a real mission queue and a state protocol, but no scheduler or controller. `pui-mission` defines the candidate-to-frozen transition, but it remains blocked without trusted subject proof and a global lease service. A maintainer currently freezes one mission outside an autonomous controller, starts the Observer, starts a fresh Verifier when needed, records human decisions, and starts later stages.

A no-finding result is valid. `pui-record` closes supported no-finding, rejected-finding, and blocked terminal outcomes. Accepted remediation still requires independent review before `pui-maintenance-close`.

## Candidate recurring tasks

The machine catalog also defines bounded read-only candidates for CI failure diagnosis, collaboration-governance drift, deployment evidence, and dependency drift. Candidate means the boundary is designed. It does not mean a scheduler, credential, runtime, or owner exists.

## Why writes remain attended

A local single-use ledger cannot prevent the same probe from being consumed in another clone or runner. Automatic external mutation therefore needs a globally atomic consumer or a service-side idempotency key. Subject identity and the trusted issuer must also be verifiable at execution time.

Until those controls exist, recurring tasks stay read-only. Semantic decisions, approval, merge, publication, release, access, secrets, and repository rules always stop for a human.

The exact catalog is `internal/agent-operations/autonomous-tasks.yaml`. The maintenance procedure remains under `internal/autonomous-maintenance/**`.
