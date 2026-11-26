# Publishers, collaboration execution, and event shadow

This guide specifies the execution contracts for `agent:publish`, `agent:collaborate`, and offline `event-shadow` replay. For top-level architecture and CLI commands, see [README.md](README.md).

## Scope & Limits

- Standalone CLI `--mode` and `--mode-source` flags are operator declarations, not runtime attestation; the CLI is not a token sandbox.
- Generic scheduled writer scopes (`proto-ui-scheduled-collaboration-v1`, `proto-ui-scheduled-review-v1`, `proto-ui-scheduled-merge-v1`) remain `pending-runtime-identity` and read-only. Autonomous collaboration also stays blocked pending a governed publication-verification contract for `governed-outcome` artifacts.
- Read-before-write observations are change detection, not server-side compare-and-swap guarantees.

## Supported publisher (`agent:publish`)

Every invocation requires `--repository`, independently established `--mode` / `--mode-source`, and `--authorization` (`explicit-current-user` or a signed `--owner-grant` ID with `--owner-authorization` and `--owner-key`).

```sh
pnpm agent:publish -- commit --message-file <message.txt> --branch <branch> --expected-head <sha> --expected-tree <tree-sha> --repository github.com:owner/repo --mode human-assisted --mode-source current-user --authorization explicit-current-user
pnpm agent:publish -- issue create --title <title> --body-file <body.txt> --repository github.com:owner/repo --mode human-assisted --mode-source current-user --authorization explicit-current-user
pnpm agent:publish -- pull-request create --title <title> --body-file <body.txt> --base <base> --head <branch> --repository github.com:owner/repo --mode human-assisted --mode-source current-user --authorization explicit-current-user
pnpm agent:publish -- comment --number <n> --body-file <body.txt> --repository github.com:owner/repo --mode human-assisted --mode-source current-user --authorization explicit-current-user
pnpm agent:publish -- update-body --number <n> --body-file <body.txt> --target-updated-at <UTC> --target-body-digest <sha256> --repository github.com:owner/repo --mode human-assisted --mode-source current-user --authorization explicit-current-user
```

### Operation invariants

| Surface | Required bindings & safety rules |
| --- | --- |
| `commit` | Rejects origin's live `default_branch`. Runs `git commit --signoff --cleanup=verbatim` against a private index frozen to `--expected-tree` and verifies the commit object directly. Delegation needs `implement` + `*`. |
| `pull-request create` | Binds pushed head/base SHAs, verified live origin repo (fork `owner:branch` + `head_repo`), and complete paginated contributor comparison (including >250 commits). Sends authorized Markdown byte-for-byte; closed PRs never count as duplicates. |
| `comment` & `update-body` | `update-body` edits only credential-owned targets bound to freshly read `target-updated-at` + `target-body-digest`. Pass `--body-digest <sha256>` for sealed payloads so the body and marker stay byte-identical. |
| Unknown outcomes | Any lost acknowledgment stops after one read-only reconciliation and never retries automatically. |

## Collaboration execution (`agent:collaborate`)

A collaboration request names one of the seven actions in `proto-ui-scheduled-collaboration-v1`, carries an empty attended-decision list, binds current-user or governed-outcome evidence, and includes exact target IDs and timestamps (`updatedAt`, `expected_head_sha`, thread ID, or workflow ID).

- **Local vs. live checks**: `validate` checks request/handoff schema, mode/source parity, and digests locally; `apply` re-reads live GitHub state before deciding no-op, reject, or one bounded write followed by post-write readback.
- **Mode declarations**: Both `validate` and `apply` require independent `--mode` matching the handoff (human-assisted: current-user or active-human-loop; autonomous: maintainer-invocation, schedule, or governed-queue). Human-assisted runs require `current-user-instruction` purpose evidence.
- **Sealing**: Compute `agent:collaborate -- request-digest`, attach `sha256:<digest>` as the handoff's `collaboration-request` artifact, and bind `--authorization`.
- **Metadata repairs**: Title/label updates preserve existing bodies without retroactive rewrites.

### Thread revision digests

Before authoring a thread-resolution request, collect the thread snapshot read-only:

```sh
corepack pnpm@10.32.1 agent:collaborate -- thread-revision --repository <github.com:owner/repo> --pull-request <number> --thread <thread-id>
```

- Hashes the thread ID plus every comment's database ID, author login (or `null`), exact body, and update timestamp sorted by ID (capped at 100 comments; truncation or missing/duplicate IDs fail closed).
- Participates in preflight, final admission, already-resolved no-op detection, and post-write verification.

### Bounded comments and unknown-outcome receipts

- A comment request dated after the preflight observation clock rejects before writing; post-write verification binds the returned comment ID, actor, canonical body, and server creation time against unique live readback.
- Any unavailable acknowledgment, failed readback, or invalid receipt throws `CollaborationMutationUnknown` with a `proto-ui.collaboration-unknown` JSON result (`writeAttempts: 1`, `reconciliationReadAttempts: 1`) and exits nonzero; never retry blindly.

## Event shadow contract (`event-shadow.yaml`)

`event-shadow.yaml` defines an offline, zero-write webhook replay contract (no webhook listener, token, or Coding Harness is deployed).

```sh
corepack pnpm@10.32.1 agent:event-shadow -- replay \
  --delivery <raw-delivery.json> \
  --trust <deployment-trust.json> \
  --state <prior-state.json>
```

- Authenticates raw request bytes via `X-Hub-Signature-256` (secret from an env var) and cross-checks headers/payloads against runtime trust anchors.
- Emits identity-only envelopes (stripping Issue/PR bodies, comments, patches, and filenames) with `mutationAuthorized: false` and `writeOperationsPerformed: 0`.
- Keys replay deduplication by `(trustedRepositoryId, rawBodySha256)` rather than mutable delivery headers; out-of-order or tied PR revisions return `reconcile-live-state`, while admitted events return `collect-live-state`.
- Produces pure canonical `nextState` without persistence; a future controller must supply durable storage, atomic leases, and authenticated transport provenance.
