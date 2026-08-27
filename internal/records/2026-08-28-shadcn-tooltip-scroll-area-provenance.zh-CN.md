# 2026-08-28 shadcn Tooltip 与 Scroll Area 来源范围记录

> Internal record. Not normative. 本文补录 PR #534 中 shadcn Tooltip 与 Scroll Area 投射的第三方来源、转换范围和归属证据。稳定语义仍以 `spec/**` 为准；本文不扩大两个 draft family 的兼容保证。

## 1）固定上游基线

两个 family 使用同一个可复验的 shadcn/ui 比较 revision：

- repository：`shadcn-ui/ui`
- revision：`f31ed81983653919dd4fe77aee4b4859f610f1dc`
- Tooltip source：[`apps/v4/registry/new-york-v4/ui/tooltip.tsx`](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/tooltip.tsx)
- Scroll Area source：[`apps/v4/registry/new-york-v4/ui/scroll-area.tsx`](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/scroll-area.tsx)
- upstream license：[MIT `LICENSE.md`](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/LICENSE.md)
- repository attribution：`packages/prototypes/shadcn/THIRD_PARTY_NOTICES.md`

这些路径是来源与比较基线，不表示 Proto UI 与该 revision 完全 API、DOM 或视觉等价，也不表示上游认证。后续上游变化不会自动修改当前 draft guarantee；同步必须通过新的实现、测试、entity revision 与来源记录完成。

## 2）Tooltip 的参考、转换与未复制范围

参考或转换的范围：

- 参考 upstream 的 Tooltip、TooltipTrigger、TooltipContent 与 TooltipProvider family 划分；Proto UI 将 provider-style 多实例协调投射为独立 `Group`，并让 Root、Trigger、Content 继承既有 Base Tooltip 协议。
- Content 的 `rounded-md`、`px-3`、`py-1.5` 与 `text-xs` 取自固定 baseline 的公开视觉 recipe，再转换为 Proto UI `tw(...)` style intent；本地 `border`、`bg-popover`、`text-popover-foreground`、`shadow-md` 与 overflow choice 是当前 Proto UI shadcn design-language delta，不宣称与固定 baseline 相同。
- Trigger 的 hover opacity、focus-visible ring 与 pressed scale 是由 Proto UI Base/runtime state handles 驱动的本地反馈规则，不是 upstream React event code 的移植。

未复制的范围：

- 没有复制 upstream React component 实现、Radix primitive 调用、prop spread、`className` merge、`data-slot`、Portal/Arrow JSX 或动画 class recipe。
- 没有复制 icon、图片、字体或其他静态资产。
- open、delay、disabled、request、Overlay、Portal、anchored positioning 与 accessibility semantics 来自 Proto UI 已有 Base Tooltip、module、runtime 与 adapter 实现，不来自 shadcn source。

## 3）Scroll Area 的参考、转换与未复制范围

参考或转换的范围：

- 参考 upstream Root、Viewport、Scrollbar 与 Thumb 的 family anatomy，以及 Root `relative`、Viewport full-size/rounding、Scrollbar flex/touch/orientation geometry 和 Thumb `relative flex-1 rounded-full bg-border` 的公开视觉 recipe。
- 这些规则被拆为四个 Proto UI prototype，并转换为 `tw(...)` style intent 与 state-driven orientation rules。Root 的 `overflow-hidden`、Viewport 的 `rounded-md`、Scrollbar 的 absolute edge placement/transparent two-pixel border，以及显式 composed projection 是当前 Proto UI 投射和宿主几何要求；它们不宣称与固定 baseline 的 DOM/CSS 相同。

未复制的范围：

- 没有复制 upstream React component 实现、Radix primitive 调用、prop spread、`className` merge、`data-slot` 或 Corner JSX。
- 没有复制 icon、图片、字体或其他静态资产。
- scroll position/extent、host surface ownership、system/composed resolution、thumb geometry、pointer routing 与 accessibility semantics 来自 Proto UI Base Scroll Area、Scroll module、host capability 和 adapters，不来自 shadcn source。

## 4）提交与 AI 辅助披露

PR #534 的贡献者声明没有逐字复制第三方代码；上面列出的公开 family/anatomy 与视觉 recipe 是被观察、选择并转换的第三方设计系统材料。PR 描述披露实现、spec、测试与文档由 OpenAI Codex/GPT-5.6 类工具实质辅助生成，并由提交者人工复核 diff；本次 provenance remediation 另外人工核对了固定上游文件、跨 runtime 浏览器证据、catalog、类型检查与许可 notice，且未向模型提供私有、雇主或客户代码。DCO 签署仍由每个 commit 的签署者负责，AI 披露不替代 DCO 或上游 MIT attribution。
