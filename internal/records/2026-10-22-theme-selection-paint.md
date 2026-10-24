# Canonical Web selection paint without selection ownership

Bounded follow-up to #865 in PR #926. The user-facing native action appearance is a separate #559 slice. The editors and useful document text remain natively selectable.

## Existing source, missing projection

The Shadcn CLI theme already defines light/dark `selection` and `selection-foreground` roles. The canonical Brutalist theme also exposes the pair. The website carries their `--pui-*` projections, but a variable declaration alone does not paint a native highlight. The fixed upstream Shadcn source at `25af02b1b467fcd53b63e0c6d6d324c57c16ef18` explicitly connects selection foreground/background to `::selection`.

This change connects the existing Proto UI palette, not a wholesale palette-version migration. It does not use a website-only blue override, blanket `user-select`, Selection-range mutation, clipboard interception, or an unsupported `selection:bg-selection` compiler token.

## Cascade and scope

- The public CLI Shadcn theme supplies a low-priority `@layer theme` selection rule. The existing prefix renderer maps both role declarations and references consistently.
- Brutalist's public theme renderer scopes highlight paint to its supplied light/dark boundaries and descendants. `includeSelection: false` explicitly represents variable-bank-only projections, including the website's inactive `site-brutalist-*` bank.
- Existing component highlight utilities retain higher cascade priority: Shadcn Input's primary pair and Brutalist Input/Textarea's main pair are not replaced. Shadcn Textarea inherits the public theme pair.
- The palette extractor accepts only the exact bounded canonical paint block, not arbitrary selectors, properties, importance or nested CSS. Its source hash still changes when the complete canonical CSS changes; unchanged resolved colors do not imply identical source provenance.

## Verification boundary

The four-runtime homepage tests observe actual light/dark document and editor selections, computed highlight pairs, native selected editor bytes, and screenshots. The website Web Components registry uses light DOM; those results must not be described as Shadow DOM evidence. Separate Shadow artifact installation and legacy `shadow: true` are distinct delivery boundaries. No compiler, Adapter, style-artifact validator, or Shadow profile contract is changed by this slice.

The contract and test records remain draft/planned until applicable execution and review evidence is attached. A successful geometry/selection test is not full CI acceptance or independent approval.
