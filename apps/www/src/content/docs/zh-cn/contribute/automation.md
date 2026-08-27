---
title: 'Agent 自动化'
description: '了解 intake、review、remediation 与 exact-head integration 如何组合成主动自动化。'
---

有定时器或 Agent prompt，不代表任务已经能自治运行。真正长期运行的任务还需要有边界的输入、去重键、完成条件、可校验输出；多个 runner 可能撞车时，还要有租约和安全终态。

## 现在实际运行的部分

Agent Operations Shadow workflow 会定时或由维护者手动采集一段 Issue 与 PR 快照。它只有 GitHub 读取权限。运行环境提供密钥时，它才执行 Agent 分析；随后会校验结构化提案并上传 artifact。没有执行分析时，快照仍有价值，但不能算 Agent 结果。

PR portfolio trial 只由人工触发，而且只读。外部引擎返回不完整结果时，流程会保留错误，不会把它包装成完整事实。

单一本地 Codex schedule 有两条有条件写入路径：`proto-ui-scheduled-review-v1` 可以提交 exact-head、证据支持的非阻塞 `COMMENT`、带 finding 的 `REQUEST_CHANGES` 或 clean `APPROVE`；`proto-ui-scheduled-merge-v1` 可以在批准者不同于 PR author 与所有 commit author/committer、thread 全部解决、可信 CI 与可信 DCO 分别成功、实时权限和 GitHub merge readiness 同时满足后通过 `pui-integrate` 合并。这些 standing scope 不会扩大仓库 shadow workflow 的权限。

## 自治维护路径

自治维护由 mission queue、lease、新鲜 Observer/Verifier 上下文、有边界 remediation、独立复核和同步收口组成。单一 runner 可以在当前能力上限与授权内自动执行整条链；新上下文用于保持证据独立，不是人工 checkpoint。

No-finding 是合法结果。`pui-record` 可以收口证据充分的 no-finding、被拒绝 finding 和 blocked 终态。已经接受并实施的修复仍须独立复核，之后才能使用 `pui-maintenance-close`。

## 候选周期任务

机器目录还定义了几类有边界的只读候选：CI 故障诊断、协作治理漂移、部署证据和依赖漂移。候选只表示任务边界已经写清，不表示 scheduler、凭据、运行环境或负责人已经存在。

## 扩展高权限写入

本地账本无法阻止同一外部动作在另一个 clone 或 runner 中再次执行。自动修改外部状态需要全局原子消费服务或平台侧幂等键，还要能把正在运行的进程和它出示的授权绑定起来。

当前本地 runner 使用一个受维护 credential、一个仓库、一个 schedule source、实时 canonical reconciliation、exact-head API 参数和 GitHub 规则，已经足以承载 active review/merge scope。启用重叠并发 runner 前，再增加更强 runtime attribution 与全局 lease。

普通自治工作在测得的上限和记录范围内持续推进。只有未决产品方向，以及 publication、release、访问、secret、ruleset、security disclosure 或 provenance exception 等高权限/不可逆操作需要人在场；新动作类别通过 evidence-backed standing-policy change 激活。

准确任务目录位于 `internal/agent-operations/autonomous-tasks.yaml`，维护协议仍由 `internal/autonomous-maintenance/**` 管理。
