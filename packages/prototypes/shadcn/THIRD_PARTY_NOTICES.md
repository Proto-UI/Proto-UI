# Third-Party Notices

`@proto.ui/prototypes-shadcn` derives component APIs and visual definitions from [shadcn/ui](https://github.com/shadcn-ui/ui). The first cataloged comparison baseline is revision `f31ed81983653919dd4fe77aee4b4859f610f1dc`. Proto UI maintains this package as an independent, unofficial implementation.

## shadcn/ui

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Tooltip static surface snapshot (2026-10-10)

Tooltip Content's static surface separately derives from [the base-nova registry](https://ui.shadcn.com/r/styles/base-nova/tooltip.json), retrieved 2026-10-10, under the shadcn MIT license above. JSON SHA256: `2f55867faecee2d3616cfd8c6a80b538909a21e62fdfa2788b1ead56093e5395`; extracted TSX SHA256: `f83d5f511812573f4ac98b866d397a46fda0f27eeb0af0ea89af01969eefbc5a`. The deployment Git SHA is unknown. This reference does not replace the earlier pinned API compatibility baseline. See `internal/records/2026-10-10-finf-tooltip-surface-migration.md` for transformations and remaining differences.

## New York AlertDialog and shared Button paint (2026-10-13)

The bounded AlertDialog presentation and shared Button default/outline paint and existing fixed sizes derive from shadcn/ui revision `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, `apps/v4/registry/new-york-v4/ui/alert-dialog.tsx` (blob `566c463a61b48c79ad544bfdd80434174107c9d5`) and `button.tsx` (blob `e3345d985d14c33e3cb9d8c45cf973807326c944`), under the MIT license above. This is the fixed New York recipe, not Base/Nova. It does not replace the historical API baseline or the separately adopted destructive variant. Mobile breakpoints, small/media variants and animated AlertDialog presence remain open. See `internal/contracts/overlay/shadcn-alert-dialog.presentation.v0.md`.

The bounded Drawer bottom Handle recipe uses the same revision’s `apps/v4/registry/new-york-v4/ui/drawer.tsx` (line 67), and default content-column composition uses `examples/drawer-demo.tsx` (line 74). Drawer Trigger/Close reuse the shared Button paint. Existing 80% primary hover remains a temporary implementation mismatch pending borrowed-state style-closure repair, not a claim about New York’s 90% recipe.

## New York Button ghost hover (2026-10-14)

The bounded ghost hover recipe derives from the same fixed shadcn/ui revision `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, `apps/v4/registry/new-york-v4/ui/button.tsx`, lines 18–19 (blob `e3345d985d14c33e3cb9d8c45cf973807326c944`), under the MIT license above. It uses accent/accent-foreground hover and half-opacity accent in dark mode. It does not advance the historical API baseline, migrate the temporarily retained default hover80, or replace the separately adopted destructive variant. Native visual and complete Button acceptance remain separate.

## Homepage Rhea / Luma Button profiles (2026-10-22)

The direct Button and explicitly opted-in passive action appearance derive from shadcn/ui revision `25af02b1b467fcd53b63e0c6d6d324c57c16ef18`, `apps/v4/registry/styles/style-rhea.css` and `style-luma.css`, under the MIT license above. At that revision the homepage UI Elements card imports `base-rhea`, while the hero imports `radix-luma`; these are distinct presentation profiles, not a universal shadcn default. This bounded migration replaces the direct Button's earlier New York paint, not the independent AlertDialog/Drawer command paint. The compatibility baseline, deliberately omitted APIs, Proto multiline wrapping, and compact icon extension remain separately documented. See `internal/records/2026-10-22-shadcn-homepage-button-profiles.md`.

## Shared-scope passive Card (2026-10-23)

The existing four Card presentation regions additionally map New York and Rhea from shadcn/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, `apps/v4/registry/bases/base/ui/card.tsx` (blob `2062884f29a8044fa48edf86605182eca29f8716`), `apps/v4/registry/new-york-v4/ui/card.tsx` (blob `6aebd4cf612dfa24d40ffdf357c6f6363e144d6a`) and `apps/v4/registry/styles/style-rhea.css` (blob `94bbca2a7f78845e7cfbcff68fb8f535e3848a98`), under the MIT license above. Scope and density are Proto presentation semantics, not upstream React API equivalence. Image-edge selectors, automatic CardAction layout and container queries remain unsupported by this bounded four-part surface.

## Shared-scope Command and single-control shell (2026-10-23)

The bounded Rhea Command and reusable single-inline-control shell derive from shadcn/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, `apps/v4/registry/bases/base/ui/command.tsx`, `apps/v4/registry/bases/base/ui/input-group.tsx`, `apps/v4/registry/styles/style-rhea.css`, and the New York shell in `apps/v4/registry/new-york-v4/ui/input-group.tsx`, under the MIT license above. The existing New York standalone Command remains a Proto compatibility recipe, not a new claim of full cmdk parity. See `internal/contracts/command/shadcn-input-shell.presentation.v0.md` for the omitted addons, invalid aggregation, groups, shortcuts and other unsupported upstream anatomy.

## Shared-scope Select profiles (2026-10-23)

The bounded Rhea Select presentation derives from shadcn/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, `apps/v4/registry/bases/base/ui/select.tsx` (blob `2cb76c117197336324cfaed1300e92ca65273b40`) and `apps/v4/registry/styles/style-rhea.css` (blob `94bbca2a7f78845e7cfbcff68fb8f535e3848a98`), under the MIT license above. Existing New York behavior and presentation compatibility remain separately documented. Scope selection, optional Field binding and the existing Content/Surface/Viewport/ItemText composition are Proto contracts, not upstream React/Base UI API equivalence. Scroll controls, foreign-document portals, arbitrary glyph selectors and full positioning parity are not included.

## Base-draft family profile projections

The additional family recipes compare the retained `apps/v4/registry/bases/base/ui/`, `apps/v4/registry/new-york-v4/ui/` and `apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css` sources at `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, under the MIT license above. Source units, per-profile paint, states and deliberately unsupported selectors remain explicit; no upstream React runtime or stylesheet is executed as a Proto renderer. This broader presentation comparison does not relabel older API or content-pinned baselines. Passive regions, private exact-Base Table hook wrappers, optional Field compositions and indexed Slider Values retain Proto Base ownership rather than borrowing another family or claiming upstream APIs. All attribution above remains applicable; source/catalog coverage and authored tests are not exact-head native or full-profile acceptance.

## Explicit website CommandMenu presentation (2026-10-31)

The opt-in `presentation="menu"` visual recipe derives from the MIT-licensed shadcn/ui revision `24a16429815cc4d691f38b49d0f4ffc11a9daef4`, `apps/v4/components/command-menu.tsx` and its New York Command anatomy. This is a website-consumer recipe, not a replacement of Rhea or the other ordinary registry profiles. Proto keeps the selected family color/theme and semantic Dialog/Command owners, uses its actual localized navigation and Pagefind results, preserves an accessible Cancel action, and bounds enlarged/short layouts. A passive glyph is not an actionable input prefix or full InputGroup addon API. Upstream Next.js, Fumadocs/cmdk, analytics, styles/colors/blocks catalog and copy-command features are not imported or claimed implemented. The existing MIT license and attribution above continue to apply; native and full upstream conformance remain separate.
