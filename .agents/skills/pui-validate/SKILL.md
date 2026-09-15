---
name: pui-validate
description: Select, run, and report proportional Proto UI validation for a completed change. Use before review, handoff, commit, or pull request updates, and after resolving validation failures. Cover focused evidence first, then affected graph, types, docs, packaging, consumers, release, or repository checks according to risk.
---

# Validate a change

For state/ownership or rendered-projection changes, selective test commands, or resource-related failures, read `internal/agent-operations/testing-method.md`. Confirm the intended files ran and keep candidate-bound failures, controlled reruns and omitted evidence distinct.

1. Read `AGENTS.md`, the actual diff, the `pui-trace` map, and any approved validation boundary.
2. Check worktree and generated-file discipline before running tests.
3. Run focused evidence first. Confirm it exercises the intended failure and owning layer.
4. Expand through affected entity graph, Runtime or Adapter integration, types, public docs, package surfaces, consumer smoke, and release governance as the change requires.
5. Run generators before their corresponding check mode. Never hand-edit generated output.
6. Record command, exit status, relevant output, environment, and skipped checks. Do not claim a check that did not run.
7. Separate machine evidence, manual acceptance, semantic approval, and deployment evidence.
8. Return failures to the owning skill with the smallest useful diagnosis.

Passing checks establish technical evidence, not product correctness, review approval, merge permission, or release authorization.

## Evidence discipline

Include the Agent-only soft-gate disposition from `internal/agent-operations/visual-evidence.md` in the evidence report. Verify request paraphrase, uploaded visuals and exact reproduction/head scope; mark unavailable evidence and the next Agent action. Humans may submit plain descriptions. Do not fabricate captures, count local files as uploaded, or convert missing images into a blanket intake/merge blocker. Upload mechanisms are documented in `internal/agent-operations/github-evidence-upload.md`; this validation leaf does not gain external-write authority.

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
