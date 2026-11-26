# Finite refractive material intent: draft decision packet

Status: experimental draft direction with a private, unexported resolver candidate, 2026-10-03. Refs Proto-UI/Proto-UI #793, #792, #802, #719, #726. Current accepted implementation baseline is main bc5acfd. No active Base guarantee is amended. The terminal outcome still includes group/morph dynamics, all 106 Base projection targets and actual Adapter/Compiler specializations across the requested hosts; the first implementation slice is only a single surface.

## Source conflict investigation

- `packages/core/src/spec/feedback/style.ts` defines only `{kind:'tw',tokens:string[]}`; `isTemplateStyleHandle` explicitly rejects other kinds.
- `packages/core/src/spec/feedback/recorder.ts` validates, semantically merges and patches token groups. It cannot retain typed material values or resources today.
- `packages/core/src/effects/types.ts` and the four `packages/adapters/*/src/runtime/effects-port.ts` implement final style queue/flush without structural rendering.
- Draft `C-FEEDBACK-STYLE-0003` explicitly requires author token sets; `C-RULE-INTENT-FEEDBACK-STYLE-0001` prohibits expanding their language through Rule intent. An arbitrary `url(#...)` token or a new unvalidated `StyleHandle.kind` would conflict with these contracts.
- Draft `HC-FEEDBACK-STYLE-SINK-0001` governs final style queue/apply and view ownership. Its current EFFECTS_CAP does not implicitly authorize a material resource channel.
- `native/gpui/crates/proto-ui-host-protocol/src/wire.rs::ProjectionTransaction` currently contains template/slots/events/focus/a11y and no root style or material. #719 root Feedback and #726 reconciliation remain real dependencies; a Rust map unit test cannot establish a prototype-to-paint path.
- #801 preferences and alpha/4px-blur support facts are separate, bounded inputs. Neither proves refractive support. No optical capability defaults to true from `CSS.supports`.

## Proposed closed author grammar (names provisional)

A separate `feedback.material` visual subsurface, a new final-result sink, and a separate Rule intent. Existing `feedback.style` behavior remains unchanged. A value contains:

- `version: 1`, `kind: 'refractive'`
- `fidelity: {kind:'native-semantic'} | {kind:'portable-model', model:'heightfield-v1'}`
- `variant: 'regular' | 'clear'`
- `shape: {kind:'rounded-rect', geometry:'shared-style-geometry'}`. Radius has one source: the final authored style geometry, resolved once into the current view's bounds/radii and used for both the outer surface and material clipping. There is no second material-only radius. Unknown/incompatible geometry is diagnosed rather than silently clipping a different shape. No arbitrary path, CSS text, texture URL or shader program.
- `phase: 'rest' | 'pressed'`; author Rule binds existing Base pressed/disabled state. A host must never invent press state or dispatch another activation.
- `anchor: 'center' | {x:number,y:number}` with finite normalized [0,1] coordinates when a separately admitted local input source exists. Until that source is accepted, only center is admitted; do not smuggle DOM PointerEvent into the prototype.
- `toneRole` and `fallbackFillRole` from a closed source theme palette. Values are author intent; no arbitrary host style strings.
- `motionPolicy: 'reduce-safe'` and `fallbackQuality: 'opaque'`. Unknown preference/support/source loss selects opaque immediately. A future standard-translucent fallback must be distinctly reported, never silently called equivalent refractive material.

Numeric optical model constants and spring constants are versioned implementation/profile data, not claimed Apple private parameters. Native-semantic lowering can use documented native Glass APIs without promising numeric equivalence. A strict portable-model request cannot silently become native-semantic; report unavailable or explicit coarsening requiring author opt-in.

The selected draft uses one declared slot with mutually exclusive complete candidates. Exactly one valid candidate may enhance; zero active candidates retain the slot and show fallback. Multiple or invalid candidates select fallback plus a diagnostic without choosing a winner. Slot removal is a distinct explicit tombstone that releases material ownership and restores current legal style. The private resolver implements these data rules only; author/Rule wiring remains unimplemented.

## Experimental draft ownership direction accepted for the next slice

The current attended review selected the following direction as an experimental draft, not a stable guarantee. Background paint is the real intersection with existing style ownership. An opaque `bg-*` above a material can hide it even when a host shader exists:

1. Material owns the surface fill/backdrop/optical coat and its explicit opaque fallback; ordinary style continues to own geometry/layout, foreground text and border.
2. A prototype that simultaneously assigns an ordinary background fill and an active material fill is rejected with a clear conflicting-fill diagnostic, rather than silently changing existing style precedence. This check covers only observable Proto-authored intent, including an explicit instruction that relinquishes a previous owned fill. It does not claim to statically prove that arbitrary external host CSS cannot obscure the effect.
3. Fallback fill is carried by the same material result, so resource loss does not depend on a later Rule turn to restore readability.
4. Style and material projection for one generation commit atomically; no intermediate transparent paint or double fill during old opaque→material transition, source loss, fallback or recovery. This requires an explicit final visual-result transaction, not two unrelated async setters. Shared geometry/radius is validated in the same transaction.

An alternative is one new typed branch inside an explicitly revised visual-style IR, but that changes the current token-only contract more broadly. The narrower separate-material direction is selected for drafting; precise conflict/removal and transaction semantics still require explicit catalog/test review before implementation. The first family consumer must use its existing Base semantic owner and not add a new button implementation.

## Host resource lease and coordinate contract

The prototype never acquires or reads backdrop pixels. The Adapter/compiled backend owns an opaque lease:

- provider/scope identity, instance identity, view epoch, active generation
- current host bounds/rounded clip; viewport-to-sampling transform; DPR
- source kind: browser-compositor-backdrop-root, native-compositor-scope, or explicitly application-owned texture
- profile/color space/alpha mode, frame identity and freshness when texture based
- maximum displacement plus scatter sampling margin; no self-capture or glass-on-glass feedback

Only the active provider/generation may publish a completed field/texture. Resize, DPR/coordinate changes, source replacement, detach, dispose and a newer target retire old work before it can paint. Dispose removes owned filter nodes/URLs/textures/listeners/frame callbacks and restores unrelated host presentation. Lost/stale source switches the complete output to the authored opaque fallback in the same transaction. Reacquisition does not replay obsolete animation targets.

`requestFlush` never invokes prototype render or changes semantic structure. Host-private rendering primitives are translation artifacts. A quality observation distinguishes native-semantic, portable-model, opaque-fallback and unavailable, with an explicit reason. A CSS syntax probe is necessary filtering at most; an unproven engine/profile remains unavailable.

## Dynamics and eventual group/morph extension

The first portable model preserves current geometry, velocity and target while retargeting press/release. Cancel settles or freezes under one declared policy, invalidates the prior generation and cannot later resurrect a queued press. For the first conservative profile, ReducedMotion selects opaque fallback, consistently with the current family policy. A future static-refraction policy would require an explicit profile revision, not a silent relaxation. Native semantic mode can use native interaction affordances, with truthful fidelity bounds.

The full outcome requires a later same-scope group primitive and persistent effect identities: shared sampling region, union field sampled once, press anchors, source-to-target morph mapping, foreground transition and continuous optical thickness. This must not be faked with two overlapping per-node filters or a teleport followed by scale/fade. All future geometry and normals derive from the same per-frame field.

## Adapter and Compiler implementation lanes

- Web: current real Chromium carrier/2D marker evidence permits a version-bounded experimental backend. Adapter creates the private SVG resource and installs source-generated model/CSS; it does not ask authors for filter IDs. Other engines remain unsupported until the same physical probes pass there. Runtime and compiled paths must share a normalized intent and independently prove actual pixels/lifetime.
- SwiftUI/AppKit: documented Glass APIs are a native-semantic specialization. Strict numeric profile mapping is unavailable unless a separate custom-render path is implemented. GPUI's macOS window integration with NSGlassEffectView is a proposal, not existing support.
- GPUI: source-data #798 is independent. Root Feedback #719 plus a real compositor/owned-frame or native-semantic integration is required. No unsupported fields are dropped. A new material transaction requires protocol negotiation and malformed/unknown-vector tests.
- Flutter: target-specialized Dart plus the permitted shader/image-filter path on actual Impeller; explicit diagnostics for unavailable backends. No current repository implementation is claimed.
- Qt: target-specialized QML/C++ and QSB resource for an explicit scene subtree; software renderer/absent texture are unavailable. No arbitrary desktop capture.
- Compiler output is backend-specific code/resources from finite IR. It may call documented platform APIs or generated numeric kernels; embedding a CSS interpreter is not AOT. General compiler admission remains separately governed under #732/#733.

## Falsifiable first-slice tests

1. Closed grammar rejects NaN/Infinity/out-of-range coordinates, unknown fields/models, arbitrary URLs/shaders, incompatible fidelity and conflicting fill ownership.
2. Same real Base Button prototype drives rest/press/disabled exactly once; material transitions produce zero structural renders and never extra activation.
3. Missing/false/unknown host support and any unsafe/unknown preference render the explicit opaque fallback. Native/emulated preference changes restore/revoke on retained instances.
4. Exact engine/profile uses real DOM backdrop: non-periodic x/y markers for +/0/- displacement; only-blur negative control; live source changes; resize/scroll/DPR; rounded-corner outside-mask pixels. Foreground is excluded from carrier ROIs.
5. Real stylesheet/resource removal proves that support metadata alone is insufficient. Old generation completion, detached callbacks, stale texture and missing theme palette cannot keep claiming enhanced output.
6. One generation atomically applies style+material; replace/dispose/rebind releases every owned resource and preserves unrelated presentation.
7. Press interrupted by release/cancel/second press retains current state/velocity. Explicitly record the actual interruption phase; the existing experiment's screenshot-latency cancellation near end state is not sufficient evidence.
8. 30/60/120 Hz bounded model clocks converge; ReducedMotion removes overshoot; pathological time gaps cannot explode. Finite poses get numerical map/Jacobian tests, but mathematical tests do not replace rendered quality review.
9. Adapter versus compiled target receives the same canonical IR and semantic event trace. True compiled artifact has a manifest of specialized resources and no generic runtime CSS parser; compare actual geometry/paint/diagnostics on each admitted backend.
10. Independent matched-control visual review and the user's stated acceptance remain required. A green pixel-difference assertion does not establish resemblance to Apple's Liquid Glass.

## Private resolver candidate and evidence limits

The first code lives only in `packages/modules/feedback/src/material/visual-result.ts` and is not re-exported, connected to current Feedback flushes, or installed into any host. `material-visual-result.test.ts` currently has 26 focused passing tests. Existing Feedback catalog-boundary tests also passed, and a standalone strict TypeScript check passed on the complete resolver candidate. Independent source review is still required.

The input explicitly carries post-patch normalized paint contribution provenance. The resolver does not claim to construct that provenance from current Rule optimization: `rule-expose-state-web` can remove a pure style Rule after lowering it to selector tokens. Runtime/optimizer integration must retain or inhibit that path before any host admission. All material-related checks must occur after runtime patch/suppress/clearPatch.

A retained material slot strips its normalized competing paint contributions and emits explicit `clearPaint` for fill/background-image/backdrop/coat. A slot tombstone instead retains current legal style and relinquishes material ownership. The resolved fallback foreground must equal the final style foreground, avoiding a second text owner. Missing/nonopaque fallback colors reject the input before candidate resolution rather than inventing an unreadable fallback.

The private candidate admits only one closed portable heightfield-v1/center-anchor shape profile. Native-semantic fidelity and richer author grammar in the proposed design remain unimplemented. Logical geometry uses finite positive dimensions, radius clamped to half width/height, axis-aligned transforms, DPR 0.5–3 and at most 1,048,576 device pixels. These provisional profile limits bound work; they are not universal host or quality guarantees. No texture is allocated by the resolver.

The pure transaction gate separates target generation, source lease generation, view lifetime, surface identity/binding incarnation, geometry revision and frame sequence. Source replacement or geometry/surface retirement first publishes a complete fallback before preparing new resources. It retains an existing complete same-source result during ordinary target preparation, commits the replacement before releasing the old owned resource, and discards stale completions. Source loss and dispose revoke publication rights first. Reentrant source loss during a host callback, old source-generation recovery, and the first-preparation transparent gap were each observed as failing unit cases before repair. The callback is a logical boundary only: existing React state/Vue refs are not thereby proved atomic paint.

The complete T entity stays draft/planned because its admission cases include actual Runtime, source/provider, native/Compiler and host atomicity evidence that these pure tests cannot supply. No passing unit count promotes those integration cases.

Fresh independent source review found additional pure-model bugs before publication: duplicate successful completion released the still-current lease; failed re-commit could release a restored owner; new targets admitted an older same-lease frame; old surface binding admission lacked an incarnation; sparse color/style arrays and forged snapshots bypassed validation. Each now has a regression. Complete snapshots are deep-frozen and admitted only through a private resolver provenance brand. Source/view frame ordering is independent of target changes; surface rebinding requires a new binding revision. Reentrant failed fallback never restores a revoked resource. These logical guards still do not establish physical host painting after an actual backend failure.
