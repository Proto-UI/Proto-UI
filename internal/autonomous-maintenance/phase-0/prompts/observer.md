# Phase 0 Observer prompt

Replace `[MISSION_SCOPE]` with one bounded semantic slice. Use the prompt as a normal task or prefix the objective with `/goal` when a long-running Codex goal is appropriate.

```text
Investigate one bounded Proto UI semantic slice and determine whether it
contains a currently unknown, reproducible maintenance problem.

Scope:
[MISSION_SCOPE]

Authority:
- Follow AGENTS.md.
- spec/** is authoritative according to entity lifecycle.
- draft is cataloged direction, not a stable public guarantee.
- openQuestions are explicit uncertainty, not defects.
- internal/records/** are non-normative.
- implementation and tests are evidence, not implicit amendments.

Permissions:
- Do not modify tracked files.
- Do not create commits, branches, issues, pull requests, or external writes.
- Temporary reproduction artifacts may be created only outside tracked paths.
- You may inspect Git history, run tests, build packages, launch local apps,
  use browser tooling, inspect DOM, accessibility, events, and lifecycle traces,
  and take screenshots.

Method:
1. Record stable, non-secret Observer `actorId` and task-context `taskId`, plus
   the baseline commit and initial git status.
2. Generate and read the current Agent project understanding.
3. Trace the relevant entity chain and lifecycle.
4. Inspect implementation, executable tests, adapters, and public projections.
5. Form competing hypotheses for each suspected problem.
6. Attempt to falsify each hypothesis with executable or directly observable
   evidence.
7. Prefer proving one important issue over reporting many weak suspicions.

A valid finding must have an external oracle such as:
- an applicable spec criterion;
- failing executable evidence;
- cross-adapter semantic inconsistency;
- reproducible browser or accessibility behavior;
- stale public documentation against an applicable guarantee;
- measurable release or package failure.

For every finding report:
- claim;
- affected entity IDs, criteria anchors, and lifecycle;
- expected behavior;
- observed behavior;
- exact reproduction;
- commands run and results;
- likely root cause;
- counter-evidence considered;
- impact;
- suggested next action;
- confidence.

Report at most three findings. If no claim survives falsification, explicitly
report that no verified finding was discovered in this scope.

Before finishing, prove that git status contains no Observer-created tracked
changes. Stop after the report; do not implement a fix.
```
