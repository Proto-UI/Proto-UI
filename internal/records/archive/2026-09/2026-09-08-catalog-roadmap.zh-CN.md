# M / HC / Adapter 编目余量与推进计划

日期：2026-09-08。盘点基线：`70612955`，分支 `codex/module-host-adapter-catalog-batch`。本文记录当前用户确认的工作安排与架构方向，不替代 spec，不接纳新 API 或提升实体 lifecycle。

## 当前位置

首批 Feedback、Rule、Anatomy 已分别提交；此前 Context、Expose State、Expose Event 等已有有界编目。五条信息通路及 State、Rule、Anatomy 的第一轮核心边界基本收束。Lifecycle、Template、asHook 机制继续沿其 C/T 与 Runtime 证据治理，不为了 Module 数量建立重复身份。

按 standard Runtime 安装清单，排除 `test-sys` 与 Module 基础设施，共 27 个生产语义 Module。当前有 16 个 M、17 个 HC、4 个 Adapter profile。16 个 M 中仅 Props 为 active，其余均 draft；有界支持不等于全部语义稳定。

| 类别 | 数量 | 领域 |
| --- | --- | --- |
| 已形成四 Adapter 有界编目 | 10 | Props、Event、Feedback、Expose、Context、State、Rule、Anatomy、Expose State、Expose Event |
| 已有 M，仍需补充边界或 Adapter evidence | 6 | Collection、Text Control、Image View、Scroll、Positioning、A11y |
| 已有生产实现，尚无独立 M | 11 | Trigger、Focus、Boundary、Hit Participation、Overlay、Presence、Expose State Web、Rule Expose State Web、Rule Meta、State Interaction、State Accessibility |

Image View 已有 React、Vue3、Web Component 的支持声明，仍须审查 Vue2 和覆盖边界。缺 A 关系不能推导实现不支持；缺 M 也不自动意味着必须创建新正式概念。

## asHook 与协作模块

`packages/hooks/src/index.ts` 直接导出 13 个 asHook 入口：asCollection、asCollectionItem、asFocusable、asFocusEntry、asFocusRoving、asFocusScope、asTrigger、asBoundary、asHitParticipation、asOverlay、asTextControl、asImageView、asScrollSurface。它们约对应 9 组能力，多个入口可共享一个 Module；asHook 是承载形式，不是概念重要程度或编目完成度的判据。

Expose State、Expose Event 的核心协作语义已编目。后续要区分：

- `expose-state-web`：State 公开视图的 Web attribute / CSS variable 投影。
- `rule-expose-state-web`：利用上述投影的 Rule 优化及默认 Plan 等价性。
- `rule-meta`：已用于明暗主题，但抽象与 API 仍在演进，不因编目固化。
- `state-interaction`、`state-accessibility`：`fromInteraction` / `fromAccessibility` 的 deprecated compatibility 实现。依 C-STATE-INTERACTION-0001 与 M-STATE-0001，不提升为新的稳定作者能力；先做消费者与迁移盘点。

## 用户确认的推进顺序

| 批次 | 建议顺序 | 主要目标 |
| --- | --- | --- |
| 1 | Collection → Expose State Web → Rule Expose State Web | 利用 Anatomy、Expose、Rule 的近期上下文补齐结构投影与通路协作 |
| 2 | Trigger → Focus → Boundary → Hit Participation | 交互能力、状态归属、目标参与及宿主职责 |
| 3 | Presence → Positioning → Overlay | 按依赖处理生命周期、几何与浮层；需要与真实浏览器证据区分 |
| 4 | Text Control、Image View、Scroll | 补全已有实体、四 Adapter 和相关消费者证据 |

约有 17 个领域待处理：13 个普通编目候选，4 个架构/兼容/演进领域（A11y、两个旧 State 模块、Rule Meta）。这不是 17 个新 M，也不是固定 commit 数量。每个 slice 开始时重新 trace；架构依赖或证据缺口可能调整顺序。

普通编目沿同一活跃批量分支/PR，以语义 slice 组织独立 commit。实体数或 Module 名不是拆 PR 的充分理由；新的架构、所有权或尚未决定的语义边界需要单独处理。

## A11y 架构支线

用户希望未来将 A11y 作者入口从 `def.a11y` 调整为 asHook。该方向不等于已移除现有 API，也不自动改变 A11y Module / HC 的所有权。需另行确定：

1. 一个统一入口还是按语义分组，以及返回 handle 的形态；本记录不预定 API 名称。
2. 与 Focus、State、Anatomy relationship 的职责分界。
3. 旧 `def.a11y`、官方原型和 deprecated state accessor 的兼容与迁移安排。

盘点时 #625（direct-reference transport）与 #621（Table/A11y graph）仍 OPEN；#553 的 same-domain relationship 设计也尚未合入。开始架构变更前重新读取 live 状态并协调，避免在旧入口编目中反复投入。实际迁移按架构变更独立处理，不阻塞无关普通编目。

## 每个 slice 的完成边界

从适用 C/D 追踪到 M、必要 HC、A 支持/省略关系、T 和实际实现。HC 按宿主职责建模，不机械复刻 cap token。补充阶段、取消、缺失能力、生命周期、四 Adapter 与直接消费者证据；只修复已治理语义的漂移。保留 deferred 与实验边界，不以通过测试代替 lifecycle admission。

本计划不包括全量官方 Prototype 行为/视觉审计，也不包含自动发布、合并或新 API 接纳。当前下一步为 Collection：保持 Anatomy order、显式 item、metadata 和位置快照的范围，不引入 selection、roving focus、keyboard 或 A11y policy。

## 盘点依据

- `packages/runtime/src/instance/instance.ts`
- `packages/hooks/src/index.ts`
- `spec/modules/**`、`spec/host-caps/**`、`spec/adapters/**`
- `spec/contracts/C-STATE-INTERACTION-0001.yaml`
- `internal/records/2026-09-08-module-host-adapter-catalog-batch.zh-CN.md`
