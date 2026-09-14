# Feedback contracts and implementation map

This directory explains Feedback and preserves legacy detail. The applicable entities under `spec/**` are authoritative. The visual style slice below remains **draft**; cataloging it does not promote the whole Feedback channel or admit auditory/tactile capabilities.

## Authority

- [C-FEEDBACK-0001](../../../spec/contracts/C-FEEDBACK-0001.yaml) defines the Component-to-User information channel.
- [C-FEEDBACK-0002](../../../spec/contracts/C-FEEDBACK-0002.yaml) separates setup planning from runtime effects.
- [C-FEEDBACK-STYLE-0001](../../../spec/contracts/C-FEEDBACK-STYLE-0001.yaml) bounds visual style feedback and prohibits structural rendering as its update mechanism.
- [C-FEEDBACK-STYLE-0002](../../../spec/contracts/C-FEEDBACK-STYLE-0002.yaml) governs setup-only `use` and `unUse`.
- [C-FEEDBACK-STYLE-0003](../../../spec/contracts/C-FEEDBACK-STYLE-0003.yaml) and [C-FEEDBACK-STYLE-0004](../../../spec/contracts/C-FEEDBACK-STYLE-0004.yaml) govern token semantics and the boundary between author intent and host translation artifacts.
- [C-FEEDBACK-STYLE-0005](../../../spec/contracts/C-FEEDBACK-STYLE-0005.yaml) governs runtime `patch`, `suppress`, and `clearPatch`.

## Current visual style flow

`def.feedback.style.use` records setup contributions. Its returned `unUse` removes that contribution during setup; it is not a runtime or lifecycle disposer. Rule owns condition evaluation and supplies active style contributions through the internal Feedback port, following [C-RULE-INTENT-FEEDBACK-STYLE-0001](../../../spec/contracts/C-RULE-INTENT-FEEDBACK-STYLE-0001.yaml).

Feedback semantically merges the base contributions and applies one incremental per-instance runtime patch layer. Positive patches and suppression operate by semantic group. `clearPatch` removes this layer and exposes the current base, including any intervening Rule changes. Style changes request effects projection without changing the template or requesting a structural render.

Author tokens reject selector/state syntax. Internal translation paths may carry selector-bearing artifacts; this distinction does not make those artifacts legal author input. Runtime write restrictions during readonly render remain an open question in `C-FEEDBACK-STYLE-0005`.

[M-FEEDBACK-0001](../../../spec/modules/M-FEEDBACK-0001.yaml) owns this Module slice. [HC-FEEDBACK-STYLE-SINK-0001](../../../spec/host-caps/HC-FEEDBACK-STYLE-SINK-0001.yaml) describes the host queue/apply responsibility currently implemented by `EFFECTS_CAP` and `EffectsPort`. Four Web Adapter profiles translate the result to `data-pui-style`, preserving unrelated presentation. Host surface selection follows [C-HOST-SURFACE-PROJECTION-0001](../../../spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml); the visual surface need not be the logical boundary.

## Lifetime and evidence

Logical contributions and patches survive repeatable view detach/remount. Host effects suspend while detached or unmounting, and mounting replays retained state when the sink is available. Terminal disposal ends the instance style state. These boundaries follow [C-LIFECYCLE-0006](../../../spec/contracts/C-LIFECYCLE-0006.yaml) and [C-LIFECYCLE-0007](../../../spec/contracts/C-LIFECYCLE-0007.yaml).

[T-FEEDBACK-0001](../../../spec/tests/T-FEEDBACK-0001.yaml) maps direct Module tests, Runtime lifecycle and Rule integration, EffectsPort tests, and real React, Vue 3, Vue 2 and Web Component journeys. These prove semantic token projection and absence of Proto structural rendering; they do not establish browser CSS appearance or non-Web conformance.

Legacy details remain in [style.use.setup-only.v0.md](./style.use.setup-only.v0.md), [style.merge.semantic.v0.md](./style.merge.semantic.v0.md), and [style.export.v0.md](./style.export.v0.md). Read them together with the applicable spec lifecycle and current runtime patch contract.
