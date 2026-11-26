# 2026-04-13 v0 Public Launch Scope And Priority

> Internal record. Not normative. This document captures the current decision frame for what Proto UI's first public release must prove, what it does not need to prove yet, and how to prioritize the remaining work.

---

## 1) Context

Proto UI has already accumulated substantial implementation work across:

- protocol contracts under `internal/contracts`
- runtime and adapter implementations for React, Vue, and Web Components
- prototype libraries under `packages/prototypes/base` and `packages/prototypes/shadcn`
- docs and demo content under `apps/www`
- release scripts under `scripts/release`

At the same time, the remaining pre-release work is still spread across many parallel directions:

- quick start and minimal adoption loop
- prototype library completion
- docs
- contract catalog and contract-test catalog
- CLI and npm package release
- organization / CI / CD / project operations
- adapter coverage expansion
- website operations and social operations

What is missing is not only more implementation, but a sharper release boundary.

Without that boundary, the first public release can easily expand from "prove the model is real" into "finish the entire ecosystem".

---

## 2) Observed Facts

### 2.1 The implementation is already beyond a toy stage

As of 2026-04-13:

- workspace tests pass: `153 passed | 3 skipped` test files
- test count is `558 passed | 34 todo`
- React / Vue / Web Component adapters all have active test coverage
- base and shadcn prototype libraries both exist and have tests

So the current situation is not "nothing is ready".

It is closer to:

- core semantics already have a meaningful implementation base
- cross-adapter validation is real
- public-release packaging, onboarding, and scope control are lagging behind implementation depth

### 2.2 The current Quick Start is not yet a real public path

The current `quick-start.mdx` explicitly says:

- CLI is not ready yet
- commands should not actually be run
- the document describes an intended future flow, not a usable present-day flow

So the most important public promise is still not closed.

### 2.3 Release packaging exists, but publish readiness is not yet clean

The repo already contains:

- release scanning
- staging/publish scripts
- package metadata for adapters, prototypes, runtime, modules, and core packages

But the current release scan still flags broad publish issues, especially:

- many packages export `src/*.ts`
- some packages are still missing package READMEs

This means package publication is being actively prepared, but is not yet in a "ship with confidence" state.

### 2.4 Governance scaffolding exists, but CI/CD appears minimal

The repo already has:

- `CONTRIBUTING.md`
- issue templates for adapters, prototypes, and docs

But there are currently no visible GitHub workflow files in `.github/workflows`.

That means open-source intake exists, while baseline automation still looks underbuilt for a public launch.

### 2.5 Adapter coverage is already wider than the minimum proof burden

For a first public release, three web adapters are already a meaningful scope:

- React
- Vue
- Web Components

Adding more adapters before v0 would improve surface area, but does not materially improve proof of the model in the same way that closing the first official usage loop would.

---

## 3) Problem Statement

Proto UI needs a release decision that answers three questions clearly:

1. What must be true for the first public release to count as successful?
2. Which workstreams are true release blockers versus quality improvements?
3. Which attractive directions should be explicitly deferred until after release?

If this is not decided now, the project risks two opposite mistakes:

- releasing with a strong technical core but a broken first-user path
- delaying release indefinitely in pursuit of ecosystem completeness

---

## 4) Decision

### 4.1 The first public release should prove one official adoption loop, not ecosystem completeness

The v0 public launch should be treated as successful if it proves all of the following:

- a new external user can follow one official path and actually run Proto UI
- the path demonstrates real cross-adapter protocol value
- the path is supported by docs, packages, and tests
- the release message accurately describes current boundaries and non-goals

It does **not** need to prove:

- large component breadth
- many adapters beyond the current three
- polished contributor automation in every area
- mature community operations
- a fully productized CLI ecosystem

### 4.2 Priority levels should be defined by release impact, not by general importance

For this launch, use:

- `P0`: release blocker; if incomplete, the first public release should not go out
- `P1`: strongly recommended for launch quality, but can be reduced or partially deferred if the core loop is already real
- `P2`: explicitly post-release; valuable, but not required for the first public proof

### 4.3 Recommended priority by workstream

| Workstream | Priority | Reason |
| --- | --- | --- |
| 最小使用场景闭环（Quick Start 可跑通） | P0 | This is the public proof path. Without it, the release story is not true. |
| 文档建设 | P0 | The first release is largely legibility work around an already-deep codebase. |
| CLI / 测试 / npm package 发布与管理 | P0 for package publish path; P1 for CLI | Packages must be installable. A full CLI should not become the main blocker unless Quick Start insists on CLI. |
| 契约编目、契约测试编目 | P1 | Important for contributor scalability and review quality, but does not need perfect completeness before launch. |
| 原型库建设 | P1 | Need a frozen minimal set, not broad coverage. |
| 组织管理、CI/CD 等后勤建设 | P1 | Public launch should have baseline automation and intake, not a mature operations stack. |
| 适配器覆盖范围扩充 | P2 | Current three adapters are enough for v0 proof. Expansion can wait. |
| 网站运营、社交媒体运营 | P2 | Launch messaging matters; ongoing operation can stay lightweight at first. |

### 4.4 Quick Start should not be blocked on a full-featured CLI

This is the most important scoping decision in this record.

Recommended rule:

- first public release must have a real Quick Start
- but that Quick Start does **not** need to depend on a mature official CLI

Preferred launch strategy:

- make packages installable first
- provide one officially supported manual setup path
- treat CLI as an accelerator that may land before launch only if it remains minimal

This keeps the release burden attached to user success, rather than attached to tool ambition.

If the team insists that the public story must be "Proto UI starts with CLI", then CLI immediately becomes `P0`.

But that should be understood as a deliberate product decision, not as a technical inevitability.

### 4.5 The minimal release gate should be narrower and sharper than the current aspiration set

The first release should require all of the following:

1. One official runnable onboarding path
2. One official adapter recommendation for onboarding
3. One small but credible prototype set
4. One truthful docs path matching the actual install/use flow
5. One repeatable package staging/publish process
6. One baseline CI path that validates the repo on pull requests

Everything else should justify itself against those six gates.

---

## 5) Release Gate Definition

### 5.1 Gate A: a real official onboarding loop exists

Minimum acceptable state:

- Quick Start no longer says "not installable yet"
- a user can start from docs and run one component locally
- the commands or code samples in docs match the actual shipped path
- the path is tested by at least one smoke-level verification flow

Recommended launch path:

- pick one blessed onboarding stack, preferably React
- pick one styled prototype and one headless prototype as examples
- keep the path deliberately small

### 5.2 Gate B: the prototype set is frozen enough for a first release

Minimum acceptable state:

- current base/shadcn prototypes used in docs and demos are stable
- each release-promoted prototype has tests
- docs list the supported prototype set clearly
- unsupported or incomplete areas are explicitly labeled

This release does not require a large catalog.

It requires a trustworthy catalog.

### 5.3 Gate C: docs are truthful, coherent, and sufficient

Minimum acceptable state:

- README and docs site tell the same story
- current status and roadmap are consistent with Quick Start
- there is a clear path for users
- there is a clear path for contributors
- there is a clear explanation of current non-goals and risk boundaries

### 5.4 Gate D: package publication is operationally real

Minimum acceptable state:

- the intended public package set is explicitly chosen
- release staging succeeds for that package set
- missing README / export / metadata blockers are resolved for publish-target packages
- the release steps are documented and repeatable

This gate is about operational confidence, not about publishing every internal package on day one.

### 5.5 Gate E: baseline project operations exist

Minimum acceptable state:

- PR-time CI runs at least type checks and tests
- issue intake remains usable
- release responsibilities and basic launch checklist are written down

This does not require sophisticated automation, dashboards, or governance processes yet.

---

## 6) Explicitly Deferred For Post-Launch

The following should be considered safe to defer unless they become unexpectedly cheap:

- new adapter families beyond React / Vue / Web Components
- broad prototype-library expansion beyond the launch set
- a richer CLI command surface
- deep contract/test catalog polish beyond a usable index
- advanced CI/CD automation such as multi-channel release orchestration
- sustained social-media calendar or high-frequency content operations
- broader ecosystem positioning work beyond launch messaging and core landing pages

---

## 7) Recommended Sequencing

### Phase 1: close the first official path

- choose the launch onboarding path
- choose the launch package set
- fix package publish blockers for that set
- rewrite Quick Start to match reality

### Phase 2: harden the launch surface

- freeze the launch prototype set
- add contract/test catalog indexes
- add baseline CI
- audit README, status, roadmap, and homepage messaging

### Phase 3: launch support, not scope expansion

- prepare website launch pages and links
- prepare one announcement thread / post set
- prepare contributor intake notes

No new workstream should enter Phase 1 unless it directly strengthens the official onboarding loop.

---

## 8) Consequences

This decision intentionally narrows the meaning of "ready for release".

That has several consequences:

- some attractive ecosystem work will be explicitly postponed
- documentation truthfulness becomes more important than breadth
- package/install reality outranks tooling ambition
- adapter expansion is no longer allowed to compete with onboarding closure for attention

This is desirable for v0.

Proto UI does not need its first release to look complete.

It needs the first release to be honest, runnable, and convincing.

---

## 9) Follow-up Work

- produce a per-workstream execution matrix with `P0 / P1 / P2`
- decide whether launch Quick Start is CLI-based or manual-install-based
- pick the launch package subset
- define the release prototype subset
- define baseline CI and release checklist ownership
