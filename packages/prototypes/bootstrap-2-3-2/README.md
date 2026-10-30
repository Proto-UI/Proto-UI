# Bootstrap 2.3.2 projection (draft)

A private, unreleased, real Base-inheriting projection source package. It is a partial increment of [#792](https://github.com/Proto-UI/Proto-UI/issues/792), not a complete library or a published install target. Every implemented part keeps its Base state, event, context and accessibility owner.

| Component | Real parts / owner | Bootstrap 2.3.2 reference and deliberate difference |
| --- | --- | --- |
| Button | Button / `asButton()` | [Archived buttons](https://getbootstrap.com/2.3.2/base-css.html#buttons), seven-color gradient and raised/inset grammar; stronger focus ring, fixed upstream 4px/12px padding and 14px/20px type, no jQuery |
| Checkbox | Root + Indicator / `asCheckboxRoot()` + `asCheckboxIndicator()` | [Archived forms](https://getbootstrap.com/2.3.2/base-css.html#forms); custom square and original check/mixed glyph rather than the original native checkbox skin |
| Switch | Root + Thumb / `asSwitchRoot()` + `asSwitchThumb()` | Design-language extension using the archived control palette and relief; core 2.3.2 has no Switch |
| Toggle | Toggle / `asToggle()` | Design-language extension using [stateful button appearance](https://getbootstrap.com/2.3.2/javascript.html#buttons); Base owns active state, not the original jQuery plugin |
| Input | Root / `asInputRoot()` and its modules | [Archived text fields](https://getbootstrap.com/2.3.2/base-css.html#forms); one host-owned single-line editor, white field, compact spacing, 4px corner and inset shadow |
| Textarea | Root / `asTextareaRoot()` and its modules | [Archived textarea](https://getbootstrap.com/2.3.2/base-css.html#forms); one host-owned multiline editor, inherited IME and stable controlledness, vertical resize |
| Separator | Root / `asSeparatorRoot()` | Simplified palette-derived hr/divider extension; 1px horizontal/vertical divider without upstream two-edge styling or default margins |

Text controls and Toggle use normal 14/20 typography at a 16px root. Checkbox/Switch parts derive value from their root context; they never own a competing value. Input/Textarea preserve inherited modules and render no authored second editor. Bootstrap 2.3.2 had no standard dark theme: the historical palette stays the same inside a dark consumer. Consumers select font resources; the reference stack is Helvetica Neue, Helvetica, Arial, sans-serif.

All component paint lives in Prototype tokens, Rule contributions and the shared finite physical token translator. Load family `renderThemeCss()` plus CSS generated from its source by `collectProtoStyleTokens` / `renderProtoStyleTokenCss`. The generated draft preset uses that same source vocabulary. Consumers own fonts, outer layout and theme activation. [Attribution and deliberate changes](THIRD_PARTY_NOTICES.md) travel with the source; the public CLI archive independently contains the Apache license and notice for its derived values.

The bilingual `/en/ui-libraries/bootstrap-2-3-2/` and `/zh-cn/ui-libraries/bootstrap-2-3-2/` pages expose the implemented kinds and their genuine recipes. Their preview toolbars use genuine Bootstrap Select parts and Text labels, while retaining the page's four-Web runtime preference. Missing kinds continue to fail explicitly; source/catalog coverage does not establish homepage, release or full-family acceptance.

The Button fixture is `/en/test/new-projection-families/`; the controls fixture is `/en/test/bootstrap-state-controls/`. A prepared read-only Actions workflow binds real browser evidence to the exact candidate SHA. Local simulated-host, physical CSS, source/preset and package checks do not establish real browser paint, general Prototype Compiler, GPUI, Flutter or Qt conformance. Source-derived GPUI token data preserves unsupported-property diagnostics and is not native component execution. #792 stays open for all remaining Base parts and host/compiler evidence.

Select has eleven direct parts: Root, Trigger, Value, Content, Surface, Viewport, Item, ItemText, Group, Label and Separator. Content owns the pinned dropdown-menu chrome, Surface is structural and Viewport is the one scrollport. Compose Content > Surface > Viewport > Item > ItemText, with named Groups and contentless Separators inside Viewport. Select is a button-dropdown design-language extension, not native HTML select or jQuery API parity. Private `/select` and `/text` CLI entries require explicit workspace source mode. All eight Text axes are retained, with no user-selection override.

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

`fieldTextarea`, `fieldSelectTrigger` and `fieldSwitch` reuse the corresponding standalone family recipe through the exact matching Base optional-Field composition. Field remains the sole invalid/pending, policy and relationship owner; ordinary controls do not absorb nearby Field state.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.

## Base draft projection sources

The workspace additionally contains passive regions, Image, Table, Transition, Radio Group, Scroll Area, Dialog, Hover Card, Tooltip, Drawer Header/Footer, the optional Tabs Indicator, separate scalar/indexed Slider families, and the existing form, search/navigation, data and collection compositions. Every entry preserves its actual Base owner/modules/render. Semantic-only coordinators and helper boundaries are not extra widgets. Modern parts without a Bootstrap 2.3.2 counterpart are explicit Proto extensions, not retroactive upstream component or plugin parity.

All historical comparisons are pinned to `twbs/bootstrap@b4c4072679943773a7582daa63f545ba818fa627`. Source pixel units, palette, shadows and supplied slots remain distinct from deliberate readable-label/focus extensions. Motion gaps are not faked: modal top -25% to 10% needs containing-block-relative geometry and per-channel easing, Button background-position needs its resident 100ms channel, and Carousel/Progress choreography needs the governed retained-slide/width/stripe capabilities. Static paint and zero-duration presence do not satisfy those gaps. Parent-owned exact-head execution, package/CLI consumers, four-Web paint, accessibility, Compiler and native hosts remain separate evidence gates.

## Text-capable Thumbnail composition

The Library entry composes the existing passive Surface (`outline`, `raised`) and Text, following the archived 2.3.2 Thumbnail instead of a modern Card. Default Surface (`outline`, no elevation) remains neutral. The explicit raised recipe uses the #ddd frame and 0/1/3px shadow; native-link `solid` Surface shares Button's classic primary gradient and pressed paint without inheriting Button interaction. Its native anchor remains the navigation/focus owner.

Text's `sm` + `normal` supplies 14/20 typography at a 16px root; `2xl` + `relaxed` supplies 24.5/40. Rem dimensions scale with text settings. The website supplies only composition spacing, while these family prototypes own paint/type and real Runtime server snapshots. This introduces no new component kind, public CLI entry, homepage eligibility or exact-browser acceptance claim.

## Local draft artifacts

`pnpm run build:draft` refreshes the public prerequisite `dist` trees in the workspace through the normal package compiler, then builds and stages the existing draft entries and dependency closure in a fresh temporary directory. `pnpm run pack:draft` additionally produces local tarballs. The JSON receipt identifies every artifact and its draft-only status. Both commands run from this package directory.

These are private, release-excluded development artifacts, not public package admission or a registry publication. The checked-in source exports and public CLI rejection remain unchanged. The temporary manifests use `0.0.0-draft`, retain `private: true`, omit lifecycle scripts and bind workspace dependencies to the same local draft version. Install the complete returned tarball closure together with scripts disabled and offline resolution; no artifact should be uploaded to npm. Build/pack success alone does not establish consumer, host, visual, native, or full Finf G4 acceptance.

Run `pnpm test:draft-packages` from the repository root for the complete offline tarball install, JavaScript ESM and strict NodeNext declaration smoke. Run this build-bearing suite separately from other package builds.

The draft builder admits only the two named prototype families and their current dependency shape. It is not a general private-package build API; adding workspace dependencies that occur only in peer or optional fields requires extending and testing its closure planning first.

Button default/primary preserve the archived CSS pixel dimensions when the root font size changes. This supersedes the initial scalable-metrics deviation for Button only; other projections retain their separately tracked sizing work. Browser zoom and native/compiler verification are separate from root-font tests.

Button size accepts `default`, `large`, `small`, and `mini` (default `default`) for both variants. Fixed v2.3.2 padding/font/radius/height values are respectively `4px 12px / 14px / 4px / 30px`, `11px 19px / 17.5px / 6px / 44px`, `2px 10px / 11.9px / 3px / 26px`, and `0px 6px / 10.5px / 3px / 22px`; all retain 20px line height and 1px borders. Height values describe a single line, not an added fixed-height constraint. Link/block and icon-sprite offsets are not included.

Button variants are `default`, `primary`, `warning`, `danger`, `success`, `info`, and `inverse`. The v2.3.2 text shadows and final modern-browser border colors are retained. Hover/focus keeps the gradient at its -15px endpoint; pressed/disabled removes it. The stronger focus-visible ring remains. This is static/state-endpoint alignment: the original 100ms motion and full contrast/target acceptance are still open. Complete finite paint recipes respect current token-group merging; old passive exports remain unchanged for other component owners.
