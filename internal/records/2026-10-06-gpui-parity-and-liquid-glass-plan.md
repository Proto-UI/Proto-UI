# GPUI parity and Liquid Glass implementation plan

Date: 2026-10-06. Agent: dot; ModelTrace: not measured under the current owner exemption.

Status: source-verified, non-normative implementation plan for the unified Finf work in #872. This record does not declare a complete GPUI Adapter, native Liquid Glass, stable profile, or finished Compiler target. Every unfinished item below remains open. The first vertical slice is an implementation stage, not a reduction of the full requested outcome.

## Exact observation boundary

- Project source baseline: `25c3d0731e39003d87f541afc5e1a294a9d95568`.
- Finf remote observed: `662ef4080793d6464596d1b48ad787fefaccf623` on 2026-10-06; this packet does not mutate that ref.
- Label interface dependency: draft tree `65e5dd52ae14e417699bdb08bd0404542132a287`, based on the project source baseline. Its typed `InstanceAssociations` channel is a candidate dependency, not already stable admission.
- GPUI upstream remains exactly `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. `gpui`, `gpui_macos`, and `gpui_wgpu` manifests declare Apache-2.0. Upstream source was inspected, not copied into this candidate or newly executed.
- `native/gpui/README.md` was stale: the workspace already contains protocol, style, and real GPUI translation crates and a pinned GPUI dependency. The old README is not negative implementation evidence.
- `@proto.ui/adapter-gpui-peer` remains private with `protoUi.release.scan: false`. A working internal lane and an admitted public Adapter profile are separate deliverables.

## Existing work that must be preserved

The Rust host is real, not a fake bridge. `native/gpui/crates/proto-ui-gpui/src/{host,hub,input,key,style,template,a11y}.rs` provides native layout/input routing, frame projection, focus handles, T0 projection activation, host-owned composition, style mapping, and a bounded AccessKit projection. The peer runs the existing TypeScript RuntimeSession instead of reimplementing Prototype semantics in Rust.

`packages/adapters/gpui-peer/src/bundle.ts` exposes twelve entries: Button, Toggle, Switch root/thumb, Tabs root/list/trigger/content/indicator, Transition, and Checkbox root/indicator. These are six families, not all Base identities. Real Node-peer/Rust-host tests exist for those families. Tests under `tests/t0` are real interop tests but ignored in the ordinary Cargo run; the `rust-interop` CI job explicitly runs them.

Root Feedback is implemented: `ProjectionTransaction.style`, `style.apply`, `EFFECTS_CAP`, token merge, host refinement, stale-epoch checks, and rejection diagnostics exist in current source. #719 is closed without merging individually, but its work was consolidated through #756. A PR's individual merge flag is not proof that its implementation is absent.

#823's recursive slot placement and terminal-lifetime repairs are already present. #822 is still open at `ae25e8ffb5b3416a307a126056b797b40cc98124`; its `projection.order` protocol and Tabs navigation must be reconciled explicitly, not independently reinvented. The existing native relation code derives `labelledBy` names across live sessions; it does not yet expose every AccessKit relationship as a native relation.

## Full parity work inventory

This inventory is deliberately capability-based. Adding bundle names, fixtures, unsupported diagnostics, or catalog rows cannot close a capability.

| Area | Verified source capability | Remaining actual work and required evidence |
| --- | --- | --- |
| Semantic execution | Existing TS Runtime, bounded protocol, epoch/commit/lease state machine, composition/lifetime tests | T1 embedded deployment/runtime packaging; fail/restart/backpressure; full Base bundle and all public projection identities; no second semantic owner |
| Layout and styling | Flex, bounded lengths/colors/theme substitutions, root and Template styles | Native layout/paint for every actual token/value; text inheritance, selection, SVG/images, shadows/outlines/gradients/transforms/stacking; actual pixel and layout comparisons per family |
| Focus and input | Native pointer/key routing, tab stops, native focus facts, Button/Toggle/Switch/Checkbox/Tabs subset | Reconcile #822; vertical/RTL/order/reparent tests; text/IME/composition/selection; modality and return-focus; T0 prevention limitation versus T1 synchronous budget |
| Label associations | Candidate typed Core channel; current host has semantic naming ledger | Dedicated identity lowering, real window/tree scope, native pointer and accessibility request routing, callback-scope/lifetime/disabled/control ownership, all five admitted targets and every styled projection |
| Scroll | Mapper can express overflow | Actual Scroll module lease, metrics/read/write, overscroll/user interruption/end-follow, track/thumb/corner and A11y; overflow alone is not Scroll conformance |
| Overlay | Input router anticipates portal ownership | Host Boundary/Positioning/Overlay/HitParticipation, stacking, dismissal, modal locks, trap/restore, nested overlays, root usable-space lease and offscreen/resize tests |
| A11y | Button, Switch, Checkbox, TabList/Tab/TabPanel roles; states and Click; label text resolution | Rich roles/actions/relations/live content, native text-control value/selection, table/image semantics, actual OS tree/action tests, VoiceOver evidence, Linux/Windows evidence; preserve explicit names |
| Theme/preferences | Source-derived family palettes and sampled meta | Live color scheme and reduced-motion/transparency/contrast/forced-colors policy, updates without remount, teardown/observer loss, family-specific readability |
| Projection families | Shadcn/Brutalist/Bootstrap/Liquid token/theme input | Full real Prototype execution and same behavioral/visual matrix for each family. Current family fixture tests intentionally leave gradient/shadow/blur incomplete |
| Material | Draft intent, visual ownership contract; separate Web owned-scene experiment | Native transport, shared lowering, source ownership/leases, portable GPU passes and native-semantic bridge, live preferences, safe fallback, pixel/performance/resource-loss evidence |
| Compiler | Separate compiler work exists | Consume the same versioned host lowering; generate editable native calls and lifecycle hooks; compile/run native output; differential behavior, styles/material, accessibility and failure paths |
| Demos and admission | Native tests and research labels | Executable native gallery covering exact identities; source-bound evidence; runnable packaging; formal multi-artifact Adapter profile, docs, supported OS/backend/toolchain, release/admission gates |

At the baseline the style mapper's explicit unsupported-property inventory contains 31 properties and another value-level inventory. This count is historical evidence, not a target to game. `svg` nodes are diagnosed as not rendered. A styled root with missing declarations can be rejected as a whole. None of these safety behaviors is a final substitute for the requested feature.

## First complete semantic vertical slice: Label → Checkbox/Switch

This is the next implementation stage. Label → RadioItem/Input/Textarea, additional controls, the styled projections, and the complete native material lane remain open until separately executed and evidenced.

1. Keep `InstanceAssociations` separate from JSON Props. The host creates an explicit association identity; the wire carries a bounded renderer-owned key, and the peer materializes the public opaque reference through its factory within that renderer lifetime. No object reference, `HTMLElement`, callback, selector, or id lookup crosses the wire.
2. A logical composition root is not a window or accessibility tree. Derive live view scope from the actual GPUI window plus the host-owned surface tree, and use exact identity/epoch/lease generation. Reject foreign scope, duplicate participants, missing views, old lease messages, and late requests after detach/disposal.
3. Attach the existing ControlLabel Module, not application listeners that mutate Checkbox/Switch values. Naming is the owned A11y semantic `labelledBy` relation; activation enters the target's existing callback scope and invokes the same internal operation as direct activation.
4. Name conflict cannot disable an explicitly enabled activation-only relationship. Naming continues for disabled targets; activation and focus do not. Controlled state, ordinary outward signals and retained focus ownership remain unchanged.
5. The native host supplies only qualified activation requests. Reject non-primary/modified input, drags, cancellation, nested interactive descendants and stale generations. Label gains no Tab stop or independent keyboard activation. Assistive actions must use actual native AccessKit routing, not a test-only synthetic click.
6. Run assertions against actual peers and native hosts: live name changes, pointer/accessibility activation exactly once, disabled/controlled behavior, focus cancellation, reentrant disable/detach/ref replacement, duplicate/foreign scope, view reattachment, target teardown and late traffic.
7. Extend the real macOS accessibility test and T0 CI with nonzero-test guards. Add a current-source native screenshot or video and decoded/native-tree evidence. Keep visual/AT evidence debt explicit until collected. A TS scope ledger test is useful but cannot complete this slice alone.

T0's focus application remains asynchronous. A scripted synchronous focus callback cannot certify the real T0 case in which a native focus callback disables or detaches a participant before a subsequent control change. Keep that negative case open until a governed continuation or the T1 synchronous guest path preserves the ordering; do not label this first transport/host increment complete parity. The full Label contract also still requires passive text selection and all five target families.

Before editing shared messages, reconcile #822 once. The Finf integrator owns the only remote ref. Label Core changes and GPUI deltas are separate packets so the draft 137-file dependency is not accidentally submitted twice.

## Material ownership and two backend paths

The Prototype expresses material intent, existing rest/pressed state and the sampling relationship. Host/backends own platform handles, shader programs, textures, resource synchronization and OS availability. Do not add GPUI, Metal, WGSL, AppKit, URL or texture fields to Prototype Props to evade that boundary.

Existing governing drafts are `C-FEEDBACK-MATERIAL-0001`, `C-VISUAL-TRANSACTION-0001`, `T-MATERIAL-VISUAL-RESULT-0001`, and the historical direction in `2026-10-04-native-material-lowering-direction.md`. The owner's latest 2026-10-06 direction supersedes an earlier backend-first interpretation: **explicit Liquid Glass requires the self-implemented optical effect; adaptive native blur prefers the available system material.** An AppKit `NSGlassEffectView` must not satisfy an explicit Liquid Glass request by substitution. It is at most a candidate for the adaptive system-material intent. Fidelity and availability are realization facts below this author-intent decision, not a way to erase it. An owned-scene input cannot silently turn into a system-composited backdrop.

The required shared-lowering selection table is:

| Author intent | Eligible primary mechanism | Never silently substitute |
| --- | --- | --- |
| Explicit Liquid Glass | Self-implemented, versioned optical model with proven source boundary | OS blur, Acrylic, Aero, Mica, `NSVisualEffectView` or `NSGlassEffectView` |
| Adaptive native blur/material | Actual system/version-appropriate native backdrop with verified availability and source scope | Claim of fixed Liquid Glass optical identity; unsupported native API; unrelated opaque wallpaper material relabelled as blur |

If the primary mechanism is unavailable, select an explicitly disclosed permitted fallback or unsupported result. Accessibility safety fallback is independent and can still force opaque rendering. Add negative controls proving that native capability availability does not reroute explicit Liquid Glass, and that an adaptive request uses its valid native mechanism rather than eagerly running the custom shader. Windows 10 Acrylic and Windows 7 Aero illustrate the intended adaptation; they are not a claim of an implemented legacy Windows target.

### Path A: GPUI-owned portable GPU material

The current Web experiment uses WebGL/GLSL ES 1.00. It is not a WebGPU implementation. The pinned GPUI renderer uses `gpui_wgpu`; its WebGL2 shader variant is a renderer backend detail, not evidence that the existing Web material provider can be reused unchanged.

At the fixed pin, the GPUI `Scene` primitive list contains Quad, Shadow, Path, Underline, monochrome/subpixel/polychrome sprites and Surface. Its wgpu pipelines mirror those primitives. A `canvas` callback records those primitives; it is not a public arbitrary-shader/postprocess pass. Thus a genuine portable material cannot be completed by only adding a `StyleRefinement` field or replacing a CSS class.

Implement a small host-owned renderer extension with an explicit owned-scene image resource. Do not capture arbitrary desktop or other-window content. A minimal architecture is:

- Produce eligible background content once into an offscreen texture in the same GPU device/context. Bind the source resource to owner, frame revision, color space, extent, coordinate transform and generation. The material samples only the allowed source region; output may not feed its own source.
- Snapshot the sampling region before its glass group, with padding sufficient for the finite blur/refraction footprint. Multiple overlapping members share the same pre-group source. Do not recursively sample already-composited glass unless a separately admitted graph explicitly allows it.
- Resolve surface bounds and all four radii once from final style geometry. Reuse those exact values for clipping and the optical model. Use physical-pixel scale consistently; resize/DPI/window migration invalidates resource identity.
- Lower the finite heightfield model into mask/normal/refraction sampling, bounded blur, tint/coat and foreground composition. Perform scene sampling and blending in a declared linear color space with correct premultiplied-alpha conversion. Preserve sharp foreground text, border and focus indication after the material pass.
- Use cached pipelines and resources, dirty rectangles, shared group capture and bounded quality tiers. No synchronous GPU readback or JS/IPC wait in layout/prepaint/paint. CPU readback is acceptable for isolated evidence capture, not the production frame loop.
- On source loss, device loss, unsupported format, stale frame, invalid transform or allocation failure, switch atomically to the declared opaque fallback and release old leases. Record the reason. Reacquisition uses a new generation and never resurrects a retired source.

The first optical fixture should contain a real Liquid Glass Button over an app-owned moving high-frequency/color background, with rest/pressed/disabled/focus states. A blur-only control and a no-refraction control must differ from the full output at the same SHA. Changed backgrounds must change the sampled pixels. Mask edges and text must remain stable under DPI/resize. These negative controls prevent a decorative gradient or static screenshot from being mistaken for actual refraction.

### Path B: adaptive native blur/material (Apple candidate)

For adaptive native material, one current Apple candidate is `NSGlassEffectView`; `NSGlassEffectContainerView` groups related glass. At the fixed GPUI pin the macOS window's `Blurred` path creates `NSVisualEffectView`, not `NSGlassEffectView`. That existing window effect is neither element-level Liquid Glass nor a new native source contract.

If that adaptive profile selects Liquid Glass on Apple, a complete AppKit binding must host its content inside `NSGlassEffectView.contentView`. Apple's WWDC25 guidance explicitly warns against a sibling glass background: that arrangement misses system content-legibility treatment. For GPUI's single GPU view, simply laying an AppKit glass sibling behind a rectangle is therefore not the final bridge.

Use a narrowly owned embedded native surface/content island, with clipping, stacking, coordinate/DPI synchronization, host lifecycle, input forwarding and a single accessibility owner. Test whether the actual hosted content can participate correctly before declaring it supported. Prefer standard native controls only when they preserve the governed Base semantics without creating two activation/state owners. If a whole GPUI subtree cannot be represented safely in the island, disclose the restriction and continue engineering it rather than claiming native equivalence.

Native availability checks must cover the actual API/OS/framework, shape, source scope and ownership, not just `target_os = macos`. The macOS 26 APIs are an initial target; evolving properties require their own availability checks. Do not infer other Apple platform availability. The compiler emits the same native calls and lifecycle subscriptions chosen by the shared lowering profile.

Apple documents shared sampling for grouped glass and system adaptation to preferences; neither proves this binding implements a Proto multi-surface morph contract. Keep group identity/morph semantics, cross-window sources and unsupported shapes as explicit follow-on work.

### Live safety policy and honest quality

- Preserve the current conservative material contract: reduced motion, reduced transparency, forced colors, unknown/unsafe contrast, unknown relevant preference or unproven source support select the complete opaque fallback. Platform behavior may later justify a separately reviewed policy revision; it must not silently override the current contract.
- Observe real host preference sources. On AppKit, use the shared NSWorkspace notification center for display-option changes; do not subscribe to the default center and assume it works. Also handle appearance, window activation, DPI and native-view replacement.
- Invalidate enhancement before the next eligible paint, without waiting for a later semantic Rule turn. Keep the final text foreground, opaque fill, border and focus ring readable. Re-enable only from affirmative current facts and fresh resources.
- Report native-semantic, portable-model, opaque-fallback or unavailable, with source scope and fallback reason. A blur implementation, alpha tint or same-looking screenshot does not earn native or full-glass identity.

## Shared lowering packet, not a new public schema by accident

Adapter and Compiler should consume one versioned lowering decision containing:

- intent/fidelity/model and complete fallback;
- target profile/version/backend and affirmative capability facts;
- live preference revision;
- instance/view/surface identity and final geometry revision;
- bounded source kind, owner, generation and region;
- chosen quality/reason and owned resource obligations.

Generated shaders and AppKit handles remain host implementation details. Wire resources use opaque host-issued handles plus leases, never arbitrary pointer integers/URLs. Validate bounded lengths, finite coordinates, revisions and exact ownership. A packet is publishable only with an implemented consumer and tests; an empty `unsupported` branch is not a finished lowering implementation.

The parallel available-space work belongs to Positioning: a `root-content` usable rectangle lease with logic-space geometry and revision, projected to native layout. Web `visualViewport`, CSS env names and custom property names stay in the Web backend. The GPU material shares final surface geometry, not a second viewport calculator.

## Evidence and performance gates

The existing `.github/workflows/ci.yml` already provides a legal fixed-pin verification route:

1. `rust`: protocol/style tests and Clippy on Linux, plus rustfmt.
2. `rust-macos`: the full existing GPUI workspace and feature-gated `accesskit_macos` real-window test, with a nonzero-result check.
3. `rust-interop`: real Node peer versus GPUI host, each ignored T0 suite explicitly enabled and checked for a nonzero result.

The local cloud workspace has no Cargo/rustc/rustfmt. That is a local limit, not proof that native verification is unavailable. Authorized project changes should run through the existing repository CI after the single Finf owner integrates them. Existing lockfile/pin remains unchanged; no new toolchain or third-party fork is executed here.

For native material evidence, record OS, GPU, backend, driver, scale, display refresh, dimensions, source/candidate SHAs and artifact hashes. Measure baseline, opaque fallback and enhanced output on the same host. Capture CPU frame work, GPU material pass time when supported, p50/p95/p99 frame time, missed frames, texture bytes, allocations, source-copy count and resource release after repeated attach/detach. Present budgets as engineering targets pending measurement, not invented passes. A 60 Hz total frame has 16.67 ms, a 120 Hz frame 8.33 ms; material has only its agreed share of that budget. A reasonable first fixture target is at most one source capture per group, zero steady-state allocations/readbacks, and no unbounded growth over repeated transitions; actual numerical time acceptance must be reviewed with measurements.

A material benchmark must include 1, 8 and 32 surfaces, large and small radii, moving backgrounds, resize/DPI changes, scrolling, grouped overlap, device/source loss and preference toggles. Disable the optical stage in a negative control while preserving semantics. Adaptive native material and explicit self-implemented Liquid Glass have separate intent, identity and evidence; no pixel-equivalence claim is inferred.

## Unfinished acceptance checklist

- [ ] Reconcile #822 and finish full input/focus/ordering/IME behavior.
- [ ] Complete every Base identity on the native host with actual capability evidence.
- [ ] Complete Label→all five admitted targets and their styled projections.
- [ ] Implement Scroll, Overlay, Boundary, Positioning, usable-space and hit-participation native capabilities.
- [ ] Close the style/value/SVG/image/text/native-A11y gaps through rendered evidence.
- [ ] Execute Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass projections at the same semantic/visual level.
- [ ] Implement and test live theme/accessibility preference sources.
- [ ] Implement portable owned-scene GPU material with source-loss and optical negative controls.
- [ ] Implement and test adaptive native blur/material, including an Apple content island when selected; do not substitute NSVisualEffectView or a sibling blur.
- [ ] Complete shared Adapter/Compiler native lowering and run generated native output.
- [ ] Deliver native gallery/demo packaging, SHA-bound visual/performance evidence and honest profile/admission documentation.

## Primary sources inspected

- [Pinned GPUI scene](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/scene.rs), especially `Primitive` and `PaintOperation`.
- [Pinned GPUI wgpu renderer](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui_wgpu/src/wgpu_renderer.rs), shader/pipeline inventory.
- [Pinned macOS window](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui_macos/src/window.rs), `WindowBackgroundAppearance::Blurred` and raw window handle.
- [Apple AppKit WWDC25](https://developer.apple.com/videos/play/wwdc2025/310/), content ownership and group sampling around the glass section.
- [NSGlassEffectView](https://developer.apple.com/documentation/appkit/nsglasseffectview) and [NSGlassEffectContainerView](https://developer.apple.com/documentation/appkit/nsglasseffectcontainerview).
- [Apple adoption guidance](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) and [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials).
- [NSWorkspace display option notification](https://developer.apple.com/documentation/appkit/nsworkspace/accessibilitydisplayoptionsdidchangenotification).

No copied upstream implementation or third-party execution is part of this record. Public source facts, proposed architecture and measured evidence remain separate.
