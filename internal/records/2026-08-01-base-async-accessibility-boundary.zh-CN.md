# 2026-08-01 Base 异步无障碍边界：Live Region 与 Async Region

> Internal record. Not normative. 本记录整理 OpenWebUI 应用探针发现的异步无障碍缺口、Base 层窄边界原语的建模判断与后续实体规划。当前编目方向已进入 draft `C-ASYNC-A11Y-0001`、`P-BASE-LIVE-REGION`、`P-BASE-ASYNC-REGION`、`T-BASE-LIVE-REGION-0001` 与 `T-BASE-ASYNC-REGION-0001`；本文不替代这些真相源。

---

## 1）背景

OpenWebUI 应用探针在组合消息状态反馈（"正在生成…"、"3 条新通知"、"加载完成"）时，发现 Base 层缺少两个窄语义原语：

1. **Live Region**：应用需要一个受治理的 ARIA live-region 容器，将 authored 文本内容作为播报载荷，并通过 `politeness`（polite/assertive）与 `atomic` props 控制 `role`、`aria-live`、`aria-atomic` 的投射。应用层不应自行拼写 ARIA attribute 或维护 role/live 的一致性。
2. **Async Region**：应用需要一个受治理的 `aria-busy` 容器，在异步操作期间标记区域忙碌状态，并暴露 `busy` state handle 供 styled 表面（Card/Badge）读取。应用层不应自行管理 `aria-busy` attribute 的生命周期。

两者均不涉及 focus 管理、event 路由、command 通路、announcement 定时器、替换状态机或聊天语义。这些责任由应用层或更高层 styled family 拥有。

## 2）边界判断

### 2.1 不引入第二个 `BaseXxxRoot` 命名约定

Package prototype export 遵循 `separatorRoot`、`scrollAreaRoot` 等既有模式：默认导出 prototype，命名导出 `liveRegionRoot` / `asyncRegionRoot`，as-hook 导出 `asLiveRegionRoot` / `asAsyncRegionRoot`。不在 prototype package 中引入 `BaseLiveRegionRoot` / `BaseAsyncRegionRoot` PascalCase 包装；CLI 生成的 adapter facade 继续遵循既有 PascalCase 约定。

### 2.2 Live Region 不是 status 组件

Live Region 是语义容器，不是状态机。它不拥有 `loading | success | error` 状态枚举，不拥有 announcement 定时器，不拥有替换策略。应用层在 styled Card/Badge 表面中组合 Live Region，并自行决定何时更新 authored 文本内容。

### 2.3 Async Region 不是 skeleton

Async Region 与 Brutalist Skeleton 有本质区别：Skeleton 是 styled-only、passive、contentless 视觉原语（`aria-hidden=true`，不渲染后代）；Async Region 是语义容器（投射 `aria-busy`，保留 authored 后代与焦点）。两者不共享 prototype 身份。

### 2.4 Web a11y 投影扩展

`packages/modules/a11y/src/web.ts` 的 `ARIA_STATE_ATTRS` 新增 `live → aria-live`、`atomic → aria-atomic`、`busy → aria-busy` 三个受治理映射。这遵循既有 `ARIA_STATE_ATTRS` 模式（`checked → aria-checked` 等），不改变 `hidden` 的特殊处理逻辑。

### 2.5 公开消费面

两个原语分别通过 `@proto.ui/prototypes-base/live-region` 与 `@proto.ui/prototypes-base/async-region` 提供默认 export、命名 root export 与 as-hook，并进入 CLI 的 `base-live-region` / `base-async-region` 组件注册表。Async Region 的 `busy` expose 继续遵循既有 Web state 序列化，供 styled family 使用 `data-[busy]` variant；不新增公开 package，也不改变 rc.7 BOM package 数量。

## 3）实体规划

本轮按一个垂直语义切片新增：

- `C-ASYNC-A11Y-0001`：异步无障碍边界契约，治理 Live Region 与 Async Region 的投射规则与禁止通路。
- `P-BASE-LIVE-REGION`：Live Region prototype 实体。
- `P-BASE-ASYNC-REGION`：Async Region prototype 实体。
- `T-BASE-LIVE-REGION-0001`：Live Region 可执行测试映射。
- `T-BASE-ASYNC-REGION-0001`：Async Region 可执行测试映射。
- 修订 `T-A11Y-0001`：新增 `T-A11Y-0001-CASE-LIVE-ATOMIC-BUSY` 覆盖 Web adapter 的 live/atomic/busy 投射。

所有新实体保持 `draft`，通过关系链与 executable tests 形成一个 coherent slice。

## 4）仍需决定的问题

- Live Region 是否需要 `relevant` prop（`aria-relevant`）以控制 additions/removals/text 的播报粒度。
- Async Region 是否需要 `live` prop 以在 busy 状态变化时触发播报（当前设计不包含，由应用层组合 Live Region 实现）。
- 是否需要 `P-BASE-LIVE-REGION` 的 `inherits.prototypes` 关系以支持 styled family 继承。

---

## 参考

- `spec/contracts/C-ASYNC-A11Y-0001.yaml`
- `spec/prototypes/P-BASE-LIVE-REGION.yaml`
- `spec/prototypes/P-BASE-ASYNC-REGION.yaml`
- `spec/contracts/C-A11Y-0001.yaml`
- `packages/modules/a11y/src/web.ts`
- `internal/records/2026-07-29-scroll-area-boundary-and-host-projection.zh-CN.md`
