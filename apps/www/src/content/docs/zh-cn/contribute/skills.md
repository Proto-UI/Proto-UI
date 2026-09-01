---
title: 'Agent Skill 目录'
description: '查看 pui-dev 与 pui-maintain 按需组合的短状态转换，而不是一次加载整个 skill 库。'
---

`internal/agent-operations/skills.yaml` 是机器注册表，保存路径、能力档位、任务类别、输入和输出。这里用人能直接读懂的方式说明同一套 skill。

## 如何按需加载

总入口先选择一个叶子 ID，再让解析器返回唯一的注册文件：

```sh
pnpm agent:skill -- pui-trace --mode human-assisted --mode-source current-user
```

叶子完成后返回结构化 handoff。总入口先校验它，再解析下一步：

```sh
pnpm agent:skill -- --handoff <handoff.json>
```

Handoff 携带有类型的产物，最多指向一个下个 skill。终态 handoff 会结束链路。叶子本身不能继续加载别的叶子。

## 进入仓库并确定任务

| Skill         | 完成的一次转换                                  |
| ------------- | ----------------------------------------------- |
| `pui-assess`  | 从未测评状态得到未签名的 U0-C4 本地任务适配结果 |
| `pui-orient`  | 从未知上下文得到带执行模式的协作边界            |
| `pui-select`  | 从未限定请求得到一个只读任务提案，或明确无任务  |
| `pui-claim`   | 从已授权提案得到一个 claim，或安全地不写入      |
| `pui-unclaim` | 释放一个自己拥有的 claim 并留下记录             |
| `pui-trace`   | 从明确对象得到权威与证据图                      |

## 整理受治理的内容

| Skill            | 完成的一次转换                         |
| ---------------- | -------------------------------------- |
| `pui-brainstorm` | 从未决产品方向得到最小决策包           |
| `pui-spec`       | 从已追踪语义范围得到受治理 spec 图变更 |
| `pui-contract`   | 从受治理事实得到易读的 contract 投影   |

## 实现一个所有权切片

| Skill                | 完成的一次转换                                 |
| -------------------- | ---------------------------------------------- |
| `pui-module`         | 从有边界 Module 切片得到可移植实现与证据       |
| `pui-host`           | 从已追踪宿主责任得到 Host Capability 实现      |
| `pui-adapter-assess` | 从明确的 Adapter 问题得到只读评估包            |
| `pui-adapter`        | 从有边界 Adapter 范围得到一个实现切片          |
| `pui-prototype`      | 从受治理组件切片得到完整 Prototype 交付        |
| `pui-regression`     | 从已复现的受治理故障得到有边界的修复与回归证据 |

## 建立证据与读者文档

| Skill             | 完成的一次转换                                                 |
| ----------------- | -------------------------------------------------------------- |
| `pui-test`        | 从受治理行为得到可执行证据                                     |
| `pui-docs`        | 从仓库事实得到人类文档                                         |
| `pui-validate`    | 从候选改动得到相称的验证报告                                   |
| `pui-review`      | 从候选 exact head 得到独立 packet 与获授权的 review receipt    |
| `pui-integrate`   | 从已获独立批准的 exact head 得到受仓库规则约束的 merge receipt |
| `pui-collaborate` | 从受治理的实时协作状态得到一个已核验的可逆 mutation receipt    |

## 检查并继续推进仓库协作面

检查类叶子保持只读 intake 与诊断；credential 边界用于保护观察过程，并不限制后续 skill 链。`pui-collaborate` 会在 current-user 或 standing authorization 下执行一个 exact-target、可逆的 metadata、update-branch、ready-for-review、thread、review-request、status-comment 或 CI recheck 动作。其注册 runtime 会核验 purpose-bound request digest 与最新 live state，只执行零次或一次 mutation，对未知结果仅 reconciliation 一次且不盲目重试，并返回经过 schema 校验的 receipt；review disposition 与 merge 继续使用各自独立的 exact-head 叶子。

| Skill                   | 完成的一次转换                                         |
| ----------------------- | ------------------------------------------------------ |
| `pui-issue`             | 从一段 Issue 队列得到协作状态报告                      |
| `pui-pr`                | 从一段 PR 队列得到集成状态报告                         |
| `pui-ci`                | 从一次 workflow 故障得到归属与证据图                   |
| `pui-govern`            | 从一个协作问题得到治理漂移报告                         |
| `pui-deploy`            | 从一个交付面得到与 revision 绑定的证据报告             |
| `pui-deps`              | 从一个依赖问题得到影响和风险报告                       |
| `pui-dependency-update` | 从已治理依赖报告得到有边界的 manifest 与 lockfile 更新 |

## 准备和核验发布

| Skill               | 完成的一次转换                     |
| ------------------- | ---------------------------------- |
| `pui-release-prep`  | 从明确发布意图得到可审阅候选状态   |
| `pui-release-audit` | 从已完成发布得到核对后的不可变证据 |

## 执行自治维护

`pui-maintain` 每次只路由一个阶段。协议要求独立性时，观察、核验和复核必须使用新的上下文。

| Skill                    | 完成的一次转换                                         |
| ------------------------ | ------------------------------------------------------ |
| `pui-mission`            | 从选定候选得到冻结的有边界 mission 与 lease            |
| `pui-observe`            | 从冻结 mission 得到 finding 或 no-finding 报告         |
| `pui-verify`             | 从候选 finding 得到独立分类                            |
| `pui-remediate`          | 从已接受 finding 得到有边界的修复与 remediation packet |
| `pui-maintenance-review` | 从实际修复得到独立技术结论                             |
| `pui-maintenance-close`  | 从已复核修复得到同步后的收口状态                       |
| `pui-record`             | 从不需要修复的终态结果得到同步后的 run 记录            |

## Agent 独自工作时，能力档位就是上限

C1 适合处理有边界的事实，以及事实或文档复核；C2 增加测试、bounded-regression 复核，以及 review 提交和 exact-head integration 等 exact-target 协作写入；C3 增加有边界的语义实现和受治理切片复核；C4 增加跨域语义、治理判断、release evidence 复核与发布准备。`pui-review` 每次按内容声明 C1–C4 review class；review 与 merge 写入原语本身使用 C2 exact-target mutation floor。注册表把叶子的门槛叫作 `autonomousMinimumBand`，因为它只在 Agent 自己选择或推进任务时作为硬上限。

在 `human-assisted` 模式中，同一份结果只是建议。它会改变工作范围、验证强度、复核深度和限制说明，但不会挡住当前用户明确要求的任务。在 autonomous 工作中，只要 active standing authorization、可信证据、GitHub 实时权限、review state 与仓库规则一致，符合条件的独立 Agent 就可以继续 recheck、提交有 finding 支撑的 `REQUEST_CHANGES`、对 clean exact head 执行 `APPROVE`，并完成 exact-head merge。只有未决产品方向和特权或不可逆操作需要升级给人类；Discord 或 Poppy 信任仍只约束它们实际控制的 surface。
