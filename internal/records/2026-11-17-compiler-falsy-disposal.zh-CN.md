# Compiler ordinary disposal 保留 falsy 错误

## Why

当前 `C-LIFECYCLE-0002-K` 已明确普通 `beforeDispose` 的边界：首个 authored callback 抛错后停止该序列，继续尝试已取得资源的私有 terminal cleanup，最后向调用方报告失败；只有该错误时，包括 falsy 值在内的原始抛出值必须保留。该条目仍为 draft，本次不改变其 lifecycle，也不扩大其它生命周期的错误恢复语义。

在 `bf8b1f55f93a89f3c689276d6e339d83891f4dba` 上，React DOM `disconnect()` 和既有 React SSR 实验的 `disposeNow()` 把 `undefined` 同时用作“尚无错误”和错误值；Vue2 `dispose()` 最后用 truthiness 决定是否抛出。因此实际 cleanup 虽然完成，调用方仍可能观察到错误的成功结果。这对应集中维护台账 [#1488 的 G 节](https://github.com/Proto-UI/Proto-UI/issues/1488)。

修复在这三个 owner 路径使用独立的 `{ error }` carrier，所有原有 catch 点统一保存 carrier，最终解包抛出其原值。正常路径不分配 carrier；原有清理顺序、fail-fast authored dispatch 和 SSR request 的既有 `AggregateError` 包装保留，没有新建聚合政策。

## 实际红／绿证据

新增 `packages/compiler/test/lifecycle-disposal-errors.test.ts` 通过公开 compiler producer/writer 输出完整 artifacts，再用普通生成模块 import 和真实 React/Vue2 框架调用执行。React SSR 使用原有直接 `ssr: true` 实验入口，未激活公共 SSR registry profile。

| 消费者 | 修复前 | 修复后 | 修复前的具体失败 |
| --- | --- | --- | --- |
| React DOM | 9/10 | 10/10 | `throw undefined` 被吞 |
| Vue2 | 3/10 | 10/10 | `0`、`-0`、`false`、空字符串、`null`、`undefined`、`NaN` 被吞 |
| React SSR 既有实验 | 9/10 | 10/10 | `throw undefined` 未进入 request cleanup aggregate |

每条路径还执行 truthy string、真正的 `Error` 和正常返回控制。primitive 用 `Object.is` 验证，包括 `-0` 和 `NaN`；`Error` 控制验证类型与 message，没有将它描述为单独的对象 identity 证明。

在判断错误传播之前，测试先观察：首个 callback 的计数、后续 authored callback 是否被跳过、在 `beforeDispose` 内实际创建的 50/51 ms Delay timer 是否以同一 timer identity 被 `clearTimeout` 取消，以及 DOM 消费者保留的 State 和纯词法 exposed method 是否失效。这些 Delay 在普通 view detach 之后创建，因此取消不能仅由早先 detach 或后续失活检查解释。React 仅在同步 unmount 期间收集并显式交付 host microtasks，以捕获连 `undefined` 都可能抛出的完成事件；这不是原生浏览器调度验收。

有效红测为 **30 收集／21 通过／9 失败／0 跳过**；同组绿测为 **30/30，通过，0 跳过**。最初试运行还有二十条输出目录冲突：测试误把已创建的临时目录交给要求全新目的地的 writer。修正为新的 `output` 子目录后才形成有效红测；原始试运行独立保留，没有把这些 fixture 错误计作产品回归。

独立审查发现测试的清理异常可能跳过全局恢复。已改为逐项收集 cleanup 错误，并在 `finally` 恢复 spies、fake timers 和 document；待清理的 Vue2 owner 保留本 case 的 error handler。审查者逆转这两处隔离修正后，测试字节精确恢复到有效红测的 SHA，确认 authored source 与全部行为断言没有在红→绿之间改变。

## 受影响的既有检查

以下五个既有文件在同一两文件产品补丁上以单 worker 完整运行：`react-source.test.ts`、`react-context-source.test.ts`、`vue2-native-template.test.ts`、`button-ssr-server.test.ts` 和 `delay-detach-consumer.test.ts`。实际结果 **5 文件／106 通过／0 失败／0 跳过**，命令 wall time 51.032 秒。与新回归合计为 **6 文件／136 项通过**，并非完整 Compiler 或全仓 CI。

具体命令、源码与日志 SHA、逐文件结果和本地独立审查摘要保存在相邻 `.evidence.json`。相关原始日志仍保留已有 Vite `ES2024` target warning，没有隐藏 warning 或将其改写成新的产品错误。

## 尚未由本次证明的范围

本次执行是普通框架消费者在 Happy DOM 中的行为证据。没有真实浏览器、平台三阶段整体完成或 SSR 正式准入声明；没有新执行 interaction/style/context 多个次级 cleanup 同时失败的全部组合。现有聚合结构未改属于源码审查结论。仓库整体 types、完整 Compiler、独立 GitHub approval 与最终合并仍以各自实际结果为准。本地独立代理审查不是 GitHub `APPROVED` review。
