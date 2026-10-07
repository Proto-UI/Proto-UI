---
name: pui-validate
description: Select, run, and report proportional Proto UI validation for a completed change. Use before review, handoff, commit, or pull request updates, and after resolving validation failures. Cover focused evidence first, then affected graph, types, docs, packaging, consumers, release, or repository checks according to risk.
---

# Validate a change

For state/ownership or rendered-projection changes, selective test commands, or resource-related failures, read `internal/agent-operations/testing-method.md`. Confirm the intended files ran and keep candidate-bound failures, controlled reruns and omitted evidence distinct.

1. Read `AGENTS.md`, the actual diff, the `pui-trace` map, and the governed validation boundary.
2. Check worktree and generated-file discipline before running tests.
3. Run focused evidence first. Confirm it exercises the intended failure and owning layer.
4. Expand through affected entity graph, Runtime or Adapter integration, types, public docs, package surfaces, consumer smoke, and release governance as the change requires.
5. Run generators before their corresponding check mode. Never hand-edit generated output.
6. Record command, exit status, relevant output, environment, and skipped checks. Do not claim a check that did not run.
7. Separate machine evidence, observable acceptance evidence, authority resolution, and deployment evidence.
8. Diagnose failures before returning them: distinguish environment/setup, implementation, and test/fixture defects, retaining uncertainty when the evidence cannot separate them. Preserve the failing command, assertion, and candidate; use `internal/agent-operations/testing-method.md` for controlled reruns.
9. Return a repairable failure to one eligible owning leaf with the evidence report and required prior artifacts. A `pui-regression` handoff needs the authority map, reproduction, and existing implementation authorization; a `pui-test` handoff needs the authority map, governed behavior, and existing implementation authorization. Do not invent missing authorization or perform source repairs inside this disposable-output-only leaf. The entrypoint resumes validation after repair.
10. If the next repair lacks a prerequisite or crosses a gate, return a terminal handoff naming the blocker and next action. A failed or blocked check is not a completed implementation task, evidence of infeasibility, or permission to remove requested behavior or weaken its assertion.

Before routing `pui-validate` to `pui-review`, retain the actual handoff received by validation and pass it with `--prior-handoff` to both `agent:skill` and `agent:review`. The validator checks unchanged mode, repository/scope/head and current candidate identities and existing bindings. Supply a new evidence-report digest, not a renamed copy of a received report. V1 replaces its singleton report; v2 may retain historical reports but needs a new explicitly result-bound report whose revision is the current head. When an input candidate has no digest, validation computes its actual artifact SHA-256 and adds only that missing field; in v2 it can likewise bind a missing revision to the current head. Retain reference and every existing field. Do not return a valid digestless input to its producer merely to add optional metadata. A missing predecessor remains evidence to recover, not permission to synthesize history. If a received report lacks a digest, the new report uses a distinct reference and a digest; this structural distinction cannot detect byte-identical aliases. These structural comparisons do not authenticate file contents or prove canonical execution; inspect the report and run the required checks independently.

Passing checks establish technical evidence, not product correctness, review approval, merge permission, or release authorization.

## Evidence discipline

Include the Agent-only soft-gate disposition from `internal/agent-operations/visual-evidence.md` in the evidence report. Verify request paraphrase, uploaded visuals and exact reproduction/head scope; mark unavailable evidence and the next Agent action. Humans may submit plain descriptions. Do not fabricate captures, count local files as uploaded, or convert missing images into a blanket intake/merge blocker. Upload mechanisms are documented in `internal/agent-operations/github-evidence-upload.md`; this validation leaf does not gain external-write authority.

For UI work, inspect the final rendered captures rather than only producing files or reading layout values. Apply the policy's design-review method: identify the actual region, observed issue or successful relationship, user consequence, and proposed correction. Account for the supported viewport, theme, locale, and interaction-state scope; separate visual judgment, accessibility checks, and functional results. Recapture after relevant changes and keep unresolved findings visible.

Where reuse or dogfood is claimed, trace the rendered control or surface to the actual component or Prototype and its supported inputs, then exercise its behavior. Identify native recipes, page layout, and brand artwork separately. Visual similarity and component-shaped markup alone do not verify that claim.

For per-commit reporting, reconcile newly pushed development SHAs with their change summaries, validation, remaining work, and comment receipts or publication debt. UI evidence binds the revision, viewport, and theme; purely internal work uses applicable executable evidence. Missing captures or running checks remain `pending`. Return this evidence without posting or uploading from this leaf. Adding or updating a progress comment changes the canonical review input even on the same head; recollect before relying on an earlier packet.

Apply these principles to every validation round; they are methodology, not a checklist of known bugs:

1. Bind visual assertions to actual rendered output: computed geometry, paint, positioning and component captures. Internal facts alone do not prove a visible defect. For purely internal claims, require executed variable/state observations and a source-bound causal walkthrough under the visual-evidence policy; do not invent a UI or substitute a prose/log screenshot.
2. Probe transitions, not states. Sample adjacent states pairwise and assert on the deltas between them; most regressions live in the difference between two frames, invisible to isolated snapshots.
3. Re-assert dependents. Observing or changing a surface obligates re-verifying every surface anchored to, composed with, or layered above it.
4. Attribute every expectation. Each expected value names its authority (spec anchor or upstream reference); an observable behavior with no cited authority is itself a finding.
5. Scope expectations per family. Behavioral assumptions never transfer across design languages; each expectation needs a fresh citation inside its own family.
6. Exercise live boundaries. Any path that depends on an external live system must be run against that system, not only against synthetic fixtures.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep commands and paths exact.

A fresh report may record `passed`, `failed`, `partial` or `not-run`; freshness is not a green result. Review and integration independently enforce their required evidence and acceptance conditions.
