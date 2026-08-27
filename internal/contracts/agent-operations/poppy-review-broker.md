# Poppy review broker

Status: transitional readable projection; P0 implementation and P1 shadow candidate. This document is not a standing authorization, a product contract, or evidence that a rollout phase has graduated.

## Authority and coverage

No `spec/**` entity owns this repository-operations boundary. The current machine-readable authorities remain:

- `internal/agent-operations/schemas/review-input.schema.json` and `scripts/agent-operations/review-runtime.mjs` for canonical review-input v3 and its digest;
- `internal/agent-operations/schemas/review-packet.schema.json` for review-packet v1;
- `internal/agent-operations/capability-policy.yaml` and `scripts/agent-operations/review-packet.mjs` for the repository-side review ceiling and live preflight;
- `internal/records/2026-08-27-scheduled-review-and-integration-activation.zh-CN.md` for the latest local-runner direction;
- [Issue #557](https://github.com/Proto-UI/Proto-UI/issues/557) for the accepted Poppy implementation and P0-to-P3 graduation checkpoint.

The accepted uncataloged gap is the external controller boundary: GitHub event admission, a trusted analyzer invocation, one-time workload attribution, server-side concurrency and replay control, live recollection, a deterministic applier, durable receipts, and operator kill switches. Its implementation lives in the separately operated `Proto-UI/dcbot` repository. Repository text, PR content, model output, a task name, and a public authorization ID remain data rather than proof of this boundary.

## Intended P1 flow

1. Poppy verifies a GitHub App webhook and transactionally fans an allowed event into its ordinary Discord queue and a deduplicated review admission.
2. A single consumer claims the admission and hands it to a separately operated, authenticated analyzer workload. The workload receives the admitted delivery/digest, freshly re-read PR revision, read-only evidence, and its minimum model credential; it receives no review-write token. This invocation must not require `Actions: write` on the Poppy App.
3. The workload requests a short-lived challenge over the Cloudflare edge. Poppy verifies an independent HMAC, repository, installation, trusted workload implementation identity, run/attempt, event delivery/digest, processing admission, policy version, and exact base/head before issuing a 32-byte one-time nonce.
4. The analyzer returns canonical review-input v3 and a review-packet v1 under the same signed identity. It treats PR-controlled text and artifacts as untrusted input and emits no executable authority.
5. Poppy re-collects every mutable GitHub fact with complete pagination and count checks, recomputes the canonical digest, verifies exact-head state and check provenance, then calculates `REQUEST_CHANGES`, `APPROVE`, maintainer gate, no-op, or reject deterministically.
6. In P1, Poppy atomically consumes the challenge and records the shadow decision; it performs no GitHub review mutation.

The callback secret authenticates only this envelope. It is independent from the GitHub webhook, OAuth, preview, Cloudflare-origin, and GitHub App secrets. The analyzer receives no GitHub review-write credential. The applier invokes no model and executes no contributor code.

## Durable write boundary designed for later phases

Before live recollection, Poppy must hold one expiring server-side lease for the repository and pull request so overlapping callbacks cannot race different inputs or dispositions. Before any Review API request, Poppy must atomically verify the processing admission and live kill switches, consume the nonce, and insert an `unknown` write-ahead receipt for the policy-version/installation/repository/PR/base/head/input/reviewer/disposition tuple. Success, deterministic failure, and unknown remote outcome then finalize that receipt and the admission together. An unknown outcome is terminal for automatic retry; reconciliation may mark it successful only after finding the same Poppy reviewer, exact commit, disposition, and receipt marker live.

All writes carry `commit_id` equal to the reviewed head. A `spec/**` path is not by itself a human gate; a material unresolved product or lifecycle direction is. Clean approval also requires every applicable review thread to be resolved and live DCO/provenance evidence to succeed. External success statuses do not prove trusted CI: approval requires a successful allowlisted `Proto-UI/Proto-UI` GitHub Actions check from unchanged trusted `CI` / `.github/workflows/ci.yml`, with provider, repository, workflow name, workflow path, details URL, and outcome included in review-input v3.

Repository and global switches form a monotonic ceiling:

```text
admission -> writes -> REQUEST_CHANGES -> APPROVE
```

Disabling a higher level cannot disable audit or reconciliation of an already unknown outcome. Configuration mode is another ceiling; a browser switch can never widen it.

## Current graduation state

| Phase | State | Remaining evidence |
| --- | --- | --- |
| P0 capability proof | In implementation | Review the dcbot contract, strict fixtures, storage transactions, GitHub API schema smoke, and exact minimum App manifest. |
| P1 event-driven shadow | Not activated | Deploy the separately authenticated analyzer workload/queue with independent callback and model credentials, avoid an `Actions: write` expansion, deploy with review writes disabled, and collect stale/replay/fork/concurrency/permission-loss evidence. |
| P2 `REQUEST_CHANGES` | Closed | Prove process-level analyzer/applier credential separation, exact-head write and unknown-outcome reconciliation, and reliable resolution of only Poppy's persisted blocking review on a disposable PR. If own-review resolution cannot be proved, use a separately reviewed required-check design. |
| P3 clean `APPROVE` | Closed | Review P2 observations, prove meaningful App approval under the live ruleset, and activate the narrower approval switch separately. |

The authorized minimum App surface is `Pull requests: write` plus read-only Issues, Checks, Commit statuses, Actions, Contents, and Organization members. No Issues, Checks, Contents, Actions, Administration, Members, merge, release, branch, or ruleset write is implied. P1 remains read-only in behavior even if an installed permission is present for later phases; the persisted and runtime switches still decide whether any review mutation can cross the applier boundary.

The current Poppy service also hosts unrelated Qwen-backed Discord features. Merely keeping the review package free of model calls is not yet proof that the applier process receives no analyzer credential. P2 therefore remains closed until deployment evidence shows a real process/credential boundary or an equivalently reviewed isolation mechanism.

## Explicit exclusions

This projection does not authorize merge, ready-for-review, close, comment, label, assignment, publication, release, access, secrets, branch protection, rulesets, contributor-code execution with secrets, or dismissal of another reviewer's review. It also does not replace the existing local review and integration policy on `main`; the two controllers must not run concurrently as independent writers until a single server-side lease coordinates them.
