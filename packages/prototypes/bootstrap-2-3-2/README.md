# Bootstrap 2.3.2 projection (draft)

A real `bootstrap-2-3-2-button` Prototype inheriting `asButton()`; not a website CSS skin or a copy of the old JavaScript runtime. This private, unreleased source package is the first increment of [#792](https://github.com/Proto-UI/Proto-UI/issues/792), not a full library or a published install target.

The first slice provides `variant: default | primary` and inherited `disabled`. It uses the archived 2.3.2 raised-control palette/gradients, 4px corners and 14/20 typography at a 16px root. Bootstrap 2.3.2 had no standard dark theme: the same legacy palette is retained in a dark consumer rather than inventing historical dark parity. Consumers select font resources; the reference stack is Helvetica Neue, Helvetica, Arial, sans-serif.

All appearance lives in Prototype tokens, Rule contributions and the shared physical token translator. Load family `renderThemeCss()` plus CSS generated from its source by `collectProtoStyleTokens` / `renderProtoStyleTokenCss`; consumers only own fonts, outer layout and theme activation. See `THIRD_PARTY_NOTICES.md` for attribution and exact deliberate differences.

The standalone fixture `/en/test/new-projection-families/` mounts real WC, React, Vue 3 and Vue 2 adapters. Homepage/component registry expansion is a later #792 slice. These exports do not establish general Prototype Compiler, GPUI, Flutter or Qt support; exact limitations are recorded in the linked work item.
