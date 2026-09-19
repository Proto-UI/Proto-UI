# Uploading GitHub evidence with gh

For Agents following the [visual evidence policy](visual-evidence.md). Humans may submit plain descriptions. These methods explain upload mechanisms, not permission to create repositories, Releases, deployments or public storage.

## Storage choices

| Method | Main code tree | Git storage | Use |
| --- | --- | --- | --- |
| Issue/PR editor attachment, then `gh` posts returned Markdown | No | No | Default screenshots and reproduction-only attachments |
| Gist through `gh gist create` or API | No | Separate Gist history | Markdown reports, HTML/SVG source and logs; not a binary-image upload API |
| Existing authorized asset hosting/Release | No | No repository Git objects | Durable evidence when destination/purpose is explicitly approved |
| Dedicated evidence branch/authorized assets repository | No main-tree change | **Yes** | CLI-only image fallback; retention owner required; never merge the evidence-only branch |
| Normal feature branch (Git or Contents API) | Yes after merge | Yes | Maintained docs, examples, fixtures or enduring records |
| Actions artifact | No | No repository Git objects | Supplementary run-bound bundles with retention/access limits |

Use one shared checkout/object store and small files, not a clone/bundle per Issue. “Outside the main code tree” does not mean “outside Git”; deleting an evidence branch does not promptly reclaim all clones' objects. Keep ephemeral captures outside tracked source. Version an asset only when its long-term purpose justifies the cost.

## Attachment + Markdown (no repository pollution)

`gh issue comment --body-file` publishes Markdown; it does not itself upload local images. Neither a local path nor passing a PNG as a body file works. This does **not** mean gh cannot upload: Gist, Contents and Release APIs below provide distinct storage paths. There is no `gh issue upload` subcommand or documented general public REST endpoint for Issue-comment attachment uploads; do not scrape cookies or rely on private signed-upload endpoints.

1. Capture actual evidence; inspect/redact the files and metadata.
2. In an authenticated GitHub Issue/PR editor, drag/drop or choose the file. Wait for upload completion and copy the returned attachment Markdown. Follow current [types/limits](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files); never invent a URL.
3. Publish in the editor **or** via `gh`, not both. For the CLI, put that returned Markdown in the reviewed evidence body and discard the unused editor draft.
4. Read back the published comment and open the image as the intended reader. Do not assume a private attachment URL is a privacy boundary; upload only approved content.

```powershell
gh issue view 123 -R Proto-UI/Proto-UI --comments
gh issue comment 123 -R Proto-UI/Proto-UI --body-file evidence-comment.md
gh issue view 123 -R Proto-UI/Proto-UI --comments
# Same mechanism for an authorized PR follow-up:
gh pr comment 456 -R Proto-UI/Proto-UI --body-file evidence-comment.md
```

Before writing, check target/permission and a stable marker such as `<!-- agent-evidence:issue-123:BASE_SHA:v1 -->`. Read back before retrying a timeout. Prefer an additive comment: `gh issue edit --body-file` replaces the body and risks losing another author's or concurrent edits. Record the comment receipt URL.

## Gist through CLI or API

Gists store text files and have separate Git-backed history; they keep evidence source out of the project repository. `gh gist create` defaults to **secret/unlisted, not private**. Explicitly choose visibility and inspect all files before sharing. Use public only when publication is authorized. Markdown can embed already uploaded images; Gist HTML/SVG are source artifacts, not automatically executable pages or reliable inline-image endpoints.

```powershell
gh gist create --public --desc "Issue 123 reproduction" ./README.md ./reproduce.html ./sequence.svg ./trace.txt
gh gist view GIST_ID --files
# API equivalent: file content is UTF-8 text, not base64 binary.
gh api --method POST gists -F public=true -f description='Issue 123 reproduction' -F 'files[README.md][content]=@README.md' -F 'files[reproduce.html][content]=@reproduce.html'
gh api gists/GIST_ID --jq '{html_url,history: [.history[].version],files: [.files[] | {filename,raw_url,truncated}]}'
```

These are alternatives, not commands to create duplicate Gists. Keep the returned ID/URL and immutable revision where possible. Verify source completeness (`truncated`/raw content), reader access and image rendering; post the Gist Markdown link plus actual screenshot URL in the Issue. Do not pass PNG bytes to the text-file API or treat base64 text as a displayed screenshot. A Gist link alone does not satisfy a claimed uploaded screenshot. Do not send confidential material even to a secret Gist.

## Git or Contents API for versioned images

Choose a verified authorized branch, never a direct write to `main`. Reuse existing Git/worktrees. Keep evidence-only assets out of product PRs; do not merge their branch. Assets that belong to maintained docs/tests use their owning directory and normal PR review. Preserve provenance/license and generators. Use content-specific filenames and pin image links to full commit SHA, not a moving branch.

```powershell
# In the verified target worktree/branch, with no unrelated staged files:
git status --short
git branch --show-current
git add -- internal/records/evidence/issue-123/before.png internal/records/evidence/issue-123/reproduce.html
git diff --cached --stat
git commit -s -m "docs: add issue 123 evidence"
git push origin HEAD:refs/heads/codex/issue-123-evidence
git rev-parse HEAD
```

Confirm the destination before using these example paths. Use the existing contributor identity/DCO, never another person's sign-off. Embed PNG via `https://raw.githubusercontent.com/OWNER/REPO/FULL_COMMIT/path/before.png`; link source via `https://github.com/OWNER/REPO/blob/FULL_COMMIT/path/reproduce.html`. Encode path segments and verify reader access; never embed tokens or expiring private raw URLs.

### Create a new file with gh api (PowerShell)

The Contents API creates a **Git commit**, not a comment attachment. This example requires an already created authorized branch and a verified absent path. A 403 or network failure is not proof of absence. Send base64 **file bytes**, not the filename or raw binary; stdin avoids command-line size limits and dumping base64 into logs.

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

This create-only example omits the existing blob `sha`: it fails rather than overwriting. An update needs a fresh blob SHA and separately reviewed scope. On uncertain submission, read the existing file and compare bytes/commit before retrying. Preserve the receipt, verify SHA-256 of uploaded bytes, form the immutable image URL, post and read back the Issue/PR. For many files, prefer one reviewed Git commit rather than one API commit per file.

## Existing authorized Release/hosting (outside Git)

Only upload to a Release explicitly approved for this purpose. **Do not create/publish a Release, change latest, or repurpose a production release to host screenshots.** Inspect its tag, visibility and filenames. Use unique filenames and avoid `--clobber`: it deletes an old asset before upload and may lose it if upload fails.

```powershell
gh release view evidence-tag -R OWNER/REPO --json tagName,isDraft,url,assets
gh release upload evidence-tag ./issue-123-before-HASH.png -R OWNER/REPO
gh release view evidence-tag -R OWNER/REPO --json assets --jq '.assets[] | {name,url,size}'
```

Use the returned URL, verify download/render behavior and reader access, then post Markdown with gh. Draft/private Releases are not public image hosting. Existing external hosting needs its own approved upload path, visibility and retention; gh posts the reference only.

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

Commands/flags were checked against local gh help on 2026-09-15. This does not claim every storage method was exercised. Verify actual editor/hosting behavior, limits and reader access in the current session.
