---
title: 'Contributor Agents'
description: 'Use a lazy, composable skill system to enter Proto UI work without exceeding comprehension or permission.'
---

Proto UI gives Agents two short entrypoints.

`pui-dev` routes ordinary development. `pui-maintain` routes governed autonomous maintenance. Both choose one transition from the machine registry and resolve one leaf with `pnpm agent:skill -- <leaf-id>`. They do not preload the library. A validated handoff may resolve at most one next leaf.

## Atomic skills

Each leaf skill performs one transition: orient, claim, trace authority, shape a decision, author governed artifacts, implement one owning slice, build evidence, update docs, validate, review, prepare a release, or audit publication.

The maintenance entrypoint has separate leaves for observation, independent verification, accepted remediation, independent review, and closure. This keeps fresh-context roles independent.

Skills are written in English so models share one technical instruction set. The Agent communicates with a contributor in the language that contributor uses.

## Assessment

Start a dynamic challenge from the current spec catalog:

```sh
pnpm agent:assess
```

The challenge is bound to the repository SHA, catalog and policy digests, a random nonce, and an expiry. It contains no answer key. It tests authority, relation tracing, semantic boundaries, validation design, task eligibility, and permission reasoning.

The Agent completes a response bound to that challenge, validates it, fills the public dimension rubric, and derives an unsigned result:

```sh
pnpm agent:assess:response -- --challenge <challenge.json>
pnpm agent:assess:validate -- --challenge <challenge.json> --response <response.json>
pnpm agent:assess:evaluation
pnpm agent:assess:self-result -- --challenge <challenge.json> --response <response.json> --evaluation <evaluation.json>
```

The six dimensions use scores from 0 through 4. No strong dimension compensates for a weak one. A critical failure caps the result. The unsigned result can only be U0 or read-only C1.

Higher capability needs an independent, versioned, expiring attestation from a trusted issuer. Every mutation also needs a probe bound to the exact leaf, task scope, current diff, permission snapshot, human authorization, and subject. If trusted identity, issuer, or global consumption is unavailable, the Agent stops before writing.

The assessment only limits task choice. Effective capability is the full intersection:

```text
effective capability =
live GitHub permission
∩ live Discord or Poppy trust when the action touches those surfaces
∩ verified Agent comprehension
∩ task risk ceiling
∩ fresh task-specific probe
∩ current human authorization
```

No assessment grants GitHub access or removes a human gate.

## Task selection

An Agent may propose only a ready, bounded, unclaimed item with explicit acceptance and validation boundaries. It must inspect assignment, comments, linked work, Project state when available, required capability, and permission ceiling. Posting the claim is a separate mutation and may be unavailable.

If no item qualifies, the Agent stops and reports that no safe claim exists.

Copy this line into your Agent:

```text
Read AGENTS.md, then use $pui-dev to assess your current capability and permissions and select at most one eligible unclaimed task. Stay read-only unless a trusted attestation, an exact live task probe, platform permission, and current human authorization all permit the next leaf; otherwise return the proposal and missing gate.
```

The [skill catalog](/en/contribute/skills/) lists every transition. [Agent automation](/en/contribute/automation/) distinguishes deployed shadow tasks from manual and candidate workflows. The detailed policy is in [AGENTS.md](https://github.com/Proto-UI/Proto-UI/blob/main/AGENTS.md) and [Contributor Agents](https://github.com/Proto-UI/Proto-UI/blob/main/internal/agent-operations/contributor-agents.md).
