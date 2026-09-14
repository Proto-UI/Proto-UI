# Whitepaper illustrations

The whitepaper SVGs are embedded as images and inherit the website's explicit light/dark color scheme. Full-size viewing stays in the site's themed dialog.

## Editing

User-authored Excalidraw exports: `whitepaper-information-channels.svg`, `whitepaper-lifecycle.svg`, and bilingual `whitepaper-component-boundary` and `whitepaper-translation-responsibility` SVGs. Website adaptations preserve the user's layout and wording while adding theme colors and an Adapter cutout mask. The original editable drawings remain with the author.

`node apps/www/scripts/generate-whitepaper-diagrams.mjs` generates the eight bilingual anatomy, Switch activation, conditional consistency, and evolution SVGs. Edit that generator for those assets; it deliberately does not overwrite the user-authored drawings. Codex generated these diagrams and assisted with website integration and theme adaptations; the maintainer reviewed the figures.

## Third-party material

- The translation diagrams embed React, Vue, Flutter, and Qt host logos from [Devicon v2.17.0](https://github.com/devicons/devicon/tree/v2.17.0/icons), specifically `react/react-original.svg`, `vuejs/vuejs-original.svg`, `flutter/flutter-original.svg`, and `qt/qt-original.svg`. Logo artwork is unchanged and embedded as base64 images. See [MIT license](licenses/Devicon-MIT.txt). The logos identify target Hosts; they do not imply endorsement or equal support.
- Excalidraw exports embed glyph subsets of **Excalifont 1.000**, **Xiaolai SC 3.11**, and **Nunito 3.602** (versions read from their embedded font metadata). These subsets are retained unchanged. Upstream Excalidraw font packaging and metadata can be inspected at [commit 214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f](https://github.com/excalidraw/excalidraw/tree/214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f/packages/excalidraw/fonts), under `Excalifont/`, `Xiaolai/`, and `Nunito/`. This is a source reference, not a claim about the author's exact Excalidraw application build. Excalifont is copyright 2024 Excalidraw; Xiaolai is copyright 2020 LXGW, derived from Nozomi Seto's Seto font; Nunito is copyright 2014 The Nunito Project Authors. All three use SIL OFL 1.1. Full notices are retained in [Excalifont-OFL.txt](licenses/Excalifont-OFL.txt), [Xiaolai-OFL.txt](licenses/Xiaolai-OFL.txt), and [Nunito-OFL.txt](licenses/Nunito-OFL.txt). Additional upstream sources: [Xiaolai](https://github.com/lxgw/kose-font) and [Nunito](https://github.com/googlefonts/nunito).

The generated SVGs reference system font names without bundling font files.
