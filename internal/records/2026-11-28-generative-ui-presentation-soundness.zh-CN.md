---
kind: investigation
status: active
date: 2026-11-28
baseline: c85b91e9 (C-COMPILER-FOUNDATION-0001 / C-COMPILER-AUTHORING-0001 / C-COMPILER-LINT-0001, all draft)
receipts:
  - internal/records/2026-11-28-generative-ui-presentation-soundness-sources.json
---

# 生成式 UI 的呈现可靠性：编译期声明检查初稿

**提议：**把"生成式 UI 要 make sense"中可以客观判定的那一半，定义为一条不变量——**界面可以说得少，但不能说错**（presentation soundness）。

0.4 编译器前端在编译期检查这条不变量，并在 HIR 上把证明不了的声明降级为可靠的较弱形式。降级后的产物是普通原生组件，运行时零额外开销。LLM 从不被拒绝，用户从不被骗。

## Scope & Limits

- 本文是非规范记录：不修改 `spec/**`，不新增语言规则，也不产生 `source-invalid`。要晋升为规范，需要单独的 decision 和 contract 实体。
- 依赖编译器前端尚未完成的 phase/effect/ownership 分析（见 `internal/compiler/README.md` 的 Scope & Limits）。本文不声称任何已实现能力。
- 只覆盖通过**带类型的 prototype 插槽**做出的声明。自由文本的含义、视觉层级和审美不在保证范围内，归建议层。
- 文中 API 拼写均为示意，不是 authoring 合同的提案文本。

## 1. 问题与事实

- 多轮生成式 UI 的 2,750 次失败中，"看似可用但没接线"占 17%，"派生状态不同步"占 21%，"与外部状态矛盾"占 11%，失败转换中 52.7% 含回归（EvoGenUI-Bench，EMNLP 2026）。
- Interaction2Code（ASE 2025）独立观察到的高频失败是 No interaction、Partial implementation、Interactive element missing、Wrong function。
- 这几类问题都可以表述为同一件事：**界面展示的声明，强于它实际拥有的证据**。来源与引用数见 receipts。

## 2. 四条设计原则

| 原则 | 含义 |
|---|---|
| 可靠性强制，精确度温柔 | 不变量由编译器降级保证；如何更精确由 LLM 根据建议性反馈决定 |
| 对 LLM 宽容，对用户诚实 | 不拒绝、不强制重试；AI 自己的估算合法，只需如实标注来源 |
| 零运行时开销 | 声明与来源只存在于编译期，像 lifetime 一样被擦除 |
| 声明写在签名上 | prototype（人写一次）声明每个插槽呈现哪类声明，以及它的诚实较弱形式；组合检查因此是局部的 |

## 3. 核心演算

```text
声明 c ::= none                     -- 不对系统状态做任何断言（静态文案、装饰）
        | fact(v, roots, tense)    -- 显示的值 v 由 roots 计算而来；tense ∈ {now, asOf(r)}
        | outcome(op, φ)           -- 操作 op 处于阶段 φ（requested/pending/completed/failed/cancelled/…）
        | capability(e, κ)         -- 现在激活 e 会产生 κ 类效果（action / task start / navigation）

证据（全部来自 Proto 已有语义）：
  owner 发布的状态与受控输入 · request 事件 · scheduler 的 task 结局
  · extern 结果（附声明的证据类别）· 字面量（附作者身份：authored | generated）

⟦c⟧ = 使 c 成立的系统状态集合；c₁ ⊑ c₂ ⇔ ⟦c₂⟧ ⊆ ⟦c₁⟧；none 是最弱元素

安全性：对每个可达状态 s、屏幕上每个元素 e，有 s ∈ ⟦claim(e)⟧（以 e 所在视图的 revision 计）
活性：  每次状态提交后，对应视图最终提交或被 superseded（VIEW-COMMIT）
```

**支持关系 ⊢（每类一条）：**

- `fact(now)`：值的 lineage 只经过当前一致视图中的读取（props / state / derive / Context）。经过快照边（初始化读取、跨 await 的捕获、单次拉取的 extern 结果）时，只支持 `asOf(r)`。
- `outcome(op, φ)`：lineage 来自 owner 发布的值或 scheduler 结局。request 事件只能支持 `requested`。
- `capability(e, κ)`：e 的激活连接解析到一个 action，其 Behavior IR 效果集合非空且包含 κ；e 的 disabled 投影反映该 action 的可用条件。
- 字面量：`authored` 配置下由作者负责；`generated` 配置下，落在 fact 插槽的字面量只支持来源为模型的声明（如"AI 估算"）。

**组合定理（待证明）：**每个模板节点的声明都被其 lineage 支持，且响应式依赖满足 `C-COMPILER-FOUNDATION-0001-DEPENDENCIES`（不遗漏有效变化）⇒ 在每个已提交视图的 revision 上，安全性成立。

这一步把"所有可达状态"的全局问题，化归为"每个节点"的局部检查，地位相当于 borrow check 的逐函数检查。

## 4. 已有失败都是这一条不变量的实例

| 观察到的失败 | 在演算中 | 编译期降级（prototype 声明的较弱形式） |
|---|---|---|
| 按钮没有接任何行为 | capability 无支持 | `disabled` + 原因 |
| 筛选变了，总计不变 | `fact(now)` 只有快照证据（镜像状态） | 改为派生，或显示"截至 r" |
| 未提交就显示"已保存" | `outcome(completed)` 只有 request 证据 | 绑定该操作的真实阶段；无法关联操作时不显示 |
| AI 估算被当作事实 | generated 字面量落在 fact 插槽 | 附"AI 估算"来源标注 |
| 受控 Toggle 按请求显示已开启 | 用 `activeChange` 支持 `active` 的 fact | 读取 owner 发布的 `active` 投影 |

**正例：**`context-owned-async-tabs` 示例显式建模了 `loading / stale / failed / cancelled`，`panelLabel` 的每个分支都有证据支持。它就是"诚实写法"的样子，也说明 Proto 现有语义足以提供所需证据。

这里的 facts / requests 区分，与 `2026-06-29-focus-logical-tree-model.zh-CN.md` 对 focus facts 和 focus requests 的划分同源。

## 5. 与 0.4 编译器的结合

| 阶段 | 新增工作 | 复用的现有设计 |
|---|---|---|
| Prototype 定义 | 在公开接口（props / public events）上声明呈现类别及其较弱形式；作为编译器拥有的带类型声明读取 | intrinsic declarations；`C-COMPILER-AUTHORING-0001-PUBLIC` |
| 前端分析 | 在同一个 TS Program 上做 lineage 前向数据流：值携带 roots、快照边、作者身份 | 共享 Program/checker；`proto/pure-derivation` 所需的 effect 分析 |
| Component HIR | 对每个 `renderer.child` / `renderer.el` 节点求声明 c 与支持 ⊢ | HIR 已保留模板、动态区域、依赖、事件 |
| 降级 | 证明不了时，作为普通 HIR 改写，选择可证明的最强较弱形式 | 发生在 Behavior IR lowering 之前 |
| Target AST / 发射 | 无改动；目标只看到普通 HIR | `EMISSION`、`SUPPORT`、`COMPLETE` |
| 报告 | 独立的 `presentation` 结果，不并入 `sourceValid` | lint 合同的诊断身份与版本规则 |

**示意（拼写未定）：**

```ts
// prototype 作者（人）声明一次：插槽呈现什么，以及它的诚实较弱形式
const props = def.props.define({
  label: { type: 'string', presents: 'none' },
  value: { type: 'string', presents: 'fact', weaker: ['asOf', 'attributed'] },
});
```

**配置由宿主决定：**`presentation profile ∈ {authored, generated}` 由宿主应用或生成管线配置，生成出来的源代码不能自己选择。这与 AGENTS.md 中"仓库文件不能选择执行模式"是同一原则。

**报告：**

```text
presentation: { profile, analysisComplete, widened: [...], findings: [...] }
```

- 分析不完整的节点按最保守的方式降级，并报告原因，绝不静默放过。
- presentation 结果不影响 `sourceValid`；降级后仍然 `compilable`。

## 6. 零开销与擦除

- 产物中不出现 claim 注册表、provenance 包装、运行时监控或 revision 比较。新鲜度依赖目标原生响应式，阶段依赖 scheduler 本来就有的结局。
- 降级产物就是人会手写的普通代码（disabled 按钮、阶段绑定、来源标签）。
- 外部数据的新鲜度语义由 extern 声明的证据类别决定；检查器从不插入轮询或订阅。
- dev / 预览构建可以选择性编译断言，用于发现 extern 证据类别声明错误；release 构建完全剥离。

**验收（均可机械判定）：**

1. **擦除测试**：全部声明可证明时，开启与关闭 presentation 检查的目标产物逐字节相同。
2. **对照测试**：降级产物按 `C-COMPILER-FOUNDATION-0001-MEASUREMENT` 与同等语义的手写组件比较成本。
3. **符号扫描**：release 产物中没有任何 presentation 相关的符号或支持模块。

## 7. 面向 LLM 的诊断

诊断只讲原因、修法和降级后果，不用 MUST。模型可以回应"这是有意的，因为……"，记录即可，不惩罚。

```text
提示[presentation/outcome-without-evidence] 状态插槽声称「已完成」，但这里只有一个请求
  --> settings.proto.ts
   |
28 |     run.emit(saveRequested, draft)            —— 证据：requested
41 |     renderer.child(Status, { props: { phase: 'completed' } })
   |                                       ^^^^^^^^^^^ 这里声明的是 outcome(completed)
help: 用 task 的真实阶段 → renderer.child(Status, { props: { of: save } })
降级：未修改时，此节点编译为不显示阶段（none）
```

## 8. 验证计划

1. **机械化证明**：用 Lean 证明玩具版核心演算的组合定理（局部支持加依赖完备 ⇒ 安全性）。
2. **静态检查**：lineage 与 effect 分析，加上逐节点的支持判定。
3. **有界模型检查**：对生成出的小状态空间验证活性，例如"保存后最终显示完成或失败"。
4. **实验**（真实模型，多轮任务）：
   - 对照四组：基线 / 规则写进 prompt（参照 Interaction2Code 的 Failure-aware Prompt）/ 温和诊断加编译期降级 / 严格拒绝。
   - 指标：affordance 与派生状态失败率、TP@5、降级率、能力保留（ArtifactsBench 或偏好评分）。

## 9. 风险与未决问题

- **自然语言不可形式化**：写着"导出"、实际接删除的按钮，可以通过结构检查。可选缓解：能力插槽的文案默认取自 action 的声明。
- **平凡可靠**：全部降级为 none 也是可靠的。必须同时盯降级率，它是精确度的客观指标。
- **信任边界**：保证相对于 extern 证据类别的声明成立，这些声明由人编写，地位相当于 `unsafe`。
- **组合事件连接未定义**：0.4 authoring 示例里尚无"父级把子级 public event 接到自己的 action"的写法，而 capability 检查依赖这条连接的定义。
- **定义缺口**：例如 `P-BASE-SWITCH` 没有声明"立即生效"。较弱形式和呈现类别都需要先作为定义补上，不能由 lint 发明。
- **对话层**：助手文本中的结构化能力声明，以及跨轮承诺，属于第二阶段；需要生成管线输出结构化声明后才能检查。

## 10. 后续工作

1. 用 `pui-brainstorm` 收敛方向，并起草 decision 实体（draft）。
2. 为 `P-BASE-BUTTON`、`P-BASE-TABS` 补充呈现类别和较弱形式的定义（定义工作，与编译器实现分开）。
3. 在共享前端上实现 lineage 分析原型，先覆盖现有三个 authoring 示例与少量生成组合。
4. 实现降级 HIR 改写和擦除测试。
5. 完成 Lean 玩具证明和实验评测流程。
