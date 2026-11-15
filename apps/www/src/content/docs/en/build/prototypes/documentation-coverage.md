---
title: 'Prototype Documentation Coverage'
description: 'Find the documentation for implemented prototype families and distinguish exports, experiments, and migration gaps.'
---

This index maps implementation families to their reader-facing documentation. A family page covers its constituent parts; a file, a generated icon, an authored `asHook`, a CLI facade, and a catalog identity are not interchangeable units. Read each page's lifecycle and host limits before choosing an API. Package publication does not automatically activate a draft `P-*` entity.

## Current library entry points

For current workspace exports, use [Base](/en/ui-libraries/base/), [Shadcn](/en/ui-libraries/shadcn/), [Brutalist](/en/ui-libraries/brutalist/) and [Lucide](/en/ui-libraries/lucide/). The first three render the shared current export index; Lucide retains its generated searchable catalog. These entry pages distinguish the published 0.2.0 install baseline from workspace 0.3 source and link each family's real detail route.

Shadcn Input Shell and Style Scope currently link to their draft source protocols because complete public Usage and host evidence remain open. Their source exports are retained in the index; they are not silently counted as complete detail pages. Other library entries remain experimental and are outside the four-family 0.3 commitment.

The tables and branch checkpoints below retain the **2026-10-04 historical inventory**, including its then-missing Base Input route. The current Base Input guide is [here](/en/ui-libraries/base/input/). Earlier test results, failures, hashes and source identities remain in [the dated audit](https://github.com/Proto-UI/Proto-UI/blob/main/apps/www/docs/prototype-coverage-audit-2026-10-04.md); they are not acceptance of a later source tree. [#1042](https://github.com/Proto-UI/Proto-UI/issues/1042) and its retained [acceptance carrier #1323](https://github.com/Proto-UI/Proto-UI/issues/1323) preserve the route, host, package, responsive and accessibility conditions. A static route index does not satisfy those execution conditions.

## How to read the inventory

The source directory is `packages/prototypes/<library>/src/<family>`. Part labels below identify source files, not a new export naming convention: `overlay` implements the documented Mask identity; Transition's `as-transition` and `transition` belong to one protocol. The detail page and package export define the actual import. Compound parts share a family page rather than getting superficial one-line pages.

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
| Input: [documentation PR #812](https://github.com/Proto-UI/Proto-UI/pull/812) | `root` |
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

Generated per-icon exports are specializations of `P-LUCIDE-ICON`; the searchable icon catalog documents them. Manifest, snippets, and loaders are tooling rather than additional protocols.

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

## New passive atoms in this workspace

The Text and Surface pages describe the reusable workspace atoms introduced with PR #777. Their names and inputs are reusable; the homepage is only one consumer. The families below are draft and retain the Adapter/Compiler limits stated on each page.

- base: [Text](/en/ui-libraries/base/text/), [Surface](/en/ui-libraries/base/surface/)
- shadcn: [Text](/en/ui-libraries/shadcn/text/), [Surface](/en/ui-libraries/shadcn/surface/)
- brutalist: [Text](/en/ui-libraries/brutalist/components/text/), [Surface](/en/ui-libraries/brutalist/components/surface/)
- bootstrap-2-3-2: [Surface](/en/ui-libraries/bootstrap-2-3-2/surface/)
- liquid-glass: [Surface](/en/ui-libraries/liquid-glass/surface/)

## Branch-only additions and gaps

This section is an audit checkpoint dated 2026-10-04, not a release announcement. The main baseline was `d4bdb66b54d68625fb3da1109a76e0829c1e77d7`. Follow the linked pull requests for later integration and exact-head evidence.

- Base Input has source and catalog ownership on that baseline, but its Base detail route was missing. [PR #812](https://github.com/Proto-UI/Proto-UI/pull/812) supplies bilingual API pages and real four-Web-runtime previews; the Shadcn Input page is not a substitute for the Base protocol documentation.
- [PR #808](https://github.com/Proto-UI/Proto-UI/pull/808) adds Bootstrap Checkbox Root/Indicator, Switch Root/Thumb, Toggle, Input, Textarea, and Separator. Its six new family pages cover those eight new parts. Together with Button this is seven component kinds and nine parts, still a partial draft family. These entries are not silently added to the main-baseline table above.
- [The Material experiment](/en/ui-libraries/liquid-glass/material-experiment/) records `experimental-owned-material-button` from PR #809, separately from the existing stage-0 Liquid Glass Button. It is not a released library export or a general Compiler support claim.
- [PR #777](https://github.com/Proto-UI/Proto-UI/pull/777) originally introduced five `site-*` definitions; this workspace replaces them with reusable Text/Surface and existing Lucide composition. Its three image-zoom definitions (two inherited from main, one newly introduced) are also removed by the later dependency. Document image zoom now composes existing Button/Dialog owners with public Surface paint. No page-specific API is admitted; the dated audit preserves exact source identities and migration checkpoints.

## Keep new prototypes documented

For each new identity or part, update the applicable family page with imports, anatomy, inputs, observable outputs, lifecycle, and negative boundaries. Link a reachable page from the library or contribution entry. A real runtime example must import the implemented public surface; do not register an unavailable prototype merely to create a demo. State Adapter execution and Compiler admission separately. A supported rejection diagnostic is not successful compilation.

The website source audit also inspects non-package definitions and experiments so that they cannot disappear behind the public-export checklist. Record an unsupported or page-specific implementation as a bounded gap, then replace it with governed atoms or existing composition. The dated engineering inventory in `apps/www/docs/prototype-coverage-audit-2026-10-04.md` records exact examined heads and those migration targets.
