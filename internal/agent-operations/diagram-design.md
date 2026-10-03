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

## Asset admission is a separate boundary

A static-looking SVG can still contain scripts, event attributes, external resources, or embedded active content when opened as a document. Inspect the source and existing asset policy; do not expand allowlists or claim general SVG safety from visual review. Prefer the established image embedding path for static figures. Image preview, zoom, keyboard access, and Markdown/MDX coverage need their own bounded implementation and tests.
