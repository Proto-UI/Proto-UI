---
name: pui-select
description: Select at most one eligible Proto UI work item and return a read-only proposal without changing GitHub or repository state. Use after pui-orient when requested contribution work is not yet bounded, or when a user asks what ready task fits the current capability and permission envelope. Do not post a claim, assign anyone, decide readiness, or invent work.
---

# Propose one eligible work item

1. Require a current `pui-orient` envelope.
2. Read `CONTRIBUTING.md` and inspect the live issue queue, assignees, recent comments, linked pull requests, labels, milestones, and Project fields when available.
3. Reject work that is unassessed, ambiguous, design-blocked, oversized, missing acceptance or validation boundaries, beyond capability or permission, already owned, actively claimed, or linked to active implementation.
4. Select at most one smallest ready item with a fixed expected result, explicit exclusions, evidence boundary, risk, required capability, and permission ceiling. Returning no eligible item is correct.
5. In autonomous mode, reject any item whose task class exceeds the fresh self-assessed ceiling. For review work, also require one declared review class present in `recommendedReviewClasses`. In human-assisted mode, report low confidence and stronger review needs without blocking the user's selected work.
6. For the selected Issue, inspect its existing evidence using `internal/agent-operations/visual-evidence.md`. Return an `evidence-assessment` artifact bound to the Issue URL, observed update time and inspected discussion cutoff. Include a sanitized request paraphrase with actual source attribution, existing verified evidence links and quality, inspected versus unknown discussion scope, baseline/result, `complete`/`partial`/`blocked` disposition for the named evidence scope, and each gap's reason and next Agent action. A future test plan is not current evidence. If no item is eligible, record a no-target assessment without inventing a request or defect.
7. Return raw selection facts, a copy-ready claim proposal, planned evidence, expiry, unknowns, and the exact authorization and live permission required by `pui-claim`. Embed the assessed `Agent evidence` section in the proposed claim text before requesting authorization for that exact text. Missing evidence is Agent debt, not grounds to reject human intake or an otherwise ready item.

Remain read-only. Do not comment, label, assign, claim, edit, close, create a branch, or mutate Project state. A proposal never changes readiness or grants implementation authority.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
