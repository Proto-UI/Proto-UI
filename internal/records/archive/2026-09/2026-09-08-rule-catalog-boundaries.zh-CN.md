# Rule 编目前的边界确认

日期：2026-09-08。本文记录当前用户对 Rule 编目范围的确认，不替代 spec authority。

## 已确认的边界

1. setup 期间登记的原型语法操作、声明或效果，如果提供作者取消入口，该入口默认也仅限 setup。已有 `C-CORE-SYNTAX-0007` 承担通用约束，无需创建重复实体。取消可以表现为返回函数或 handle method；internal lifecycle cleanup 不是作者取消入口。已有显式 runtime API 仍由各自契约治理。
2. `RuleHandle.dispose()` 采用上述边界，在 setup 执行期间允许；`onCreated` 已是 runtime，必须拒绝。更新 `D-RULE-HANDLE-DISPOSE-0001`，保持 draft，不接纳 runtime Rule removal。
3. 本轮不实现 `intent.state`。缺少实际需求推动，不因编目或清理历史代码而引入 layering、rollback、baseline 等状态写入语义。当前只有类型、操作记录和 reason metadata；默认执行器不执行 state.set。本次没有决定移除 API 或新增 fail-fast 行为。
4. meta 的明暗主题需求成立，且已经由官方 Shadcn Button、Checkbox、Switch、Textarea 使用。它是已投入使用但 API 尚在演进的扩展；单一需求不足以固化通用环境抽象，未来可能变形或被替代。更新 `D-RULE-META-NAMING-0001`，不提升 lifecycle，不改变现有主题行为。
5. Context path 等扩展等待实际需求再安排。whole-value Context Rule 输入仍须如实标注读取、订阅、触发与 identity 边界；本次不扩展它的支持范围。

## 本轮落地

- 直接 Rule Module facade 在 declaration 和返回 handle 的取消入口读取 Runtime SYS_CAP setup guard；与 asHook 已有包装对齐，守卫在执行声明 callback 或删除 Rule 之前运行。
- 实例 terminal cleanup 继续调用内部 Module hooks，不依赖作者的 setup-only handle。
- `T-RULE-0001` 增加实际 Runtime 和直接 Module 的证据，覆盖 setup 撤销、created、render、mounted、detached、remount、beforeDispose 和 disposed；其它 planned IR/matrix 测试保留 planned。
- 历史 smoke test 从“允许 runtime 删除”改为“拒绝并保留原样式”，legacy removal 文档及 debt 记录同步新决定。

这只是 Rule 核心编目的边界准备；M/A 编目与完整输入、IR、依赖、扩展证据仍按后续切片推进。所有修改继续位于批量编目分支中。

## Rule core 编目推进

在上述边界确认后，本地补齐 `M-RULE-0001`、`T-RULE-0002` 与 React、Vue3、Vue2、Web Component 四个 A profile 的 Props/State-to-style 支持。Rule 通过 Feedback 物化样式，无独立 HC；保持 draft，不推广 Context、state intent、meta 或 expose-state 优化的支持范围。Feedback 已提交为 `dc0e3d4b`，Rule 仍为本地候选；Anatomy 尚未开始。

新增直接 Module、实际 Runtime 与四 Adapter 的 executable evidence；原有 Context/matrix TODO 保留 planned。测试同时暴露并修复两处已有契约漂移：inactive Rule 的非法 style token 现在也在声明时拒绝；terminal dispose 清理 IR、State handle 表与 extension closure，并拒绝保留 port 的后续评估/注册。setup-only cancellation 的准备改动一并纳入本 slice。

Web Component Props journey 遵循现有 `setElementProps()` 后显式 `update()` 协议；其余框架使用原生 props 更新。Adapter 测试证明 token projection、user class、State 更新不触发 Proto structural render 和 fresh-owner isolation；反复 view epoch 与 State watch 去重由 Runtime 测试证明，不声称 Rule 在 remount 的首个 structural commit 前已重放样式，也不以 DOM token 断言代替实际 CSS 外观。

## 本地验证

Node.js 22.23.2 / pnpm 10.32.1。Rule、Feedback、Runtime 与全部 Adapter 范围回归：238 个文件通过，795 项通过，34 项原有 TODO；包含 meta 和 expose-state Web 优化回归。spec/schema/graph：61 项通过；`check:types` 通过（188 个 Astro 文件零诊断）。`spec:docs:agent`、`workspace:generate`、`check:agent-doc`、`check:agent-operations` 通过。未运行发布流水线或浏览器视觉验收；本轮未 commit、push 或发布 PR。
