---
title: '协作模型'
description: '让每个 GitHub 协作面只负责一种状态，并分开权限、信任、就绪度与证据。'
---

当工作容易查找、领取、审阅和验证时，Proto UI 才能保持速度。为此，每个协作面只承担一种状态。

## 工作放在哪里

Discussion 承接开放问题。Issue 承接边界明确的结果。PR 是一个可审阅的集成单元。Review 记录独立判断，Actions 记录机器证据，Deployment 与 Release 记录外部交付事实。

Milestone 表达一个发布结果或独立 program，不承担日常状态。

规划中的组织 Project 会成为跨仓库的操作视图，用字段表达工作流位置、任务是否就绪、优先级、claim 过期时间、证据进度、Agent 理解要求和权限上限。产品语义仍然留在 `spec/**`。看板先以只读方式上线；幂等、过期 claim、权限和回滚检查通过后，才逐项开启可逆自动化。

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

研究方向获准不等于允许实现。`help wanted` 也不会覆盖尚未完成的 maintainer design。

领取需要与最新评论、assignee、关联工作和 Project 状态一致，并设置过期条件，避免停止推进的任务一直占用。

## 分开几条权限轴

GitHub 权限决定平台操作。工作触及社区或 Bot surface 时，Discord 与 Poppy 信任才参与约束。本地 Agent 测评描述任务适配度：在 `human-assisted` 工作中它提供建议，在 `autonomous` 工作中它才是上限。任务风险和当前授权仍是独立条件。

分数和 Discord role 都不能授予 GitHub 权限。本地结果也不能证明模型身份或预测验收。Approval 与 merge 需要当前用户或精确 active standing authorization，并继续受实时仓库规则约束；本地 schedule 只有窄范围 review 与 exact-head integration scope。Release、仓库规则、访问控制和 secrets 仍由人类在场决策。

主仓库和 Discord Bot 目前并不具备相同的 CI 与分支控制。协作者应按各仓库真实存在的控制工作，不能借用另一边的保证。

完整政策见 [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md)。
