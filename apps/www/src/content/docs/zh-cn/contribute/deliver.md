---
title: '交付一个改动'
description: '让一个受治理的完整切片经过实现、证据、审阅、部署和发布。'
---

快速交付依靠短反馈，不依靠跳过闸门。

## 修改前

从当前 `main` 创建短期分支。追踪适用 spec 的 lifecycle、criteria、relations、实现、测试、生成投影、package surface 和公开文档。

如果实施过程中出现新的语义身份、所有权、公共 API、兼容性决定、Host Capability、依赖或生命周期变化，应立即停止，回到 Issue 请求最小的缺失决定。

## 完成一个完整切片

先在拥有行为的层补聚焦证据，再实现最小完整行为。当 spec entity、测试、生成视图、export、CLI、Demo 和公开页面表达同一个改动时，应在同一变更中保持一致。

先运行 focused check，再按影响范围增加 graph、types、docs、package、consumer 或 release 检查。记录准确命令，也说明哪些检查没有运行。

提交使用 `git commit --signoff`。PR 需要披露第三方来源和实质性 AI 辅助，说明哪些内容已经决定、哪些不在范围内，并链接适用实体和证据。

## 验收与回归

机器检查证明确定性证据通过。Review 判断改动是否符合受治理边界。Preview deployment 让维护者检查一个已交付 revision。三者不能互相替代。

回归修复应先证明现有保证会因预期原因失败。如果期望行为本身不清楚，这项工作属于语义塑形，不属于 Bug 修复。

新的 push 会使旧 review 失效。只有当前 revision 通过所需检查、所有 review thread 已解决并完成独立验收后，才能合并。

## 发布

发布准备形成可审阅的仓库状态。真正 publication 从受治理的 `main` 单独执行，并保持人类在场。随后再通过 evidence change 核验 registry、tag、GitHub Release、assets、snapshot digest、workflow head 和 deployment。

有人持续协作时，Agent 可以在当前人类决定下准备或审计发布工作；无人值守时，它必须遵守最新本地自治上限。Standing-authorized Agent 可以通过 `pui-integrate` 机械合并 exact 且已独立批准的 PR；两种模式都不能让 Agent 自行 publish、tag、激活稳定生命周期或恢复部分失败的 release。

精确命令和提交要求见 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md)。
