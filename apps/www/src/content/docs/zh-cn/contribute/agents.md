---
title: '贡献者 Agent'
description: '通过懒加载、可组合的 skills 参与 Proto UI，同时受理解能力与实际权限约束。'
---

Proto UI 为 Agent 提供两个短入口。

`pui-dev` 负责普通开发，`pui-maintain` 负责受治理的自治维护。它们从机器注册表中选择一次状态转换，再用 `pnpm agent:skill -- <leaf-id>` 解析一个叶子 skill。通过校验的 handoff 最多只能解析出下一个叶子，不会一次读取整个 skill 库。

## 原子 skills

每个叶子 skill 只完成一次转换：确定上下文、领取任务、追踪权威、整理决策、编写受治理实体、实现一个所有权切片、建立证据、更新文档、验证、独立审阅、准备发布或核验发布事实。

自治维护另外拆出观察、独立核验、已批准修复、独立复核和收口，确保需要新上下文的角色不会被合并。

Skill 指令统一使用英文，让模型使用同一套技术约束。Agent 与贡献者交流时跟随贡献者当前使用的语言。

## 能力测评

先从当前 spec catalog 动态生成试题：

```sh
pnpm agent:assess -- --locale zh-CN
```

试题绑定仓库 SHA、catalog 与 policy digest、随机 nonce 和过期时间，不包含答案文件。它考察权威判断、关系追踪、语义边界、验证设计、任务就绪度和权限推理。

Agent 接着填写与试题绑定的答卷，校验格式和快照，再按公开维度评分表填写自评并派生结果：

```sh
pnpm agent:assess:response -- --challenge <challenge.json>
pnpm agent:assess:validate -- --challenge <challenge.json> --response <response.json>
pnpm agent:assess:evaluation
pnpm agent:assess:self-result -- --challenge <challenge.json> --response <response.json> --evaluation <evaluation.json>
```

六个维度各自按 0 到 4 评分，强项不能抵消弱项，严重错误还会限制最终结果。未签名的本地自评只能得到 U0 或只读 C1。

更高能力需要可信签发者给出的独立、带版本和过期时间的 attestation。每次写操作还要有一份 probe，绑定准确的叶子 skill、任务范围、当前 diff、权限快照、人工授权和 Agent 主体。可信身份、签发者或全局单次消费能力缺失时，Agent 必须停在写操作之前。

测评只会缩小任务范围。有效能力是以下条件的完整交集：

```text
effective capability =
live GitHub permission
∩ 与社区或 Bot 有关时所需的 Discord 或 Poppy 信任
∩ verified Agent comprehension
∩ task risk ceiling
∩ fresh task-specific probe
∩ current human authorization
```

它不能授予 GitHub 权限，也不会取消任何人类闸门。

## 任务选择

Agent 只能提议已经就绪、边界明确、无人占用，并且写清验收和验证范围的任务。它还要检查负责人、评论、关联工作、Project 启用后的状态、能力要求和权限上限。真正发布 claim 是另一项写操作，当前条件不够时不能执行。

如果没有合格任务，Agent 应停止并报告当前没有安全的领取对象。

把下面这一行交给你的 Agent：

```text
Read AGENTS.md, then use $pui-dev to assess your current capability and permissions and select at most one eligible unclaimed task. Stay read-only unless a trusted attestation, an exact live task probe, platform permission, and current human authorization all permit the next leaf; otherwise return the proposal and missing gate.
```

[Skill 目录](/zh-cn/contribute/skills/) 列出全部状态转换；[Agent 自动化](/zh-cn/contribute/automation/) 区分已经部署的 shadow、手动协议与候选设计。详细政策见 [AGENTS.md](https://github.com/Proto-UI/Proto-UI/blob/main/AGENTS.md) 和 [Contributor Agents](https://github.com/Proto-UI/Proto-UI/blob/main/internal/agent-operations/contributor-agents.md)。
