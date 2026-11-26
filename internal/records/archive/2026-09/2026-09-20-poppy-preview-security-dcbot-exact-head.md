# Poppy preview security: fail-closed exact-head dcbot verification

Status: dated non-normative engineering record for the PR #596 review finding `PR596-DCBOT-EXACT-HEAD-EVIDENCE-001`. The normative trust boundary lives in `.github/workflows/poppy-preview-security.yml` comments and `integrations/proto-ui-preview/README.md`; this record only preserves the reasoning and alternatives considered on 2026-09-20.

## Finding and root cause

The only credential-capable real dcbot handler job was restricted to `push`, and both dcbot checkouts used `continue-on-error`. On PR head `dfda3bfac68d48716fe8b452d5ba0d76caa70c75` the canonical check "Pinned dcbot handler verification" was SKIPPED, and the `pull_request` lane silently skipped source-digest verification and the Go suite whenever `github.token` could not read the private `Proto-UI/dcbot` repository. No non-optional exact-head evidence existed before integration.

## Chosen direction

A `pull_request_target` lane (`dcbot-contract-exact-head`) now produces the exact-head receipt:

- The workflow definition comes from the immutable default branch, so PR code cannot alter the trusted steps, and `GITHUB_TOKEN` stays `contents: read`.
- `DCBOT_CONTRACT_TOKEN` is required up front; absence or an unauthorized token fails the check. The token is used only for the pinned-revision dcbot checkout with `persist-credentials: false`, and the checkout must resolve to the pinned commit.
- The PR head is checked out separately (contract JSON only) as inert data; nothing under `.pr-head` executes. Digest verification is an inline script embedded in the trusted workflow and rejects unsafe digest paths before reading them.
- The check binds to `github.event.pull_request.head.sha`; the `refs/pull/<n>/head` fetch is verified against that SHA so a stale checkout fails instead of certifying the wrong tree.
- The push-only lane keeps the same verification and is now fail-closed as well; `continue-on-error` is gone from every dcbot checkout.

Alternatives considered: a `workflow_run` receipt would also run trusted code, but its checks attach to the default branch rather than the PR head, so the receipt would not appear as an exact-head PR check. Running the in-repository digest test from the PR head inside the trusted lane was rejected because it would execute pull-request-controlled code in a secret-bearing job.

## Follow-ups

- The new `pull_request_target` lane only exists on the default branch after this PR merges; until then the exact-head check cannot run for this PR. Post-merge, verify on a follow-up PR that "Pinned dcbot handler verification (exact head)" appears and is green, and confirm `DCBOT_CONTRACT_TOKEN` is configured as a fine-grained read-only token for `Proto-UI/dcbot`.
- The lane remains repository CI evidence, not a platform-required status check; requiring it in branch protection is a separate maintainer action.
