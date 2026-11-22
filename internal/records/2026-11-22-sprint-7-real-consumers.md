# Sprint 7: actual application consumers

The current user identified **Shenko** as the real Harness application and **OpenGreendam/verdant** as another consumer. These are existing applications with different delivery paths. Their evidence is recorded separately; no substitute Harness application was created.

| Application | Pinned starting point | Actual consumption | Evidence and limits |
| --- | --- | --- | --- |
| [cyjin-yl/shenko](https://github.com/cyjin-yl/shenko) | `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42` | The production React UI consumes public Shadcn components. Its Inspect timeline and IM conversation now consume MessageScroller follow facts and commands; its own message bubbles and transport badge also use generated React components. | [Harness execution record](2026-11-22-sprint-7-harness.md): actual App, deterministic HTTP/WS inputs, desktop/narrow browser journeys, reading anchors, selection, owner replacement and cleanup. The final companion PR/pin and final integrated build are recorded there. |
| [OpenGreendam/verdant](https://github.com/OpenGreendam/verdant) | `91a775546ebd21a87d76d76568195a6513437719` | Authored PitchGestureSurface prototype is compiled to Rust and used by actual GPUI application/session crates. | Source, consumer imports and all 20 generated artifact hashes were read and verified. Five repository admission-rule fixtures passed. This session did not execute the native application or its SDK/platform acceptance. |

## Shenko: follow-tail belongs to the existing App

The implementation is in the existing `crates/shenko-ui/web/src/{ui-kit,timeline-surface,im,react-renderer}.tsx` and its ordinary public-package build. The App keeps stable entry/message identities, saved reading mode, selections and anchors. The shared Scroll lease owns follow/depart/resume and cancellation. App-specific reading state is not introduced into Base or the compiler.

The companion change preserves the actual controller, renderers and generated children. It removes the two private 24/32-pixel end-follow thresholds, uses `pauseFollowing()` for reading/selection, and preserves the focused resume control. A surface/source/subject key starts a new reading owner; old callbacks cannot act on its replacement. The browser receipts distinguish trusted keyboard/wheel input from scripted selection and deterministic backend facts.

Shenko's current fixed Inspector lens does not satisfy #522's resizable Inspector condition. Its task/file views do not satisfy #523's two independent Catalog Tree fixture domains. Its Shadcn consumption does not rewrite the original #513/#514 Brutalist decision or the retained editor exemptions. Those conditions remain on their original source owners.

## Verdant: existing GPUI compiler consumer

All following paths are relative to the pinned Verdant revision above:

| Responsibility | Source |
| --- | --- |
| Authored semantic input | [`frontend/proto-ui/src/pitch-gesture-surface.proto.ts`](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/src/pitch-gesture-surface.proto.ts) |
| Compiler/SDK identity | [`frontend/proto-ui/compiler.pin.json`](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/compiler.pin.json) |
| Generated Rust consumer | [`frontend/proto-ui/generated/pitch-gesture-surface/Component.rs`](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/generated/pitch-gesture-surface/Component.rs), with Cargo dependency, source map, provenance and supporting SDK files |
| Application owner | [`frontend/crates/verdant-app/src/proto_roll.rs`](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/crates/verdant-app/src/proto_roll.rs) creates the generated `PitchGestureSurface`; `editor.rs` retains that owner. |
| Actual domain calls | `frontend/crates/verdant-session/src/bindings.rs` calls `planNoteGesture`; `frontend/crates/verdant-app/src/devices.rs` calls `planControlGesture` and `dragNormalized`. Both crates declare the generated crate as a path dependency. |
| Artifact receipt | [`frontend/proto-ui/receipts/pitch-gesture-surface.json`](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/receipts/pitch-gesture-surface.json) |

The pin selects Proto-UI `e56b2d1a3d6b688a1cbc6930dab1d6757304d733`, version `0.3.0-alpha.2`, profile `gpui-source-v1`, Node 24 and pnpm 10.32.1. The upstream GPUI revision is `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`; the application's workspace GPUI is `e5f2f9db75e97613232b5c1946333e61fa3828ab`. The workspace dependency is intentional and is governed by Verdant's own check.

The prototype receives immutable application guard facts and returns note/control gesture plans. Domain/session mutation remains in Verdant. It is an actual compiler consumer, not evidence that Verdant uses Harness follow-tail.

Read-only verification found the authored source hash and **20/20 artifact hashes matching** the existing receipt, with no mismatches. `node frontend/proto-ui/tools/check-proto-ui-rules.mjs` completed **5/5** fixtures: the workspace dependency case is admitted; pinned-crate, duplicate-GPUI, pinned-SDK and pinned-provenance cases are rejected. Those checks establish the declared source/admission boundary only. They do not establish native input, accessibility, paint, resource cleanup, or all S5 backend criteria. No Verdant source or remote state was changed.

## Acceptance ownership

#746 and #745 receive the bounded real Harness evidence and preserved editor boundary. #522/#523 retain the additional application proof stated above. Compiler/non-Web parents receive only the Verdant source mapping that actually exists. No cross-platform acceptance is inferred by combining unrelated applications or by counting one implementation twice.
