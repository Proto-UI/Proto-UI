---
title: 'Compiler 指南'
desp: '0.4 Proto 语言编译器的基础规范与实现状态'
description: '0.4 Proto 语言编译器的基础规范与实现状态'
---

旧的私有编译器已经退役。**0.4** 新编译器可以把仓库中的只读 Badge 和受控 Toggle 源码编译成 TypeScript React 组件和原生 Rust GPUI 组件。两个目标使用共享 TypeScript Program 生成的同一份已检查组件 IR。开发入口见 [Compiler 基础文档](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md)。

现有应用继续使用 [Runtime](/zh-cn/build/runtime-architecture/) 与 [Adapter](/zh-cn/build/adapter-guide/)。真实运行的示例、组件 facade 与样式工具沿用各自版本边界。新编译器重建不会成为 0.3 发布的新增验收条件。

## 已有编译器消费方如何迁移

本次退役改动以 [`67fd94f58372cf35fa929f24ef731416b5817e31`](https://github.com/Proto-UI/Proto-UI/tree/67fd94f58372cf35fa929f24ef731416b5817e31) 为直接基线，该版本仍保留旧编译器。依赖旧私有编译器构建的应用，应在完成迁移前保留自己已经验证过的较早 pin。这个基线标识退役边界，并不证明应用在该版本上已经通过构建。

将依赖 pin 升过这一边界后，旧的 `compileFile`、`writeCompilation`、`formatCompilerDiagnostics` 等导出会消失。已有导入或消费方的导出检查可能在调用编译器函数之前就失败；新编译器不承诺保留这些 API。

应用可以主动把受影响的组件迁到现有 Runtime / Adapter 路径，并按该路径的版本化合同验证行为，也可以等待所需的新编译能力。这是消费方的迁移选择；编译器不会自动回退到 Adapter，也不会把旧源码静默解释为新语言。

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

| 源码目标       | 从作者源码得到的验证结果 |
| -------------- | ------------------------ |
| React          | Chromium 验证了 Badge 的 DOM 文本、计算后的颜色、子圆点宽度和只读投影。四个 Toggle 用例覆盖浏览器点击、固定模式下拒绝无效更新、本地状态保留，以及首次输入无效。 |
| GPUI           | 原生无头宿主验证了 Badge 的标签、底色、子圆点绘制结果和只读投影。三个 Toggle 用例覆盖指针请求、重新挂接后的本地状态，以及信号订阅者排队接受请求。 |
| Vue 2          | 源码后端尚待实现。 |
| Vue 3          | 源码后端尚待实现。 |
| Web Components | 源码后端尚待实现。 |

两个宿主都验证了 Badge 的在线状态外观，也验证了传入未知 tone 时保留基础样式。另有一组用例直接以经过检查的 IR 为输入，独立检验目标端行为。

应用专属 extern 可以声明有限的目标集合，缺少绑定时必须明确失败。这不豁免官方可移植原型库在五个后端上的实现义务。

## 这份基础交付了什么

仓库现已记录新合同、独立的语义测试场景、实现顺序与旧实现退役边界。旧编译器、生成物 fixture、编译器专属 runner 与浏览器编译面板已移除。Git 历史保留旧实现和当时的观察记录，它们不构成新编译器的正确性证据。

私有包提供 `compile <path> --target react|gpui [--name ...] [--out ...]` 命令。`compile` 默认从输入文件所在目录向上查找最近的 `tsconfig.json`。下面两个示例均使用 `internal/compiler/examples/tsconfig.json`，其中的路径映射让作者 API 的导入指向编译器自带的类型声明。也可以通过 `--project <path>` 显式指定项目配置。`lint` 默认从当前工作目录查找配置。

```sh
node packages/compiler/src/cli-entry.mjs --status
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target react --name AuthoringBadge --out AuthoringBadge.ts
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target gpui --name AuthoringBadge --out authoring_badge.rs
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target react --name ControlledToggle --out ControlledToggle.ts
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target gpui --name ControlledToggle --out controlled_toggle.rs
```

前端从磁盘读取仓库中的三个作者输入，通过编译器自带的有类型内建声明解析作者操作。公开的 Core 运行时尚未导出 `@proto.ui/core/authoring`。Adapter 执行这些源码以及消费方迁到共用源码的路径仍待验证。

显式传入 `active: false` 后，在按钮可用时连续按两次，每次都发出了 `{ active: true }` 请求，按钮仍显示 `Off`。宿主传入 `active: true` 后，公开状态变为 `true`，按钮显示 `On`。省略 `active` 时，组件从 `defaultActive` 初始化一次，此后自行维护状态。禁用时按下按钮没有产生请求。同一实例增删 `active` 会拒绝整次属性更新，新实例可以重新选择模式。两个宿主运行的组件均来自同一份 Toggle 源码和已检查的 IR。

通用 lint 和编辑器共用 TypeScript Program 与 checker 检查已实现的布尔条件、隐式转换和文本规则，全程无需执行作者模块。可用 `node packages/compiler/src/cli-entry.mjs lint path/to/component.proto.ts --target react --json` 分析项目中的组件。报告记录源码、依赖和配置的摘要。`analysisComplete` 仍为 `false`。发现确定的违规时 `sourceValid` 为 `false`，否则为 `null`。退出码 `1` 表示源码无效，`2` 表示分析未完成或请求的目标不可用。编译 Tabs 源码还需要按 `key` 保留子组件身份、按逻辑层级提供和读取 Context，以及在面板拥有的任务中调用真实的加载器绑定。

后续按能力集交付，每批通过普通目标构建与真实行为验证完整场景。语言不合法、编译器尚未实现、后端尚未降低、extern 缺少绑定应能分别诊断。性能工作先固定冷、热、增量、共享成本与单组件成本的测量方法，再制定硬预算。

当前应用开发请继续阅读 [Runtime 架构](/zh-cn/build/runtime-architecture/)和 [Adapter 指南](/zh-cn/build/adapter-guide/)；编译器开发从[基础文档与工作顺序](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md)开始。
