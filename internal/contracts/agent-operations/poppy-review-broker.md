# Poppy review broker

Status: transitional readable projection for the reported P1 shadow and later review-write activation paths. Runtime capability ceilings and current authorization determine which transition may execute.

## Governed sources and provenance

No `spec/**` entity yet owns this repository-operations boundary. Until it is cataloged, the current machine-enforced sources are:

- `internal/agent-operations/schemas/review-input.schema.json` and `scripts/agent-operations/review-runtime.mjs` for canonical review-input v3 and its digest;
- `internal/agent-operations/schemas/review-packet.schema.json` for review-packet v1;
- `internal/agent-operations/capability-policy.yaml` and `scripts/agent-operations/review-packet.mjs` for the repository-side review ceiling and live preflight;

Direction and acceptance provenance remain intentionally non-normative:

- `internal/records/2026-08-27-scheduled-review-and-integration-activation.zh-CN.md` records the latest local-runner direction but cannot redefine the boundary;
- [Issue #557](https://github.com/Proto-UI/Proto-UI/issues/557) tracks the accepted implementation plan and P0-to-P3 evidence, but its mutable discussion is not contract authority.

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

Before live recollection, Poppy must hold one expiring server-side lease for the repository and pull request so overlapping callbacks cannot race different inputs or dispositions. Every lease acquisition receives a monotonic fencing generation. A worker renews the lease before the review-write boundary; the transaction that inserts the write-ahead receipt must atomically verify the current lease owner, fencing generation, unexpired lease, processing admission, and live kill switches before consuming the nonce. Every authenticated callback outcome — including a maintainer gate, no-op, reject, or any provably deterministic failure that produces no mutation — must still consume the one-time nonce and durably finalize its admission atomically. The nonce is consumed exactly once per admission regardless of disposition; the write-ahead intent is created only for a mutation outcome, so a non-writing result can never leave a reusable challenge that a later resubmission with a different packet could spend.

The `unknown` write-ahead receipt binds policy version, installation, repository, PR, base, head, canonical input digest, canonical review-packet digest, exact rendered Review API request-body digest, reviewer, and disposition. In the same transaction it becomes the PR-level pending write intent. The rendered body carries the immutable receipt marker and packet digest. Immediately before the GitHub POST, the applier renews and revalidates the lease owner, fencing generation, unexpired lease, every applicable live kill switch, and the exact PR base and head against the receipt. If the base or head has drifted since recollection and receipt insertion, or a switch has closed, it finalizes the intent as a provably pre-request deterministic failure without mutating GitHub. Otherwise the POST is the single mutation attempt owned by that pending intent.

While any write intent for the repository and PR is `unknown`, every successor generation is reconciliation-only regardless of head or proposed disposition: it cannot insert another intent or call a mutation API. Success, provably pre-request deterministic failure, and unknown remote outcome finalize the receipt and admission together under the same fencing generation. Lease loss after intent insertion never authorizes another POST or retry. Reconciliation may mark an intent successful only after finding the same Poppy reviewer, exact commit, disposition, receipt marker, packet digest, and exact live review-body digest. If the exact remote result cannot be proved, the intent remains `unknown` and all new mutations for that PR remain prohibited. A stale worker cannot insert, finalize, or reconcile after another generation owns the lease; its still-pending single POST, if it resumes, remains the only mutation that reconciliation may accept.

All writes carry `commit_id` equal to the reviewed head. The `proto-ui-scheduled-review-v1` authorization is schedule and local-runner bound, so it does not by itself authorize the event-driven Poppy reviewer; a separately recorded Poppy authorization keyed to Poppy's own event-admission execution source must be active before any Poppy review write. That Poppy authorization, together with matching repository-side enforcement, must retain the complete successful-CI predicate before any `APPROVE`: every collected check resolves to `SUCCESS`, `SKIPPED`, or `NEUTRAL`, and at least one allowlisted trusted CI check succeeded. Before any review mutation, preflight must also prove that every applicable review thread is resolved and non-outdated, DCO status is successful, and source/license provenance is successful; missing, pending, failed, or unknown evidence fails closed. It must also prohibit `APPROVE` whenever any current or previous changed-file path identifies a YAML entity under the governed `spec/**` collections; widening either the CI or the path gate requires another separately recorded authorization and matching repository-side enforcement before activation.

Repository and global switches form a monotonic ceiling:

```text
admission -> writes -> REQUEST_CHANGES -> APPROVE
```

Disabling a higher level cannot disable audit or reconciliation of an already unknown outcome. Configuration mode is another ceiling; a browser switch can never widen it.

## Current graduation state

| Phase | State | Next activation evidence |
| --- | --- | --- |
| P0 capability proof | Completed for shadow operation | Preserve the reviewed dcbot contract, strict fixtures, storage transactions, GitHub API schema smoke, and exact minimum App manifest as P1 evolves. |
| P1 event-driven shadow | Reported `(1,0,0,0)`; evidenced by [`internal/records/2026-08-29-poppy-review-broker-p1-shadow-evidence.md`](../../records/2026-08-29-poppy-review-broker-p1-shadow-evidence.md) | Continue collecting stale/replay/fork/concurrency/permission-loss observations with review writes disabled and no `Actions: write` expansion. The record evidences P1 only; P2/P3 remain closed until the Poppy-specific writer authorization, effective App/key/token containment, and current-head independent review are separately evidenced. |
| P2 `REQUEST_CHANGES` | Closed | Demonstrate the fenced pending-intent write path, process-level analyzer/applier credential separation, exact-head write and unknown-outcome reconciliation, and reliable resolution of only Poppy's persisted blocking review on a disposable PR. A separately reviewed required-check design remains the ready fallback if own-review resolution is unavailable. |
| P3 clean `APPROVE` | Closed | Apply P2 observations, demonstrate meaningful App approval under the live ruleset, and activate the narrower approval switch independently. |

The currently installed Poppy App (`poppy-for-proto-ui-dev`, installation `153047275`) grants `contents: write`, `issues: write`, `discussions: write`, `pull_requests: write`, `actions: read`, and `checks: read`. The credential topology is evaluated as three distinct layers: the App/installation grants and their `InstallationTokenPermissions` are the platform ceiling; the broker-requested installation token is the bearer used for GitHub API calls and must be checked for requested and effective permissions; and the broker-held private key (`PrivateKeyPath`) plus its token issuer is the minting authority that could otherwise bypass an assumed token restriction. The intended minimum surface for review write is `Pull requests: write` plus read-only Issues, Checks, Commit statuses, Actions, and Organization members; the `contents`, `issues`, and `discussions` write permissions are outside the review-write boundary and must be narrowed to read-only or removed before any review-write activation. `Pull requests: write` is a coarse platform permission that can technically reach adjacent PR mutations such as closing a pull request or changing PR conversation state; those actions remain unauthorized and disabled by the controller, but the installed token retains that compromise blast radius. P2/P3 activation therefore requires evidence of effective grant narrowing across all three layers, either by hard-narrowing the installation-wide grants or by a dedicated narrow App/key or non-bypassable token issuer with independently verified effective permissions; the current record does not prove that containment. P1 remains read-only in behavior even though the installed permission is present for later phases; the persisted and runtime switches decide when a review mutation can cross the applier boundary.

The current Poppy service also hosts unrelated Qwen-backed Discord features. P2 activation evidence therefore demonstrates that the applier process receives no analyzer credential through a real process/credential boundary or an equivalently reviewed isolation mechanism.

## Adjacent capability routing

This broker advances exact-head review dispositions. It does not authorize merge, ready-for-review, close, comment, label, assignment, publication, release, access, secrets, branch protection, rulesets, dismissal of another reviewer's review, or contributor-code execution with secrets. An adjacent action may reach its owning controller only with separate exact current-user or applicable standing authorization, and that controller must independently verify its live scope and invariants; this document supplies no standing authority. The local review/integration controller and Poppy share one server-side lease before either becomes a writer, giving the project one coordinated automation path instead of competing writers.
