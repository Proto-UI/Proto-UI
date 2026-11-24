---
title: '原型文档覆盖索引'
description: '按组件库查找已实现的原型家族、对应文档页面与源码部件结构。'
---

本页汇总各原型库中已实现的组件家族及其文档入口。每个复合组件共享同一份家族文档页，方便在一个页面内查阅完整部件、API 与示例。

## 组件库总览

查看当前导出列表与组件导航，请直接进入各库入口页：

- [Base](/zh-cn/ui-libraries/base/)
- [Shadcn](/zh-cn/ui-libraries/shadcn/)
- [Brutalist](/zh-cn/ui-libraries/brutalist/)
- [Lucide](/zh-cn/ui-libraries/lucide/)

其中 Base、Shadcn 与 Brutalist 提供实时同步的组件索引，Lucide 提供可搜索的图标目录。

## 阅读说明

源码按 `packages/prototypes/<library>/src/<family>` 目录组织。下表中的“源码部件”列对应源码文件名，便于贡献者快速定位实现：例如 `overlay` 对应遮罩部件，Transition 中的 `as-transition` 与 `transition` 同属一个协议。实际使用时的导入名称请以对应组件详情页为准。

## base

| 家族文档 | 源码部件 |
| --- | --- |
| [Async Region](/zh-cn/ui-libraries/base/async-region/) | `root` |
| [Button](/zh-cn/ui-libraries/base/button/) | `button` |
| [Checkbox](/zh-cn/ui-libraries/base/checkbox/) | `indicator`, `root` |
| [Dialog](/zh-cn/ui-libraries/base/dialog/) | `close`, `content`, `description`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/zh-cn/ui-libraries/base/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/zh-cn/ui-libraries/base/hover-card/) | `content`, `root`, `trigger` |
| [Image](/zh-cn/ui-libraries/base/image/) | `root` |
| [Input](/zh-cn/ui-libraries/base/input/) | `root` |
| [Live Region](/zh-cn/ui-libraries/base/live-region/) | `root` |
| [Radio Group](/zh-cn/ui-libraries/base/radio-group/) | `indicator`, `item`, `root` |
| [Scroll Area](/zh-cn/ui-libraries/base/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/zh-cn/ui-libraries/base/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/zh-cn/ui-libraries/base/separator/) | `root` |
| [Switch](/zh-cn/ui-libraries/base/switch/) | `root`, `thumb` |
| [Table](/zh-cn/ui-libraries/base/table/) | `caption`, `cell`, `header-cell`, `root`, `row` |
| [Tabs](/zh-cn/ui-libraries/base/tabs/) | `content`, `indicator`, `list`, `root`, `trigger` |
| [Textarea](/zh-cn/ui-libraries/base/textarea/) | `root` |
| [Toggle](/zh-cn/ui-libraries/base/toggle/) | `toggle` |
| [Tooltip](/zh-cn/ui-libraries/base/tooltip/) | `content`, `group`, `root`, `trigger` |
| [Transition](/zh-cn/ui-libraries/base/transition/) | `as-transition`, `transition` |

## bootstrap-2-3-2

| 家族文档                                              | 源码部件 |
| ----------------------------------------------------- | -------- |
| [Button](/zh-cn/ui-libraries/bootstrap-2-3-2/button/) | `button` |

## brutalist

| 家族文档 | 源码部件 |
| --- | --- |
| [Badge](/zh-cn/ui-libraries/brutalist/components/badge/) | `root` |
| [Button](/zh-cn/ui-libraries/brutalist/components/button/) | `button` |
| [Card](/zh-cn/ui-libraries/brutalist/components/card/) | `content`, `footer`, `header`, `root` |
| [Checkbox](/zh-cn/ui-libraries/brutalist/components/checkbox/) | `indicator`, `root` |
| [Dialog](/zh-cn/ui-libraries/brutalist/components/dialog/) | `close-icon`, `close`, `content`, `description`, `footer`, `header`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/zh-cn/ui-libraries/brutalist/components/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/zh-cn/ui-libraries/brutalist/components/hover-card/) | `content`, `root`, `trigger` |
| [Scroll Area](/zh-cn/ui-libraries/brutalist/components/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/zh-cn/ui-libraries/brutalist/components/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/zh-cn/ui-libraries/brutalist/components/separator/) | `root` |
| [Skeleton](/zh-cn/ui-libraries/brutalist/components/skeleton/) | `root` |
| [Spinner](/zh-cn/ui-libraries/brutalist/components/spinner/) | `root` |
| [Switch](/zh-cn/ui-libraries/brutalist/components/switch/) | `root`, `thumb` |
| [Tabs](/zh-cn/ui-libraries/brutalist/components/tabs/) | `content`, `list`, `root`, `trigger` |
| [Textarea](/zh-cn/ui-libraries/brutalist/components/textarea/) | `root` |
| [Toggle](/zh-cn/ui-libraries/brutalist/components/toggle/) | `toggle` |
| [Tooltip](/zh-cn/ui-libraries/brutalist/components/tooltip/) | `content`, `group`, `root`, `trigger` |

## liquid-glass

| 家族文档                                           | 源码部件 |
| -------------------------------------------------- | -------- |
| [Button](/zh-cn/ui-libraries/liquid-glass/button/) | `button` |

## lucide

| 家族文档                                   | 源码部件 |
| ------------------------------------------ | -------- |
| [Icons](/zh-cn/ui-libraries/lucide/icons/) | `icon`   |

所有图标共享 `P-LUCIDE-ICON` 协议，并统一收录在可搜索图标目录中。

## shadcn

| 家族文档 | 源码部件 |
| --- | --- |
| [Button](/zh-cn/ui-libraries/shadcn/button/) | `button` |
| [Checkbox](/zh-cn/ui-libraries/shadcn/checkbox/) | `indicator`, `root` |
| [Dialog](/zh-cn/ui-libraries/shadcn/dialog/) | `close-icon`, `close`, `content`, `description`, `footer`, `header`, `overlay`, `root`, `title`, `trigger` |
| [Dropdown Menu](/zh-cn/ui-libraries/shadcn/dropdown-menu/) | `content`, `item`, `root`, `trigger` |
| [Hover Card](/zh-cn/ui-libraries/shadcn/hover-card/) | `content`, `root`, `trigger` |
| [Input](/zh-cn/ui-libraries/shadcn/input/) | `root` |
| [Radio Group](/zh-cn/ui-libraries/shadcn/radio-group/) | `indicator`, `item`, `root` |
| [Scroll Area](/zh-cn/ui-libraries/shadcn/scroll-area/) | `root`, `scrollbar`, `thumb`, `viewport` |
| [Select](/zh-cn/ui-libraries/shadcn/select/) | `content`, `item`, `root`, `trigger`, `value` |
| [Separator](/zh-cn/ui-libraries/shadcn/separator/) | `root` |
| [Switch](/zh-cn/ui-libraries/shadcn/switch/) | `root`, `thumb` |
| [Tabs](/zh-cn/ui-libraries/shadcn/tabs/) | `content`, `list`, `root`, `trigger` |
| [Textarea](/zh-cn/ui-libraries/shadcn/textarea/) | `root` |
| [Toggle](/zh-cn/ui-libraries/shadcn/toggle/) | `toggle` |
| [Tooltip](/zh-cn/ui-libraries/shadcn/tooltip/) | `content`, `group`, `root`, `trigger` |

## 基础容器与文本原子

以下各库还提供可复用的 `Text` 与 `Surface` 基础原子：

- base：[Text](/zh-cn/ui-libraries/base/text/)、[Surface](/zh-cn/ui-libraries/base/surface/)
- shadcn：[Text](/zh-cn/ui-libraries/shadcn/text/)、[Surface](/zh-cn/ui-libraries/shadcn/surface/)
- brutalist：[Text](/zh-cn/ui-libraries/brutalist/components/text/)、[Surface](/zh-cn/ui-libraries/brutalist/components/surface/)
- bootstrap-2-3-2：[Surface](/zh-cn/ui-libraries/bootstrap-2-3-2/surface/)
- liquid-glass：[Surface](/zh-cn/ui-libraries/liquid-glass/surface/)

## 保持文档同步

新增原型身份或复合部件时，请在对应家族页面同步补充导入方式、Anatomy 部件、属性表、事件方法与交互示例，并将新页面接入对应组件库的导航入口，确保每个公开组件都可从官网直接查阅和试用。
