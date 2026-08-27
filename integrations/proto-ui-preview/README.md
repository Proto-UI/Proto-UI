# Poppy contributor previews

This integration gives every open or draft `Proto-UI/Proto-UI` pull request a Vercel-style preview, including pull requests whose head branch lives in a fork. Each PR receives one isolated Cloudflare Pages project named `poppy-proto-ui-pr-<number>`. A new commit replaces that project's deployment; closing the PR deletes the entire project.

The preview is not public. Its trusted Pages `_worker.js` asks Poppy to authorize every asset request. GitHub OAuth grants access only to the PR author, a current requested or non-dismissed recorded reviewer, an active member of the Proto-UI organization, or a user explicitly invited through Poppy by an identity with current maintainer trust for this repository. An invite is scoped to the exact repository, PR, and current head and is valid only for the Ready deployment tuple (head SHA, run ID, run attempt, and project); a new head, Building/Failed/Closed transition, explicit invite revocation, lost maintainer trust, dismissed review, or removed membership invalidates authorization without waiting for the session cookie to expire.

## Data flow

```text
fork or same-repo PR
        |
        | pull_request (read-only token, no secrets)
        v
build apps-www -> GitHub Actions artifact (untrusted)
        |
        | workflow_run on the trusted default branch
        v
verify run + live PR + head SHA + exact artifact name
        |
        v
sanitize artifact -> inject trusted _worker.js -> deploy per-PR Pages project
        |
        +--> HMAC-signed deployment record -> Poppy
        +--> one updated PR comment

failed build -> exact live PR/head association -> revoke stale ready state
             -> update the same PR comment with the failed Actions run

pull_request_target: closed -> delete the whole Pages project -> mark closed
```

## Install in `Proto-UI/Proto-UI`

Keep this directory in the target repository at `integrations/proto-ui-preview/`, then copy its workflow templates into the repository workflow directory:

```bash
cp integrations/proto-ui-preview/.github/workflows/*.yml .github/workflows/
```

The resulting paths must be exactly:

- `.github/workflows/poppy-preview-build.yml`
- `.github/workflows/poppy-preview-bootstrap.yml`
- `.github/workflows/poppy-preview-deploy.yml`
- `.github/workflows/poppy-preview-close.yml`
- `.github/workflows/poppy-preview-security.yml`

When these trusted files reach `main`—or are later upgraded—the push-only bootstrap workflow enumerates every already-open pull request, including drafts and forks, and dispatches the same live-PR/head-validated secret-free build. Existing PRs therefore do not have to wait for a new commit or a manual maintainer action.

The deploy and cleanup workflows intentionally execute the scripts from this directory after checking out trusted repository code. Do not change them to check out `pull_request.head.sha`. Bootstrap uses `repository_dispatch` to converge secret-free manual builds because GitHub permits that GITHUB_TOKEN event to start another run while loading the deploy workflow exclusively from the default branch; the secret-bearing deploy workflow has no `workflow_dispatch` entry.

In **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create and update pull-request comments. The workflow YAML still narrows each job to its minimum permissions:

| Workflow | Trigger | Effective permissions | Secrets |
| --- | --- | --- | --- |
| build | `pull_request` | `contents: read` | none |
| bootstrap | trusted `main` workflow installation/update (`push` only) | `actions: write`, `contents: write`, `pull-requests: read` | none |
| deploy | build `workflow_run` or `poppy_preview_build_completed` `repository_dispatch` (default-branch workflow code only) | `actions: read`, `contents: read`, `pull-requests: write` | Cloudflare and Poppy |
| cleanup | `pull_request_target: closed` | `contents: read`, `pull-requests: write` | Cloudflare and Poppy |
| security | preview integration changes on PR or `main` | `contents: read` | none |

## Repository secrets

Add these at **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account that owns the per-PR Pages projects. |
| `CLOUDFLARE_API_TOKEN` | Scoped token with Cloudflare Pages project/deployment edit access for that account. Do not use the global API key. |
| `POPPY_PREVIEW_EDGE_SECRET` | At least 32 random bytes. The deploy workflow stores it as the `POPPY_PREVIEW_EDGE_SECRET` Pages secret; Poppy holds the same value. It is never embedded in `_worker.js`. |
| `POPPY_PREVIEW_INGEST_SECRET` | A different, at least 32-byte HMAC key shared with Poppy's deployment-ingest endpoint. |

Generate the two independent Poppy secrets locally, for example:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

The Cloudflare token only needs the account's **Cloudflare Pages: Edit** capability. The close workflow deletes an entire per-PR project, which also removes its deployments, hostname, Worker secret, and build resources.

## GitHub App and Poppy settings

The OAuth gate uses the existing Poppy GitHub App. Configure:

- callback URL: `https://poppy-proto-ui.chenyejin2004.workers.dev/preview/auth/github/callback`
- repository **Pull requests: Read-only**, so Poppy can confirm the current PR author and state;
- organization **Members: Read-only**, so hidden as well as public organization membership can be verified;
- no repository write permission is required for preview comments—the trusted workflow's short-lived `GITHUB_TOKEN` owns its one sticky comment.

Configure Poppy with the same `POPPY_PREVIEW_EDGE_SECRET` and `POPPY_PREVIEW_INGEST_SECRET`. The central control plane must expose:

| Endpoint | Contract |
| --- | --- |
| `GET /preview/auth/github?pr=<n>&return=<url>` | Starts OAuth. `return` is the requested absolute URL on the exact recorded `https://poppy-proto-ui-pr-<n>.pages.dev` origin; reserved `/__poppy/*` paths are rejected. On success Poppy redirects to `/__poppy/session?ticket=...&return=<clean-path-and-query>`. |
| `POST /api/preview/exchange` | Requires `X-Poppy-Preview-Edge-Secret`. Exchanges `{ticket, pr, project, head_sha, run_id, run_attempt}` once and returns `{session, return, expires_at}` (`expires_in` is also accepted by the Worker). |
| `POST /api/preview/authorize` | Requires the same edge-secret header. Checks the session plus the same immutable head/run tuple and returns `{authorized: true}` or `{allowed: true}` only while that exact deployment record is Ready, the PR is open, and the user is eligible as author, live reviewer, active organization member, or exact-current-head invite issued by an identity with current maintainer trust. Head/deployment transition, invite revocation, or loss of mutable eligibility denies the next asset request. |
| `POST /api/preview/deployments` | Requires `X-Poppy-Signature-256: sha256=<HMAC(raw body)>`. Accepts the deployment lifecycle payload described below. |

Deployment lifecycle payloads use stable snake-case fields:

```json
{
  "pr": 462,
  "head_sha": "0123456789abcdef0123456789abcdef01234567",
  "author_login": "contributor",
  "author_id": 12345,
  "project": "poppy-proto-ui-pr-462",
  "origin": "https://poppy-proto-ui-pr-462.pages.dev",
  "deployment_id": "cloudflare-deployment-id-or-empty",
  "run_id": 123456789,
  "run_attempt": 1,
  "status": "ready"
}
```

`status` is `building`, `ready`, `failed`, or `closed`. `origin` remains the canonical per-PR origin for every status; `run_id` is always the positive GitHub Actions run ID, `run_attempt` distinguishes immutable artifacts created by a re-run, and `deployment_id` may be empty when no deployment became ready.

## Security boundaries

- The fork build receives no secrets and a read-only token. It checks out the exact live PR head SHA, not a mutable branch name.
- The artifact is always considered hostile. The privileged job verifies the workflow path, base repository, event, current open PR, current head SHA, artifact name, expiry, and size through GitHub's API.
- The privileged job checks out deployment code from its trusted ref and never runs a file from the artifact. The sanitizer rejects links and special files, enforces Pages limits, removes `_worker.js`, `_routes.json`, `_headers`, `_redirects`, and `.assetsignore`, then writes its own gate last. In particular, an attacker cannot use `_routes.json` to bypass the Worker.
- Existing per-PR projects are accepted only when they are Direct Upload projects. A Git-integrated Pages project with the same name is rejected, so a separate Git deployment cannot replace the trusted gate at the canonical URL.
- `POPPY_PREVIEW_EDGE_SECRET` is a Pages encrypted secret binding. It is not written into JavaScript, an artifact, a comment, or a workflow log.
- The trusted job installs its exact Wrangler version from the checked-in npm lockfile with lifecycle scripts disabled before any secret-bearing Wrangler command runs.
- The browser stores only an opaque session in `__Host-poppy-preview` with `Secure; HttpOnly; SameSite=Lax; Path=/`. The OAuth ticket is one-time and short-lived. Poppy re-authorizes every asset request and can revoke a session immediately when a PR closes or membership changes.
- Artifact responses set both `Content-Security-Policy: worker-src 'none'` and a deliberately unrelated `Service-Worker-Allowed` scope. Pull-request code cannot install a persistent Service Worker that bypasses later authorization or intercepts `/__poppy/session`.
- The trusted workflow must receive Poppy's `building` acknowledgement before touching Cloudflare. A failed `ready` acknowledgement produces a failed card and failed workflow; Cloudflare success alone can never publish Ready.
- Every response is `private, no-store` and carries `X-Robots-Tag: noindex, nofollow, noarchive`. The Pages origin has no unguarded route.
- Cloudflare's deployment-specific hash hostnames are redirected to the one canonical per-PR hostname before OAuth, preventing a session from being split across or bootstrapped for an unrecorded origin.
- The ingest HMAC key and edge authorization key are deliberately different.

## End-to-end test

The secret-bearing deploy workflow deliberately has no `workflow_dispatch` entry point: repository workflows from non-default branches must never be able to request these secrets. The secret-free build workflow does expose a manual input so existing open PRs can be bootstrapped; the trusted deploy workflow accepts such an artifact only when that build ran from the repository's default branch:

```bash
gh workflow run poppy-preview-build.yml \
  --repo Proto-UI/Proto-UI --ref main \
  -f pr_number=462 \
  -f expected_head_sha="$(gh pr view 462 --repo Proto-UI/Proto-UI --json headRefOid --jq .headRefOid)"
```

After this integration reaches the default branch, open or update a disposable PR to exercise the normal `pull_request` → `workflow_run` path. A maintainer can also use GitHub's ordinary **Re-run jobs** UI; `run_attempt` keeps those immutable artifacts and lifecycle updates distinct.

For acceptance, verify all of the following:

1. PR #462's fork build gets no secrets and uploads the expected artifact.
2. Direct navigation to its Pages URL redirects to Poppy GitHub OAuth.
3. The PR author, a current recorded reviewer, an active Proto-UI organization member, and an exact-current-head user explicitly invited by a maintainer can enter; an unrelated GitHub account receives no preview session. Removing the invite or moving the PR to a new head revokes that invited user on the next request.
4. Synchronizing the PR replaces the deployment and updates the same comment.
5. A failed build invalidates the current head's preview instead of leaving a stale **Ready** comment or accessible older head.
6. Closing a disposable test PR deletes `poppy-proto-ui-pr-<n>` and changes the same comment to **Preview removed**.
