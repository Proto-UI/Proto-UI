# Documentation native navigation visual ownership

This bounded follow-up to `2026-10-03-website-native-link-prototype.md` applies the same app-owned passive `SiteLinkSurface` to the documentation brand, sidebar links, TOC links and pagination. No official Link API, Base behavior, Template native-attribute channel or Adapter contract changes.

## Native owners and visual owners

- Starlight still creates sidebar and pagination anchors and owns their href, rel, target, current-page truth and accessible names. The bridge moves the existing child nodes into the passive Prototype without replacing the anchor or introducing a second tab stop.
- SiteTitle opts into the same brand appearance. It retains its original title span, localization exclusion and native destination.
- Sidebar appearance uses a 44px minimum height across viewports, preserving the prior mobile target floor rather than reintroducing a CSS-dependent 32px/44px split. TOC and pagination retain separate, compact navigation densities. These are application design choices, not public component size guarantees.
- TOC keeps the existing scroll/intersection calculations and writes to `aria-current` and `in-view`. The bridge reads those facts and never writes selection. The previous absolute highlighter rectangle and its paint-only animation are removed. Current/in-view links receive Prototype-owned family tokens individually.

## Why an enhanced-only reset is necessary

Starlight's scoped SidebarSublist and Pagination rules continue matching the same original anchors and label nodes. Copying those components would unnecessarily duplicate routing/disclosure behavior. Instead, `a[data-site-link-enhanced]` with one of the four explicit navigation appearances neutralizes upstream padding, border, background, shadow, typography and outline. The real child Prototype supplies the family appearance and focus ring. This reset does not draw a replacement CSS recipe and never applies to all anchors.

Existing app link-skin rules are restricted to `:not([data-site-link-enhanced])`. Before JavaScript enhancement, native links retain their fallback layout and focus visibility. Sidebar list indentation, TOC depth offsets, pagination ordering and SVG dimensions remain layout concerns. The enhancement's focus/paint/clip behavior requires real-browser evidence; source or Happy DOM checks do not establish pixels or accessibility quality.

## Pagination label projection

The former `a > span` font-size-zero selector stops matching after insertion of a passive Proto child. Applying it indiscriminately could hide the title. The bridge instead keeps the original outer span, title span, localized caption text nodes and br node. It places only the existing caption nodes in a visually-hidden span, preserving the native link's complete Previous/Next-plus-title accessible name. Disposal restores the exact original node order. Next-link directional ordering is applied to the slot surface as layout, while title font/color inherit from the Prototype. Tests cover both families, node identity, cleanup and duplicate initialization.

## Explicit remaining scope

Menu/settings panel shells, native details/summary disclosure, and WIP badge visuals remain outside this slice. Search commands and Pagefind/dialog visuals are a separate work item. Markdown prose links retain their existing typography. No whole-site dogfood completion is claimed.

The existing registered `site-native-links.browser.test.ts` receives navigation captures and behavioral assertions for both families in light and dark modes. All four roles receive keyboard-focus checks for ring tokens, width, offset, color, paint delta and unclipped target geometry. It checks actual current sidebar state, hover deltas, native TOC fragment navigation and observed in-view truth, pagination title visibility/accessibility name and actual href navigation. The narrow-screen case opens the existing contents drawer through its real button, tests sidebar focus and clipping, verifies that this site's desktop-only TOC remains hidden, and stresses pagination with explicitly labeled long-title fixture content. A no-JavaScript docs case exercises native destinations, current-page truth, all four roles' native focus paint, heading fragment navigation and pagination. The local execution environment does not permit Chromium; these assertions and exact-commit screenshots remain pending the managed Actions run and rendered-image review.

Co-author by OpenAI Dots
