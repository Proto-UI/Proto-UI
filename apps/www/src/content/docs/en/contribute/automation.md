---
title: 'Agent automation'
description: 'See how intake, review, remediation, and exact-head integration compose into active automation.'
---

Proto UI does not describe a task as autonomous merely because it has a schedule or an Agent prompt. A running task also needs bounded input, deduplication, a completion rule, validated output, a lease where runners can overlap, and a safe terminal state.

## What runs today

The Agent Operations Shadow workflow collects bounded Issue and pull-request snapshots on a schedule or by manual dispatch. It has read-only GitHub permissions. It runs Agent analysis only when the runtime secret is available, validates the structured proposal, and uploads artifacts. If analysis is skipped, the snapshot is still useful, but it is not an Agent result.

The pull-request portfolio trial is manual and read-only. It preserves incomplete external-engine results instead of presenting them as complete facts.

The single local Codex schedule is currently read-only. Its collaboration, review, and merge scopes are `pending-runtime-identity` and cannot perform GitHub writes until Poppy broker-verified workload identity is bound; human-assisted actions remain governed by explicit current-user authorization. After activation, exact-head evidence, platform-contributor-independent approval, resolved threads, separately trusted CI and DCO status, live permission, and GitHub merge readiness still remain required. These standing scopes do not widen the repository shadow workflow.

## Autonomous maintenance path

Autonomous maintenance uses a mission queue, leases, fresh Observer and Verifier contexts, bounded remediation, independent review, and synchronized closure. A single runner may execute this chain automatically inside its current ceiling and authorization. Fresh contexts preserve evidence independence; they are not human checkpoints.

A no-finding result is valid. `pui-record` closes supported no-finding, rejected-finding, and blocked terminal outcomes. Accepted remediation still requires independent review before `pui-maintenance-close`.

## Candidate recurring tasks

The machine catalog also defines bounded read-only candidates for CI failure diagnosis, collaboration-governance drift, deployment evidence, and dependency drift. Candidate means the boundary is designed. It does not mean a scheduler, credential, runtime, or owner exists.

## Scaling privileged writes

A local ledger cannot prevent the same external action from running in another clone. Automatic external mutation therefore needs a globally atomic consumer or a service-side idempotency key, plus a way to bind the running process to the authorization it presents.

The current local runner uses one maintained credential, one repository, one schedule source, canonical live reconciliation, exact-head API parameters, and GitHub rules. That boundary supports active review and merge scopes today; concurrent runners add stronger attribution and a global lease before overlapping writes.

Ordinary autonomous work proceeds within its measured ceiling and recorded scope. Only unresolved product direction and privileged or irreversible operations—publication, release, access, secrets, rulesets, security disclosure, or provenance exceptions—stop for an attended decision. New action classes activate through evidence-backed standing-policy changes.

The exact catalog is `internal/agent-operations/autonomous-tasks.yaml`. The maintenance procedure remains under `internal/autonomous-maintenance/**`.
