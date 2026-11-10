# Documentation diagram design

Honor an explicit visual direction, including a requested hand-drawn treatment, while preserving technical meaning. Handwritten typography and deliberately irregular strokes are code-authored styling unless their actual provenance says otherwise. Preserve font and asset licenses, pin upstream sources, and verify every localized glyph.

Use a diagram to make a relationship easier to inspect than the surrounding prose. Do not add a figure to satisfy a visual quota, or judge its provenance from its appearance. Hand-drawn and precise geometric treatments are both valid; choose the treatment that makes the subject legible and fits the existing publication.

## Establish the meaning before the style

1. Locate the asset, its editable source or generator, all live references, locale variants, theme behavior, and any earlier version being replaced. Distinguish public illustrations, UI icons, sample-image fixtures, and retained historical evidence. Do not rewrite historical captures to make them resemble a new implementation.
2. Write a compact semantic ledger: the question the reader should answer; source paths and entity lifecycle; nodes and their owners; each edge's direction and meaning; ordering or timing constraints; and exclusions. Separate observed facts, editorial examples, proposed designs, and unresolved claims. A picture must not promote a draft entity or invent runtime evidence.
3. Choose a topology for that question. A relation map shows channels; a sequence shows order; a comparison aligns conditions; a responsibility map shows ownership. Do not force every subject into a stack of equal boxes. Visual proximity, enclosure, branches, numbering, and arrows all carry meaning and need the same source review as text.

## Draw only the useful structure

- Give each node one short identity or action label. Place detail in nearby prose, a caption, or an accessible description when it does not need a position in the graph. Remove repeated titles, long sentences inside boxes, redundant arrow labels, and decorations that compete with the relationships.
- Make hierarchy serve meaning. Use enclosure for ownership, alignment for comparison, and a small consistent set of line and arrow treatments. Explain any distinction between sequence, dependency, information delivery, and optional paths. Do not imply synchronous execution merely by drawing two operations on the same row.
- Use space to separate owners and preserve a clear reading route. Avoid crossing edges and ambiguous joins. Color should reinforce a relationship already expressed by geometry and text; it must not be the only carrier of a distinction.
- Prefer editable SVG or code-native diagrams for exact technical content. Edit generated assets through their generator. Keep user-authored layouts and wording unless their replacement is in scope. Do not use image generation to fabricate source labels, topology, measurements, or verification.
- An explanatory illustration is a static document surface. It does not become a Proto UI component merely because it is on the website. Its actual controls, such as an image-preview dialog, must follow their own component and accessibility ownership.

## Inspect the actual output

Render the candidate rather than approving source code or a textual description. Compare it with the baseline and any user-provided reference. Inspect at its real article width and at full-size preview, in light and dark themes, for every changed locale. Check text size and wrapping, clipping, edge endpoints, arrowheads, ownership boundaries, contrast, and whether a reader can answer the original question without decoding a paragraph in every node.

Use the semantic ledger again after layout changes. Confirm every node, label, arrow direction, branch, state owner, and ordering claim; verify that removed text is still available where needed. Keep alternative diagnoses distinct from sequential stages and assumptions distinct from guarantees. Validate accessible text and preserve captions and attribution.

Retain revision-bound before/after captures and generator reproducibility checks. Report the actual rendering tool and its limits: a local SVG rasterizer is useful layout evidence, but is not proof of browser font rendering, article layout, image-preview interaction, or assistive-technology behavior. Structural checks do not replace visual or semantic review. Publication follows the separate authorization and evidence workflow in [visual-evidence.md](visual-evidence.md).

## Collect the composed whitepaper evidence

`whitepaper-diagram-evidence.yml` defines serial capture steps for five explicit profiles: `switch-activation`, `evolution-feedback`, `conditional-consistency`, `component-anatomy`, and `information-flow-model`. The retained information-flow profile opens the canonical chapter 2 comparison through its real details summary; it does not navigate to the retired legacy article. This profile depends on that comparison being present in both locale pages. The runner never substitutes a different image or route when a profile is unavailable.

Use Node 24 and the lockfile's dependencies. Set `CANDIDATE_SHA` to the exact clean checkout's full commit SHA, `CHROME_PATH` to the explicitly identified Chromium executable, and `DIAGRAM_EVIDENCE_DIR` to a fresh absolute directory outside the worktree. Keep separate directories for baseline, candidate and rerun evidence. Run the following serially, preserving command output and any failed attempt:

```sh
node --test scripts/docs/test/generated-whitepaper-diagrams.test.mjs scripts/docs/test/whitepaper-diagram-evidence.test.mjs scripts/docs/test/whitepaper-diagram-evidence-profiles.test.mjs scripts/docs/test/whitepaper-diagram-evidence-receipts.test.mjs scripts/docs/test/whitepaper-diagram-build.test.mjs
node apps/www/scripts/whitepaper-diagram-build.mjs begin-build
corepack pnpm@10.32.1 --filter apps-www build
node apps/www/scripts/whitepaper-diagram-build.mjs finish-build
DIAGRAM_EVIDENCE_FIGURE=switch-activation node apps/www/scripts/capture-whitepaper-diagram-evidence.mjs
DIAGRAM_EVIDENCE_FIGURE=evolution-feedback node apps/www/scripts/capture-whitepaper-diagram-evidence.mjs
DIAGRAM_EVIDENCE_FIGURE=conditional-consistency node apps/www/scripts/capture-whitepaper-diagram-evidence.mjs
DIAGRAM_EVIDENCE_FIGURE=component-anatomy node apps/www/scripts/capture-whitepaper-diagram-evidence.mjs
DIAGRAM_EVIDENCE_FIGURE=information-flow-model node apps/www/scripts/capture-whitepaper-diagram-evidence.mjs
node apps/www/scripts/check-whitepaper-diagram-evidence.mjs
```

`build-start.json` and `build.json` bind the clean source identity before and after the actual production build, generated CSS, and the complete emitted file inventory. Captures reject subsequent output changes, including HTML, scripts and styles. These are local source/build receipts, not a hermetic build or a signed attestation. Do not pair an old build or image with a new source hash.

Each profile records both locale pages, their source and built HTML hashes, every selected SVG's source/build identity, and the browser's actual article and Dialog measurements. All profiles keep separate viewport article, complete-figure region and real themed preview PNGs with byte hashes and dimensions. A tall figure's document-region capture preserves the responsive viewport; it does not prove the whole figure was visible in one viewport. The retained SVG has a viewBox without declared intrinsic pixels, so its measured natural dimensions are recorded and its aspect ratio is checked without inventing a pixel size. The runner also records resolved image descriptions, the actual preview control's accessibility snapshot, the authored caption and the Dialog's description/snapshot. Inspect their meaning and localization independently; a nonempty label or a browser accessibility snapshot does not prove assistive-technology usability.

The planned complete matrix is 60 article/figure/preview cases and 24 font probes: eight cases per standard profile, with evolution's 28 cases including responsive boundaries, resizing, repeat opening, history return and landscape. `receipt.json` rejects missing or duplicate cases, stale source/build bindings, failed probes, missing PNGs and changed PNG bytes. A successful capture-integrity result leaves visual/semantic acceptance pending. Review the actual text, clipping, endpoints, arrow meaning, ownership and accessible explanations against the semantic ledger, then attach the independent review and applicable generation, docs/agent, production and exact-head CI results. Keep the inventory/provenance ledger's original revision and remaining dispositions distinct from this new capture revision. Bind each pushed development commit to its own progress/evidence comment and real uploaded visuals before earning the corresponding tracking check.

## Asset admission is a separate boundary

A static-looking SVG can still contain scripts, event attributes, external resources, or embedded active content when opened as a document. Inspect the source and existing asset policy; do not expand allowlists or claim general SVG safety from visual review. Prefer the established image embedding path for static figures. Image preview, zoom, keyboard access, and Markdown/MDX coverage need their own bounded implementation and tests.
