---
title: '交付一个改动'
description: '让一个受治理的完整切片经过实现、证据、审阅、部署和发布。'
---

快速交付意味着每份可信证据都能立即解锁下一项自动化步骤。

## 修改前

从当前 `main` 创建短期分支。追踪适用 spec 的 lifecycle、criteria、relations、实现、测试、生成投影、package surface 和公开文档。

如果实施过程中出现新的语义身份、所有权、公共 API、兼容性决定、Host Capability、依赖或生命周期变化，应明确记录范围，把尚未稳定的保证维持在 draft，并继续推进仍然可逆的有边界实现与证据。只有仓库对会造成实质不兼容的产品选择没有方向时才升级；请求最小缺失选择的同时，其余工作继续推进。

## 完成一个完整切片

先在拥有行为的层补聚焦证据，再实现最小完整行为。当 spec entity、测试、生成视图、export、CLI、Demo 和公开页面表达同一个改动时，应在同一变更中保持一致。

先运行 focused check，再按影响范围增加 graph、types、docs、package、consumer 或 release 检查。记录准确命令，也说明哪些检查没有运行。

提交使用 `git commit --signoff`。PR 需要披露第三方来源和实质性 AI 辅助，说明哪些内容已经决定、哪些不在范围内，并链接适用实体和证据。

## 验收与回归

机器检查证明确定性证据通过。独立 Review 判断改动是否符合受治理边界。Preview deployment 暴露一个已交付 revision 供检查。三类证据相互补充，并直接驱动下一项转换，不额外制造一层普遍审批暂停。

回归修复应先证明现有保证会因预期原因失败。如果期望行为本身不清楚，这项工作属于语义塑形，不属于 Bug 修复。

新的 push 会触发 live reconciliation 和 fresh exact-head review。现有 standing authorization 允许独立 Agent 重新检查、提交有 finding 支撑的 `REQUEST_CHANGES`、批准符合条件的 clean exact head，并把已获独立批准的 head 交给 `pui-integrate`。合并命令绑定已审阅 SHA，且仅在可信 checks 通过、active change request 已清除、review thread 已解决、实时权限已确认、仓库规则报告 clean 且 mergeable 时执行。

## 发布

发布准备形成可审阅的仓库状态。真正 publication 从受治理的 `main` 单独执行，并保持人类在场。随后再通过 evidence change 核验 registry、tag、GitHub Release、assets、snapshot digest、workflow head 和 deployment。

无论由当前用户指导还是依据 active standing authorization 运行，Agent 都可以通过同一套证据绑定的转换准备、验证、审阅并集成 release-candidate 仓库改动。Publication、tag 创建、稳定生命周期激活和部分发布恢复属于特权或难以逆转的最终交付操作，仍需当前人类授权并保持人在场。

精确命令和提交要求见 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md)。
