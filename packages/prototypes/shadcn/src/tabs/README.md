# Draft production Tabs style projection

Uses the shared `styleProfile` context from #932, not page CSS. A `shadcn-style-scope` selects a subtree; Tabs Root or List can explicitly select their descendants, while a leaf's explicit selection wins. `inherit` restores nearest-scope selection. Without a selecting scope, New York remains the compatibility fallback.

## Supported surface

`SHADCN_TABS_TEXT_DEFAULT_STYLES` remains the frozen text/default source-projection list exported from the `/tabs` subpath: all eight current styles (`vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`) plus the independent `new-york-v4` (alias `new-york`). Root/List/Trigger/Content/Indicator have authored recipes for horizontal and vertical, light/dark, selected, hovered, focus-visible and disabled states. This list describes source coverage, not native or cross-adapter acceptance. Pressed remains Base behavior with no invented extra visual. Style changes must retain Base value, selection handles, focus, slotted user nodes and editor selection. Orientation is observed from Base context, never written back.

Upstream `variant="line"` is projected: the List gets `gap-1 bg-transparent` (+`rounded-none` where the style's default list rounds; sera's list has no rounding upstream), the active Trigger goes transparent in every scheme, and the `after:` indication is painted on an **owned decorative target** (`def.feedback.style.declareDecoration` + `style.to(target)` + `r.decoration(target)`), the draft capability from `C-FEEDBACK-STYLE-OWNED-TARGET-0001`. Each adapter must implement it; unknown/unsupported targets reject, there is no host fallback. Existing `appearance="underline"` remains a separate Proto compatibility surface, not an alias for upstream line.

`tabsIndicator` is a full-projection part: `asTabsIndicator` once, `value`/`activeValue`/`orientation` derived, neutral `bg-foreground` paint only. Base defers layout measurement and positioning to downstream styling, so no geometry is promised — the `line` indication lives on the Trigger decoration instead, exactly like upstream's `after:`.

Unknown raw style choices still throw rather than falling back. Arbitrary nested SVG and inline-icon sizing (`[&_svg]`, `has-data-[icon]` paddings) are not projected — a shared inline-glyph contract gap. No new Lucide dependency or DOM selector inspection is introduced.

## Per-style recipe mapping

`.cn-tabs-trigger`/`.cn-tabs-list`/`.cn-tabs-content` overrides come from the pinned `style-*.css` sources (`internal/fixtures/shadcn-style-source`, `3d98900e…`): nova/lyra/mira/rhea `h-8`, vega/maia/luma/NY `h-9`, sera `h-10`; maia `rounded-4xl`, luma `rounded-full`, lyra/sera squared; mira/lyra/sera `text-xs`; sera `font-semibold uppercase tracking-wider`. luma and rhea declare `border-transparent!`: their focus/dark border contributions are withheld by rule precedence (no CSS important token copied). Active `shadow-sm` exists only where the source declares it (vega, nova, New York); line replaces it with `shadow-none`. Lyra/Mira vertical `--spacing(1.25)` is evaluated to `0.3125rem`; their `text-xs/relaxed` content is expressed as `text-xs leading-relaxed`.

## Source and evidence

`internal/fixtures/shadcn-tabs-style/coverage.json` binds inspected source bytes to upstream `3d98900e9b73c45f035f8109e9d41ba6a51685e7`. The source slice CSS inventory and MIT notice remain in `shadcn-style-source`. The retained `outline-none` and `select-none` are explicit Proto compatibility extras.

Focused tests exercise actual runtime and Happy DOM behavior when run; they do not establish native browser, screenshot, full adapter or full upstream parity acceptance. Portal, arbitrary reparent and alive-view remount guarantees remain excluded as in #931. Owned-decoration runtime support is adapter-dependent (draft contract, Web adapter bounded implementation); source coverage and accepted types are not native or cross-adapter acceptance.

The scoped `shadcn-tabs-style.yml` workflow produces exact-head light/dark screenshots plus source and browser receipts. Its capture page uses neutral consumer palette tokens and layout CSS only; it does not repair component styling with selectors. Build-only success is not native evidence, and the PR records screenshot status separately.
