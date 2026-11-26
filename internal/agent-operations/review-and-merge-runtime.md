# Review, canonical input v5, and merge runtime

This guide specifies canonical review-input collection, packet publication credit, exact-head merge verification, and cloud review boundaries for `agent:review`. For overview and CLI examples, see [README.md](README.md).

## Scope & Limits

- Applies to `scripts/agent-operations/review-runtime.mjs`, `collect-live-review-input.mjs`, `review-packet.mjs`, and `connector-review-worker.mjs`.
- Generic scheduled scopes (`proto-ui-scheduled-review-v1`, `proto-ui-scheduled-merge-v1`) remain `pending-runtime-identity` and read-only until Poppy broker-verified workload identity is bound.
- Consecutive live reads detect drift across pages but do not make GitHub REST/GraphQL APIs atomic; the final merge PUT has no server-side base-SHA compare-and-swap.

## Invocation context and validation predecessors

- **Independent mode flags**: `submit-review` and `merge-pull-request` require explicit `--mode` and `--mode-source` arguments supplied by the launcher/operator before reading task artifacts (never copied from handoff JSON). Mismatches reject before artifact reads or network calls.
- **Validation predecessor (`--prior-handoff`)**: When the review handoff comes from `pui-validate`, `validate`, `inspect`, `eligibility`, and `submit-review` require `--prior-handoff <received-validation-input.json>` pointing to the actual input handoff received by validation. Keep it distinct from `--prior-packet` (which binds an earlier review packet).
- **Schema versions**: `APPROVE`, `REQUEST_CHANGES`, and merge require freshly collected canonical v5 input and schema v2 `agentEvidence` (including truthful `agentEvidence.source`). Legacy v3/v1 paths remain read-only for historical `COMMENT` validation only; v4 inputs must be re-collected as v5.

## Canonical review-input v5 collection

Live collection gathers commits, reviews, conversation comments, review threads + replies, exact-head check contexts, changed files, and `reviewerPermissions` (`permissionsObservedAt` stays in the receipt so unchanged facts hash identically):

| Dimension | Enforced bound / invariant |
| --- | --- |
| Canonical `baseSha` | Derived strictly from GraphQL `pullRequest.baseRef.target.oid` (never `baseRefOid` or REST `base.sha`). |
| GraphQL pagination | Max 100 pages / 10,000 items (100/page); verifies stable IDs, `totalCount`, and advancing cursors. |
| REST changed files | Explicit numbered pages, unique paths, matches PR count, bounded to 3,000 files. |
| Invocation resource cap | Max 1,000 requests, 64 MiB/response, 256 MiB cumulative; exceeding any bound fails closed. |
| Double-read stability | Repeats the complete collection and compares canonical v5 digests and live state; any drift rejects without writing (`agent:review:smoke` verifies read-only). |

## Publication credit and prior-packet reconciliation

- **Prior-packet binding**: Before submitting `APPROVE` or `REQUEST_CHANGES`, the reviewer's live disposition history determines whether an earlier governed packet must be reconciled via `--prior-packet`; missing artifacts block rather than being synthesized.
- **Publication credit**: Requires the full rendered original packet body plus both matching packet and Agent-evidence digest tokens in one valid exact-head `APPROVED` review from a publisher with live `WRITE`/`MAINTAIN`/`ADMIN` permission (`READ`/`TRIAGE`/none fail closed).
- **Published-packet handoff**: Carry the immutable pre-publication packet (`published-review-packet`, ≤ 64 MiB) and its `sha256:<digest>` from `pui-review` to `pui-integrate`. Reconstructing pre-publication input may remove only that publication review and its newly added publisher permission; the merge packet may update only `reviewInputDigest` and `observedAt`.
- **Lost POST outcomes**: Any malformed or lost review POST stays unknown after one read-only reconciliation even if a matching review appears live; inspect live state before taking further action.

## Exact-head merge writer (`merge-pull-request`)

1. Validates the reviewed packet, original `--published-review-packet`, canonical v5 input, and independent execution context before external calls.
2. Runs a fresh live v5 collection and full eligibility gate: contributor independence (reviewer ≠ PR author or any commit author/committer), trusted CI + DCO, resolved threads, live permissions, and exact `git/ref/heads/<baseRefName>` match.
3. Checks GitHub readiness: requires `MERGEABLE`/`CLEAN`, or `MERGEABLE`/`UNSTABLE` **only** under the narrow Vercel preview-authorization exception:
   - Verified `vercel` Bot terminal `https://vercel.com/git/authorize` status, with all other checks terminal (`SUCCESS`, `SKIPPED`, or `NEUTRAL`).
   - Structured `previewAuthorization` debt in `agentEvidence`, `WRITE`/`MAINTAIN` permission, and explicit `viewerCanMergeAsAdmin: false`.
4. Submits one squash PUT with `commit_title: "Integrate pull request #<number>"`, quoting the sealed PR body and commit messages (historical `Signed-off-by:` text stays readable, not a new DCO trailer).
5. Verifies the resulting merge commit retains the reviewed single parent against the inspected base:
   - After a confirmed PUT commit SHA: up to 12 read-only checks (1s interval), honoring HTTP 429 or rate-limit 403 headers (`Retry-After`, `X-RateLimit-Remaining: 0`) within a 120s cumulative wait budget.
   - Ordinary permission 403s, identity conflicts, and lost/unknown PUTs stop immediately (lost PUTs receive one read-only reconciliation and never retry or roll back).

## Cloud event review proposal & connector boundary

- **Proposal**: [2026-10-02-cloud-event-incremental-review-proposal.md](../records/2026-10-02-cloud-event-incremental-review-proposal.md) and the [Poppy broker contract](../contracts/agent-operations/poppy-review-broker.md) remain blocked pending verified parent attribution, durable coalescing, and fenced replay evidence.
- **Ledger & connector handoff**: [cloud-review-ledger-candidate.md](cloud-review-ledger-candidate.md) covers read-only dry-run/journal protocols. [connector-review-parent-handoff.md](connector-review-parent-handoff.md) defines the cloud owner-plugin review and initial open-PR sweep paths (canonical v5, separate analysis vs. publication tracking) without activating generic pending scopes.
