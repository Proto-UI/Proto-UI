---
title: 'Compiler 指南'
desp: '0.4 Proto 语言编译器的基础规范与实现状态'
description: '0.4 Proto 语言编译器的基础规范与实现状态'
---

旧的私有编译器已经退役。新编译器属于 **0.4 scope**，目前交付的是规范与实现计划，五个源码后端均尚未实现。[Compiler 基础文档](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md)是开发入口。

现有应用继续使用 [Runtime](/zh-cn/build/runtime-architecture/) 与 [Adapter](/zh-cn/build/adapter-guide/)。真实运行的示例、组件 facade 与样式工具沿用各自版本边界。新编译器重建不会成为 0.3 发布的新增验收条件。

## 以什么为准

新编译器不承担旧解析器、API、生成代码或测试的兼容义务。行为由 spec catalog 定义：

- [C-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/contracts/C-COMPILER-FOUNDATION-0001.yaml)：语言与执行合同。
- [D-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/decisions/D-COMPILER-FOUNDATION-0001.yaml)：架构与工程决策。
- [T-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/tests/T-COMPILER-FOUNDATION-0001.yaml)：必须观察的语义场景与尚缺的实现证据。

这些实体描述新编译器。draft 状态表示实现与验证尚未完成，不表示旧编译器的行为可以自动成为默认规则。

## 书写与执行

Proto 使用合法的 TypeScript 语法及其编译器基础设施，独立定义可移植的值、阶段、所有权与效果规则。通过 TypeScript 类型检查并不等于符合 Proto 规范。schema、初始化、响应计算、动作与生命周期明确分区。现有 `.proto.ts` 通过计划中的 0.4 工作项迁移，不会被静默赋予新语义。

响应依赖在编译期确定。无法精确证明时，编译器可安全扩大纯计算的依赖集合；无法建模的程序必须诊断拒绝。依赖扩大不能导致额外事件、请求或其他效果。

动作内的读取立即看见自己的写入，派生值也遵守这一规则。同步片段在动作边界发布状态，每个 `await` 结束当前片段，恢复执行时进入新片段。失败只丢弃当前尚未发布的写入与尚未执行的排队效果，已提交的状态与已发生的外部效果不承诺撤销。

异步任务具有所有者、取消与过期结果规则。Context 的值和 provider 身份均可响应。只有显式公开的状态与动作成为宿主 API；类型化、只读的状态投影让宿主自行组合外观。

## 编译架构

编译器必须分析作者行为，经有类型的语义 IR 降低到结构化目标 AST，并复用成熟的解析、类型检查与打印基础设施。React、GPUI 是第一批源码后端；LLVM 不作为前置条件。

生成组件必须能够进入普通宿主应用。执行原型源码、嵌入动态 JavaScript VM、在运行时解释 Proto IR、包装现有 Runtime / Adapter，都不算编译成功的兜底。组件名与源码路径不得决定专用降低逻辑。

| 源码目标       | 新实现状态 | 交付顺序           |
| -------------- | ---------- | ------------------ |
| React          | 尚未实现   | 第一批共同验证     |
| GPUI           | 尚未实现   | 第一批共同验证     |
| Vue 2          | 尚未实现   | 必须提供的源码后端 |
| Vue 3          | 尚未实现   | 必须提供的源码后端 |
| Web Components | 尚未实现   | 必须提供的源码后端 |

应用专属 extern 可以声明有限的目标集合，缺少绑定时必须明确失败。这不豁免官方可移植原型库在五个后端上的实现义务。

## 这份基础交付了什么

仓库现已记录新合同、独立的语义测试场景、实现顺序与旧实现退役边界。旧编译器、生成物 fixture、编译器专属 runner 与浏览器编译面板已移除。Git 历史保留旧实现和当时的观察记录，它们不构成新编译器的正确性证据。

私有包目前仅提供可用性查询：

```sh
node packages/compiler/src/cli-entry.mjs --status
```

编译请求明确返回 `PUI_COMPILER_NOT_IMPLEMENTED`。目前没有可用的新编译命令；该包仍为私有包，可用性查询也不是已承诺的编译器 API。

后续按能力集交付，每批通过普通目标构建与真实行为验证完整场景。语言不合法、编译器尚未实现、后端尚未降低、extern 缺少绑定应能分别诊断。性能工作先固定冷、热、增量、共享成本与单组件成本的测量方法，再制定硬预算。

当前应用开发请继续阅读 [Runtime 架构](/zh-cn/build/runtime-architecture/)和 [Adapter 指南](/zh-cn/build/adapter-guide/)；编译器开发从[基础文档与工作顺序](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md)开始。
