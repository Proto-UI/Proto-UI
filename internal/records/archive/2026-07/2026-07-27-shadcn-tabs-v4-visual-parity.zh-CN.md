# 2026-07-27：Shadcn Tabs v4 默认样式还原度收敛

> Internal record. Not normative. 本文记录 `0.2.0-rc.6` 人工试用暴露的 Tabs 布局与视觉偏差，以及本轮对固定 shadcn/ui v4 baseline 的收敛范围；稳定规则见 `P-SHADCN-TABS*` 与对应 `T-SHADCN-TABS*` 实体。

## 外部观察

`shadcn-tabs-list` 只有 `inline-flex` 而没有明确的 fit-content width。在普通 inline formatting context 中它通常会收缩，但作为 flex/grid item 或被宿主布局 blockify 时仍可能 stretch，导致使用者经常需要手动补宽度。

进一步对照发现，问题不只是一枚宽度 token。当前 Tabs surface 来自较早期的独立视觉尝试：List 增加 border、shadow、rounded-xl 与 muted opacity，Trigger 增加额外 hover background、pressed scale 与 ring offset，Content 则直接承担 Card-like border、background、minimum height、padding 与 shadow。这些选择与实体固定的 shadcn/ui v4 new-york baseline 已有明显外观差异。

## 固定基线

比较源继续使用既有实体固定的 `shadcn-ui/ui@f31ed81983653919dd4fe77aee4b4859f610f1dc`：

- Root 默认 horizontal composition：`flex flex-col gap-2`；
- List 默认 variant：`inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground`；
- Trigger 默认 horizontal/default variant：relative inline-flex、减 1px 高度、flex growth、gap-1.5、rounded-md、transparent border、px-2/py-1、foreground opacity，以及 selected/hover/focus/disabled 对应 surface；
- Content：`flex-1 outline-none`，内部 Card 或 panel chrome 由调用方组合内容提供。

固定 revision 与当前 upstream main 在上述基础结构上保持一致，因此本轮不更新 provenance revision，只收敛此前已经记录但尚未实现的 default-surface gap。

## 本轮边界

本轮对齐默认 horizontal orientation 与 List `default` variant，并把 upstream 的 Radix/data-state styling 翻译为 Proto UI 已有的 selected、hovered、focusVisible 与 disabled facts。Pressed 仍保留为 inherited interaction fact，但默认 v4 surface 不再为其增加独立缩放或背景。

以下内容继续保留在 compatibility open questions，不随默认样式修复仓促扩张：

- `variant="line"` API 与 line indicator；
- vertical orientation 的 `h-fit flex-col`、Trigger full-width 与 left alignment；
- upstream 显式 `dark:*` 分支；当前 Proto surface 仍通过主题变量自然换色，但本轮不扩张禁止冒号的 authored `tw()` token 契约；
- `data-slot`、native/className forwarding 与 Radix prop naming；
- nested SVG descendant rules；
- `forceMount` 与 Proto UI `keepMounted` 的 API 映射。

## Token 与验证

Proto style CSS renderer 增加 `w-fit`/`h-fit` 到 `fit-content` 的一等映射，并补齐 default Tabs surface 需要的 `flex-1`、`shadow-sm`、`outline-1` 与 `outline-ring`。不采用 `w-[fit-content]` 作为长期 workaround，以保持 prototype source、upstream token 与生成 CSS 之间的可追溯性。

验证需要同时覆盖：

- Root/List/Trigger/Content 的正向 v4 tokens；
- 已移除的旧 border/shadow/Card-like tokens 不再投射；
- selected、hover、focus-visible、disabled 与 hidden behavior 不回归；
- CLI 生成 CSS 不把新增 tokens 标为 unsupported；
- Web Component demo projection 与生成 style preset 同步更新。
