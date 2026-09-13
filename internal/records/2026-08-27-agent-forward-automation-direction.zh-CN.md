# Agent-forward 自动化默认路径

日期：2026-08-27

本文记录维护者对 Issue、PR、Agent Operations 与自治维护语言和执行边界的最新方向。它更新此前把 Phase 0、P0、shadow、人工 finding disposition 或逐步批准写成普遍前置门的短期方向，但不改写那些记录保存的历史。本文不定义 Proto UI 产品语义；适用的 `spec/**` 实体仍按 lifecycle 优先。

## 默认路径

当 Issue、现有 spec/contract、已接受的 draft direction 或回归证据已经给出可验证结果时，Agent 默认直接完成选择、claim、实现、测试、文档投影、PR 更新、review disposition、ready-for-review 与 exact-head integration。P0/P1/P2 只表达优先级，不是权限档位；非 P0 的 ready 工作无需等待 P0 清零。

自动推进仍绑定实时目标、当前授权、实际平台权限、DCO/provenance、可信 CI、独立 review、幂等或 exact-head 参数以及仓库规则。这些是执行条件，不应重复写成逐动作的人类批准。

## 两类人类决定

只有两类未解决问题默认停给维护者：

1. `unresolved-product-direction`：权威来源没有决定新的语义身份、所有权、兼容性取舍、公共保证或 lifecycle admission，并且不同选择会实质改变产品方向。
2. `privileged-or-irreversible-operation`：publication/release、access/secret/ruleset、security disclosure、法律或 provenance 例外，以及无法通过平台规则或可恢复机制约束的不可逆操作。

Finding 是否值得修、commit grouping、ready-for-review、review disposition 和 merge 不再单独构成人类门。已治理的 drift 由独立验证结果直接进入修复；干净 exact head 由独立 Agent review、可信 CI 和仓库规则决定 integration。若同一凭据不能自审，使用独立 reviewer，而不是把所有 PR 退回维护者点击。

## 投影规则

当前 Issue/PR body、贡献文档、自动化目录与 skills 应先说明 Agent 能完成什么，再说明两类真正例外。历史 records、既有 `AM-P0-*` run ID 与已经发生的试验结论保持原样；它们是证据，不是今天的通用权限上限。
