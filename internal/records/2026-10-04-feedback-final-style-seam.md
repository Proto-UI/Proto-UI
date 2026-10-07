# Private post-patch visual-consumer seam

Date: 2026-10-04. Non-normative increment of #809 / #793 / #792.

The source-only experiment at `2638b696dc45552c019676056027dc6f4bae1ee5` did not connect its material declaration to Feedback or any rendered host. This increment adds one private seam inside the existing Feedback module, without claiming that the complete material transaction is now implemented.

## Implemented boundary

`FINAL_STYLE_SINK_CAP` receives immutable final style inputs after the recorder's setup and Rule contributions, runtime patch, suppress and clearPatch. Structural commit replay and fresh-view replay use that same path. When this capability is present, Feedback does not also queue or flush legacy style output. Without it, existing EffectsPort behavior remains the projection path.

Each input carries a view epoch and monotonically increasing revision. The capability owns its view's complete future visual projection. Replacement, detach and terminal disposal retire the old consumer exactly once. A failed projection retains its exact input for retry; a new logical change or view supersedes that retry. Terminal logical cleanup runs even if retirement throws.

This seam is private and is not re-exported by the Feedback package. No current Adapter installs it. A consumer still has to resolve style provenance, material ownership, shared geometry, complete fallback and resource support before it can commit any enhanced frame. Forwarding selector tokens preserves evidence but does not establish complete runtime provenance or inhibit selector lowering.

## Evidence and limits

The focused tests execute the real Feedback module and capability vault. They cover final post-patch input from each entry point, exclusive sink routing, snapshot immutability, monotonic revisions, replacement replay, detach/remount, terminal disposal, projection-failure retry and throwing resource retirement. They are logical boundary evidence, not rendered UI evidence.

The first new test run used a matcher unavailable in the repository's Vitest version; equivalent call-count and argument assertions corrected the test-only failure. Existing source-specializer and Feedback resolver coverage remain separate from GPU execution.

Local checks on the candidate: 39 Feedback tests (including eight new sink tests), nine source-specializer tests, workspace TypeScript, formatting and whitespace checks passed. The full Runtime runner's non-browser phase passed 2,913 tests in 523 files, with 34 existing todo cases and three skipped files. The browser phase is not included in that pass count. Its first attempt failed before browser execution because Astro could not create its default telemetry configuration directory. A retry uses a writable temporary configuration path and disables telemetry; its browser result must be reported separately.

## Required continuation

1. Bind the finite Prototype material declaration and its existing Base semantic state inside the module/runtime path, rather than a permanent external state subscriber.
2. Retain or inhibit relevant Rule selector lowering, resolve style-owned final geometry once, and provide complete foreground/fill/preferences/source facts.
3. Install a reusable capability-admitted host consumer with real source/context loss, stale generation, remount and atomic paint tests.
4. Render the approved fixed upstream shader against owned test content and capture pointer/keyboard transitions bound to the actual resulting commit.

The unchanged GLSL ES100 source is a backend-specific source result. This seam is backend-neutral; it does not supply Vulkan/SPIR-V, WebGPU, GPUI, Flutter or Qt shader conversion, pipeline support or cross-engine visual equivalence.
