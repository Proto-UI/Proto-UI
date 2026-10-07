# Feedback sink-kind retirement reconstruction

Date: 2026-10-07. Review: https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4200878879. Authority: `HC-FEEDBACK-VISUAL-SINK-0001-LIFETIME`.

The prior local repair tree `71c1af568a1f15e38901366601d658ed2e93baaf5` was not recoverable from GitHub. This is a new paired reconstruction. Baseline `packages/modules/feedback/src/create.ts` blob `77dfa9c07a187a269ac58c3f79cb0ca07f3eafc9` matched the current joint source.

Five new controls failed before the repair, while three positive/unchanged-kind controls passed. The missing release was reproduced in both directions when the same host object migrated between `VISUAL_FEEDBACK_SINK_CAP` and `FINAL_STYLE_SINK_CAP`. Throwing release and reentrant owner/commit transitions were also affected.

The fix records the selected capability kind alongside object identity and view epoch. Either object or kind replacement retires the previous output. Retirement clears ownership metadata before invoking the host, so a throwing or reentrant release cannot keep an old owner alive or overwrite a newer owner. The selected kind is recorded before each host commit, matching its actual frame shape.

Current results:

- Eight new controls pass after repair.
- All 84 Feedback tests pass.
- Sixteen related real Runtime material/style contract tests pass.
- All four material-specializer tree-shaking checks pass; no optical provider is eagerly added by this bookkeeping change.
- Workspace TypeScript check passes. An initial test-only spy signature inferred the array-push return value; the spies now explicitly return void, and the exact final tests were rerun against both baseline (five failures) and repaired source (eight passes).
- Independent source acceptance and final integrated package measurement remain separate gates. The catalog entry stays planned until independent review.

Raw red/green evidence is retained with the source packet. No previous 92-test claim is reused, no screenshot is relabelled, and no native optical/material support is inferred from lifetime tests. No review-thread or PR-ref write is performed by this packet.
