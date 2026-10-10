# Intranet contributor previews

One static preview service consumes GitHub Actions artifacts for open or draft `Proto-UI/Proto-UI` pull requests, including fork heads. Poppy does not build, publish, authorize, invite users to, or store these previews. There is no Cloudflare Pages provider, dcbot receiver, fallback, workflow template copy, or preview comment writer.

## Build and publish

1. `.github/workflows/intranet-preview-build.yml` resolves the live open PR and exact head. A disposable hosted builder uploads its identity marker before executing contributor code, checks out that exact head without persisted credentials, installs the frozen lockfile and builds `apps-www`.
2. The marker is `intranet-preview-binding-<pr>-<head-sha>-<attempt>`; the static ZIP is `intranet-preview-<pr>-<head-sha>-<attempt>`. Both expire after three days. Old provider artifact identities are not admitted.
3. `publish.mjs` runs in the existing trusted publisher seat. It uses GitHub read APIs to enumerate open PRs, branch builds and manual builds, then uses `build-admission.mjs` to bind the workflow, repository, PR, head, run, attempt and artifact. A native `flock` serializes the entire CLI operation.
4. `extract-artifact.mjs` downloads a bounded ZIP without forwarding the API token to its signed blob URL. `sanitize-tree.mjs` creates a separate tree of ordinary non-executable files. The publisher never imports, executes or builds anything from the ZIP.
5. After staging, the shared admission guard rechecks supersession, run attempt and live PR/head. One atomic catalog replacement makes admitted generations available. The final open-head scan excludes PRs that closed or changed during staging; obsolete owned generation directories are removed.

Discovery does not filter by a run's original creation time: an older run can produce a fresh rerun attempt. A completed manual attempt whose entire artifact set is expired is remembered only as a negative discovery fact. A new attempt invalidates that key; cached discovery never authorizes publication. Enumeration is capped at fewer than 1,000 runs per branch/manual query, 1,000 open PRs and 400 artifacts per run. Incomplete, changing or over-bound results fail closed.

Existing PRs can be built after the workflow reaches the default branch:

```sh
gh workflow run intranet-preview-build.yml --repo Proto-UI/Proto-UI --ref main \
  -f pr_number=<open-pr> -f expected_head_sha=<full-live-head-sha>
```

This dispatch requires ordinary live Actions permission. It does not provision credentials or activate a second publishing path.

## Origin and audience

The catalog is at the configured dedicated preview domain. A Ready generation uses `p<pr>-r<run-id>-a<attempt>.<domain>:<port>` and serves the site at `/`, not beneath a Gitea repository path. Root-relative Astro routes and assets therefore keep their normal layout. Extensionless directory routes redirect to their trailing-slash form. A new head, run or rerun attempt gets a different origin.

The deployment uses an intranet-only listener and a private wildcard DNS entry. The concrete host, domain, port and service status are operational configuration, not a public package guarantee. Intranet reachability replaces the retired per-author/reviewer OAuth access policy: anyone on the permitted intranet can read the preview. Do not expose it through the public Poppy edge, Gitea origin, SSO origin, an administrator origin, or an unauthenticated WAN forwarding rule.

Preview JavaScript is untrusted. The server sets `no-store`, `nosniff`, no-index headers and a server-owned CSP restricting scripts/assets/network requests to that generation, disabling frames, forms and workers. Service-worker and worker fetches are also rejected independently of the page CSP. No API token, user session, admin route or deployment control endpoint is served on these origins.

## Availability and bounds

A failed, queued or superseding build cannot leave its predecessor advertised as Ready. Closed PRs and changed heads lose their catalog entry; requests to a non-current generation return `410`. A failed synchronization returns `503`, rather than renewing old Ready state. A catalog older than five minutes also returns `503`, including when the publisher stopped or was killed.

Synchronization is polling, not an atomic GitHub authorization transaction. GitHub can change after the last API read. The two-minute deployment timer and five-minute serving lease bound convergence; they do not promise instantaneous revocation. The scan itself must finish within four minutes, and every Ready entry retains the original scan timestamp rather than a later lease extension.

The retained artifact envelope is 50 MiB compressed, 100 MiB expanded, 25 MiB per file and 20,000 files. ZIP materialization additionally limits each path to 64 components/1,024 UTF-8 bytes, aggregate path names to 8 MiB and inferred parent directories to 20,000. Links, special files, traversal, ambiguous paths, and root `_worker.js`, `_routes.json`, `_headers`, `_redirects` or `.assetsignore` controls are rejected. Empty regular assets remain valid.

## Runtime configuration

The credential-free static process uses a JSON configuration:

```json
{
  "root": "/var/lib/proto-ui-preview",
  "domain": "preview.example.internal",
  "bind": "10.0.0.12",
  "port": 8188,
  "leaseMilliseconds": 300000
}
```

Run `node serve.mjs <serve-config.json>` under a separate unprivileged account with read-only access to the published tree and no credential mounts.

The trusted publisher uses `{ "root": "<same-published-tree>", "ghPath": "<verified-gh-binary>" }` to read the existing seat's identity without exporting it to the static host. Alternatively, a separately provisioned protected `tokenFile` can hold a repository-scoped Actions-read credential. Configure exactly one identity source. A public repository does not make Actions artifact downloads anonymous. Do not copy a broad maintainer token onto the serving process or grant this read-only client additional write permission.

Run `node publish.mjs <publish-config.json>` as a finite supervised command. The CLI acquires the kernel lock itself; locks are released when the owned process dies or the host reboots. Direct callers of `synchronizePreviews` must provide the same serialization. Keep code/configuration trusted and immutable between reviewed deployments; only the publisher may write the data directory.

## Verification and retirement

`.github/workflows/intranet-preview-checks.yml` runs the focused native Node suite. Locally:

```sh
node --test scripts/preview/*.test.mjs
```

Runtime acceptance additionally requires a real Actions artifact, actual catalog/page/assets and WC/React/Vue/Vue2 browser behavior, separate generation origins, worker rejection and observed head/failure/close or lease revocation. Unit checks alone do not prove deployment.

The old Poppy build/bootstrap/deploy/close/security workflows and both integration copies are removed from source. Their registered platform workflows, preview-only secrets, Pages resources, deployed bot/edge routes and OAuth callback settings must be reconciled against live ownership before declaring external retirement complete. Preserve unrelated Poppy OAuth, broker, reports and Control Room features; preserve historical SQLite rows and dated engineering records. Do not remove shared Cloudflare credentials merely because preview no longer uses them.
