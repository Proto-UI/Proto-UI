# Poppy review broker P1 shadow evidence

Status: dated non-normative rollout evidence for the P1 shadow row. This record does not activate Poppy review writes, grant repository permission, or replace `internal/agent-operations/capability-policy.yaml`.

## Observation window and deployed revision

- Observation date: 2026-08-28.
- External implementation: `Proto-UI/dcbot#1`, revision `d77f2d8`.
- Repository projection: #560 exact head `7ddfed589937a8a3a1ee913a7e81d6ad39816ded` at the time of the observation.
- Evidence source: Issue #557 maintainer rollout report dated 2026-08-28.

## Runtime and credential topology observed

- `proto-pulse` hosts the public webhook, Control Room, Discord, and existing Qwen workloads.
- `poppy-review-broker` is a loopback-only GitHub App applier with dedicated review SQLite; it has no Qwen, Discord, OAuth, or general-store dependency.
- `poppy-review-analyzer` has Qwen and callback-HMAC access only; it has no GitHub App, Discord, OAuth, or review-store dependency.
- The broker listens on `127.0.0.1:8790`; main and broker readiness endpoints were healthy.
- Claim/result routes were absent from the Cloudflare Worker allowlist.
- The callback secret was provisioned only in root-owned `0600` service environments and a user-only local backup; no secret value entered either repository, Control Room, logs, or the issue report.
- Shared SQLite main/WAL/SHM files were `0660` under the fixed `poppy-review-state` group.
- Qwen serialization used the root-owned `0640` `/run/poppy-qwen/qwen.lock`.

These observations establish process separation and the shadow topology. They do not prove that the GitHub App installation or key can no longer mint its currently configured broader permissions; effective permission narrowing or an independently reviewed non-bypassable containment boundary remains a P2/P3 prerequisite.

## Shadow receipt and switch tuple

- Switch tuple: `admission/write/request-changes/approve = (1,0,0,0)`.
- Process ceiling: `POPPY_REVIEW_MODE=shadow`.
- Representative shadow: PR #536 completed admission, isolated analysis, signed callback, exact live recollection, deterministic policy, and a durable no-op receipt.
- Four concurrently drifting snapshots were rejected fail-closed.
- Unknown receipts: `0`.
- Successful remote review mutations: `0`.
- All three services were active with zero post-restart failures during the observation.

## Validation and remaining gates

The rollout report records passing full Go tests, `go vet`, Linux amd64 build, Web tests, TypeScript check, production build, Wrangler dry-run, systemd verification, sysusers/tmpfiles dry-run, dependency isolation, and added-line credential scan.

This record evidences the reported P1 shadow observation only. P2 `REQUEST_CHANGES` and P3 `APPROVE` remain closed until all of the following are separately evidenced:

1. a Poppy-specific writer authorization bound to the broker's event-admission identity rather than the local scheduler's `schedule` identity;
2. effective App/key/token permission narrowing or an equivalently reviewed non-bypassable containment boundary; and
3. independent current-head review of the governing contract and runtime evidence.

The local `proto-ui-scheduled-review-v1` authorization remains schedule/local-runner-bound and does not authorize the event-driven Poppy writer.
