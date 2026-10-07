# Semantic material declaration and private WC host candidate

Date: 2026-10-04. Draft increment of #809, #793 and #792; no stable admission.

The owner clarified that Prototype language must stay above renderer internals so compilers can target Vulkan, WebGPU, GLSL and explicitly degraded CSS. This candidate therefore removes the renderer preset, texture source class and binding map from the Prototype. Its finite declaration names material, shape, sampling relationship, complete fallback and Button interaction semantics. The existing finite WebGL kernel is a backend implementation choice, not the upper bound of the author language. This does not promise arbitrary graphical equivalence across targets.

## Actual path

`Prototype.modules → Feedback-owned Base state observation → post-patch style/material frame → WC consumer → private fixed-source program/resource realization`.

Relevant fill/geometry/text Rule contributions remain evaluator-owned rather than becoming invisible selectors. Final shared geometry is read after the actual style projection; the emitted writer takes its radius from that frame instead of a material-only declaration. The opaque fill is authored; `fallback.foreground: style` explicitly resolves the final style-owned text role before candidate selection. An unresolvable, nonopaque or insufficient-contrast fallback rejects the whole material projection and restores the original complete ordinary style with an unavailable diagnostic; it does not leave a partial fallback fill. Generic WC without a GPU consumer explicitly produces opaque CSS fallback and a loss reason. It loses refraction, scene sampling and optical press effects.

The GPU host is reusable and separate from the test page. It uses bounded owned RGBA pixels, no DOM capture or remote URL. All unchanged upstream shader bytes and complete MIT/asset-exclusion notices remain in generated output. Feedback owns subscriptions to Base's internal semantic state handles; the host does not subscribe to an externally exposed Button state or invent input. The browser fixture uses the real WC Adapter and ordinary physical pointer/keyboard input.

## Validation status before real-browser CI

- Workspace TypeScript passes.
- Nine source/ABI tests pass, now also asserting low-level renderer terms are absent from Prototype data and Base state reaches Feedback material frames.
- 83 focused files / 306 tests pass across Feedback, Rule lowering and WC, including five new actual WC integration tests for Base state, explicit CSS fallback and selective Rule retention.
- The browser bundle and source-derived token stylesheet build successfully. An initial choice of unsupported `rounded-3xl` / `text-black` was replaced with supported `rounded-full` / `text-foreground`; no page CSS reimplemented these Prototype semantics.
- Real browser/GPU evidence is pending exact-head CI. The local Chromium socket restriction remains a verification limit, not a passed browser result.

The browser evidence job blocks non-test requests and has no account credentials or production deployment. Its generated scene is owned test data. Expected evidence includes actual output change on Base pointer press, activation counts for pointer and keyboard, disabled suppression, injected preference fallback, source/context loss and recovery, and a fresh owner after removal. Its SHA-tagged captures are evidence only after the job executes and the artifacts are inspected.

## Remaining boundaries

The private reference renderer does not establish C-FEEDBACK-MATERIAL or C-VISUAL-TRANSACTION stable admission. Source lease stress, asynchronous transaction preparation, complete style provenance beyond the finite profile, all fallback/contrast cases, full graph compilation, Vulkan/WebGPU/native realization, group/morph/fusion, and all-family public projections require further evidence and implementation. The existing private heightfield resolver is not relabeled as equivalent to the distinct liquidGL reference optics.

## Opt-in semantic implementation and measured cost

The initial local host candidate `61bbb99dfa1ea11dce256806b99f50d13ed4d029` still statically included material validation/binding in every Runtime. A following increment moves that implementation behind a private framework factory capability. The WC profile provides the framework implementation only when a material declaration is present. Feedback itself still creates, owns and disposes semantic observation; this is not an Adapter/external state subscriber. Plain Runtime, React and Vue bundles exclude the finite material implementation, checked through four esbuild metafile negative/positive controls. No renderer function or callback enters Prototype data.

Same-toolchain gzip measurement (Node 24.19.0, zlib 1.3.2.1-motley-3246f1b, esbuild 0.25.12, Linux x64): source `2638b696` → seam `958b743f` → initial host `61bbb99`: Runtime 66,620 → 66,976 → 67,857; React 87,180 → 87,562 → 88,454; Vue 86,900 → 87,265 → 88,161; WC 90,337 → 90,728 → 94,940. The opt-in split reduces the initial host Runtime/React/Vue by approximately 600 bytes each, at the cost of a small WC factory bridge. Current thresholds are unchanged and Runtime/React/Vue still fail; this remains a separate explicit budget-governance debt. The common sink lifecycle has a real cost even without material. No threshold was raised and no feature was disguised by symbol-only compression.

The first publication attempt for `61bbb99` was rejected because the authenticated OAuth application lacked workflow scope. No alternate identity or connector was used to evade the denial. The owner subsequently completed the workflow authorization; publication is retried only under the same verified identity and the newly granted scope. Authentication material is not part of project evidence.

## Emitted-package integration repair

The successful `9ce6011` GPU job did not make its aggregate package build green. That independent job first failed with TS4058: the inferred `declareMaterial` return type leaked the Core declaration token's private brand. An explicit `PrototypeModuleDeclaration<OwnedMaterialConfig>` return type fixes the declaration boundary. Running the actual WC package build then exposed TS6059 because cross-package relative source imports escaped the package root. These are preserved failures, not dismissed as environment noise.

The repair uses explicitly experimental `internal/*` package subpaths for framework consumption, with source aliases for development and real dist exports for emitted consumers. It does not export renderer fields in Prototype language or promote a stable family/API. The WC/Feedback runtime and capability identities now resolve through their owning package rather than importing another package's source tree. A separate browser mode consumes only emitted package artifacts; its esbuild input list rejects package `src/` paths. That mode requires the actual WC and Base package build, not workspace type-check alone. A first local attempt correctly rejected the missing built Base Button artifact; the workflow now builds both dependency closures before it runs this mode.

The source-only image set from `9ce6011` remains bound to that source. New package-consumer screenshots require their own exact-head run. Bundle budgets are still unchanged and failing for the three previously identified whole-entry cases.
