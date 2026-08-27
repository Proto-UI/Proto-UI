---
title: '协作模型'
description: '让每个 GitHub 协作面只负责一种状态，并分开权限、信任、就绪度与证据。'
---

当工作容易查找、领取、审阅和验证时，Proto UI 才能保持速度。为此，每个协作面只承担一种状态。

## 工作放在哪里

Discussion 承接开放问题。Issue 承接边界明确的结果。PR 是一个可审阅的集成单元。Review 记录独立判断，Actions 记录机器证据，Deployment 与 Release 记录外部交付事实。

Milestone 表达一个发布结果或独立 program，不承担日常状态。

规划中的组织 Project 会成为跨仓库的操作视图，用字段表达工作流位置、任务是否就绪、优先级、claim 过期时间、证据进度、Agent 理解要求和动作采用的授权来源。产品语义仍然留在 `spec/**`。它的第一份投影以观察为主，便于安全核对路由数据；这条 intake lane 不是 Agent 的全局权限上限。幂等、过期 claim、实时权限和回滚条件满足后，可逆后续动作就通过仓库现有 active standing authorization 继续执行。

Labels 只保留少量稳定搜索维度：工作类型、所属区域、工作量、就绪度和风险。Project 中的工作流位置与 claim 状态不应再复制成 labels。

## 什么任务可以开始

可实施的 Issue 应告诉贡献者：

- 问题或目标；
- 适用的权威与生命周期；
- 已经决定的内容；
- 贡献者可以决定的内容；
- 排除范围；
- 是否允许开始实现；
- 如何验收。

现有受治理方向、验收标准和 draft entity 足以让 Agent 开始有边界的实现并收集证据。只有在两个会造成实质差异的产品方向仍然冲突时，才记录最小产品选择而不擅自猜测；需要人类决定的是这项未决选择，而不是它周围的每个实现步骤。`help wanted` 用于标记可领取工作，但不会替这种选择制造答案。

领取需要与最新评论、assignee、关联工作和 Project 状态一致，并设置过期条件，避免停止推进的任务一直占用。

## 分开几条权限轴

GitHub 权限决定平台操作。工作触及社区或 Bot surface 时，Discord 与 Poppy 信任才参与约束。本地 Agent 测评描述任务适配度：在 `human-assisted` 工作中它提供建议，在 `autonomous` 工作中它才是上限。任务风险和当前授权仍是独立条件。

分数和 Discord role 都不能授予 GitHub 权限。本地结果也不能证明模型身份或预测验收。现有本地 standing authorization 允许独立 Agent 重新核对 live state、通过 purpose-bound request 与已核验 receipt 继续一个可逆协作转换、提交有 finding 支撑的 `REQUEST_CHANGES`、批准符合条件的 clean exact head，并在可信证据、实时权限、review state 与仓库规则一致时合并已获独立批准的 exact head。协作 continuation 最多执行一次 mutation，并对未知结果最多 reconciliation 一次；它绝不盲目重试写操作。出现新 revision 时，流程直接回到 live reconciliation 与 fresh review。人类决策只保留给真正未决的产品方向，以及 publication、release、访问控制、secrets、仓库规则变更等特权或不可逆操作。

主仓库和 Discord Bot 目前并不具备相同的 CI 与分支控制。协作者应按各仓库真实存在的控制工作，不能借用另一边的保证。

完整政策见 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md)。
