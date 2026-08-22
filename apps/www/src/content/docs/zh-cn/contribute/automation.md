---
title: 'Agent 自动化'
description: '分清哪些周期任务已经运行，哪些仍靠人工启动，哪些只是有边界的候选设计。'
---

有定时器或 Agent prompt，不代表任务已经能自治运行。真正长期运行的任务还需要有边界的输入、去重键、完成条件、可校验输出；多个 runner 可能撞车时，还要有租约和安全终态。

## 现在实际运行的部分

Agent Operations Shadow workflow 会定时或由维护者手动采集一段 Issue 与 PR 快照。它只有 GitHub 读取权限。运行环境提供密钥时，它才执行 Agent 分析；随后会校验结构化提案并上传 artifact。没有执行分析时，快照仍有价值，但不能算 Agent 结果。

PR portfolio trial 只由人工触发，而且只读。外部引擎返回不完整结果时，流程会保留错误，不会把它包装成完整事实。

## 仍由人启动的部分

自治维护已经有 mission queue 和状态协议，但没有 scheduler 或 controller。维护者目前要在自治控制器之外冻结一项 mission，再启动 Observer；需要核验时另开一个新的 Verifier 上下文，并在后续阶段之间记录人工决定。每次自治转换都必须处于最新本地任务与复核上限内，并遵守记录下来的 mission lease。

No-finding 是合法结果。`pui-record` 可以收口证据充分的 no-finding、被拒绝 finding 和 blocked 终态。已经接受并实施的修复仍须独立复核，之后才能使用 `pui-maintenance-close`。

## 候选周期任务

机器目录还定义了几类有边界的只读候选：CI 故障诊断、协作治理漂移、部署证据和依赖漂移。候选只表示任务边界已经写清，不表示 scheduler、凭据、运行环境或负责人已经存在。

## 为什么写操作仍须有人在场

本地账本无法阻止同一外部动作在另一个 clone 或 runner 中再次执行。自动修改外部状态需要全局原子消费服务或平台侧幂等键，还要能把正在运行的进程和它出示的授权绑定起来。

这些控制完成前，周期性的外部写操作保持只读。普通本地自治工作仍可在测得的上限和已记录范围内推进。语义决定、approval、merge、publication、release、访问、secret 和仓库规则始终停下来交给人。

准确任务目录位于 `internal/agent-operations/autonomous-tasks.yaml`，维护协议仍由 `internal/autonomous-maintenance/**` 管理。
