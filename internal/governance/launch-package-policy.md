# Proto UI Launch Package Policy

> Internal governance document. This policy defines how Proto UI packages should be classified for the `v0.1.0` public launch, which packages are part of the launch commitment surface, and what kinds of new packages may still enter the launch scope during the final preparation window.

---

## 1. Purpose

Proto UI already contains many workspace packages, but the first public release does not need to present all of them as equally mature public surfaces.

This document exists to define:

- which packages are part of the `v0.1.0` launch commitment
- which packages may still be published but are not part of the launch commitment
- which packages should be treated as internal or dependency-directed for launch purposes
- which newly added packages may still enter `v0.1.0` during the final preparation window

This document is a governance rule for release scope.

It is not the long-term reference document for explaining every package in detail.

---

## 2. Package Tiers

For `v0.1.0`, Proto UI packages should be divided into three tiers.

### 2.1 Launch Commitment Packages

These packages define the real public surface promised by the first release.

They must be the basis for:

- README wording
- Quick Start wording
- smoke verification
- release notes
- launch-focused release scan and packaging hardening

These packages are primarily aimed at `Maker` users.

### 2.2 Public But Non-Launch-Commitment Packages

These packages may still be public and may still be published.

However, they are not part of the default first-user story for `v0.1.0`, and the first public release should not be judged primarily by whether they are polished to the same level as the launch commitment packages.

These packages are primarily aimed at:

- `Prototype Author`
- `Adapter Author`
- contributors
- maintainers

### 2.3 Internal Or Dependency-Directed Packages

These packages may still be important and may still need to be published for dependency reasons.

However, for launch-scope governance, they should be treated as:

- internal architectural building blocks
- dependency-directed surfaces
- non-default entry points

They are not part of the `v0.1.0` public promise surface.

---

## 3. `v0.1.0` Launch Commitment Package List

The current launch commitment package list for `v0.1.0` is:

- `@proto.ui/adapter-react`
- `@proto.ui/adapter-vue`
- `@proto.ui/adapter-web-component`
- `@proto.ui/cli`
- `@proto.ui/prototypes-base`
- `@proto.ui/prototypes-lucide`
- `@proto.ui/prototypes-shadcn`

These packages define the main first-release story:

- Proto UI can be consumed through official adapters
- Proto UI ships an official CLI for project scaffolding
- Proto UI provides an official base prototype library
- Proto UI also provides styled and icon-driven prototype libraries for practical usage and demos

If a package is not in this list, it is not automatically part of the launch commitment just because it exists in the workspace or is technically publishable.

---

## 4. Public But Non-Launch-Commitment Packages For `v0.1.0`

The current public but non-launch-commitment package set is:

- `@proto.ui/adapter-base`
- `@proto.ui/core`
- `@proto.ui/types`
- `@proto.ui/hooks`

These packages have legitimate users and should not be described as meaningless internals.

However, they are not part of the default Quick Start or the default first-user release promise.

They should be positioned as:

- authoring-oriented surfaces
- advanced surfaces
- contributor-facing surfaces

They may appear in deeper documentation, but they should not displace the launch commitment packages from the primary release narrative.

---

## 5. Internal Or Dependency-Directed Packages For `v0.1.0`

The following packages should be treated as internal or dependency-directed for launch governance:

- `@proto.ui/runtime`
- `@proto.ui/module-base`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-as-trigger`
- `@proto.ui/module-boundary`
- `@proto.ui/module-context`
- `@proto.ui/module-event`
- `@proto.ui/module-expose`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-overlay`
- `@proto.ui/module-presence`
- `@proto.ui/module-props`
- `@proto.ui/module-rule`
- `@proto.ui/module-rule-expose-state-web`
- `@proto.ui/module-rule-meta`
- `@proto.ui/module-state`
- `@proto.ui/module-state-accessibility`
- `@proto.ui/module-state-interaction`
- `@proto.ui/module-test-sys`

This classification does **not** mean these packages are unimportant.

It means:

- they are not part of the main `v0.1.0` user promise
- they should not expand the first-release story
- their publication status should be driven by architecture and dependency needs, not by launch marketing scope

---

## 6. Operational Rules

For `v0.1.0`, the package tiers should affect release work in the following way.

### 6.1 Docs

README, Quick Start, and launch-facing docs should primarily describe and validate the launch commitment packages.

Public but non-launch-commitment packages may be documented, but should appear as advanced or contributor-facing material.

Internal or dependency-directed packages should not be presented as part of the first-user path.

### 6.2 Release Scan

Launch-focused release scan and packaging hardening should use the launch commitment list as the main release gate.

Other packages may still be scanned and improved, but they should not delay `v0.1.0` unless they block:

- publication of launch commitment packages
- dependency correctness for launch commitment packages
- truthful documentation of the launch package surface

### 6.3 Smoke Verification

Smoke verification for launch readiness should be designed around the launch commitment packages first.

Additional checks for non-launch-commitment packages are valuable, but secondary.

### 6.4 Release Communication

Release notes and launch messaging should distinguish clearly between:

- packages that are part of the first public promise
- packages that are public but advanced
- packages that exist mainly as internal architecture surfaces

---

## 7. Rules For New Packages During The Final Preparation Window

During the final month before `v0.1.0`, new packages may only be added to the launch commitment scope if all of the following are true:

- the package directly serves an already committed launch path
- the package does not widen the product story beyond the frozen `v0.1.0` scope
- the package is necessary for the launch commitment packages to be truthful, usable, or publishable
- the package can receive minimal docs, tests, and packaging validation before launch
- the package does not materially increase release-process complexity

Typical cases that may still be acceptable:

- a companion package required by the existing adapter or prototype launch path
- a package necessary to make the CLI-backed launch path or the Web Component script path truthful
- a packaging bridge that closes a release blocker in the already frozen launch story

---

## 8. Packages That Should Default To `0.2.0` Or Later

During the final preparation window, the following kinds of additions should default to `0.2.0` or later:

- a new adapter family
- a new prototype library family
- a new module family
- a package that mainly serves future ecosystem breadth rather than the frozen launch path
- an authoring or contributor package that does not block the launch commitment packages
- a package whose value is real but whose maturity cannot be proven before launch

The burden of proof is on additions.

If a new package cannot clearly justify why it must be in `v0.1.0`, it should move to the next minor line.

---

## 9. Non-Goals

This document does not try to:

- fully explain every package's internal role
- replace architectural documentation
- settle long-term publication strategy for every dependency-directed package

Those topics should be handled in a separate package-surface reference document.

---

## 10. Summary

For `v0.1.0`, Proto UI should treat packages in three tiers:

- launch commitment packages
- public but non-launch-commitment packages
- internal or dependency-directed packages

The `v0.1.0` launch commitment package list is currently:

- `@proto.ui/adapter-react`
- `@proto.ui/adapter-vue`
- `@proto.ui/adapter-web-component`
- `@proto.ui/cli`
- `@proto.ui/prototypes-base`
- `@proto.ui/prototypes-lucide`
- `@proto.ui/prototypes-shadcn`

Everything else should be judged against whether it supports that frozen first-release story, rather than against whether it exists in the workspace.

---

## 11. Machine-Executable Governance Source (from 2026-04-16)

To prevent drift between docs and release automation, launch package governance now has a machine-readable source:

- `internal/governance/launch-package-governance.json`

This file drives `scripts/release/scan.mjs` and `scripts/release/publish.mjs` when running with `--profile launch`.

Operational constraints:

- `launchCommitmentPackages`: included in the default launch release set
- `candidatePackages`: candidate set that must be decided package by package
- Candidate statuses are restricted to:
  - `approved`: may join release selection only with `--include-approved-candidates`
  - `pending`: not yet admitted; must not be published as part of launch set
  - `deferred`: explicitly postponed; must not be published as part of launch set
- New packages never auto-enter launch: they must be added to governance and explicitly decided

This keeps launch scope governance explicit and enforceable while still leaving room for hard launch additions (for example packages needed by `input` work that introduces new modules or lower-level APIs).
