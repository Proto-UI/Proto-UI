# Bootstrap 2.3.2 projection (draft)

A private, unreleased, real Base-inheriting projection source package. It is a partial increment of [#792](https://github.com/Proto-UI/Proto-UI/issues/792), not a complete library or a published install target. Every implemented part keeps its Base state, event, context and accessibility owner.

| Component | Real parts / owner | Bootstrap 2.3.2 reference and deliberate difference |
| --- | --- | --- |
| Button | Button / `asButton()` | [Archived buttons](https://getbootstrap.com/2.3.2/base-css.html#buttons), default/primary gradient and raised/inset grammar; stronger focus ring, scalable metrics, no jQuery |
| Checkbox | Root + Indicator / `asCheckboxRoot()` + `asCheckboxIndicator()` | [Archived forms](https://getbootstrap.com/2.3.2/base-css.html#forms); custom square and original check/mixed glyph rather than the original native checkbox skin |
| Switch | Root + Thumb / `asSwitchRoot()` + `asSwitchThumb()` | Design-language extension using the archived control palette and relief; core 2.3.2 has no Switch |
| Toggle | Toggle / `asToggle()` | Design-language extension using [stateful button appearance](https://getbootstrap.com/2.3.2/javascript.html#buttons); Base owns active state, not the original jQuery plugin |
| Input | Root / `asInputRoot()` and its modules | [Archived text fields](https://getbootstrap.com/2.3.2/base-css.html#forms); one host-owned single-line editor, white field, compact spacing, 4px corner and inset shadow |
| Textarea | Root / `asTextareaRoot()` and its modules | [Archived textarea](https://getbootstrap.com/2.3.2/base-css.html#forms); one host-owned multiline editor, inherited IME and stable controlledness, vertical resize |
| Separator | Root / `asSeparatorRoot()` | Simplified palette-derived hr/divider extension; 1px horizontal/vertical divider without upstream two-edge styling or default margins |

Text controls and Toggle use normal 14/20 typography at a 16px root. Checkbox/Switch parts derive value from their root context; they never own a competing value. Input/Textarea preserve inherited modules and render no authored second editor. Bootstrap 2.3.2 had no standard dark theme: the historical palette stays the same inside a dark consumer. Consumers select font resources; the reference stack is Helvetica Neue, Helvetica, Arial, sans-serif.

All component paint lives in Prototype tokens, Rule contributions and the shared finite physical token translator. Load family `renderThemeCss()` plus CSS generated from its source by `collectProtoStyleTokens` / `renderProtoStyleTokenCss`. The generated draft preset uses that same source vocabulary. Consumers own fonts, outer layout and theme activation. [Attribution and deliberate changes](THIRD_PARTY_NOTICES.md) travel with the source; the public CLI archive independently contains the Apache license and notice for its derived values.

The bilingual `/en/ui-libraries/bootstrap-2-3-2/` and `/zh-cn/ui-libraries/bootstrap-2-3-2/` pages expose all seven implemented kinds and their genuine recipes. Their toolbar-free previews follow the page's four-Web runtime selector without requiring a missing Bootstrap Select. Missing kinds continue to fail explicitly, and the incomplete family is not offered by the eleven-kind homepage selector.

The Button fixture is `/en/test/new-projection-families/`; the controls fixture is `/en/test/bootstrap-state-controls/`. A prepared read-only Actions workflow binds real browser evidence to the exact candidate SHA. Local simulated-host, physical CSS, source/preset and package checks do not establish real browser paint, general Prototype Compiler, GPUI, Flutter or Qt conformance. Source-derived GPUI token data preserves unsupported-property diagnostics and is not native component execution. #792 stays open for all remaining Base parts and host/compiler evidence.
