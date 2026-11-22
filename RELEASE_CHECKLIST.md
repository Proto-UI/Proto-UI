# Release preparation

This file is the release navigation entry point. The former v0 public-launch wishlist is [preserved as historical material](internal/records/2026-11-22-v0-public-launch-checklist.md); it is no longer the release gate.

| Question | Current source |
| --- | --- |
| What belongs to 0.3, and what remains open? | [0.3 delivery plan](internal/governance/release-0.3-plan.md), [delivery list](internal/governance/release-0.3-list.md) and its source-bound criterion ledger |
| Which exact release is being prepared? | [Version entities](spec/versions/) and their lifecycle; [`VERSION`](VERSION) is the workspace projection, not proof of publication |
| How do preparation, publication and verification proceed? | [Release workflow and maintainer checklist](internal/governance/release-workflow.md#7-end-to-end-maintainer-checklist) · [中文](internal/governance/release-workflow.zh-CN.md) |
| Where are published and candidate release materials? | [Versioned release notes and evidence](internal/releases/); interpret them with the corresponding `V-*` entity and immutable publication evidence |
| Which compatibility and package rules apply? | [Versioning policy](internal/governance/versioning-policy.md) and [package governance](internal/governance/launch-package-governance.json) |

Protocol guarantees come from the applicable [spec entities](spec/README.md), with their lifecycle and version bounds. Release scope, implementation progress and acceptance evidence are separate facts. An archived checkbox, a passing local check or a calendar target does not establish release acceptance.

For document placement, ownership and retirement, see [documentation policy](internal/governance/documentation-policy.md). The [2026-11-22 audit](internal/records/2026-11-22-documentation-governance.md) records how each part of the former checklist maps to current sources.
