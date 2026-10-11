# Preserve Library Card ownership before definition

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed mismatch

Card run 37769859972 on published `5445b04c970f6fb46ccd871d2fbe509709c80e45` remains 0/9. Besides Brutalist endpoint widths, the saved distinct frames show Base and Lucide title color temporarily changing in seven of eight cases. For example, Vue light changes from `oklch(0.269 0 0)` to `lab(2.75381 0 0)` and back. All five non-Brutalist endpoint objects match, which does not prove their middle frames match.

The existing typography inventory says already component-owned text must not be wrapped twice. Its component boundary recognized runtime `data-pui-root` and styled `data-pui-style` ancestors, but not the explicit server-authored `data-library-part` owner. Base's deliberately empty tokens correctly omit `data-pui-style`; before WC definition, its Library native headings and paragraphs therefore entered the unrelated documentation typography inventory.

Executing the actual `collectSiteTypographyTargets` against the saved Astro-dev HTTP document, with script execution and all asset loading disabled, selected exactly six existing Library nodes: Base h2/p/p and Lucide h2/p/p. Adding the actual enhanced `data-pui-root` marker removed all six. After the owner fix, both states select zero Library nodes. This is actual SSR DOM/inventory evidence, not a native paint reproduction. An initial probe accidentally allowed localhost asset fetch attempts; it was discarded as setup noise and repeated with those loaders explicitly disabled. No loaded asset or browser result is claimed by that probe.

## Small owning-layer correction

The documentation inventory now excludes the already authored `data-library-part` boundary regardless of token emptiness or runtime definition. It does not insert fake empty styles, apply a color workaround, suppress source content, remove native semantics or change a family recipe. Ordinary documentation headings and paragraphs remain selected. Even an explicit site-typography marker inside a Library-owned part cannot claim a second owner.

Two regression cases fail on the old implementation with exactly six extra nodes, then pass in both full and docs-only inventory modes. They verify original source identity and content remain untouched and compare the pre-definition and enhanced-marker inventories. The full typography, Library controller and Library source suites pass 51 cases, including all four real adapter lifecycle tests. Native title continuity remains the next exact-head browser obligation; this inventory fix does not settle the separate Brutalist selected-font question or turn any old journey green.

The production delta is one additional selector in the owning inventory boundary. No public API, package budget, font, geometry tolerance, browser deadline or acceptance count changes. Final source wall, types/docs and official native runs remain coordinated integration obligations.
