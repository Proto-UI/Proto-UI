# Documentation Code Frame Design

**Issue:** [#369](https://github.com/Proto-UI/Proto-UI/issues/369)

**Status:** Approved

## Problem

The documentation currently presents two incompatible code surfaces. `PrototypePreviewer` code panels use the Proto UI border, 12px radius, muted surface, and 13px code typography. Starlight/Expressive Code Markdown blocks lose their intended border, padding, radius, and compact desktop control treatment because Tailwind's later `base` cascade layer overrides Starlight's earlier component layer. The resulting 40px copy control dominates short blocks and the two surfaces do not read as one system.

## Decision

Keep both renderers and their behavior. Unify their visual grammar rather than replacing either implementation.

1. Predeclare the documentation cascade order before bundled styles as `base -> starlight -> components -> utilities`. This lets Starlight/Expressive Code component rules survive Tailwind's reset while preserving Proto UI component and utility overrides.
2. Configure Expressive Code through Starlight's supported `styleOverrides` surface: 1px Proto UI border, 12px outer radius, muted code surface, and 13px/24px code typography.
3. Give both Expressive Code and `PrototypePreviewer` an icon-only 32px copy target with an 18px glyph, themed border/background, hover feedback, and visible `focus-visible` treatment.
4. Preserve Expressive Code copy feedback, terminal/editor framing, horizontal scrolling, and theme token projection. Preserve `PrototypePreviewer` expand/copy behavior and keep its `View code` control private to previews.

## Scope

Documentation presentation only. No prototype, adapter, runtime, code-generation, or public package behavior changes.

## Verification

Build the production documentation site, then exercise the Chinese Transition page in Chromium at desktop and narrow widths in light and dark themes. Check frame geometry, internal horizontal scrolling without page overflow, copy feedback, previewer expansion/copy, focus visibility, and navigation reinitialization. Smoke-check a terminal code block because Expressive Code's terminal frame uses the same corrected layer order.
