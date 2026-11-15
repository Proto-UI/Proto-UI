---
title: '原型文档覆盖索引'
description: '查找已实现原型家族的文档，区分导出、实验与待迁移缺口。'
---

本索引将实现家族对应到读者文档。家族页同时记录其组成部件；源码文件、生成图标、authoring `asHook`、CLI facade 与编目身份不是同一种计数单位。选择 API 前应阅读对应页面的生命周期与宿主边界。包已发布不等于 draft `P-*` 实体已经转为 active。

## 当前库入口

当前工作区导出请从 [Base](/zh-cn/ui-libraries/base/)、[Shadcn](/zh-cn/ui-libraries/shadcn/)、[Brutalist](/zh-cn/ui-libraries/brutalist/) 与 [Lucide](/zh-cn/ui-libraries/lucide/) 进入。前三者渲染共享的当前导出索引，Lucide 保留生成的可搜索图标库。入口区分已发布 0.2.0 安装基线与工作区 0.3 源码，并链接各家族真实的详情路由。

Shadcn Input Shell 与 Style Scope 目前链接到 draft 协议源码，其完整公开 Usage 与宿主证据仍未闭合。索引保留这些源码导出，不把它们静默算作完整详情页。其他库入口仍是实验范围，不属于四家族 0.3 承诺。

下方表格与分支检查点保留 **2026-10-04 的历史盘点**，包括当时缺失的 Base Input 路由。当前 Base Input 指南见[这里](/zh-cn/ui-libraries/base/input/)。旧测试结果、失败、hash 与源码身份继续保留在[当日审计](https://github.com/Proto-UI/Proto-UI/blob/main/apps/www/docs/prototype-coverage-audit-2026-10-04.md)，不转称为后续源码树的验收。[#1042](https://github.com/Proto-UI/Proto-UI/issues/1042)及其保留的[验收载体 #1323](https://github.com/Proto-UI/Proto-UI/issues/1323)继续记录路由、宿主、包、响应式与可访问性条件；静态路由目录不能满足这些执行条件。

## 如何阅读清单

源码目录为 `packages/prototypes/<library>/src/<family>`。下面的部件标签标识源码文件，不定义新的导出命名：`overlay` 实现文档中的 Mask；Transition 的 `as-transition` 与 `transition` 属于同一协议。实际 import 以详情页和包导出为准。复合部件共用家族页，不以只有一句话的独立页制造虚假覆盖。

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
| Input：[文档 PR #812](https://github.com/Proto-UI/Proto-UI/pull/812) | `root` |
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

逐图标生成导出是 `P-LUCIDE-ICON` 的特化，由可搜索图标目录记录。manifest、snippets、loaders 是工具数据，不是新增协议。

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

## 当前工作区新增被动原子

Text 与 Surface 页面记录 PR #777 实际增加的可复用工作区原子。它们的名称与输入可复用，首页只是一个消费者；以下家族保持 draft，各自页面分别列出 Adapter/Compiler 限制。

- base: [Text](/zh-cn/ui-libraries/base/text/), [Surface](/zh-cn/ui-libraries/base/surface/)
- shadcn: [Text](/zh-cn/ui-libraries/shadcn/text/), [Surface](/zh-cn/ui-libraries/shadcn/surface/)
- brutalist: [Text](/zh-cn/ui-libraries/brutalist/components/text/), [Surface](/zh-cn/ui-libraries/brutalist/components/surface/)
- bootstrap-2-3-2: [Surface](/zh-cn/ui-libraries/bootstrap-2-3-2/surface/)
- liquid-glass: [Surface](/zh-cn/ui-libraries/liquid-glass/surface/)

## 分支新增项与缺口

本节是 2026-10-04 的审计检查点，不是发布公告。main 基线为 `d4bdb66b54d68625fb3da1109a76e0829c1e77d7`；后续集成与精确提交验证请查看所链接 PR。

- Base Input 在该基线已有源码和编目归属，但缺少 Base 详情路由。[PR #812](https://github.com/Proto-UI/Proto-UI/pull/812) 补充双语 API 页面和真实的四种 Web runtime 预览；Shadcn Input 页面不能代替 Base 协议文档。
- [PR #808](https://github.com/Proto-UI/Proto-UI/pull/808) 增加 Bootstrap Checkbox Root/Indicator、Switch Root/Thumb、Toggle、Input、Textarea、Separator。六个新增家族页覆盖八个新增部件，加上 Button 共七类组件、九个部件，仍是部分 draft 家族；上面的 main 基线表不会提前把这些条目当成已集成。
- [Material 实验](/zh-cn/ui-libraries/liquid-glass/material-experiment/) 单独记录 PR #809 的 `experimental-owned-material-button`，不与现有 stage-0 Liquid Glass Button 混淆。它不是已发布的库导出，也不代表通用 Compiler 支持。
- [PR #777](https://github.com/Proto-UI/Proto-UI/pull/777) 曾引入五个 `site-*` 定义；当前工作区用可复用 Text/Surface 与既有 Lucide 组合替代。三个 image-zoom 定义（两个继承自 main，一个新增）也由后续依赖移除。文档图片预览改为组合已有 Button/Dialog owner 与公开 Surface 绘制，不准入页面专用 API；日期审计保留精确源码身份和迁移检查点。

## 让新增原型同时进入文档

每新增一个身份或部件，都应在对应家族页补齐 import、anatomy、输入、可观察输出、生命周期与明确不支持的范围，并从库入口或贡献入口连接可到达页面。真实 runtime 示例必须 import 已实现的公开表面；不要为制造 Demo 而注册不存在的原型。Adapter 执行与 Compiler 准入应分别陈述；明确拒绝的诊断不等于编译成功。

网站源码审计也检查包外定义与实验，避免它们藏在公开导出检查之外。对不支持或页面专用的实现记录有界缺口，再由受治理原子或既有组合替代。`apps/www/docs/prototype-coverage-audit-2026-10-04.md` 保存了已检查的精确提交与迁移对象。
