# AM-P0-002-F1 narrowed remediation re-review task

> Historical frozen prompt used for review round two. Its reference to implementation approval predates and is superseded by the current automated-completion rule in the Phase 0 workflow.

下面的代码块可直接粘贴到全新 Codex 任务中。它用于独立核验经过第一次 `incomplete` review 后收窄的 remediation，不应继承实现者的期望结论。

```text
你正在 Proto UI 仓库中执行 AM-P0-002-F1 remediation packet 的第二轮独立 review synthesis。不要继续修复代码；请判断修订后的 packet 和实际 diff 是否准确、完整，是否足以支持 implementation approval。

工作区：
/Users/yangguangliang/Desktop/projects/Proto-UI

基线提交：
109083311d32c1a43ba3d66e55e7cd0b7c08f1dc

先阅读仓库根目录 AGENTS.md，然后完整阅读：

1. Finding：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/findings/AM-P0-002-F1.md
2. 修订后的 review packet：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/reviews/AM-P0-002-F1.md
3. Review Synthesizer prompt：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/prompts/review-synthesizer.md
4. Review packet template：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/templates/remediation-review.md
5. Phase 0 workflow：
   /Users/yangguangliang/Desktop/projects/Proto-UI/internal/autonomous-maintenance/phase-0/README.md

第一次独立 review 将 broad remediation 分类为 `incomplete`，置信度 0.99，建议 `revise`。它确认原 finding 的窄路径得到修复，但证伪了自动 recovery 状态模型，并发现 explicit unbind reactivation、同步 epoch 异常、rollback failure bookkeeping、重复 listener、生产 capability 路径和 authority map 缺口。

人工随后接受了更窄的语义方向：

- 只要求一次 bind 在添加任何新 listener 前解析全部 pending registration target；
- target resolution 失败时本轮新增 listener 必须为零；
- target 可用后只保证显式 `bind()` 可以重试完整 plan；
- capability epoch 不自动恢复初始失败；
- explicit `unbind()` 后 epoch 不得重新绑定；
- listener attachment、cleanup failure、host-owned lease、同步重入和 global recovery 不属于本 remediation 的保证。

## 当前 remediation inventory

只审查以下 7 个路径相对 baseline 的 diff：

- spec/modules/M-EVENT-0001.yaml
- spec/contracts/C-EVENT-0007.yaml
- spec/tests/T-EVENT-0001.yaml
- spec/tests/T-EVENT-0003.yaml
- packages/modules/event/src/kernel.ts
- packages/modules/event/test/contract/event-module.v0.contract.test.ts
- packages/spec/fixtures/src/event/registration.ts

`packages/modules/event/src/impl.ts` 应与 baseline 无差异。请独立确认这一点。

工作区中的 Run 001 Props remediation、`internal/autonomous-maintenance/**`、`scripts/autonomous-maintenance/**` 和 `package.json` reviewability overlay 不属于这 7 路径 inventory。不要修改、恢复或删除它们。

## 必须核验

完整执行 `review-synthesizer.md`，并至少独立确认：

1. 所有 pending target 是否在第一次新 listener attachment 前完成解析。
2. mixed semantic `key.down` + missing ordinary root `host:click` 是否在失败后留下 0 个 listener。
3. target 恢复并 bump capability epoch 后是否仍保持 0 个 listener。
4. 随后显式 `bind()` 是否完整绑定两个 registration，且无重复。
5. 成功后 `unbind()` 再 bump epoch 是否保持 0 个 listener。
6. missing global target、attachment throw、removal throw、同步 capability reentrancy 是否确实未被新 criterion 或 test mapping 声称为已解决。
7. `T-EVENT-0003` 的新 case 是否只声称 Module-level evidence，没有借 fake target test 声称 official Adapter/host-cap failure conformance。
8. packet 是否完整包含既有 draft lifecycle authority，以及 CapsVault、RuntimeSession、HostWiring、ViewEpochOwner、五个 Event-port Module consumer、official Adapters 和 unknown surfaces。
9. 当前实现是否引入 finding 范围之外的新行为、同步异常路径、closure lifetime 或 lifecycle transition。
10. 第一次 review 发现的 hostile EventTarget 与 raw EventTarget/host-owned lease debt是否被诚实保留为 follow-up，而非被隐藏或误称已修复。

## 约束与输出

- 只读任务：不得修改 tracked files，不得创建 branch、commit、Issue 或 PR。
- 记录任务前后的 HEAD、`git status --short` 和 untracked 集合，证明没有仓库变化。
- 可以运行检查、测试和 `/private/tmp` 下的 reproduction。
- 不得把本 patch 新增 criterion 和测试当作旧实现违反稳定 contract 的独立证明。
- 若环境不是 Node 22，明确记录并要求 CI 基线复核。

最终使用中文，严格按 `review-synthesizer.md` 输出：classification、confidence、semantic/implementation decisions、before/after 状态、corrected direct/indirect/excluded/unknown impact、authority lifecycle、claim-evidence-limit 矩阵、falsification attempts、残余风险、packet corrections、recommended human action、命令结果和 Git 状态证明。
```
