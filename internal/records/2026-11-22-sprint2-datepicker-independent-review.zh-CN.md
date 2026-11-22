# Sprint 2 Calendar / DatePicker 独立复核

## 当前结论

原提案回调顺序修复和新增 native journey 的静态差异已复核。`DATEPICKER-REVIEW-001` 的公开 State / Context 启动会话反例经过两轮修复已转绿；第二轮修复仍有一个真实嵌套请求回归 `DATEPICKER-REVIEW-002`，当前保持未接受。原生浏览器新增旅程尚未执行，本记录只证明代码审查与下列真实 Runtime 探针。

本复核者没有提交或修改被审产品实现，没有代替实现者重跑完整矩阵。小型探针均通过 `/tmp/proto-ui-s2-heavy-local.lock` 串行运行。

## 实质发现与证据

| 发现 | 实际行为 | 证据与当前状态 |
| --- | --- | --- |
| DATEPICKER-REVIEW-001，P2：请求开始时的弹层会话采样太迟 | 最初关闭的 Picker 在公开 State 通知或更早 Calendar Context 订阅者中打开；旧 selection 随后将新弹层关闭。原契约要求请求开始时弹层已经打开。 | 原 `3bd5bcf` 的 State 单/范围 2 条红；首次 request ID 提前发布后原 2 条转绿，但早期 Context 订阅者单/范围 2 条仍红；`593682a` 的单调 id / 当前 provider / Popover 前态修复后原 Context 2 条转绿。原始红绿回执与三阶段完整源码快照均保留。 |
| DATEPICKER-REVIEW-002，P2：旧 Popover 通知前态绑定了新请求 | request 1 在关闭状态启动；早期 Calendar 订阅者打开弹层；早期 Popover 订阅者已经读到实际 open=true，再提交并接受 request 2。Picker 将最新 id 2 绑定到旧打开通知的 prev.open=false，导致新请求应关闭却保持打开。 | `593682a` 源码在整合 `2430aea` 上，独立单/范围 2 条均红。request 2 返回 true，canonical 均已接受 16 日，最终 open=true 且没有 completion close；应为 false。`compiler-review-picker-context-nested.*`。相邻旧 close → reopen → 新受控请求 → 延迟 owner 接受也在相同源码上单/范围 2 条均红，`compiler-review-picker-context-oldclose.*`。 |

第二项不是使用旧请求关闭新会话的容错要求，而是当前有效、被接受且在已打开会话内启动的新请求应正常完成。相邻旧关闭通知的反例由 collections 复核者提出，本路按实现者要求以原 Runtime harness 独立确认：旧 close 的较早订阅者重新打开并发起新受控请求；该请求开始时实际 open=true，稍后普通 owner 接受，却被继续送达的旧 close 退休而不关闭。两个模式均复现，执行前后五个相关源文件 SHA 一致且匹配 2430aea。它归入同一已证实因果绑定缺口。

## 原生旅程静态审查

新增 fixture 使用普通受控消费者：根事件先保存，rangeChange 通过既有 WC 属性提交或框架 redraw 接受 range；Vue / Vue2 保留框架自然提交时序。观察值来自公开 exposes，关闭和重开也只调用公开方法。fixture-only 控制选项被剥离，不作为产品 Props。

runner 保留原 range 拒绝与 DOM presence / 家族 paint 断言，并新增：

- uncontrolled 完成严格为 rangeChange → 一次 openChange。
- controlled range 接受时，回调前、普通 owner 更新后、回调结束前 popup 均保持打开。
- 普通接受后只产生一次 date-selection 关闭。
- 回调显式关闭再重开后保留新会话，重复提交同一 canonical range 不会复活旧 completion。
- 事件个数、顺序、原因、最终公开 open、transition state 与真实后代可见性都被断言。

这补齐的是 range 消费旅程的接受 / 拒绝 / 回调重入，不代表所有 single-date 路径或受控 Popover open 拒绝已被同一旅程覆盖。当前没有独立 native 成功声明；真实 Chromium 回执由托管队列产生后另行审查。`git ls-files -z` 来源清单修复也已静态核对，保留非 ASCII 文件路径原始字节。

## 来源绑定和范围

`compiler-review-picker-source-bindings.json` 将原始脚本、原始结果和三个执行源码快照逐一绑定。原 State-green JSON 中 reviewedCommit 字段继承最初基线 `3bd5bcf`；它不是执行候选。该原 JSON 没有覆写；补充 binding 明确它执行的是 Calendar 增加 11 行的第一修复工作树。

- 原基线 Calendar SHA-256：`37abb98add0b3cb861e246200ac2d8511e30b1d201b3f5ddd6c86f1cb74fa852`。
- 第一与第二修复 Calendar：`e24adfcf37a6ac5f7890351e41c898093fda16ed7278ce2e724d15f4a6f44790`。
- 第二修复 DatePicker：`26e3e057639cc13bf67e99ce3ca6c8f61a02fb9113546e40441454eb3a047840`。
- 被审定义：`5129e2c9a54fbb98bd353f8e5d373c925c2d0069e106f775bcff6c8cd026ef09`。
- native runner：`49261eb2f879a76e9ed445d831a1709008f7e6690595ebeaef0ca52618621cbb`。
- native fixture：`220b32f66e8bed530732d7504d5449a4feec7924983a0b89d3d30640a2e14bb7`。

已回读实现者两整文件 114/114、0 skip 结果（calendar-selection 25 项；selection-reset-lifecycle 89 项），不把该回读写成复核者独立运行。该结果不覆盖随后发现的第二项嵌套请求反例。
