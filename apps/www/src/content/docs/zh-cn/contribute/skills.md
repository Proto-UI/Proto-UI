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

| Skill            | 完成的一次转换                       |
| ---------------- | ------------------------------------ |
| `pui-brainstorm` | 从语义不确定性得到维护者决策包       |
| `pui-spec`       | 从已批准语义范围得到 spec 图变更     |
| `pui-contract`   | 从受治理事实得到易读的 contract 投影 |

## 实现一个所有权切片

| Skill                | 完成的一次转换                                 |
| -------------------- | ---------------------------------------------- |
| `pui-module`         | 从已批准 Module 切片得到可移植实现与证据       |
| `pui-host`           | 从已批准宿主责任得到 Host Capability 实现      |
| `pui-adapter-assess` | 从明确的 Adapter 问题得到只读评估包            |
| `pui-adapter`        | 从已批准 Adapter 范围得到一个实现切片          |
| `pui-prototype`      | 从受治理组件切片得到完整 Prototype 交付        |
| `pui-regression`     | 从已复现的受治理故障得到有边界的修复与回归证据 |

## 建立证据与读者文档

| Skill           | 完成的一次转换                                            |
| --------------- | --------------------------------------------------------- |
| `pui-test`      | 从受治理行为得到可执行证据                                |
| `pui-docs`      | 从仓库事实得到人类文档                                    |
| `pui-validate`  | 从候选改动得到相称的验证报告                              |
| `pui-review`    | 按一个声明的 review class 生成与 revision 绑定的 packet   |
| `pui-integrate` | 从已批准 exact-head PR 得到受仓库规则约束的 merge receipt |

## 检查仓库协作面

这些叶子全部只读。诊断和提案不等于授权修复。

| Skill        | 完成的一次转换                             |
| ------------ | ------------------------------------------ |
| `pui-issue`  | 从一段 Issue 队列得到协作状态报告          |
| `pui-pr`     | 从一段 PR 队列得到集成状态报告             |
| `pui-ci`     | 从一次 workflow 故障得到归属与证据图       |
| `pui-govern` | 从一个协作问题得到治理漂移报告             |
| `pui-deploy` | 从一个交付面得到与 revision 绑定的证据报告 |
| `pui-deps`   | 从一个依赖问题得到影响和风险报告           |

## 准备和核验发布

| Skill               | 完成的一次转换                     |
| ------------------- | ---------------------------------- |
| `pui-release-prep`  | 从已批准发布意图得到可审阅候选状态 |
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

C1 适合处理有边界的事实，以及事实或文档复核；C2 增加测试与 bounded-regression 复核；C3 增加已批准的语义实现和受治理切片复核；C4 增加跨域语义、治理证据、发布准备，以及 standing-authorized exact-head integration。`pui-review` 每次声明一个 review class，本地结果列出 Agent 无人值守时可以承担的类别。注册表把叶子的门槛叫作 `autonomousMinimumBand`，因为它只在 Agent 自己选择或推进任务时作为硬上限。

在 `human-assisted` 模式中，同一份结果只是建议。它会改变工作范围、验证强度、复核深度和限制说明，但不会挡住当前用户明确要求的任务。两种模式都仍受 GitHub 实时权限、相关 surface 的 Discord 或 Poppy 信任、当前授权、仓库规则和人类闸门约束。
