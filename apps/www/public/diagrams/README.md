# Whitepaper illustrations

The whitepaper SVGs are embedded as images and inherit the website's explicit light/dark color scheme. Full-size viewing stays in the site's themed dialog.

## Editing

User-authored Excalidraw exports: `whitepaper-information-channels.svg`, `whitepaper-lifecycle.svg`, and bilingual `whitepaper-component-boundary` and `whitepaper-translation-responsibility` SVGs. Website adaptations preserve the user's layout and wording while adding theme colors and an Adapter cutout mask. The original editable drawings remain with the author.

`node apps/www/scripts/generate-whitepaper-diagrams.mjs` generates the eight bilingual anatomy, Switch activation, conditional consistency, and evolution SVGs. Edit that generator for those assets; it deliberately does not overwrite the user-authored drawings. Codex generated these diagrams and assisted with website integration and theme adaptations; the maintainer reviewed the figures.

## Third-party material

- The translation diagrams embed React, Vue, Flutter, and Qt host logos from [Devicon v2.17.0](https://github.com/devicons/devicon/tree/v2.17.0/icons), specifically `react/react-original.svg`, `vuejs/vuejs-original.svg`, `flutter/flutter-original.svg`, and `qt/qt-original.svg`. Logo artwork is unchanged and embedded as base64 images. See [MIT license](licenses/Devicon-MIT.txt). The logos identify target Hosts; they do not imply endorsement or equal support.
- Excalidraw exports embed glyph subsets of **Excalifont 1.000**, **Xiaolai SC 3.11**, and **Nunito 3.602** (versions read from their embedded font metadata). These subsets are retained unchanged. Upstream Excalidraw font packaging and metadata can be inspected at [commit 214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f](https://github.com/excalidraw/excalidraw/tree/214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f/packages/excalidraw/fonts), under `Excalifont/`, `Xiaolai/`, and `Nunito/`. This is a source reference, not a claim about the author's exact Excalidraw application build. Excalifont is copyright 2024 Excalidraw; Xiaolai is copyright 2020 LXGW, derived from Nozomi Seto's Seto font; Nunito is copyright 2014 The Nunito Project Authors. All three use SIL OFL 1.1. Full notices are retained in [Excalifont-OFL.txt](licenses/Excalifont-OFL.txt), [Xiaolai-OFL.txt](licenses/Xiaolai-OFL.txt), and [Nunito-OFL.txt](licenses/Nunito-OFL.txt). Additional upstream sources: [Xiaolai](https://github.com/lxgw/kose-font) and [Nunito](https://github.com/googlefonts/nunito).

The anatomy, conditional-consistency, and evolution SVGs reference system font names without bundling font files. The Switch activation SVGs embed the bounded handwritten font subsets described below; they do not request remote fonts.

## Review

Follow the [documentation diagram method](../../../../internal/agent-operations/diagram-design.md) when changing an illustration. Source-grounded meaning and an actual localized, themed render are separate requirements. A hand-drawn treatment is allowed, not required; repeated boxes and sentences are not a substitute for clear relations.

The Switch activation figure is an editorial reading of the chapter 4 pseudocode. Root owns `checked`, explicitly emits `checkedChange`, updates Context, and requests its own Feedback refresh. Thumb receives Context and keeps derived display state. Horizontal arrows show channels across owners; their position does not require synchronous Context callback dispatch. The applicable catalog direction remains draft (`P-BASE-SWITCH`, `P-BASE-SWITCH-THUMB`, `C-STATE-0001`, `C-STATE-0005`, `C-CONTEXT-0010`, and `D-CONTEXT-NOTIFICATION-SCHEDULING-0001`).

## Handwritten Switch activation typography

The activation drawing uses deterministic, slightly irregular pen paths and handwriting typography, following the visual character of the authored information-channel drawing. Its graph, labels, owner boundaries, and editorial status are unchanged by that treatment. The marks are code-authored, not a claim that the figure was drawn by hand.

`apps/www/scripts/whitepaper-diagram-fonts.json` is the generator's frozen font input. It contains glyph subsets derived from **Excalifont 1.000** and **Xiaolai SC 3.11** at the same [upstream Excalidraw commit](https://github.com/excalidraw/excalidraw/tree/214cd6e6e8ac3ad6b68486aa7aa7241abdf9445f/packages/excalidraw/fonts) cited above. Each input shard is identified by filename and Git blob SHA, and each embedded subset has its own SHA-256 and Unicode coverage. The subsets are renamed `Proto Diagram Hand Latin` and `Proto Diagram Hand CJK`; glyph outlines are not redesigned. The Latin subset is embedded in both locales; the CJK subset is embedded only in Chinese. The assignment-arrow character `←` uses the system sans-serif fallback.

These derived fonts remain **SIL OFL 1.1**, with copyrights and full notices in [Excalifont-OFL.txt](licenses/Excalifont-OFL.txt) and [Xiaolai-OFL.txt](licenses/Xiaolai-OFL.txt). The surrounding repository license does not relicense the fonts. Source preparation used FontTools to merge the named upstream Xiaolai shards, subset the visible labels, rename family/name records, and encode WOFF2; no third-party drawing or non-public font source was copied.

Changing a visible label may require refreshing the subset from the pinned upstream fonts. Keep the source shard identities, font names, Unicode coverage, content hashes and licenses synchronized. `scripts/docs/test/generated-whitepaper-diagrams.test.mjs` rejects missing visible-label coverage and font-byte drift and regenerates both locales offline. The normal Node generator does not install or run a font tool.
