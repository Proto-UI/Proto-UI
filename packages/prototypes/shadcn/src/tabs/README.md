# Draft production Tabs style projection

Uses the shared `styleProfile` context from #932, not page CSS. A `shadcn-style-scope` selects a subtree; Tabs Root or List can explicitly select their descendants, while a leaf's explicit selection wins. `inherit` restores nearest-scope selection. Without a selecting scope, New York remains the compatibility fallback.

## Supported surface, not complete Tabs parity

`SHADCN_TABS_TEXT_DEFAULT_STYLES` is a frozen capability list exported from the `/tabs` subpath for honest style selectors. It does not advertise line or glyph support.

Text-only **default**: `new-york-v4` (alias `new-york`), `nova`, `rhea`; Root/List/Trigger/Content; horizontal and vertical; light/dark; selected, hovered, focus-visible and disabled. Pressed remains Base behavior with no invented extra visual. Style changes retain Base value, selection handles, focus, slotted user nodes and editor selection. Orientation is observed from Base context, never written back.

`vega`, `maia`, `lyra`, `mira`, `luma`, `sera` explicitly throw for this consumer. Unknown raw choices also throw, even if enum normalization would otherwise conceal them. This is not the final all-style matrix: the target remains all eight latest styles plus legacy New York.

Upstream `variant="line"` is explicitly rejected pending #935. Existing `appearance="underline"` is preserved as a separate Proto compatibility surface; it is not an alias for upstream line. Arbitrary nested SVG and inline-icon sizing/placement are not projected. No new Lucide dependency or DOM selector inspection is introduced.

## Why line is not faked

C-TEMPLATE-0006 requires rejection of PrototypeRef template children. Template v0 plain nodes have static TemplateStyleHandle, not dynamic Rule feedback targets. Re-rendering an indicator would violate the style-only/no-reset boundary; the Web commit path rebuilds children. The attempted child-prototype implementation was rejected by the actual approved runtime and is not shipped. No custom-tag workaround or pseudo-selector token is accepted.

## Source and evidence

`internal/fixtures/shadcn-tabs-style/coverage.json` binds inspected source bytes to upstream `3d98900e9b73c45f035f8109e9d41ba6a51685e7` and lists all nine style statuses. The source slice CSS inventory and MIT notice remain in `shadcn-style-source`. Rhea's important transparent border is projected semantically by withholding conflicting focus/dark border contributions. The retained `outline-none` and `select-none` are explicit Proto compatibility extras.

The tests are approved-runtime/Happy DOM evidence, not native browser, screenshot, full adapter or full upstream parity acceptance. Portal, arbitrary reparent and alive-view remount guarantees remain excluded as in #931.

The scoped `shadcn-tabs-style.yml` workflow produces exact-head light/dark screenshots plus source and browser receipts. Its capture page uses neutral consumer palette tokens and layout CSS only; it does not repair component styling with selectors. Build-only success is not native evidence, and the PR records screenshot status separately.
