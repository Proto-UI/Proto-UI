---
title: 'Agent skill catalog'
description: 'See the small state transitions that pui-dev and pui-maintain compose without preloading the full library.'
---

The machine registry at `internal/agent-operations/skills.yaml` is the source for paths, capability bands, task classes, inputs, and outputs. This page explains the same library for people.

## How loading works

The entrypoint chooses one leaf ID. The resolver returns its one registered file:

```sh
pnpm agent:skill -- pui-trace --mode human-assisted --mode-source current-user
```

The leaf returns a structured handoff. The entrypoint validates it before resolving the next leaf:

```sh
pnpm agent:skill -- --handoff <handoff.json>
```

A handoff carries typed artifacts and at most one next skill. A terminal handoff ends the chain. Leaf skills cannot load other leaves themselves.

## Enter and bound the work

| Skill         | One transition                                                           |
| ------------- | ------------------------------------------------------------------------ |
| `pui-assess`  | Unassessed context to an unsigned U0-C4 local task-fit result            |
| `pui-orient`  | Unknown context to a mode-aware contribution envelope                    |
| `pui-select`  | Unbounded request to one read-only work proposal or no-work result       |
| `pui-claim`   | Authorized proposal to one posted claim or a fail-closed no-write result |
| `pui-unclaim` | One owned claim to a recorded release                                    |
| `pui-trace`   | Bounded subject to an authority and evidence map                         |

## Shape governed artifacts

| Skill            | One transition                                          |
| ---------------- | ------------------------------------------------------- |
| `pui-brainstorm` | Semantic uncertainty to a maintainer decision packet    |
| `pui-spec`       | Approved semantic scope to a governed spec graph change |
| `pui-contract`   | Governed fact to a readable contract projection         |

## Implement one owning slice

| Skill                | One transition                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| `pui-module`         | Approved Module slice to portable implementation and evidence           |
| `pui-host`           | Approved host responsibility to a Host Capability realization           |
| `pui-adapter-assess` | Bounded Adapter question to a read-only assessment packet               |
| `pui-adapter`        | Approved Adapter scope to one implementation slice                      |
| `pui-prototype`      | Governed component slice to one coherent Prototype delivery             |
| `pui-regression`     | Reproduced governed failure to a bounded repair and regression evidence |

## Build evidence and reader projections

| Skill           | One transition                                                           |
| --------------- | ------------------------------------------------------------------------ |
| `pui-test`      | Governed behavior to executable evidence                                 |
| `pui-docs`      | Governed repository fact to human documentation                          |
| `pui-validate`  | Candidate change to a proportional evidence report                       |
| `pui-review`    | Candidate change to a revision-bound packet at one declared review class |
| `pui-integrate` | Approved exact-head pull request to a rule-compliant merge receipt       |

## Inspect repository operations

These leaves are read-only. A diagnosis or proposal does not authorize its repair.

| Skill        | One transition                                                |
| ------------ | ------------------------------------------------------------- |
| `pui-issue`  | Bounded Issue portfolio to an operations report               |
| `pui-pr`     | Bounded pull-request portfolio to an integration-state report |
| `pui-ci`     | One workflow failure to an owning evidence map                |
| `pui-govern` | One collaboration question to a governance drift report       |
| `pui-deploy` | One delivery surface to a revision-bound evidence report      |
| `pui-deps`   | One dependency question to an impact and risk report          |

## Prepare and audit a release

| Skill               | One transition                                          |
| ------------------- | ------------------------------------------------------- |
| `pui-release-prep`  | Approved release intent to a reviewable candidate state |
| `pui-release-audit` | Completed publication to reconciled immutable evidence  |

## Run autonomous maintenance

`pui-maintain` routes one stage at a time. Observation, verification, and review use fresh contexts where the protocol requires independence.

| Skill | One transition |
| --- | --- |
| `pui-mission` | Selected candidate to a frozen bounded mission and lease |
| `pui-observe` | Frozen mission to a finding or no-finding report |
| `pui-verify` | Candidate finding to an independent classification |
| `pui-remediate` | Accepted finding to the bounded repair and remediation packet |
| `pui-maintenance-review` | Actual remediation to an independent technical verdict |
| `pui-maintenance-close` | Reviewed remediation to synchronized closure |
| `pui-record` | Supported non-remediation terminal outcome to a synchronized run record |

## Capability is a ceiling when the Agent works alone

C1 covers bounded facts plus factual or documentation review. C2 adds test and bounded-regression review. C3 adds approved semantic implementation and governed-slice review. C4 adds cross-domain semantics, governance evidence, release preparation, and narrowly standing-authorized exact-head integration. `pui-review` declares one review class, and the local result lists the classes the Agent may take unattended. The registry calls a leaf's threshold `autonomousMinimumBand` because it applies when an Agent chooses or advances work alone.

During `human-assisted` work, the same result is advice. It changes scope, validation, review depth, and stated limitations, but it does not block a task the current user requested. Live platform permission, relevant Discord or Poppy trust, current authorization, repository rules, and human gates remain separate in both modes.
