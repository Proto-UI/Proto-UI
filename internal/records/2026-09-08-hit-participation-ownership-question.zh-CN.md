# Hit Participation 共享 target 的待决策边界

日期：2026-09-08。基线：`94b99f44`。本文是设计决策包，不是规范；尚未实现以下建议。

## 当前事实

Hit Participation 尚无独立 C/M/HC/T slice。现有语义由 `internal/contracts/hit-participation/hit-participation.v0.md` 解释，并通过 Runtime 与 Adapter-base 测试实现。`C-BOUNDARY-0001-E` 保证其与 Boundary 独立；`D-AS-HOOK-PRIVILEGED-NO-ARG-MIGRATION-0001` 明确暂时保留参数化兼容形态。本轮不自动移除 `asHitParticipation(patch)`。

`createWebHitParticipationHostBridge()` 每个 owner 创建一个 bridge，但 target 上的 mode 和 previous pointer-events 使用共享 symbol。两个 bridge 对同一 target 写入时：

1. 初始 `pointer-events: auto`；A 声明 disabled，再由 B 声明 participating，结果为 auto，A 被覆盖。
2. A/B 都声明 disabled，结果为 none；A 清空 regions 后结果恢复 auto，B 的禁用提前失效。
3. B 再清空 regions 后结果为空字符串，原始 auto 也丢失。

该观察由两个真实 Web bridge 与一个 happy-dom HTMLElement 重现，不证明浏览器真实 hit testing。临时复现为 `/tmp/hit-overlap-probe.mjs`；核心步骤是两个 bridge 依次 sync 同一个 target，再分别 sync 空 regions。问题位于宿主投射所有权，不能用 event cancellation 或 Boundary outside 分类修补。

## 需要的决策

不同 owner 是否允许对同一物理 target 共享 Hit Participation 声明？现有契约没有规定其合并、冲突和清理语义。

建议：同模式共享、不同模式诊断并拒绝。宿主按 owner 保存 claim，最后一个 claim 释放时恢复原始宿主值；冲突检查在修改 claim/投射之前完成。disabled 与 passthrough 即使都投射 pointer-events none，也仍是不同语义，不因 Web 实现相同而合并。

替代方案：

- 单 owner 独占：第二个 owner 一律诊断拒绝，边界更简单，但合法同模式协作也无法共享。
- 模式优先级：多个不同模式合并，需进一步定义 disabled、passthrough、participating 的优先关系与作用域，不由 CSS 写入顺序代替设计。

当前独立 owner 的隐式 host root 通常不同，但作者与消费者可以显式 registerRegion 同一 target，因此不能由常见 DOM 结构推断独占保证。

## 实现和验收范围（待确认）

拟编目 `C-HIT-PARTICIPATION-0001`、`M-HIT-PARTICIPATION-0001`、`HC-HIT-PARTICIPATION-0001`、`T-HIT-PARTICIPATION-0001` 与四 Adapter 有界支持。先验证普通单 owner 投射、region 增删、未知 host target、view detach/rebind 和 terminal cleanup；按决策补充跨 owner 同模式共享、不同模式冲突、两种释放顺序、原始 pointer-events 恢复与拒绝原子性。

保留已有参数化 hook 兼容断口。blocking/modal policy、Event/Boundary 职责、通用多 owner 样式仲裁和真实浏览器全平台命中等价性不纳入本次决定。

## 批次进展

本轮已独立提交 Collection `105bff50`、Expose State Web `6176b820`、Rule Expose State Web `5b37f37a`、Trigger `aa62c195`、Focus `a723ecac`、Boundary `94b99f44`。Trigger 分叉规则来自用户明确决定；Focus Entry 与 Boundary 弱栈问题依据既有契约修复。各 slice 记录位于同日相应 Record。

roadmap 下一项停在 Hit Participation 的本边界，之后仍为 Presence → Positioning → Overlay → Text Control / Image View / Scroll。A11y、Rule Meta、deprecated State compatibility 继续维持原计划中的独立边界。
