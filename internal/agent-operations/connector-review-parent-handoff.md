# Connector review: parent handoff and production-state proposal

Status: implemented connector collection and guarded publication path in draft #773. The `proto-ui-cloud-owner-review-v1` policy is **active in this draft by explicit user authorization**. The production ledger is provisioned at the pinned genesis below. The bridge is not yet deployed on main, and no webhook listener is enabled; policy activation in an unmerged branch is not authoritative deployment. No review was posted while implementing it.

## First usable path and observed evidence

`connector-review-transport.mjs` uses the supported GitHub connector directly. It does not retry the denied CLI through a proxy or move credentials. The CLI `Forbidden` remains unexplained and is no longer a prerequisite for this route.

A real read-only bridge run collected #509 at `0bde6c962b546524b75129015c96f9ce5ddb7a84` through 23 successful connector calls: 182 changed files, 63 commits, 79 reviews, 37 conversation comments, 79 threads and 117 inline comments. REST pagination reached empty terminal pages. Every inline comment matched exactly one normalized thread comment by ID, node ID, body, timestamp and author. Bot login normalization reconciles REST `name[bot]` with the GraphQL-style `name`. Check-suite IDs join check runs to exact-head repository workflow runs; Vercel's actual deployment failure remains a CI veto. No approval judgment was made by this collection helper.

The permission call's trusted repository/username arguments and returned permission bind its subject. `get_profile` binds the connected principal ID/login. No redundant identity echo is required or synthesized. Reviews use REST node IDs and commit IDs. Collection constructs canonical main-v5 input directly; it does not fabricate GraphQL `pageInfo` fields.

Thread completeness is recorded as **terminal REST inventory plus exact thread-comment coverage**, not unbounded connector auto-pagination proof. The connector contract lists threads and supplies resolution state. Missing/extra/duplicate comments, incomplete timestamps, empty visible threads, inventory count disagreement, malformed or repeated pages, changed declared totals and resource limits fail closed. A matched inventory is bounded evidence for visible submitted comments; pending/unpublished or otherwise unobservable data must not be asserted complete. The provider's general cursor/auto-pagination contract remains unexposed. A target whose coverage cannot be established stays blocked instead of manufacturing an empty thread list.

## Authoritative v5 boundary

Main `8e42c0bfdf8795efe9766e9900ac6bdd58e4eb9a` (merged #509) owns input v5 and packet v2. The connector retains full commit messages, author/committer identities, nullable unknown review authors, and fresh canonical permission observations for eligible approval authors. REST signature validity alone cannot establish the GitHub web-flow platform attestation; missing linked contributor identity blocks this route. The historical collection above predates this migration. A second real read-only run after migration collected merged #509 at `712d85ad10d055d52e60f8a68cd3908533e81878` through 23 successful connector calls, retaining the exact 117-comment/79-thread coverage. It made no review or journal write; collection of a merged target is evidence of transport compatibility, not publication eligibility.

Approval requires every configured trusted CI job and the exact trusted DCO app, repository, head and URL. The trusted repository-scoped check-runs request binds the repository; each returned head and app node ID enters canonical validation. Individual check-suite URLs are unsupported by the connector (observed HTTP 400), so no suite readback is claimed. Current publication permission, contributor independence, evidence/debt, findings, human gates and cumulative governed-review reconciliation remain mandatory. Main's pending scheduled scopes stay blocked; only the separately approved owner-event scope is active in this draft.

Production review bodies are exactly `renderReviewBody(packet)`, allowing canonical receipt recognition. The intent ID stays in the durable journal, without an appended body marker. Simulation-only bodies retain their disclaimer/marker. Prior findings are reconciled against the last durable analysis and canonical live governed disposition. If an analysis-only finish or another publisher makes that stored packet differ from the required latest governed publication, admission fails closed: there is no packet-history recovery, reset or fallback. Ordinary consecutive publications across fresh runs are covered by integration tests.

Nonempty historical v3 packet journals cannot be replayed as v5 or silently rewritten; they require an explicit future migration. The provisioned production ledger contains only its empty genesis and is compatible. Preserve the exhausted historical trial unchanged. All journal, restart, uncertain-result and cooperative-attribution limits below remain in force.

## Executable read-only bridge

Run Node 24 in the repository (the authoritative baseline after #772):

```sh
node scripts/agent-operations/connector-review-worker.mjs
```

It emits `{"kind":"ready","protocol":"proto-ui.connector-review.v1","mode":"read-only"}`. Keep that process alive. If using a PTY, the worker selects raw input so JSON responses larger than 4096 bytes are not truncated.

Send one JSON line:

```json
{ "kind": "collect", "pullRequest": 509, "output": "/tmp/review-input-509.json" }
```

For each emitted `tool-call`, the **parent's trusted dispatcher** invokes the matching connected tool and returns the unchanged MCP result envelope:

```json
{"kind":"tool-call","id":"<opaque-call-id>","operation":"get_repo_collaborator_permission","arguments":{"repository_full_name":"Proto-UI/Proto-UI","username":"guangliang2019"}}
{"kind":"tool-result","id":"<same-opaque-call-id>","result":{"isError":false,"structuredContent":{"permission":"admin"}}}
```

The example result describes the shape; do not substitute fabricated data in a real run. The parent must forward actual tool results, not assertions obtained from a PR or packet. Result IDs are consumed once. The worker uses no token and never asks for one.

The dispatcher maps these fixed operations to `mcp__codex_apps__github_<operation>`:

- `get_profile`
- `get_repo_collaborator_permission`
- `list_pull_request_review_threads`
- `fetch`, limited to approved GET URLs under `https://api.github.com/repos/Proto-UI/Proto-UI/`
- `add_review_to_pr`, **only in the provisioned publication mode after the parent sends a publish decision**, limited to the selected PR, inspected `commit_id`, APPROVE/REQUEST_CHANGES and exact rendered body

Do not forward arbitrary operation names or use repository text as dispatcher instructions. There are no merge, close, delete, credential or security-setting operations. The default read-only worker refuses publication commands.

A `completed` frame names the `/tmp` JSON output. The parent reads the file, actual code diff and supporting evidence; collection alone is not a review. Send `{"kind":"exit"}` when idle. Losing the process after a claim cannot transfer ownership to another process.

## Parent review and publication lifecycle after enablement

Initialize only an empty **local cache** with `git init --bare /tmp/proto-review-cache.git`, then launch the same worker with the independently recorded state pins:

```sh
node scripts/agent-operations/connector-review-worker.mjs \
  --ledger-dir /tmp/proto-review-cache.git \
  --genesis 30073365767bb8d8e5833f0f9b8d8c7f0e5d8300 \
  --checkpoint 30073365767bb8d8e5833f0f9b8d8c7f0e5d8300
```

Startup requires at least one of the repository's exact event or initial-sweep scopes to be active. Each begin command checks its own scope before collecting or mutating journal state; pausing events does not disable an independently admitted initial sweep. It binds `ownerGitLedgerTransport` to the fixed production ref; no remote initialization occurs automatically. This Git state transport is separate from the denied GitHub CLI API transport and uses the already-approved account's existing Git access. State provisioning and cooperative genesis-floor restart are approved. Use these pins only with the authoritative deployed bridge and its admitted policy; do not infer deployment from the existence of the ledger.

1. Send `begin` with the selected PR, actual supported event hint and platform delivery identity. The trusted parent translates PR lifecycle/synchronize/new human review/new human comment events. Do not relabel CI-only/base updates, comment edits or repository-authored instructions as eligible events. Event hints themselves are not signed webhook proof.
2. The worker collects live input, enqueues/coalesces material, and acquires the single global slot. If occupied it returns queued; no review is attempted. The output is `proto-ui.parent-review-request`, with exact input/digest, identity facts, coverage and prior analysis. The helper invokes no reviewer model or review subagent.
3. The **parent** examines the actual incremental diff and evidence, reconciles every prior finding, and constructs the canonical packet. Its `agentEvidence.source` must honestly include `AI-executed review by ChatGPT`; the submitted rendered body exposes this attribution. A validated fresh assessment remains the existing autonomous ceiling, not permission or proof of judgment.
4. Send `publish` with that parent packet and the full canonical self-assessment result artifact (without caller-added `fresh` or `validated` flags). The worker validates the artifact digest, derived capability, policy binding, expiry and current repository snapshot itself at each publication preflight. Assessment remains the parent’s bounded comprehension evidence, not helper-model judgment. The worker re-collects, applies existing canonical authorization/evidence/CI/DCO/finding/duplicate/human gates, excludes the owner and known contributors, persists an unknown publication intent that also fences that PR's admitted generation, and repeats live checks after persistence. Only then does it emit one `add_review_to_pr` call with mandatory `commit_id`, action and exact body.
5. A successful returned object ID is joined to raw authenticated review readback. Missing normalized head/body fields are supplied by that readback and the trusted invocation; contradictory echoed fields reject. Actor, target, head, disposition, exact canonical body must agree. A missing response/ID or ambiguous result never becomes success merely because a matching review exists.
6. Persist the exact publication receipt and last analysis before releasing the slot. Later queued generations remain pending. Known receipt IDs suppress only this controller's own review wake-ups, not unrelated human activity by the owner account.

Commands are JSON lines; for example:

```json
{"kind":"begin","pullRequest":487,"event":{"kind":"synchronize","deliveryId":"<actual-delivery-id>"},"output":"/tmp/parent-review-request.json"}
{"kind":"publish","packet":{},"assessment":{},"output":"/tmp/publication-result.json"}
```

The empty packet/assessment above are placeholders and fail validation. For no-publication work, send `finish` with the parent's canonical analysis packet, or `abandon` before any intent. Every command needs an explicit `/tmp/...` output. An unknown intent cannot be abandoned, expired or adopted after restart. There is no automatic review retry.

## Approved production state — provisioned 2026-10-03 UTC

Absence was verified through the connector and Git before one non-force creation. Exact genesis/checkpoint: `30073365767bb8d8e5833f0f9b8d8c7f0e5d8300`; tree: `bb85bf25f28f616273d07c267dae7601cd8f7da5`; blob: `b5ee308b204abb70b951d6869eab28f3408fdca8`. Connector object readback and a fresh read-only reducer replay verified the parentless root, sole payload and empty state (no pending work, analysis or slot). Exactly one blob/tree/commit/ref creation was used; no review POST. Do not initialize or recreate this ref on startup.

- Repository: `Proto-UI/Proto-UI`.
- Sole state ref: **`refs/heads/proto-ui-review-ledger`**. Already provisioned; fetch and verify its pinned history without overwriting or choosing another ref.
- Parentless genesis tree: exactly one `entry.json` containing `{"schemaVersion":1,"kind":"proto-ui.owner-review-ledger","publicationEnabled":true}`. Initial creation budget: **one blob, one tree, one commit and one ref creation**. No workflows, secrets, private prompts, review or code merge.
- Pins: record the exact genesis SHA. A strict monotonic deployment retains the last verified checkpoint outside the disposable cache. The user selected cooperative deployment, supplying this genesis as the floor on each fresh run; it then **cannot detect an equivalent repository writer's rollback to an otherwise valid ancestor**. Do not present that choice as tamper-proof history. No independent identity service is required or implied.
- Normal state budget per admitted review: up to **four** journal commits (enqueue, claim, intent, receipt), each one entry blob/tree/commit and one exact-tip, fast-forward-only ref advance. Analysis/abandon paths use up to three; a queued/duplicate delivery at most one; a recognized own-review wake-up zero. Uncertain writes never retry. The prior trial ref is excluded and its exhausted budget remains unchanged.
- Data: public-repository canonical PR facts, parent packet/evidence, findings, hashes, operational owner nonce and review receipt. Sanitize the request paraphrase; no credentials or private parent transcript. This is public repository storage.
- Coordination: one parent-controlled dispatcher for the delegated owner. The user commits not to invoke overlapping same-principal reviews through Discord -> Poppy. This is cooperative same-principal coordination, not proof that all other actors are disabled. Other principals' reviews remain live input and are reconciled during final preflight; their workflows are unchanged. Any additional same-principal automated publisher must share this slot or be excluded from overlapping work. No other process may edit/reset this ref. Journal hashes/owner nonces are cooperative integrity/coordination, not cryptographic producer attribution or protection from equivalent repository write access.
- Retention: keep the production journal and baselines **indefinitely while the task is active**, with no automatic deletion. Explicit future archival/migration is required before the 2,048-commit/8-MiB replay limit; exceeding it stops admission without reset or evidence loss. The current implementation does not compact history.
- Disable: pause event delivery and new writer admission, preserve all journal/checkpoint/unknown-intent evidence, and do not restart an older writer or delete/reset state. Read-only investigation is allowed; ambiguous publication is not retried.

Remaining enablement is authoritative deployment of this reviewed bridge/configuration (the PR is still unmerged), then parent installation of the webhook dispatcher with this handoff and the verified production pins. The state, cooperative coordination and scoped policy activation decisions are already authorized; do not request them again. Preserve parent-owned judgment and actual event provenance. No listener is created by this policy edit. The connector collection access problem is resolved for the tested route. Do not submit an arbitrary test review: the parent chooses a real conclusion or obtains an explicitly bounded test target. Merge, closure, security/credential expansion remain separate and unauthorized here.

## User-authorized initial open-PR sweep

The user requested one full sweep of open PRs not authored by `guangliang2019`, immediately after the feature is established, with the parent making judgments from current discussion progress. This is a user-requested bootstrap, not a webhook delivery. The separate `proto-ui-cloud-owner-initial-sweep-v1` scope uses `autonomous/delegated-owner-initial-sweep`; it cannot borrow the event scope. Its fixed identifier is `owner-requested-open-pr-sweep-2026-10-03`. This identifier records the bounded instruction, not cryptographic authorization.

After the runtime/configuration is independently accepted and deployed:

1. Send `{"kind":"capture-initial-sweep","output":"/tmp/initial-sweep-inventory.json"}` once. The trusted connector reads the complete open-PR inventory twice with stable ordering, requires identical membership, excludes owner ID `52768321` and login `guangliang2019`, and includes drafts for analysis. The worker persists the sorted inventory once in the shared journal under the fixed sweep ID; subsequent capture commands return that persisted inventory without recollection or expansion. Pagination is bounded and capture admits at most 1,000 PRs. This is an observed inventory, not an atomic GitHub snapshot; membership changes during collection fail closed. The journal revision binds the captured list across fresh runs.
2. Process that inventory serially, one retained worker/session per PR, using the same production ref and verified genesis/checkpoint as event processing. Send `{"kind":"begin-initial-sweep","pullRequest":487,"output":"/tmp/initial-review-487.json"}`. The worker first requires membership in the persisted inventory and skips completed members before connector dispatch. It then derives a stable per-PR intake ID internally, collects current facts, verifies the PR is still open, and records `initial-sweep` honestly. Finishing the parent analysis or persisting its publication receipt marks that sweep member complete; a fresh run cannot reopen it, even after its head changes. Later changes require the independent event scope. It rejects this kind through ordinary `begin`; no fabricated platform delivery ID is accepted for bootstrap.
3. The parent reads the actual diff, current reviews/comments/replies/thread state and prior analysis, reconciles discussion progress and every prior finding, then supplies its own packet through the existing `publish` or `finish` commands. Collection never constitutes a verdict. Draft analysis does not automatically publish a review or make the PR ready. Canonical disposition rules remain unchanged.
4. Bootstrap and future supported events use the same material digest, pending generations, global slot, exact-input/head checks, cumulative baseline, durable intent and receipt. A queued result means defer that item; never launch a parallel publisher or steal its slot. If a genuine event updates material after bootstrap, use that event's real identity. Reusing the fixed bootstrap ID with different material fails closed rather than creating a second bootstrap attempt.
5. Unknown intent or lost acknowledgement stops all publication. Preserve the inventory, remaining items and ledger; do not reset state to finish the sweep. Owner-authored, closed, identity-incomplete or otherwise blocked targets retain their explicit reason. The parent handles selection, judgment and any actual review POST; no review subagents are added.

## Deployment distinction and runtime availability

Webhook creation and review publication are separate operations. The available automation interface does not require merging this PR merely to create a webhook. Repository governance requires admitted authorization, live permission, provenance, DCO/CI/review, exact-action checks and an accepted runtime/configuration; no blanket main-ancestry requirement was found in those rules. The worker loads policy beside its pinned implementation and does not itself test whether that revision has merged. This is a technical property, not deployment authority: branch content, an active-looking YAML field or a successful startup cannot admit itself.

The chosen rollout remains independent acceptance, integration of this PR, deployment, then parent webhook installation and the initial sweep. A separately approved, exact-revision pre-merge deployment is a possible alternative only if the maintainer explicitly admits that reviewed implementation and both scoped policies as the operative configuration while preserving every existing gate. No such alternative deployment or activation is authorized or performed by this implementation task. Main currently lacks these scopes; running main alone does not establish this feature.

The current execution environment has Node 24, the frozen pnpm dependencies, callable read-only GitHub connector operations and existing Git access; local tests and the prior read-only production-root startup demonstrate that environment. A future fresh automation run is not proven to inherit that workspace. Deployment must pin the accepted implementation commit/tree and policy, install its frozen dependencies in a trusted workspace, provide the fixed dispatcher and existing authorized Git access, and verify startup against the production pins before admission. Never execute a reviewed PR's arbitrary checkout as the publisher, introduce credentials, or fall back to another source/mode if that runtime is unavailable. Missing runtime is a fail-closed availability blocker; webhook registration alone cannot resolve it.

## Exact-tip transport correction (2026-10-03)

The owner Git writer now requires both a single candidate parent equal to the observed revision and `--force-with-lease=<fixed-ref>:<expected-revision>` on the push. The explicit expected value rejects a remote deletion, rollback or sibling advance between read and push; the parent assertion restricts an accepted update to one fast-forward child. This does not allow arbitrary forced history replacement, creation of a missing ledger, takeover or retry. The earlier connector non-force trial remains historical evidence for its narrower sibling-race result, not evidence for this corrected Git transport.

The production code's push arguments were exercised against disposable local bare remotes. An unchanged tip accepts its one child; deletion and rollback injected immediately before push are rejected without recreating/restoring the ref. This local experiment does not claim a fresh production-ledger write or authenticated webhook/POST trial. Existing unknown-outcome and checkpoint limits remain unchanged.

## Expected-tip state update and no-rewrite boundary

The production transport pairs `--force-with-lease=<fixed-ref>:<expected-tip>` with a mandatory immutable-candidate check: the proposed commit must have exactly one parent, equal to that expected tip. The explicit expected value is never omitted or derived from a tracking ref, and cannot be empty. The only admitted successful transaction advances that exact existing tip to its direct child. There is no `--force`, `+` refspec, history rewrite, ref recreation, rollback restoration or fallback. Server protection remains effective; rejection or uncertain acknowledgement stops mutation without retry.

The option's name does not grant a rewrite exception: both the exact-tip lease and direct-child predicate must pass. An already-installed candidate reported as “up to date” is not attributed to this attempt; only one fast-forward porcelain receipt is accepted, followed by canonical readback. This closes the prior ordinary-push hole where a deleted ref could be recreated or an ancestor rollback silently fast-forwarded. See [Git's explicit lease semantics](https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegtltexpectgt).

Adversarial tests execute this production push implementation against isolated local bare Git remotes, including deletion, rollback, advancement, unchanged tip, already-installed candidate, and deletion/rollback after remote advertisement via a local pre-push hook. Local receive-side non-fast-forward protection stays enabled in the primary matrix. Invalid candidates are rejected before push. These are real local Git tests, not live GitHub write experiments; no production state was changed, and equivalent-writer ABA/rollback to the same previously observed value remains outside the cooperative guarantee. No repository protection or credential setting is changed.

## Live authorization and bounded replay corrections

The trusted worker re-reads its fixed deployed policy file before admission/state transitions and at both publication preflights, including after unknown-intent persistence and immediately before the review request. Any policy change (including pause/revocation), missing policy, or unreadable policy stops that lifecycle; it cannot adopt a widened policy mid-review. The parent must deliver admitted policy revocations to that trusted deployment: this file reader does not poll GitHub main or manufacture a remote kill switch. As with other live preflights, there remains a read-to-request race; no atomic revocation guarantee is claimed.

The worker validates the parent's complete canonical assessment result and recollects its own trusted repository snapshot; no parent command can provide a policy/snapshot reader. It also requires the assessment's worktree digest to match, so an assessment of different uncommitted runtime files cannot authorize publication. These checks provide the existing unsigned autonomous ceiling, not independent model attestation or signed producer identity.

Identical delivery replay returns the already observed journal revision with `noOp: true`; it creates no objects, ref update or remote push. Reusing a delivery ID with changed evidence still fails. Distinct deliveries and real transitions remain subject to the existing 2,048-entry history budget. A sweep capture consumes one entry; the 1,000-member capture bound does not promise enough history to complete that many reviews. Exhaustion, unknown intent, a closed/unavailable captured member or incomplete evidence remains a fail-closed operational limit. No reset, new inventory, automatic takeover or rollover is provided.

## Owner-plugin scope versus Poppy-specific activation

This route uses the separately admitted `proto-ui-cloud-owner-review-v1` and initial-sweep authorizations, the delegated owner's connected principal, and canonical v5 review gates. It is not the separately operated `Proto-UI/dcbot` publisher. The [Poppy contract](../contracts/agent-operations/poppy-review-broker.md#durable-write-boundary-designed-for-later-phases) attaches its additional all-thread, all-mutation DCO and governed-spec-path gates to Poppy's separately recorded event-admission authorization and activation. Those Poppy requirements remain unchanged.

For the owner route, canonical `authorizeReviewSubmission` and its existing tests deliberately permit governed-spec approval when the complete review has no human judgment gate; neither a current nor previous spec YAML path is a blanket veto. Open discussion is bound into live input and must be evaluated by the parent, but an unresolved mechanical thread is not itself a universal mutation veto. A finding-backed `REQUEST_CHANGES` may report failed DCO; `APPROVE` still requires trusted successful DCO and complete successful CI. Human-maintainer judgment, incomplete evidence/debt, missing findings for a change request, identity/permission failures and exact-head drift continue to prevent publication. Connector regression tests exercise these positive and negative boundaries; they do not constitute independent review or permission to deploy.

## Dispatch fence and exact-commit semantics

Staging a publication intent is the controller's durable reservation point: its existing exact-tip CAS both validates the claimed generation and fences it. This uses the existing intent commit, preserving the four-commit normal publication budget. If a competing material admission wins first, intent persistence fails and no POST occurs. After reservation, new target-PR wake-ups remain durable in `deferred` instead of advancing the reserved generation. Other PRs can still queue. An already visible deferred material wake-up stops the one-time attempt before dispatch; byte-identical or unchanged-material wake-ups do not invent a generation. Once dispatch has begun, later target wake-ups are logically ordered after it. Receipt finalization releases the slot and applies them in journal order, coalescing pending work without dropping it. Unknown outcomes retain the fence and deferred work, with no takeover, expiry or retry.

This serializes cooperative journal admissions with dispatch; it does **not** lock GitHub's PR head, discussion, permissions or policy. Final live collection and canonical checks run under the reservation. A GitHub update can still occur after the final read. The [review API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request) binds `commit_id` to the reviewed commit, not a compare-and-swap on the current head. Both canonical rendered evidence and the helper result identify that reviewed commit only. `AGENTS.md:120` requires a fresh boundary read; `contributor-agents.md` requires a later head to be reviewed incrementally; `authorizeReviewMerge` requires the eligible publication receipt to match the live head. Existing governance therefore does not credit an old-head review as approval of a newer head. No new policy exception or perfectly atomic external-head prerequisite is introduced.

After a confirmed review receipt, the helper immediately reads the current PR head. `reviewedHeadSha` and `observedHeadSha` are distinct result fields. A changed head is queued as a read-observed `synchronize` hint only while the separate event scope remains active, using a `post-review:<receipt-id>:<observed-head>` delivery ID; it is not represented as a verified webhook delivery. This costs at most one additional journal entry for that observed update. The parent should immediately drain `followUpQueued` with a fresh session, a new delivery ID (do not reuse the already recorded post-review ID), current collection and its own incremental judgment. It must not reuse the prior packet or interpret `status: published` as approval of the observed newer head.

If observation is unavailable or the event scope is paused, the confirmed receipt remains a publication of the reviewed commit and the result carries `followUpRequired` plus `followUpError`; no alternate scope, dismissal or retry is attempted. The parent must retain that result and handle the follow-up debt. A changed head arriving after the observation remains the responsibility of the existing event subscription; no instantaneous quiescence guarantee is made. Same-head deferred discussion updates also require follow-up. Any uncertain journal acknowledgement remains fail-closed under the existing global unknown-outcome rule.

GitHub-native stale-approval dismissal/counting is separate from the canonical controller's exact-head merge gate. Current branch-protection settings could not be inspected through this connector (403), so no automatic stale-approval dismissal is claimed. Changing `dismiss_stale_reviews`, last-push approval rules or other branch protection, or dismissing a review, would require separate authority; none is changed or needed for this controller repair. Independent review and deployment readiness remain separate from the executed local race tests.

## Confirmed receipt persistence under contention

A confirmed connector receipt is not made into an ambiguous review POST merely because a later journal enqueue wins before finalization. The original process may attempt receipt persistence at most three times, each time re-reading the latest revision and verifying the entire same fenced intent before applying the identical receipt. Only an explicit pre-write `conflict` result is retryable: both ledger adapters return that status before attempting a state write. Their ownership checks still apply. A remote rejection, lost acknowledgement, `unknown` outcome, changed intent or lost owner never triggers this retry. The review POST is outside the loop and remains one-shot.

Successful reconciliation releases the slot and preserves all intervening target and other-PR work. If uncertainty or the three-attempt contention budget stops reconciliation after the receipt was confirmed, the result retains `publicationConfirmed: true`, the exact receipt and reviewed head while overall persistence remains `unknown`. This is evidence for attended reconciliation, not permission for another process to adopt the owner, repeat the POST, dismiss a review or reset the ledger. Definitive pre-write conflicts add no journal entry, so the normal four-advance publication budget remains unchanged.
