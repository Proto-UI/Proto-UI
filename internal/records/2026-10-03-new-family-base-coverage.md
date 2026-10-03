# Full Base coverage for the new projection families

Date: 2026-10-03. Non-normative task inventory for #792. Baseline `f7edface`.

The completion boundary is all 20 public Base families / 53 public parts in each projection, with real composition and evidence. The separate `asTransition` authoring hook is not counted as another rendered part. The companion JSON records every part separately. No missing part is silently inherited from Shadcn/Brutalist or marked complete by a union/registry entry.

| Base family | Public parts | Bootstrap 2.3.2 interpretation | Both families now |
| --- | --- | --- | --- |
| async-region | root | No direct component; neutral semantic container | Missing |
| button | button | 2.3.2 .btn / .btn-primary | Button four-Web subset; Liquid opaque only |
| checkbox | indicator, root | 2.3.2 form checkbox; custom parts documented | Missing |
| dialog | close, content, description, overlay, root, title, trigger | 2.3.2 modal and backdrop | Missing |
| dropdown | content, item, root, trigger | 2.3.2 dropdown menu | Missing |
| hover-card | content, root, trigger | 2.3.2 popover visual analogue; Base hover-card behavior | Missing |
| image | root | 2.3.2 image frame variants | Missing |
| input | root | 2.3.2 form text inputs | Missing |
| live-region | root | No direct component; neutral semantic container | Missing |
| radio-group | indicator, item, root | 2.3.2 form radio group | Missing |
| scroll-area | root, scrollbar, thumb, viewport | No custom 2.3.2 scrollbar; palette-derived extension | Missing |
| select | content, item, root, trigger, value | 2.3.2 native select visual reference; Base popup behavior differs | Missing |
| separator | root | 2.3.2 hr / menu divider | Missing |
| switch | root, thumb | No core 2.3.2 switch; palette-derived extension, no plugin claim | Missing |
| table | caption, cell, header-cell, root, row | 2.3.2 table / bordered/striped visual vocabulary | Missing |
| tabs | content, indicator, list, root, trigger | 2.3.2 nav-tabs / tab-content | Missing |
| textarea | root | 2.3.2 form textarea | Missing |
| toggle | toggle | 2.3.2 stateful .btn visual reference | Missing |
| tooltip | content, group, root, trigger | 2.3.2 tooltip | Missing |
| transition | transition | 2.3.2 fade analogue; motion policy explicit | Missing |

## Execution order

1. State/text controls: Checkbox + Indicator, Switch + Thumb, Toggle, Input, Textarea, Separator.
2. Selection/composition: Tabs parts and Radio Group parts.
3. Overlay composition: Select, Dropdown, Dialog, Tooltip and Hover Card parts, with inherited dismissal/focus/portal/placement behavior.
4. Scroll Area, Image, Table, Transition, Async Region and Live Region; semantic-only owners may intentionally have no visual surface, but must be genuine Base-inheriting prototypes with composition tests.
5. Integrate every available part into the library, homepage and varied demonstrations after the shared #777 family boundary lands. Per-kind anatomy/loader/theme closure is required.

## Cross-host and atomic boundaries

- Existing Web adapters can execute genuine prototypes, but each new composition needs independent runtime/behavior/paint evidence; Button passes do not cover the other parts.
- #793 owns a separately reviewable reactive preference/material primitive. Main Liquid Glass effect remains incomplete until translucent enhancement, safe live fallback, readable contrast and reduced-motion behavior are actually observed. Content panels remain neutral; the whole page does not become glass.
- #798 prepares source-derived GPUI token/theme data. Root Feedback delivery still depends on #719 and its open #726 implicit-position reconciliation. Full native success means the actual Prototype executes, produces its transaction and updates, then Rust lays out/paints and delivers input/focus/a11y. Unit mapping alone is insufficient.
- #732/#733 govern Compiler admission and independent generated-target evidence. Flutter/Qt still need real backends/profiles; they are not inferred from Web or Rust token passes.
- Missing atomic semantics will be recorded precisely and repaired in bounded draft primitive slices with regression evidence. No style projection may invent stable Base semantics or silently erase unsupported host diagnostics.

## Source boundaries

Bootstrap references are fixed to [2.3.2 Base CSS](https://getbootstrap.com/2.3.2/base-css.html) and [2.3.2 Components](https://getbootstrap.com/2.3.2/components.html). Several Base owners have no exact upstream counterpart; the table explicitly labels those family-language extensions. No old jQuery runtime, plugin behavior, Glyphicons or upstream doc prose is copied. Apple references are [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials); no proprietary Apple assets or material-engine parity are claimed.
