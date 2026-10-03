# Cloud event incremental review: blocked integration proposal

Date: 2026-10-02. Status: **proposal; publication blocked**. This record grants no authority and does not activate a runner. The accompanying tests preserve the existing denial boundary; they do not implement a cloud controller.

## Request and authority

Agent paraphrase of the current user request: prepare a separate draft PR for long-term, event-driven incremental review of `Proto-UI/Proto-UI` PRs except those authored by `guangliang2019`. The parent reviewer makes the judgment directly, without additional review subagents. An execution helper may gather and validate packets; its model is not thereby the reviewer. Publish finding-backed `REQUEST_CHANGES` when justified, and `APPROVE` only with complete evidence and no outstanding maintainer judgment. Actual webhook automation is separate follow-up work. The request permits a blocked design if runtime evidence is unavailable; it does not authorize credentials, security settings, merge, or a DCO signature with an unconfirmed identity.

The inspected baseline is `1fd4c08a067a8322295c78b2b708d2b4cbc01304` on `main`. No product spec entity owns this operations boundary. Governing sources are:

- [`capability-policy.yaml`](../agent-operations/capability-policy.yaml), especially `reviewSubmissionAuthorizations` and `futurePrivilegedAutomation`;
- [`contributor-agents.md`](../agent-operations/contributor-agents.md), review evidence and zero-trust boundaries;
- [`review-runtime.mjs`](../../scripts/agent-operations/review-runtime.mjs), `authorizeReviewSubmission`, canonical input and reconciliation validation;
- [`review-packet.mjs`](../../scripts/agent-operations/review-packet.mjs), validated handoffs, live collection and exact-head submission;
- [`poppy-review-broker.md`](../contracts/agent-operations/poppy-review-broker.md), the existing external controller, fencing, unknown-intent and credential-isolation design.

The [local schedule activation record](2026-08-27-scheduled-review-and-integration-activation.zh-CN.md) supersedes the earlier local identity-blocker observation. Its single credentialed local runner exception is not cloud authorization. Poppy has [reported P1 shadow evidence](2026-08-29-poppy-review-broker-p1-shadow-evidence.md); that evidence proves neither a parent-cloud-reviewer bridge nor active review writes. Its documented legacy v1 analyzer output cannot authorize dispositions.

## Overlap with ongoing work

On 2026-10-02, inspected open [PR #509](https://github.com/Proto-UI/Proto-UI/pull/509) at `e1c1d6123e16f72f92a8833579bf0556f474b9e8`, its `event-shadow.mjs`, `collaboration-runtime.mjs` and `review-runtime.mjs`, and the [#760 maintenance checkpoint](https://github.com/Proto-UI/Proto-UI/issues/760). #509 already owns E0 authenticated webhook shadow admission, review-input v5, reviewer/contributor identity, stronger review/DCO/provenance gates and bounded collaboration receipts. Its mode/source declarations explicitly remain operator declarations; autonomous collaboration publication is blocked because trusted governed-outcome verification is not implemented. #760 tracks this same unresolved publisher boundary and independent acceptance, not an authorization to bypass it.

This draft does not implement another envelope, lease service, replay store, input schema, collaboration runtime or reviewer. It leaves #509's work on its own branch. After that work lands, adapt these tests and the proposed narrow cloud admission bridge to its current canonical schema and final writer; do not downgrade v5 evidence to the main baseline's v3. The requested new-human-review/comment triggers also exceed #509's PR-lifecycle shadow allowlist, so they require explicit event mapping and evidence, not an implicit allowlist expansion.

The current dot webhook runtime is reported by the task owner to supply supported PR events but no signed execution envelope. Realistically it can wake read-only collection and parent-owned analysis now. Durable incremental continuity is conditional on a verified persistent baseline; without one, each fresh run must disclose full-review/unknown-history limits. It cannot safely activate unattended `REQUEST_CHANGES` or `APPROVE` through the current repository submission path. This is an integration-readiness conclusion, not a claim that a webhook listener was installed or tested here.

## Why publication remains blocked

There is no verified parent-cloud-run identity envelope, proof-of-possession, durable baseline adapter, shared lease integration, or publication-ledger adapter supplied for this task or implemented in this repository. The available GitHub connector proves repository access, not those properties. The historical Poppy shadow report is not current integration evidence. This proposal does not assert that the separately operated service lacks capabilities; it requires evidence for the exact new path before using them.

A task name, webhook delivery ID, caller-supplied `cloud-event` string, model assertion, or JSON artifact cannot establish trusted runtime origin. `proto-ui-scheduled-review-v1` currently matches only `autonomous` / `schedule`. `explicit-current-user` requires a current human-directed action, not merely a historical instruction to set up recurring review. Relabeling a webhook as either source would hide its provenance. Adding an active authorization row or accepting a new handoff enum alone would be unsafe.

The bounded supported outcome today is read-only collection/local analysis with an explicit blocked decision packet. Do not call `submit-review`, publish via the connector as a fallback, or fall back to the local scheduled authorization. If durable history is unavailable, label the analysis a full review with unknown prior reconciliation, not an incremental review. No cloud external write is allowed even if a fresh packet passes the other checks.

## Proposed integration boundary (not implemented)

Use the existing broker boundary if it can admit the parent reviewer with independently verified attribution; do not deploy a competing credentialed publisher. The parent receives read-only evidence and performs review judgment. The helper collects facts or executes bounded validation, not an independent review or a hidden replacement model. A deterministic publisher validates the parent's bound result; it cannot invent findings, resolve human gates, or synthesize an approval. The reviewing parent must meet its own fresh task/review ceiling; a helper's assessment is not transferable. Required independent current-head acceptance of the integration remains a maintainer gate, not an instruction to spawn more agents.

A future separately reviewed authorization could use `proto-ui-cloud-event-review-v1` and an explicit cloud event source. These are reserved proposal names, absent from active policy. The trusted admission verifier, execution-mode schema, resolver, packet CLI, policy and publisher must change together. Only a pinned, reviewed controller and authenticated reviewer invocation may use that source. Arbitrary GitHub workflows, caller-generated envelopes and PR-controlled code receive no authority. The verifier keys, issuer, audience, policy digest, repository/installation, PR, event digest, run/attempt, expiry, nonce and proof-of-possession must be validated outside model-controlled input. A valid webhook authenticates an event, not the later reviewer or its recommendation.

### Event admission and relevance

The requested event families are PR lifecycle, synchronize commits, and newly created human reviews/comments (including inline conversation). Exact connector event/action mappings and actor attribution need a live schema and delivery demonstration before activation. Do not assume provider labels map one-to-one to GitHub webhook names.

- Admit eligible open/reopened/ready PR lifecycle events and new commits for fresh inspection. Closed/draft transitions cancel publication eligibility and update durable state; they do not trigger a review POST.
- Re-read the PR author live and exclude `guangliang2019` case-insensitively before analysis and again before publication. Resolve stable account identity at setup; unknown author identity blocks. This is separate from self-review prevention.
- Re-read reviews/comments and prove a human actor. Ignore the automation's own receipts and bot events for triggering, without deleting them from canonical input. Unknown actor attribution blocks admission rather than being treated as human.
- CI-only changes, base-only updates and comment edits are not wake-up triggers. They still invalidate a stale canonical input at publication. A later eligible event can cause re-review; there is no promise to approve automatically when CI later turns green without an eligible event.
- Deduplicate verified deliveries first, then coalesce pending events by PR. Relevance is a scheduling decision over new commits and newly admitted human evidence, never a replacement for the full canonical digest. An unchanged material state is a durable no-op; uncertainty causes read-only inspection, not fabricated relevance or publication.
- A setup inventory can seed full reviews of existing eligible PRs; it needs an explicitly governed initial admission. Missed-delivery recovery and any later reconciliation sweep require their own reviewed scope; do not silently substitute polling for the requested webhook behavior.

### Durable baseline and serialized processing

Fresh cloud runs cannot use conversation memory, a local `/tmp` file, or `--seen-keys` as the authoritative ledger. Persist a versioned per-repository/PR record in the controller's transactional store. Retain immutable canonical input and packet blobs, their digests, reviewed base/head, prior packet digest, finding-ID reconciliation, material event cursor, policy version, reviewer identity, publication intent and receipt. Separate the last completed analysis from the last confirmed publication so a human gate, skipped event or unknown POST cannot erase open findings or manufacture a published baseline. Corrupt/missing history permits only a labeled full read-only review until it is safely re-established.

For the first activation, bound execution to one global reviewer slot and one coalesced pending generation per PR. Apply the broker's expiring, fenced PR lease to collection, judgment completion and publication; all other possible writers, including the local schedule/Poppy path, must share that same lease/intent boundary or be demonstrably excluded by a separately authorized migration. A process-local mutex or a promise not to overlap is insufficient. No writer exclusion or service changes are performed by this PR.

An event arriving during review updates a pending generation. The worker never publishes stale evidence: it re-collects the entire canonical input and compares base/head/digest, rechecks permission/author/state and validates its lease. On drift it retains the completed evidence as superseded, releases safely and processes the latest coalesced generation. An atomic compare-and-swap on the processed generation prevents clearing an event received during completion. Terminal no-op, rejected, or human-gated outcomes consume their admission/nonce too; they cannot be replayed with a different recommendation.

### Publication and unknown outcomes

Use the broker's write-ahead intent and fencing protocol, not a new direct connector POST. Bind the intent to the exact policy, reviewer, repository/PR, base/head, input digest, packet digest, disposition and rendered body digest. Preserve a stable receipt marker that can be reconciled against GitHub. Insert and consume atomically under the valid lease before one exact-head POST. GitHub and the state store do not share a transaction: this design promises no blind retry, not exactly-once delivery.

| State / observation | Allowed continuation |
| --- | --- |
| Unverified admission, missing store, lost lease, expired identity, revoked permission | No mutation; preserve an auditable blocked result. |
| Duplicate delivery or previously consumed nonce | No new judgment publication or write intent. |
| Complete result, live input unchanged, all gates pass | One durable intent, then at most one POST with `commit_id` fixed to the reviewed head. |
| New event before write / digest drift | Supersede analysis and coalesce; no stale POST. |
| Timeout, crash after intent, or lease loss after intent | Every successor is reconciliation-only for that PR, even after a new head or disposition. |
| Exact reviewer/head/disposition/marker/packet/body receipt found | Confirm and persist the remote receipt; never POST the same intent again. |
| No matching receipt or ambiguous remote outcome | Keep `unknown`; no retry/new PR intent until safely resolved under the broker contract. |

A successor lease must not release the unknown barrier while an old worker could still issue its one POST. Clearing it requires proof of a pre-request deterministic failure or the exact remote receipt, with fencing as specified by the broker. An ordinary lease timeout alone is not such proof.

Retain all existing packet validation, canonical input/exact-head binding, live permission, fresh assessment, finding, evidence/debt, self-review, draft/closed, duplicate and human-gate checks. `REQUEST_CHANGES` needs complete evidence and stable findings. `APPROVE` needs a clean complete packet, successful trusted CI and no unresolved maintainer judgment; retain the spec-entity current/previous-path approval prohibition. A broker integration must also satisfy its stricter thread, DCO and source/license prerequisites. Do not import the local preview-authorization exception into a stricter broker policy by accident. Legacy v1 packets, unresolved verification debt, missing live evidence and unknown outcomes cannot become dispositions. `COMMENT` and `ABSTAIN` are not standing-authorized review publications. Merge, ready-for-review, other GitHub mutations, release, secrets and security changes remain outside this proposed scope.

## Evidence and activation exit criteria

The included executable evidence covers only existing repository boundaries:

- `review-runtime.test.mjs`: positive local/current-human controls versus unavailable webhook/cloud/queue authority; repeated attempts with fresh objects remain denied; the unsupported cloud handoff fails in the CLI before live collection.
- `collect-live-review-input.test.mjs`: simulated connection loss after the review POST produces one attempt, with exact `commit_id`, and propagates the unknown outcome without retry.
- Existing tests retain canonical drift, prior-packet reconciliation, exact rendered-review duplicate detection, evidence/debt, CI, permission, findings and human-gate coverage.

These are deterministic fixtures, not live webhook, service restart, lease, or distributed replay evidence. Current primitives cannot authenticate a caller that simply lies about being the local scheduled runner; their documented credentialed-local-runner assumption remains unchanged. Passing these tests must not be presented as cloud readiness.

Before an activation PR, provide all of:

1. A current pinned controller/reviewer build and live event-to-parent-to-publisher attribution trace, including spoofed delivery/issuer/audience/task/repository/PR, invalid signature, expired nonce, revoked identity and source-laundering rejection.
2. Real durable-store evidence across fresh processes/restarts: duplicate/out-of-order deliveries, concurrent claims, event-during-completion coalescing, prior findings, stale generations and non-writing nonce consumption.
3. Disposable-PR evidence for lost leases, competing local/broker/cloud writers, stale base/head/input, permission loss, timeout before/after POST, process crashes and ambiguous receipt reconciliation. Demonstrate at most one attempt and no successor write while unknown.
4. Parent-owned v2 evidence packets, complete policy preflights, excluded-author/bot/self-review controls and no autonomous resolution of maintainer judgments. Demonstrate `REQUEST_CHANGES` lifecycle and subsequent disposition without dismissing another reviewer's findings; retain the broker's own-blocking-review resolution gate.
5. Effective credential containment, live repository rules, operator kill switches and a separately approved rollout. Enable neither service credentials nor write switches merely to collect proposal evidence. Approval activation follows its own narrower gate after change-request evidence.

The parent can configure actual webhook automation only after integration readiness is established. Until then any automation must remain explicitly read-only. Outstanding runtime evidence and signing identity are blockers for activation/integration, not reasons to claim this draft enables publication.
