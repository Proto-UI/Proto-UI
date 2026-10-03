# Pinned liquidGL whole-backend baseline

Status: the owner authorized this pinned, isolated browser baseline on 2026-10-03. Source preparation is complete; no execution, screenshot or visual acceptance is recorded yet.

The candidate is [naughtyduk/liquidGL 3.0.0 at 88f681a](https://github.com/naughtyduk/liquidGL/tree/88f681ab7035fd55b04f63edff1841e32c4199e9). `vendor/liquidGL.js` is the unmodified `scripts/liquidGL.js`; `provenance.json` pins its exact Git blob, SHA-256 and byte length. `vendor/LICENSE` preserves the complete MIT text and its asset exclusion. No upstream demonstration asset is included. This directory is not a public package or a production Adapter.

## Proposed bounded run

- A temporary GitHub Actions Ubuntu runner, official Chromium, empty browser context and loopback-only owned fixture; no authenticated pages, personal cookies, service credentials or production deployment
- Reuse the repository-locked Playwright toolchain and official video utility; the vendor script has no package runtime dependencies. Do not load the upstream helper or third-party scrolling libraries
- Permit the audited script's inline blob Worker and ordinary GPU APIs, without unsafe browser feature flags; record the selected actual WebGPU/WebGL/CSS/no-backend result instead of forcing a passing renderer
- Block non-loopback browser requests, forbid connections in the fixture CSP, and load no remote images/fonts/video. Use only our text, numbered marker lines, color blocks and locally generated imagery
- Test a single capsule and larger surface, then two lenses sharing a renderer. Observe optical controls at fixed geometry and pointer movement. Measure reconstruction freshness separately. Shared stacking is not shape fusion; neither the baseline nor its screenshots establish Base semantics or a portable Prototype
- Compare default optical parameters against explicit no-refraction/no-bevel controls. Retain outputs even when a negative control or cleanup assertion fails. Pixel change proves effect presence only, not Apple fidelity
- Capture evidence and pure recording in separate browser contexts with the same source/viewport; no locator screenshots during recording. Record source SHA, upstream hash, Chrome/Node versions, backend, elapsed frame samples, viewport, source class and all errors
- Exercise individual destroy, last-lens destroy, repeated destroy, interrupted preparation, resize and re-create. Record actual effects on style, shared renderer, workers, callbacks and GPU resources. Public `destroy` availability alone is not cleanup proof

## Source inspection findings before execution

The following are observations of this exact source, not executed behavior:

1. `liquidGLLens._activate` captures selected original inline styles, then sets `pointer-events: none` for a non-draggable lens (upstream lines 7890–7940). This would conflict with using the same node as a Base Button event owner. A later Prototype backend must separate its decorative surface from the semantic input owner and prove pointer, keyboard, focus and accessibility behavior. This whole-backend baseline does not silently repair the vendor.
2. `destroy()` sets `_destroyed` first and restores captured paint/pointer styles plus changed interaction styles (7854–7882). `restoreStyles` retains the original inline values and priorities (36–58), so removing an injected inline property can expose an existing stylesheet value. The claim still needs browser tests, including styles authored after initialization and unrelated properties.
3. Removing a lens clears associated caches across renderers and retains a renderer while other lenses remain (5904–5924). Final renderer destruction terminates its Worker, revokes its blob URL, removes its canvas/styles, destroys cached backend resources and switches the global representative (5927–5970). Shared global scheduling/video cleanup happens only after the last renderer. These are explicit test targets, not established leak freedom.
4. The dynamic Worker is constructed from an inline constant string and receives owned bitmap data (5609–5648). Resource-loading helpers can create `Image` requests for scene URLs (486–503); the fixture therefore blocks external requests rather than inferring that absence of `fetch` means absence of network effects.
5. Draggable mode changes cursor/touch-action and transform; pointer-down calls `preventDefault` and tracks one pointer ID, using window move/up/cancel listeners (8108–8199). This path does not call `setPointerCapture`; destroy conditionally releases capture if already present. Do not claim native capture ownership or Base event compatibility from this source.
6. Ordinary fluid movement reads captured window pointer events and tracks pointer velocity (6480–6609). It is not documented here as press-only elastic behavior, shared SDF fusion or button-to-menu morph.
7. Input is a rasterized/reconstructed scene, with a 250 ms recapture constant and separately registered dynamic media/elements. Shader language and successful GPU creation do not make it compositor-live DOM sampling.

## Acceptance boundary

The first result is an isolated upstream visual/ownership baseline for comparison. It cannot be used as evidence that Proto-UI has a material Adapter, graph compiler, all-family projection coverage or an accepted Apple Liquid Glass appearance. Scope and native backend work remain in #792/#793; graph modeling is #806.

## First executed baseline and fixture repair

Head d425c1c8 / run 37144522909 used Chrome 154 and the WebGLBackend at 760×770. The optical control changed 5979 pixels in the fixed large-surface ROI, while both pointer-transparent surfaces restored `pointer-events: auto` on destroy and the final canvas/style elements were removed. These are bounded observations, not visual acceptance.

The actual images exposed an ownership mistake in our fixture: its isolated stacking context trapped the foreground captions below the vendor's body-level canvas. Removing that isolation puts the authored foreground above the canvas; a paired visible/hidden caption pixel test now checks actual paint. The decorative scene also disables text selection during recorded pointer movement. The vendor bytes are unchanged. The first recording's dynamically registered moved text left a visible double image; that reconstruction/freshness failure remains unresolved and must not be described as a successful live update.
