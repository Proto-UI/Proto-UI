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
