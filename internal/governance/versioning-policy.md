# Proto UI Versioning Policy

> Internal governance document. This policy defines how Proto UI versions should be interpreted during the `v0` and `v1` stages, and how maintainers should communicate compatibility expectations across packages.

---

## 1. Purpose

This document exists to make Proto UI versioning predictable for:

- maintainers planning releases
- contributors preparing changes across packages
- users deciding which package versions are safe to combine

It is not a contract specification by itself.

It is a project governance rule for how version numbers should be used and explained.

---

## 2. Stage Model

Proto UI currently plans around two product stages only:

- `v0`
- `v1`

These stages are intentionally larger than ordinary semantic-versioning milestones.

### 2.1 `v0`

`v0` is the early public stage.

It is public and usable, but it does not promise that every minor version is freely mixable with every other minor version.

Within `v0`, Proto UI may still introduce breaking changes at the level of:

- sub-APIs
- option names or option meanings
- configuration shapes
- cross-package assumptions
- generated output details

### 2.2 `v1`

`v1` is the next stage of maturity.

Moving from `v0` to `v1` is expected to strengthen stability expectations, but it is **not** expected to introduce a large architectural reset.

For Proto UI, `v1` should remain compatible with the core concepts and overall paradigm established in `v0`.

That means:

- no broad redefinition of first-level concepts
- no replacement of the overall model
- no "Proto UI 2.0 in disguise" release behavior

---

## 3. Global Exact-Version Rule

Starting with `0.2.0-rc.0`, one numeric version identifies one complete Proto UI ecosystem release rather than a package-local revision count.

During `v0`:

- every public `@proto.ui/*` package must use the exact same version, including patch and prerelease suffixes
- package-local fixes wait in the current release train instead of creating autonomous patch versions
- published internal `@proto.ui/*` dependencies use exact versions rather than ranges that automatically mix patches
- apps, private spec implementation packages, and repository-only fixtures are outside the npm lockstep publish set

Equal versions are a necessary compatibility precondition, not sufficient proof of complete Prototype and Adapter compatibility; conformance evidence is still required.

---

## 4. V Entities And Repository Projections

Every governed version must be declared by a `V-*` version entity.

- A `draft` V entity represents a release train that is being prepared but is not published.
- An `active` V entity represents a release with verifiable npm, Git tag, and spec snapshot evidence.
- Root `VERSION`, public package manifests, and the workspace release list are projections of the current V entity.
- An arbitrary entity `revisions[].version` cannot create a release; it must reference an existing V entity.
- Workspace version choices come from V entities rather than scanning every revision number.

`VERSION` and public package manifests are compared as complete strings. `0.2.0-rc.0` and `0.2.0-rc.1`, or `0.2.0` and `0.2.1`, are different releases.

---

## 5. Meaning Of `0.y.z`

Proto UI follows semantic version formatting, but interprets `0.y.z` with additional project-specific discipline.

### 5.1 Minor version: `y`

`0.y.0` represents a new capability line for the Proto UI ecosystem.

A new minor version should be used when a release includes one or more of the following:

- meaningful new user-facing capabilities
- newly promoted public package surfaces
- changes to cross-package behavior assumptions
- breaking changes in sub-APIs or configuration expectations
- release-line changes that require users to upgrade packages together

For Proto UI `v0`, minor is the main ecosystem coordination boundary.

### 5.2 Patch version: `z`

`0.y.z` patch releases should stay within one minor line.

Patch releases are the safe update boundary inside that line and should be used for:

- bug fixes
- docs fixes
- test and tooling improvements
- type fixes
- packaging fixes
- small implementation refinements that do not change the intended release-line behavior

If a change causes users to reconsider whether packages from the same line can still be upgraded safely, it should probably not be treated as patch-only.

---

## 6. Release-line classification rules

When classifying a change as patch or minor during `v0`, use these defaults:

- default to `patch` for local fixes and hardening
- use `minor` for any release that changes how the ecosystem should be consumed

When evidence leaves the classification unclear, ask one focused product question:

"Would a careful user reasonably need to align their whole Proto UI stack differently because of this change?"

If the answer is yes, prefer a new minor release line.

---

## 7. User-Facing Communication Rules

Public release notes, package docs, and installation guides should consistently communicate the following:

- Proto UI is currently in `v0`
- all public Proto UI packages should stay on the exact same version in production
- patch and prerelease updates are complete ecosystem releases, not package-local publishes
- `v1` is expected to improve stability promises without changing the project's core architecture

We should not imply stronger compatibility guarantees than the project can actually maintain.

---

## 8. Summary

Proto UI versioning should be understood as:

- two planned stages: `v0` and `v1`
- no architectural reset between `v0` and `v1`
- global exact lockstep for public packages starting with `0.2.0-rc.0`
- numeric versions declared by V entities and backed by real release behavior
- patch and prerelease versions as complete ecosystem release boundaries
- fragmented `0.1.x` package history treated as legacy history without fabricated global tags
