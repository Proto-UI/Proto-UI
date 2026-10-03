# Draft ADR: semantic effects above a typed pass/resource graph

Date: 2026-10-03. Status: experimental architectural direction, not a stable Base contract or an implemented renderer. Refs #793, #792 and the private ownership prerequisite #804. The current single-surface test profile is not the framework's permanent expressiveness ceiling.

## Decision to evaluate

Use three layers:

1. **Semantic presets and interaction intent.** Component authors choose a material/effect, quality/fallback policy, shared geometry/group identity and semantic state bindings. Existing Base state remains the interaction owner.
2. **Typed effect graph.** Explicit sources, resources, ordered passes, typed bindings, coordinate/color/alpha contracts, cache invalidation and lifetime requirements. The compiler can inspect dependencies, validate interfaces, plan resources and specialize each target.
3. **Audited target kernel modules.** Immutable, provenance-addressed GLSL/WGSL/Flutter fragment or host-native implementations with declared interfaces and target requirements. A portable kernel AST or existing IR is an evaluation question, not a new shading language assumed to exist.

The current token-only `feedback.style` channel cannot express the reviewed multipass requirements. That identifies a missing extension point; it is not a reason to prohibit the user's requested shader/effect capability. Conversely, arbitrary shader text attached to a DOM wrapper is not portable Prototype semantics.

## Evidence and initial data-model falsification

`experiments/effect-graph/studio.json` and `flutter.json` represent pinned upstream pipelines as plain serializable data. They include module identities, source kinds, output formats, read/write edges, uniform/data interfaces and explicit unknowns. No upstream shader, rasterizer or demo asset is copied or executed.

`model.test.mjs` currently exercises fifteen cases: both positive source models, dependency/cycle/self-read negatives, raw host-object/callback escape negatives, missing resource contracts, mixed ABI overlap, bounded Flutter geometry input, source-class mismatch and separation of structural validity from execution/license admission. The inspector is a falsification aid, not a complete production validator or GPU security proof. Every inspected graph reports `execution: not-admitted`.

### Studio: four passes

Pinned repository: [iyinchao/liquid-glass-studio at f7b28c3](https://github.com/iyinchao/liquid-glass-studio/tree/f7b28c36305a862f5cffed3ddd51511cf1204f56).

The real [App graph](https://github.com/iyinchao/liquid-glass-studio/blob/f7b28c36305a862f5cffed3ddd51511cf1204f56/src/App.tsx) is background → first separable blur → second separable blur → main. Main reads both the sharp background and final blur. [GPUUtils](https://github.com/iyinchao/liquid-glass-studio/blob/f7b28c36305a862f5cffed3ddd51511cf1204f56/src/utils/GPUUtils.ts) supplies RGBA16F/rgba16float intermediate resources and a 160-byte mixed f32/i32 main uniform block. WebGL attaches a depth buffer; the WebGPU helper allocates a depth24plus texture but its render-pass/pipeline does not use a depth attachment. Their optical necessity is unproven.

The WGSL blur really uses a **read-only storage buffer** for its bounded 201-weight array. Flutter cannot consume that SSBO unchanged: a proven bounded-uniform specialization or an unavailable diagnostic is required. This does not justify unrestricted writable storage, compute or atomics. WGSL and GLSL blur filenames do not establish matching sampling axes; variant mapping must retain the actual source behavior and be checked before parity claims.

The background is procedural or an application-supplied image/video texture. It is not a live arbitrary DOM backdrop. The upstream WGSL path specializes the STEP9 effect, not every GLSL debug mode. Both background and main import the SDF and share its unresolved IQ-function provenance, which is still an execution/import gate; structural modeling neither resolves that license nor authorizes copying its shader modules.

The background pass also bakes geometry-dependent shadow: geometry/morph/pointer-spring changes invalidate it and its downstream blurs, not just the final pass. Both background/main explicitly reference the common 160-byte uniform block; both blur passes reference their 16-byte block.

### Flutter: cached geometry plus real compositor input

Pinned repository: [sdegenaar/liquid_glass_widgets at c35d7e1](https://github.com/sdegenaar/liquid_glass_widgets/tree/c35d7e115a52e05389dd8d98c6b32d4582931c33).

The core model captures [geometry precomputation](https://github.com/sdegenaar/liquid_glass_widgets/blob/c35d7e115a52e05389dd8d98c6b32d4582931c33/shaders/liquid_glass_geometry_blended.frag) with 16 shapes × 7 float values and a [render pass](https://github.com/sdegenaar/liquid_glass_widgets/blob/c35d7e115a52e05389dd8d98c6b32d4582931c33/shaders/liquid_glass_render.frag) consuming the live compositor backdrop at sampler 0 plus geometry data. The geometry channels encode normal XY, normalized height and SDF coverage. Its physical `ui.Image` storage/precision is not asserted to be RGBA8 or RGBA16F; preserving those channels is a provider obligation requiring execution evidence.

The default premium path uses live `BackdropFilterLayer`/`ImageFilter.shader` under Impeller. The captured-image path is deliberately unmodeled here: upstream bypasses the live BackdropFilterLayer and draws directly, so admitting it requires changing pass kind and manual size/sampler ownership as well as source, transform and freshness. Skia/Web and PlatformView limitations remain separate. The geometry matte follows two-logical-pixel margins, a dynamic DPR/pixel budget and uses FilterQuality.medium resampling; geometryLocalBounds, matteTransform and the enclosing compositor rect are explicit frame inputs, not unrelated IDs. The render size at float slots 0–1 and background sampler 0 are host-owned. The two-pass core pins uFrost to zero while deliberately leaving optional backdrop blur, frost weighting/row compositing and foreground stages as named unmapped extensions; it is not a model of the entire widget suite.

The existing MIT chain includes Tim Lehmann and Sebastian Degenaar and requires retaining the complete copyright/license and third-party notices when code is imported. Separately, this project requires an upstream pin and local modification record; that is not an invented additional MIT term. This packet contains metadata/interface facts only, not copied kernels or assets.

## Source capability is independent of shader language

These must stay distinct:

- host compositor backdrop within an authorized scope
- application-owned image/texture
- application video frame
- explicitly captured application scene
- reconstructed/rasterized DOM scene
- a prior pass output

No language translator can manufacture live DOM sampling, OS/window capture, cross-origin access or a native Apple material. A reconstructed scene never silently satisfies a live-backdrop requirement. Source acquisition belongs to the Adapter/backend, with provider/scope, view and binding identity, coordinates, color/alpha, freshness and disposal. Prototype IR contains symbolic references, not DOM/GPU objects or readback callbacks.

The current liquidGL candidate uses page reconstruction and ordered lower-output/stack/shadow inputs; its whole backend is a separate benchmark candidate. Its scripts/package MIT scope excludes demo assets. Any later adaptation must preserve this source distinction and license boundary.

## Graph obligations before implementation admission

- **Interfaces:** scalar/vector/matrix/bounded-array types; data versus color textures; sampler/format/filter/alpha requirements; target reflection, not comments alone, determines packed ABI.
- **Dependencies:** explicit read-after-write and copy/composite edges, no implicit feedback from a currently written target. Cached geometry remains valid by its dependency revisions; caching is not an unrestricted historical simulation input.
- **Coordinates:** logical/physical pixels, normalized UV, local/group/capture/viewport spaces, orientation and transform revisions. Unknown mapping cannot be guessed from uniform names.
- **Resources:** finite pass/shape/sample limits, extent plus sample margin, byte/texel budget, supported formats and deterministic cleanup. Finite loops alone do not establish acceptable GPU cost.
- **Bindings:** references to typed props/state/geometry/clock/pointer/morph outputs. Missing portable atoms become explicit design work; an anonymous host closure is not an acceptable replacement.
- **Lifetime:** distinguish target generation, source lease generation, view lifetime, surface binding incarnation, geometry revision and frame sequence. Newer preparation retires stale work; context loss and unsafe preferences select complete authored fallback.
- **Publication:** one complete visual transaction replaces style/material/resources at the host's actual paint boundary. #804 models the logical ownership rules only; React/Vue timing, commit/release exceptions and actual GPU cleanup require their own tests.
- **Quality:** report missing source, unsupported stage/opcode/format, compile failure, allocation/performance rejection and explicit degradation separately. A syntax check or successful shader compile is not actual material paint or visual quality.
- **Provenance:** immutable upstream commit/file hash, complete license chain, local modifications and generated-artifact notices. Runtime acquisition never downloads arbitrary kernel URLs from untrusted content.

## Language/backend evaluation boundaries

[Naga's supported frontend/backend table](https://github.com/gfx-rs/wgpu/tree/trunk/naga) does not provide a SkSL target. Existing WebGL ES100 source also cannot be assumed to be accepted directly by its limited GLSL frontend. [Flutter FragmentProgram](https://docs.flutter.dev/ui/design/graphics/fragment-shaders) has a restricted fragment ABI, lacks general UBO/SSBO support and reserves inputs for [ImageFilter.shader](https://api.flutter.dev/flutter/dart-ui/ImageFilter/ImageFilter.shader.html). [SkSL runtime effects](https://skia.org/docs/user/sksl/) have their own child-shader coordinate and color semantics. [WGSL](https://www.w3.org/TR/WGSL/) layout, binding and sampling-uniformity rules require real target wrappers.

Initially compare versioned audited target modules and a restricted shared numeric/kernel representation using actual upstream kernels. Do not invent a universal source language first or rename packaged Runtime/Rule/CSS interpretation as AOT. A finite material backend specializer is still narrower than the full Prototype props/events/lifecycle Compiler path.

GPUI's actual root Feedback transaction and sampling/native-material extensions remain required; Flutter and Qt need real repository backends and executed conformance. These graph models do not establish any of them. Native Apple semantic material is a distinct possible specialization, not a numerically identical lowering of an open-source shader.

## Next reversible experiments

1. Have source reviewers compare both data models to the pinned pass/uniform/source code and identify missing semantics. Any need to insert a host object or anonymous shader string is a model failure.
2. Select exact upstream files and their complete license/NOTICE chain before importing. Benchmark liquidGL as an isolated whole backend with owned assets; examine Flutter optics/physics as separable modules.
3. Compile one admitted graph into actual WebGL2/WebGPU artifacts and one supported Flutter fragment profile. Verify ABI, pass order, resource lifetime, geometry/color bounds and source identity using positive and negative controls.
4. Build a real Base-derived Prototype consumer and separately verify Adapter and target-specialized Compiler output. Add group/morph and all requested Base parts without using this first graph slice to narrow the terminal goal.

All GPU compilation, real source acquisition, rendering, performance and visual resemblance checks are currently unrun for these data models. The existing rejected optical experiments remain history, not evidence that this architecture is accepted or implemented.

Independent source/model review exposed real omissions before publication: background motion invalidation and its shared license gate, detached uniform-block inventories, unprepared Flutter frost, captured-mode pass/ownership differences, matte DPR/resampling and unused WebGPU depth allocation. These were corrected without importing shader code. The strengthened negative cases reject missing producers, writes to external inputs, missing array bounds/block sizes, invented uniform types, omitted-feature enablement and forged host sampler ownership. This improves the inspected core models; it does not convert the inspector into a complete admission/security validator.

Final source-fidelity review found two further coordinate preconditions in the live Flutter core. The stored local geometry bounds are transformed into screen-logical coordinates, then multiplied by the screen device pixel ratio and localized by subtracting the enclosing screen-physical pass origin. The matte raster DPR controls texture allocation/resampling, not screen positioning. `uCaptureOffset` is fixed to zero in this live-only model; a captured-image path cannot supply an arbitrary offset without its separately modeled pass/ownership contract. The fifteenth test retains these distinctions and rejects enabling the excluded captured offset.
