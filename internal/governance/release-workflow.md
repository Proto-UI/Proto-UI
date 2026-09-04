# Proto UI Release Workflow

> Internal governance document. This policy defines globally exact release preparation, verification, publication, and evidence capture starting with `0.2.0-rc.0`.

## 1. Authoritative State

`main` is the only source for release tags and real publication. Ordinary work uses short-lived topic branches and pull requests; release identity no longer depends on a long-lived `feat/v0-release-prep` branch.

One release is jointly identified by:

- one `V-*` version entity
- root `VERSION`
- the exact version of every public `@proto.ui/*` package
- a `v<version>` Git tag
- npm dist-tag and published package set
- the corresponding spec snapshot and digest

A release is incomplete whenever any of these facts disagree.

## 2. V Entity Lifecycle

### 2.1 Draft

When maintainers open a release train, they first create or update a `draft` V entity. It fixes:

- exact semver, including any prerelease suffix
- Git tag such as `v0.2.0-rc.0`
- npm dist-tag: `next` for prereleases and `latest` for stable releases
- `packageVersionPolicy: exact`
- the public package scope

`VERSION` and every public package manifest must project that version in the same PR. Entity revisions may reference a draft V version, but the workspace must visibly treat it as draft rather than published.

### 2.2 Active

A V entity becomes `active` only after npm packages, the Git tag, and the spec snapshot are published. Active entities must record:

- publication time
- the 40-character release commit SHA
- the `sha256` spec snapshot digest

### 2.3 Prerelease Stages

Prerelease suffixes communicate stabilization stage rather than generic internal build order:

- `alpha` admits reviewed architecture changes, top-level API changes, and new features. It is not an API or feature freeze.
- `beta` begins after core scope and major APIs converge, shifting the train toward integration, compatibility, and defect correction. A new breaking direction requires an explicit decision about returning to alpha.
- `rc` is reserved for a build maintainers believe can be promoted directly to the corresponding stable release after final verification or blocker fixes. Do not use rc while architectural rewrites, top-level breaking API changes, or new core features remain planned.

Every published stage still requires an exact V entity, complete globally aligned package set, tag, dist-tag, and immutable snapshot evidence.

## 3. Preparation

1. Create a topic branch from current `main`.
2. Create the draft V entity and update `VERSION`.
3. Use `stamp-version` to align every public package exactly.
4. Update release notes, package BOM, spec snapshot, and governance maps.
5. Run version governance, spec, types, tests, release scan, and tarball consumer smoke.
6. Merge through pull request review.

The main Quick Start always follows npm `latest` and must not silently switch ordinary users to a prerelease. A separate prerelease trial page must pin the exact V-entity version for reproducible verification; `@next` may remain a convenience channel but is not the recorded test identity. When the CLI installs Adapter and Prototype packages, it must pin each package spec to the CLI's own exact version and save an exact dependency in the consumer manifest. An unversioned `latest` resolution or an automatically widening semver range must not mix another release train into the project.

Package-local fixes do not use `publish-single`; they enter the next global release train.

Each release train owns `internal/releases/<version>/release-notes.md`, its Chinese projection, and a deterministic `package-bom.json`. `pnpm release:bom` regenerates the BOM from the public workspace package graph and launch-governance roles; `pnpm release:assets:check` fails when the reviewed BOM drifts or either release note is absent. The English note becomes the GitHub Release body, while the BOM, Chinese note, spec snapshot, and checksum are attached as release evidence.

npm Trusted Publisher configuration is package-scoped and therefore cannot be attached before a package identity exists. Every newly named public package must be created before the release train with a clearly non-release bootstrap version and configured for the reviewed release workflow. Bootstrap must not receive a release-channel dist-tag and its `bootstrap` tag must be removed after identity setup. npm may refuse to remove `latest` when it points at the package's sole bootstrap version; that `latest` may remain only if the sole version is deprecated, `next` does not point to that bootstrap version, and no release-train or stable version is published merely to cover it. `pnpm release:registry:check` verifies these public identity, dist-tag, and deprecation conditions; it does not claim to inspect the private Trusted Publisher configuration.

## 4. Publication

Real publication is manually triggered from `main` and protected by the GitHub `npm` environment approval.

Both `stage` and `publish-all` run the public registry preflight before any package is staged or published. A missing identity or non-compliant bootstrap state aborts the run, preventing an avoidable partial publication.

The workflow:

1. reads `VERSION` from the repository and accepts no temporary version override
2. runs `check-version-governance` and the launch governance scan
3. stages every public package and rewrites workspace dependencies to the same exact version
4. publishes the complete package set using the V entity npm dist-tag
5. creates `v<version>` only after every package succeeds
6. produces the GitHub prerelease/release and spec snapshot artifact
7. uses a follow-up evidence PR to record publication time, tagged commit, and snapshot digest, then activates the V entity

The publish workflow does not rewrite the V entity on `main`. The tag therefore points to the reviewed draft release identity, while `active` arrives as a separately reviewable post-publication fact. The V entity's snapshot digest refers to the immutable draft snapshot attached to the tag, avoiding a digest that recursively includes itself.

If publication is partial, the workflow must not advance dist-tags or activate the V entity. Recovery still runs the complete workspace release set with `resume_published` explicitly enabled. It skips an existing registry package only when its SHA-512 integrity exactly matches the current staged tarball, publishes missing packages at the same version, and aborts on any mismatch. The actual registry state must be recorded with the recovery.

## 5. First Unified Version

The first version governed by this workflow is:

- version: `0.2.0-rc.0`
- Git tag: `v0.2.0-rc.0`
- npm dist-tag: `next`

Historical `0.1.x` package versions are fragmented releases from before global lockstep. The highest local version, `@proto.ui/cli@0.1.4`, does not establish a global `v0.1.4` and must not be retroactively tagged as one.

## 6. Required Checks

- `pnpm check:release-version`
- `pnpm release:assets:check`
- `pnpm release:scan:launch`
- `pnpm release:stage`
- zero spec workspace issues
- repository types and tests
- current-source tarball consumer smoke
- Quick Start commands matching the verified install path

`pnpm release:rehearse` is the non-publishing, one-command preparation gate. It runs the identity and asset checks, catalog and test suites, type checks, a temporary spec snapshot, launch scan, the shared public-package build, package publish dry-run, React and multi-host CLI tarball consumer smokes, and the documentation build. Release staging copies the same verified local `dist` artifacts used by development and CI instead of compiling a separate output. The command may access the npm registry for dry-run or temporary consumer dependency installation, but it never invokes the real publish path.

Docs-only or private-app changes do not need to publish immediately. Creating a new numeric version or changing `VERSION`, however, must enter this release-train workflow.

## 7. End-to-End Maintainer Checklist

This checklist turns the policy above into the required sequence for each release train. Preparation, publication, and evidence capture are separate reviewable phases; completing one phase does not imply that the next phase has happened.

### 7.1 Prepare The Release Train In A Pull Request

1. Fetch the current default branch and create a short-lived release topic branch from `origin/main`.
2. Update root `VERSION`, create the new `draft` V entity, and align the launch-governance release line.
3. Run `node scripts/release/stamp-version.mjs` so all public package manifests use the exact version, then refresh the lockfile with the repository-declared pnpm version.
4. Update both release notes and run `pnpm release:bom`. Update package-local documentation that ships in the tarball when it refers to its own version.
5. Generate the Git-ignored local Agent projection with `pnpm spec:docs:agent` and review the entity graph affected by the new V entity; do not add the disposable projection to the commit.
6. Run `pnpm release:rehearse`, `pnpm check:agent-doc`, and `git diff --check` before committing.
7. Open a Draft PR that states the release scope, checks, package count, and the fact that no publication has occurred.

The published prerelease trial page, repository status, and release link must continue to name the last verified release during this phase. They move to the new version only in the post-publication evidence PR. This avoids presenting a reviewed draft as installable. A package README included in the new tarball may already name its own exact version because it becomes visible only when that tarball is published.

### 7.2 Run The Protected Publication

After the preparation PR merges, manually dispatch `.github/workflows/release-packages.yml` from `main` with:

- `mode=publish-all`
- `profile=workspace`
- `resume_published=false` for a normal release
- `include_approved_candidates=false` unless launch governance explicitly approved candidates

Approve the protected `npm` environment only after confirming that the workflow head SHA is the reviewed merge commit and that `VERSION` still names the intended release. Do not publish from the topic branch and do not use the `launch` profile for a real publication. The workflow must publish the complete public package set before creating the tag, GitHub Release, or snapshot assets.

If the run becomes partial, keep the same version and commit. Audit registry integrity, record the failure, and rerun the complete workspace set with `resume_published=true`; never create a replacement tag or silently advance the release train.

### 7.3 Audit Immutable Release Evidence

Before activating the V entity, verify and record all of the following:

- the successful workflow URL, its `headSha`, start time, and completion time
- every package named by `package-bom.json` has the exact version in npm; checking only the CLI is insufficient
- every package's intended dist-tag resolves to that exact version
- `v<version>` resolves to the same 40-character workflow head SHA
- the GitHub Release has the correct prerelease/stable state and contains the reviewed BOM, localized notes, spec snapshot, and checksum
- the digest of the uploaded spec snapshot matches its checksum and the digest recorded by the V entity

`release.publishedAt` uses the GitHub Release publication time, after the complete package set, tag, and release assets exist. npm first/last publication times and workflow timing may be recorded as supporting evidence but do not replace this canonical timestamp.

The V entity must use the digest of the immutable draft snapshot attached to the tag. Do not regenerate a snapshot after changing the V entity to `active` and substitute that digest: the lifecycle change alters snapshot bytes and would make the evidence self-referential.

### 7.4 Merge The Evidence Pull Request

Create a new topic branch from the latest `origin/main`; do not reuse the preparation branch. The evidence change must:

1. change the V entity from `draft` to `active`
2. add `publishedAt`, the tagged 40-character commit, and `specSnapshotDigest`
3. add an `updated` revision describing the verified publication
4. change release notes from draft wording to published wording
5. update the bilingual repository status, exact prerelease trial commands, release links, and current-release CI/CD prose
6. add a dated record containing the workflow, npm, tag, GitHub Release, and snapshot facts
7. generate and review the Git-ignored local Agent projection, then run `check:release-version`, `release:assets:check`, `check:agent-doc`, type checks, and the documentation build
8. after the evidence PR merges, replace the GitHub Release body with the merged English `internal/releases/<version>/release-notes.md` and verify that the public page no longer carries pre-publication draft wording; do not publish this mutable prose update before review, and do not replace or regenerate the immutable snapshot assets

The evidence PR does not bump `VERSION` or package manifests and does not republish packages. Its purpose is to make repository truth match already immutable external facts. Only after it merges may the release be described in the catalog as `active` and in public documentation as the current reproducible prerelease.
