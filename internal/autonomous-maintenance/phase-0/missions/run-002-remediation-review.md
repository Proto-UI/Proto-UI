# AM-P0-002-F1 remediation review task

> Historical frozen prompt used for review round one. Its references to human implementation approval predate and are superseded by the current automated-completion rule in the Phase 0 workflow.

下面的代码块是一份可直接粘贴到全新 Codex 任务中的启动 prompt。新任务应独立完成核验，不应继承 Remediator 的隐藏推理或预设结论。

```text
你正在 Proto UI 仓库中执行一次独立的 remediation review synthesis。你的任务不是继续修复代码，而是判断 AM-P0-002-F1 的 remediation review packet 是否准确、完整，是否足以支持人工做出语义和实现决策。

工作区：
/Users/yangguangliang/Desktop/projects/Proto-UI

基线提交：
109083311d32c1a43ba3d66e55e7cd0b7c08f1dc

开始前先阅读仓库根目录 AGENTS.md，并遵守其中关于 spec authority、entity lifecycle、records 和验证方式的规则。

## 必须阅读的输入

1. Finding：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/findings/AM-P0-002-F1.md

2. 待核验的 remediation review packet：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/reviews/AM-P0-002-F1.md

3. Review Synthesizer 的完整角色与输出要求：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/prompts/review-synthesizer.md

4. Review packet 的结构约定：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/templates/remediation-review.md

5. Phase 0 workflow 与 remediation review gate：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/README.md

## Finding 摘要

Verifier 将 AM-P0-002-F1 分类为 partially confirmed，置信度 0.96。

已复现的窄范围事实是：在同一个 root scope 中，semantic redirect registration `key.down` 先成功解析，后续 host-bound registration `host:click` 因 ordinary root 缺失而失败时，原实现会抛出 `EVENT_TARGET_UNAVAILABLE`，但保留前一个 live listener；模块整体仍标记为 unbound，后续 capability epoch 不会补齐缺失 registration。该 finding 是 draft Event 语义下的实现健壮性问题，不是已经确定的稳定 contract 违约。

人工已接受 finding 的修正范围并允许进入 remediation，但 finding acceptance 不等于对新增 draft 语义或当前实现的批准。

## Review packet 是什么

Review packet 是对当前未提交 remediation diff 的“可评审性投影”。它尝试说明：

- 修改前后的行为和状态转换；
- 直接、间接、排除和未知的影响面；
- 哪些规则是原有 authority，哪些是本次新增的 draft proposal；
- 每项实现修改支持什么 claim；
- 测试证明了什么以及没有证明什么；
- 仍需人工决定的残余风险。

Review packet 自身只是待核验的 claim，不是 authority，也不是正确答案。它当前自标记为 `revision-required`，但你必须独立判断该分类是否准确，不能因为 packet 这样写就接受它。

## 实际 remediation diff 范围

只把下面这些路径视为 AM-P0-002-F1 的实现/spec/test diff：

- spec/modules/M-EVENT-0001.yaml
- spec/contracts/C-EVENT-0007.yaml
- spec/tests/T-EVENT-0001.yaml
- spec/tests/T-EVENT-0003.yaml
- packages/modules/event/src/kernel.ts
- packages/modules/event/src/impl.ts
- packages/modules/event/test/contract/event-module.v0.contract.test.ts
- packages/spec/fixtures/src/event/registration.ts

使用基线提交和以上精确路径重建 diff，例如：

git diff 109083311d32c1a43ba3d66e55e7cd0b7c08f1dc -- <上述路径>

当前工作区还包含两类不属于本 remediation 的 overlay：

1. Run 001 Props remediation，例如 `spec/tests/T-PROPS-0012.yaml` 和三个 Adapter props-normalization 测试；
2. 本次 reviewability 建设本身，例如 `internal/autonomous-maintenance/**`、`scripts/autonomous-maintenance/**` 和 `package.json` 中的检查命令。

不要把这些路径算进 Event remediation 的影响面，也不要删除、恢复、格式化或修改它们。若发现实际工作区与上述说明不一致，明确报告差异。

## 约束

- 这是只读核验任务。不得修改 tracked files，不得创建 branch、commit、Issue、PR 或其它外部写入。
- 可以运行检查、测试和临时 reproduction；临时文件只能放在非 tracked 临时位置。
- 开始时记录 `git status --short` 和当前 HEAD；结束时再次检查，证明任务没有改变 tracked diff 或未跟踪文件集合。
- 不得把本次 patch 新增的 `M-EVENT-0001-I`、`C-EVENT-0007-F` 及其新测试当成旧实现已经违约的独立依据。
- passing tests 和完整 spec graph 只能作为证据，不能证明语义值得接受或影响面已经完整。
- 不要实现修复。即使发现明显问题，也只报告、复现并给出决策建议。

## 必须独立核验的问题

除完整执行 `review-synthesizer.md` 外，至少回答：

1. 当前 patch 是否准确解决 verifier 缩小后的 partial-listener 路径？
2. 当前 patch 是否把行为扩展到了 finding 之外，例如 global target recovery、dispatcher closure lifetime 或其它 capability epoch？
3. `lastDispatch` 与 `isBound` 是否足以区分：
   - failed and pending recovery；
   - explicitly unbound；
   - successfully bound；
   - terminally disposed？
4. 成功 bind 后显式 `unbind()`，再发生 capability epoch，是否会重新绑定？请独立复现或证伪，不要只引用 packet。
5. capability epoch 到来但 required target 仍不可用时，错误如何传播？packet 是否准确描述其影响？
6. `addEventListener` attach-then-throw、`removeEventListener` rollback-throw 等 failure-during-failure 路径下，实现保证与新增 draft criterion 的强度是否一致？
7. 哪些 Runtime、Module、Adapter 或 host-capability consumer 是直接、间接、排除或尚未知的影响面？packet 是否遗漏了决策相关路径？
8. 现有测试分别证明了什么、没有证明什么？是否缺少会改变人工决定的测试？
9. 更合适的实现状态模型或更窄的 remediation scope 是什么？只提出方案，不修改代码。

## 输出格式

严格按照 `review-synthesizer.md` 的要求输出，并至少包含：

- packet fidelity classification：adequate / incomplete / misleading / blocked；
- confidence；
- 等待人工决定的 semantic decisions 与 implementation decisions，分开列出；
- 你独立重建的 before/after state transition；
- corrected direct / indirect / excluded / unknown impact surfaces；
- authority lifecycle 分析；
- claim -> implementation -> evidence -> evidence limit 矩阵；
- 进行过的 falsification attempts 与结果；
- residual risks；
- packet 必须修正的内容；
- recommended human action：approve / revise / reject / gather more evidence；
- 执行过的命令及关键结果；
- 任务前后 git 状态证明。

最终报告使用中文，保留准确的 entity ID、criterion ID、测试 ID、代码符号和文件路径。不要只给抽象结论；让维护者不阅读全部 diff，也能理解需要做出的决定及其影响边界。
```
