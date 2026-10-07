# Uploading GitHub evidence with gh

For Agents following the [visual evidence policy](visual-evidence.md). Humans may submit plain descriptions. These methods explain upload mechanisms, not permission to create repositories, Releases, deployments or public storage.

## Agent write boundary

Follow [Contributor Agents](contributor-agents.md#measure-and-disclose-the-active-agent-model) for the current private ModelTrace record/context and canonical public disclosure. Agents use `pnpm agent:publish` for supported commits and Issue/PR comments, not direct `git commit`, `gh issue comment`, `gh pr comment`, editor comment submission, or a Contents API write. A receipt is not authorization, identity, independent review or acceptance. Read-only `git`/`gh` inspection and scoped staging remain usable.

The examples below use independently established `human-assisted` / `current-user` mode and exact `explicit-current-user` authorization. Substitute the actual authorized repository, target and private paths; do not infer authorization from these examples. Keep the record, context and raw samples outside the real checkout, including through directory aliases, and publish only the canonical public receipt. Other authorized execution envelopes must follow the supported publisher's trusted-launcher requirements, not relabel themselves as current-user work.

Attachment, Gist and existing authorized Release/hosting uploads are separate storage operations with their own approval, visibility and retention. `agent:publish` does not upload assets and supplies no new storage API. After uploading, publish the governed evidence comment through the supported publisher. If the authorized publication surface is unsupported, stop at that boundary rather than bypassing it with direct Git/GitHub calls.

## Storage choices

| Method | Main code tree | Git storage | Use |
| --- | --- | --- | --- |
| Issue/PR editor attachment, then supported publisher posts returned Markdown | No | No | Default screenshots and reproduction-only attachments |
| Gist through `gh gist create` or API | No | Separate Gist history | Markdown reports, HTML/SVG source and logs; not a binary-image upload API |
| Existing authorized asset hosting/Release | No | No repository Git objects | Durable evidence when destination/purpose is explicitly approved |
| Dedicated evidence branch/authorized assets repository | No main-tree change | **Yes** | CLI-only image fallback; retention owner required; never merge the evidence-only branch |
| Normal feature branch (Agent publisher; human Git or Contents API) | Yes after merge | Yes | Maintained docs, examples, fixtures or enduring records |
| Actions artifact | No | No repository Git objects | Supplementary run-bound bundles with retention/access limits |

Use one shared checkout/object store and small files, not a clone/bundle per Issue. “Outside the main code tree” does not mean “outside Git”; deleting an evidence branch does not promptly reclaim all clones' objects. Keep ephemeral captures outside tracked source. Version an asset only when its long-term purpose justifies the cost.

## Attachment + Markdown (no repository pollution)

Comment publication sends Markdown; it does not itself upload local images. Neither a local path nor passing a PNG as a body file works. This does **not** mean gh cannot upload: Gist, Contents and Release APIs below provide distinct storage paths, subject to their Agent/human boundaries. There is no `gh issue upload` subcommand or documented general public REST endpoint for Issue-comment attachment uploads; do not scrape cookies or rely on private signed-upload endpoints.

1. Capture actual evidence; inspect/redact the files and metadata.
2. In an authenticated GitHub Issue/PR editor, drag/drop or choose the file. Wait for upload completion and copy the returned attachment Markdown. Follow current [types/limits](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files); never invent a URL.
3. Put the returned Markdown in the reviewed evidence body and discard the unused editor draft. Agents publish through `agent:publish`, not the editor or raw `gh`. Humans may submit in the editor or through their direct CLI workflow, never both.
4. Read back the published comment and open the image as the intended reader. Do not assume a private attachment URL is a privacy boundary; upload only approved content.

Prepare `evidence-comment.md` with the actual attachment Markdown, source revision/provenance and stable evidence marker. Generate the disclosure below and include its exact output once as a visible standalone `## ModelTrace` section, not a quoted or commented example. Inspect the complete body and seal its exact bytes/hash under the evidence-publication authorization **after** adding the disclosure; do not authorize an undisclosed body and append it later. The supported publisher preserves an already correctly disclosed body byte-for-byte. If the record expires or changes before publication, prepare and authorize a new exact body rather than changing a sealed payload silently.

```powershell
$privateRecord = (Resolve-Path -LiteralPath '../private-modeltrace/record.json').Path
$privateContext = (Resolve-Path -LiteralPath '../private-modeltrace/context.json').Path
pnpm agent:identify -- disclosure --record $privateRecord --context $privateContext --format markdown
# Add the exact output to evidence-comment.md, then review and seal the body.
gh issue view 123 -R Proto-UI/Proto-UI --comments
pnpm agent:publish -- comment --number 123 --body-file evidence-comment.md `
  --repository github.com:Proto-UI/Proto-UI --record $privateRecord --context $privateContext `
  --mode human-assisted --mode-source current-user --authorization explicit-current-user
gh issue view 123 -R Proto-UI/Proto-UI --comments
# Same mechanism for an authorized PR follow-up:
pnpm agent:publish -- comment --number 456 --body-file pr-evidence-comment.md `
  --repository github.com:Proto-UI/Proto-UI --record $privateRecord --context $privateContext `
  --mode human-assisted --mode-source current-user --authorization explicit-current-user
gh pr view 456 -R Proto-UI/Proto-UI --comments
```

Prepare and authorize the PR body separately with its own exact target, disclosure and marker. Before either write, check target/permission and a stable marker such as `<!-- agent-evidence:issue-123:BASE_SHA:v1 -->`. Prefer an additive comment, not a body replacement that risks losing another author's or concurrent edits. Record the comment receipt URL. On a timeout or unknown outcome, reconcile read-only against the full exact body, marker, author and target before any separately justified retry; even an observed matching comment does not turn a lost acknowledgement into an acknowledged write. Do not switch to raw `gh` or change the marker to force a second publication.

## Gist through CLI or API

Gists store text files and have separate Git-backed history; they keep evidence source out of the project repository. `gh gist create` defaults to **secret/unlisted, not private**. Explicitly choose visibility and inspect all files before sharing. Use public only when publication is authorized. Markdown can embed already uploaded images; Gist HTML/SVG are source artifacts, not automatically executable pages or reliable inline-image endpoints.

```powershell
gh gist create --public --desc "Issue 123 reproduction" ./README.md ./reproduce.html ./sequence.svg ./trace.txt
gh gist view GIST_ID --files
# API equivalent: file content is UTF-8 text, not base64 binary.
gh api --method POST gists -F public=true -f description='Issue 123 reproduction' -F 'files[README.md][content]=@README.md' -F 'files[reproduce.html][content]=@reproduce.html'
gh api gists/GIST_ID --jq '{html_url,history: [.history[].version],files: [.files[] | {filename,raw_url,truncated}]}'
```

These are separately authorized storage alternatives, not commands to create duplicate Gists or bypass the governed comment publisher. Keep the returned ID/URL and immutable revision where possible. Verify source completeness (`truncated`/raw content), reader access and image rendering; include the Gist Markdown link plus actual screenshot URL in the exact evidence body published through `agent:publish`. Do not pass PNG bytes to the text-file API or treat base64 text as a displayed screenshot. A Gist link alone does not satisfy a claimed uploaded screenshot. Do not send confidential material even to a secret Gist.

## Git or Contents API for versioned images

Choose a verified authorized branch, never a direct write to `main`. Reuse existing Git/worktrees. Keep evidence-only assets out of product PRs; do not merge their branch. Assets that belong to maintained docs/tests use their owning directory and normal PR review. Preserve provenance/license and generators. Use content-specific filenames and pin image links to full commit SHA, not a moving branch.

For Agents, independently review and authorize the **entire** staged change and exact contributor branch, parent HEAD and tree. `git write-tree` records a candidate tree; computing it or viewing a stat does not approve unrelated staged user work. Stop if the index contains work outside the authorization. Prepare `evidence-commit-message.txt` without a `ModelTrace:` trailer; review the generated canonical commit disclosure with the message before authorizing the commit. The publisher appends that exact trailer and the configured contributor's sign-off. Do not paste a trailer into the prepared message or use plain `git commit` as an Agent fallback.

```powershell
# In the verified target worktree/branch, with no unrelated staged files:
git status --short
git branch --show-current
git rev-parse HEAD
git add -- internal/records/evidence/issue-123/before.png internal/records/evidence/issue-123/reproduce.html
git diff --cached --stat
git diff --cached
git write-tree
# Bind these to independently reviewed and authorized values, not blind command output:
$authorizedBranch = 'codex/issue-123-evidence'
$authorizedHead = 'FULL_REVIEWED_PARENT_COMMIT_SHA'
$authorizedTree = 'FULL_REVIEWED_AUTHORIZED_TREE_SHA'
$privateRecord = (Resolve-Path -LiteralPath '../private-modeltrace/record.json').Path
$privateContext = (Resolve-Path -LiteralPath '../private-modeltrace/context.json').Path
pnpm agent:identify -- disclosure --record $privateRecord --context $privateContext --format commit
pnpm agent:publish -- commit --message-file evidence-commit-message.txt `
  --branch $authorizedBranch --expected-head $authorizedHead --expected-tree $authorizedTree `
  --repository github.com:Proto-UI/Proto-UI --record $privateRecord --context $privateContext `
  --mode human-assisted --mode-source current-user --authorization explicit-current-user
# Only under separate exact push authorization and live branch permission:
git push origin HEAD:refs/heads/codex/issue-123-evidence
git rev-parse HEAD
```

Replace the SHA placeholders with full exact reviewed values before invoking the publisher. Confirm the destination before using these example paths. Use the existing contributor identity/DCO, never another person's sign-off. An unknown commit outcome requires read-only inspection of local HEAD, parent, tree and message before retrying; an uncertain push requires reconciliation of the remote ref before another push. Embed PNG via `https://raw.githubusercontent.com/OWNER/REPO/FULL_COMMIT/path/before.png`; link source via `https://github.com/OWNER/REPO/blob/FULL_COMMIT/path/reproduce.html`. Encode path segments and verify reader access; never embed tokens or expiring private raw URLs.

### Human-only: create a new file with gh api (PowerShell)

The Contents API creates a **Git commit**, not a comment attachment. The direct example below is **human-only**: there is no supported Agent Contents PUT bypass. Agents use the supported `agent:publish -- commit` workflow above when an authorized checkout/branch is available, or stop at an unsupported authorized surface. Authorization to store an image does not waive the Agent commit boundary.

For a human operator, this example requires an already created authorized branch and a verified absent path. A 403 or network failure is not proof of absence. Send base64 **file bytes**, not the filename or raw binary; stdin avoids command-line size limits and dumping base64 into logs.

```powershell
$evidenceRepo = 'OWNER/REPO'
$evidenceBranch = 'codex/issue-123-evidence'
$evidencePath = 'evidence/issue-123/before-HASH.png'
$evidenceFile = (Resolve-Path -LiteralPath './before-HASH.png').Path
$evidenceMessage = 'docs: add issue 123 evidence' # include your valid DCO trailer when required
gh api "repos/$evidenceRepo" --jq '{full_name,permissions}'
gh api "repos/$evidenceRepo/contents/$evidencePath" -X GET -f "ref=$evidenceBranch"
# Proceed only after verifying branch existence and path absence.
$evidencePayload = @{
  message = $evidenceMessage
  branch = $evidenceBranch
  content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($evidenceFile))
} | ConvertTo-Json -Compress
$evidencePayload | gh api --method PUT "repos/$evidenceRepo/contents/$evidencePath" --input - --jq '{commit: .commit.sha, path: .content.path, url: .content.html_url}'
```

This human-only create example omits the existing blob `sha`: it fails rather than overwriting. An update needs a fresh blob SHA and separately reviewed scope. On uncertain submission, read the existing file and compare bytes/commit before retrying. Preserve the receipt, verify SHA-256 of uploaded bytes, form the immutable image URL, publish the governed evidence comment and read it back. For many files, prefer one reviewed Git commit rather than one API commit per file; Agents still use the supported commit publisher.

## Existing authorized Release/hosting (outside Git)

Only upload to a Release explicitly approved for this purpose. **Do not create/publish a Release, change latest, or repurpose a production release to host screenshots.** Inspect its tag, visibility and filenames. Use unique filenames and avoid `--clobber`: it deletes an old asset before upload and may lose it if upload fails.

```powershell
gh release view evidence-tag -R OWNER/REPO --json tagName,isDraft,url,assets
gh release upload evidence-tag ./issue-123-before-HASH.png -R OWNER/REPO
gh release view evidence-tag -R OWNER/REPO --json assets --jq '.assets[] | {name,url,size}'
```

Use the returned URL, verify download/render behavior and reader access, then include it in the governed Markdown comment published through `agent:publish`. Draft/private Releases are not public image hosting. Existing external hosting needs its own approved upload path, visibility and retention; the comment publisher posts the reference only, not the asset.

## Actions and HTML artifacts

Actions artifacts supplement a captured run; they have retention and download/login constraints, not durable inline-image URLs:

```powershell
gh run view RUN_ID -R OWNER/REPO
gh api repos/OWNER/REPO/actions/runs/RUN_ID/artifacts --jq '.artifacts[] | {name,expired,expires_at}'
gh run download RUN_ID -R OWNER/REPO -n evidence -D ./downloaded-evidence
```

These inspect/download, not upload. Upload through an authorized workflow using artifact tooling. Record run/head, retention and access requirements; retain static screenshot fallback elsewhere when necessary.

GitHub normally displays versioned/Gist HTML as source or download, not a running mini-site. Provide source/download, reproduction instructions and screenshot fallback; editor attachments must use currently allowed file types (a ZIP may be suitable). Use an existing approved preview only within its publication authority. This tutorial does not authorize enabling Pages or running untrusted Issue HTML on an authenticated origin. Prefer self-contained network-free reports; distinguish executed observations, trace replay and simulation.

## References and verification

- [gh issue](https://cli.github.com/manual/gh_issue), [gh api](https://cli.github.com/manual/gh_api), [gh gist create](https://cli.github.com/manual/gh_gist_create)
- [Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents), [Gists API](https://docs.github.com/en/rest/gists/gists#create-a-gist)
- [gh release upload](https://cli.github.com/manual/gh_release_upload), [gh run download](https://cli.github.com/manual/gh_run_download)

The gh examples retain the local-help check from 2026-09-15; the supported Agent publisher forms follow `scripts/agent-operations/agent-publish.mjs` and the Contributor Agents projection, not gh's direct publication commands. This does not claim every storage method was exercised. Verify actual editor/hosting behavior, limits and reader access in the current session.
