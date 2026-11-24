---
title: 'Prototype Documentation Coverage'
description: 'Browse implemented Prototype families, their documentation pages, and source part directories across libraries.'
---

This index maps implemented Prototype families to their documentation pages. Compound components share one family page so all cooperating parts, props, and examples live in one place.

## Library entry points

For live export catalogs and full navigation, start from each library's overview page:

- [Base](/en/ui-libraries/base/)
- [Shadcn](/en/ui-libraries/shadcn/)
- [Brutalist](/en/ui-libraries/brutalist/)
- [Lucide](/en/ui-libraries/lucide/)

Base, Shadcn, and Brutalist render the synced export index, and Lucide provides a searchable icon directory.

## How to read the tables

Source code lives under `packages/prototypes/<library>/src/<family>`. The **Source parts** column lists source filenames to help contributors locate implementations quickly (for example, `overlay` implements the mask layer, and `as-transition` / `transition` share one protocol). Refer to each family's detail page for public import names.

## base

| Family documentation | Source parts |
| --- | --- |
| [Async Region](/en/ui-libraries/base/async-region/) | `root` |
| [Button](/en/ui-libraries/base/button/) | `button` |
| [Checkbox](/en/ui-libraries/base/checkbox/) | `indicator`, `root` |
| [Dialog](/en/ui-libraries/base/dialog/) | `close`, `content`, `description`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/en/ui-libraries/base/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/en/ui-libraries/base/hover-card/) | `content`, `root`, `trigger` |
| [Image](/en/ui-libraries/base/image/) | `root` |
| [Input](/en/ui-libraries/base/input/) | `root` |
| [Live Region](/en/ui-libraries/base/live-region/) | `root` |
| [Radio Group](/en/ui-libraries/base/radio-group/) | `indicator`, `item`, `root` |
| [Scroll Area](/en/ui-libraries/base/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/en/ui-libraries/base/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/en/ui-libraries/base/separator/) | `root` |
| [Switch](/en/ui-libraries/base/switch/) | `root`, `thumb` |
| [Table](/en/ui-libraries/base/table/) | `caption`, `cell`, `header-cell`, `root`, `row` |
| [Tabs](/en/ui-libraries/base/tabs/) | `content`, `indicator`, `list`, `root`, `trigger` |
| [Textarea](/en/ui-libraries/base/textarea/) | `root` |
| [Toggle](/en/ui-libraries/base/toggle/) | `toggle` |
| [Tooltip](/en/ui-libraries/base/tooltip/) | `content`, `group`, `root`, `trigger` |
| [Transition](/en/ui-libraries/base/transition/) | `as-transition`, `transition` |

## bootstrap-2-3-2

| Family documentation                               | Source parts |
| -------------------------------------------------- | ------------ |
| [Button](/en/ui-libraries/bootstrap-2-3-2/button/) | `button`     |

## brutalist

| Family documentation | Source parts |
| --- | --- |
| [Badge](/en/ui-libraries/brutalist/components/badge/) | `root` |
| [Button](/en/ui-libraries/brutalist/components/button/) | `button` |
| [Card](/en/ui-libraries/brutalist/components/card/) | `content`, `footer`, `header`, `root` |
| [Checkbox](/en/ui-libraries/brutalist/components/checkbox/) | `indicator`, `root` |
| [Dialog](/en/ui-libraries/brutalist/components/dialog/) | `close-icon`, `close`, `content`, `description`, `footer`, `header`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/en/ui-libraries/brutalist/components/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/en/ui-libraries/brutalist/components/hover-card/) | `content`, `root`, `trigger` |
| [Scroll Area](/en/ui-libraries/brutalist/components/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/en/ui-libraries/brutalist/components/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/en/ui-libraries/brutalist/components/separator/) | `root` |
| [Skeleton](/en/ui-libraries/brutalist/components/skeleton/) | `root` |
| [Spinner](/en/ui-libraries/brutalist/components/spinner/) | `root` |
| [Switch](/en/ui-libraries/brutalist/components/switch/) | `root`, `thumb` |
| [Tabs](/en/ui-libraries/brutalist/components/tabs/) | `content`, `list`, `root`, `trigger` |
| [Textarea](/en/ui-libraries/brutalist/components/textarea/) | `root` |
| [Toggle](/en/ui-libraries/brutalist/components/toggle/) | `toggle` |
| [Tooltip](/en/ui-libraries/brutalist/components/tooltip/) | `content`, `group`, `root`, `trigger` |

## liquid-glass

| Family documentation                            | Source parts |
| ----------------------------------------------- | ------------ |
| [Button](/en/ui-libraries/liquid-glass/button/) | `button`     |

## lucide

| Family documentation                    | Source parts |
| --------------------------------------- | ------------ |
| [Icons](/en/ui-libraries/lucide/icons/) | `icon`       |

All generated icons share the `P-LUCIDE-ICON` protocol and are browsable in the searchable icon directory.

## shadcn

| Family documentation | Source parts |
| --- | --- |
| [Button](/en/ui-libraries/shadcn/button/) | `button` |
| [Checkbox](/en/ui-libraries/shadcn/checkbox/) | `indicator`, `root` |
| [Dialog](/en/ui-libraries/shadcn/dialog/) | `close-icon`, `close`, `content`, `description`, `footer`, `header`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/en/ui-libraries/shadcn/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/en/ui-libraries/shadcn/hover-card/) | `content`, `root`, `trigger` |
| [Input](/en/ui-libraries/shadcn/input/) | `root` |
| [Radio Group](/en/ui-libraries/shadcn/radio-group/) | `indicator`, `item`, `root` |
| [Scroll Area](/en/ui-libraries/shadcn/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/en/ui-libraries/shadcn/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/en/ui-libraries/shadcn/separator/) | `root` |
| [Switch](/en/ui-libraries/shadcn/switch/) | `root`, `thumb` |
| [Tabs](/en/ui-libraries/shadcn/tabs/) | `content`, `list`, `root`, `trigger` |
| [Textarea](/en/ui-libraries/shadcn/textarea/) | `root` |
| [Toggle](/en/ui-libraries/shadcn/toggle/) | `toggle` |
| [Tooltip](/en/ui-libraries/shadcn/tooltip/) | `content`, `group`, `root`, `trigger` |

## Surface and Text atoms

Reusable `Text` and `Surface` primitives are also available across libraries:

- base: [Text](/en/ui-libraries/base/text/), [Surface](/en/ui-libraries/base/surface/)
- shadcn: [Text](/en/ui-libraries/shadcn/text/), [Surface](/en/ui-libraries/shadcn/surface/)
- brutalist: [Text](/en/ui-libraries/brutalist/components/text/), [Surface](/en/ui-libraries/brutalist/components/surface/)
- bootstrap-2-3-2: [Surface](/en/ui-libraries/bootstrap-2-3-2/surface/)
- liquid-glass: [Surface](/en/ui-libraries/liquid-glass/surface/)

## Keeping documentation in sync

When adding a new Prototype identity or compound part, update its family page with imports, Anatomy parts, props, events/methods, and live examples, and connect the page to its library's navigation entry.
