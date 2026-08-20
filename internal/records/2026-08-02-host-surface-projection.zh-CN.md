# 2026-08-02 Host Surface Projection 机制

> Internal record. Not normative. 稳定方向以 `K-HOST-SURFACE-ROLES-0001`、`C-HOST-SURFACE-PROJECTION-0001` 及其关系实体为准。

## 触发问题

PR #356 的人工验收发现：Base Textarea demo 在 React/Vue 中把 consumer class 投影到物理 `<textarea>`，而 Web Component adapter 保留 `<wc-base-textarea-root>` wrapper，并把 class 留在 wrapper。结果是 wrapper 呈现完整边框、背景与宽度，内部真正可聚焦 textarea 仍使用浏览器默认尺寸和 outline；视觉范围、点击范围与 focus surface 分裂。

已有 Text Control protocol 保证一个 host-owned physical editor，Web Component adapter 也确实只创建一个 textarea，因此这不是第二个 editing owner。问题来自 logical instance boundary 与 presentation surface 未被显式区分，导致 adapter-native class transport 错把 infrastructure wrapper 当成 User 感知表面。

## 当前方向

- `boundaryTarget` 承载 lifecycle、logical tree、semantic event boundary、exposes/ref 与 `data-pui-root` 等 adapter identity metadata。
- `surfaceTarget` 承载 Prototype Root style、`feedback.style` translation result 与 adapter-normalized surface class/style。
- 普通 adapter 默认令两个角色指向同一 target；WC Text Control 保留 custom-element boundary，并令 inner textarea 成为 surface。
- Surface 不成为通用 focus/a11y/event/hit target。Text Control、Focus、A11y 等 domain 继续使用各自 host capability；具体 profile 可以把这些 target 解析为与 surface 相同的物理对象。
- WC 原生 `class` attribute 继续属于 custom-element boundary。跨 adapter preview 或 programmatic integration 使用显式 `surfaceClassName` / `surfaceClass` / `surfaceStyle` normalized channel；inner control 同时提供 `part="control"` 作为 Web Component idiomatic styling hook。
- Surface replacement 必须迁移 adapter-owned visual projection，并保留不属于该 source 的宿主/consumer class 与 inline style。

## 拒绝的快捷方案

- 不在文档站添加 `wc-xxx > textarea` 专用 CSS；这只隐藏 previewer 症状，真实 consumer 仍会遇到同一分裂。
- 不把所有 WC `class` attribute 自动搬到 inner target；原生 custom-element class 仍是合法的 boundary styling escape hatch，且非 Text Control prototype 未必存在内部 surface。
- 不建立任意 named-target registry；当前证据只要求 boundary 与 presentation 两角色，domain target 继续由现有 capability 管理。

## 初始实现与验证

- Adapter Base 提供可重绑定的 `HostSurfaceProjection`。
- WC adapter 为普通 prototype 折叠 boundary/surface，为 Text Control 选择内部 textarea surface。
- Previewer 的 proto-node `className` 被解释为 normalized presentation intent；box node 仍使用普通 DOM class。
- React/Vue 把 normalized surface channel 映射到现有根元素，WC 将其映射到 inner textarea。
- Contract tests 覆盖默认折叠、WC split target、owned class/style replacement cleanup 与三 adapter preview projection；浏览器验收继续覆盖真实尺寸、远端点击聚焦与 focus style。

## 后续观察点

- Portal/retained view target replacement 是否需要复用同一 surface lease。
- 隐藏 native input + visible control 是否需要独立 presentation surface，或应由更具体的 compound prototype/anatomy contract 表达。
- 非 Web host 的 visual decorator/widget mapping 是否验证当前二角色模型足够。
- `surfaceClass` 等 host-local escape hatch 在 RC 之后的命名与兼容政策。

## 人工验收迭代：state selector context

Brutalist Textarea 的后续人工验收暴露了第二类 split-surface 漂移：WC 的 `feedback.style` token 已正确落到内部 textarea，但 rule 翻译出的 `data-[disabled]:opacity-50` 依赖 `data-disabled` 与 style token 位于同一元素。此前 canonical expose-state marker 只存在于 custom-element boundary，因此 React/Vue 能匹配，WC surface 不能匹配。

当前修正保留 owner session 在 boundary 上的 canonical state exposure，同时让 attached view 的 expose-state-web projection 以 presentation surface 为 Web selector 求值 target。内部 textarea 因而同时获得有限的 state marker 与条件 style token；`data-pui-root`、logical tree、events、exposes 等 instance identity 仍只属于 boundary。这里投影的是视觉求值环境，而不是复制 state ownership。
