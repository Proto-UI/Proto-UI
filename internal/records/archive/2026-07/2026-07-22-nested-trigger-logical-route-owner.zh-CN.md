# 2026-07-22：嵌套 trigger 的逻辑 route owner 与物理 EventTarget 分离

> Internal record. Not normative. 本文记录 `0.2.0-rc.1` 仓库外 React 人工试用暴露的问题、根因与本轮实现选择；规范语义以 `C-AS-TRIGGER-0001` 与 `T-AS-TRIGGER-0001` 为准。

## 外部观察

React 测试项目直接嵌套两个 Shadcn Button，或在 Dialog Trigger / Dialog Close 中嵌套 Button 时，子 trigger 初始化会依次出现：

- `[Event] redirectRoot() requires an EventTarget-like object.`
- `[AdapterHost] shadcn-button owner is already initialized`

连续 trigger 嵌套原本应由 `asTrigger()` 合并到最外层 event route，因此该表现属于实现回归，而不是不支持此类组合。

## 根因

repeatable lifecycle session 重构后，React、Vue 与 Web Component adapter 使用 opaque logical token 表达 owner、parent 与 prototype 关系。`asTrigger` 仍把找到的 parent token 强制传给只接受 `EventTarget` 的 `event.redirectRoot()`，从而把逻辑 instance identity 与物理 event target 混为一体。

现有 runtime contract test 使用同一个 `FakeTarget` 同时表示 logical instance 与 `EventTarget`，没有覆盖这种身份分离。React 的 fake runtime 也没有真实渲染嵌套 adapter component，因此未进入 framework context parent 链。

第二条错误来自 `createViewEpochOwner.initialize()` 的非原子初始化：session 创建抛错后，已写入的 wiring 没有回滚；React 错误恢复再次初始化时得到误导性的 already-initialized 错误。

## 本轮选择

1. `asTrigger` 继续只沿 host-cap 提供的 logical parent/prototype 链计算最外层 owner。
2. host 通过 `AS_TRIGGER_SET_ROUTE_OWNER_CAP` 记录 caller 到 route owner 的逻辑关系，通过 `AS_TRIGGER_GET_EVENT_TARGET_CAP` 把 owner 投影为可绑定 target。
3. Web adapter-base 为每个 logical owner 提供稳定的 dynamic EventTarget bridge。listener 可以在 owner view 尚未创建时注册；view attach、detach 或 epoch 替换时，bridge 会把既有 listener 迁移到当前 `router.rootTarget`。
4. Web event router 比较 logical owner token，而不是把 token 当 DOM，或在每个 trigger DOM 上写无法表达最外层 owner 的布尔标记。
5. `createViewEpochOwner.initialize()` 在 session 创建、intent subscription 或初始通知失败时统一回滚，使 owner 保持可重试状态。

没有通过删除 Event 模块的 `EventTarget` 校验来规避错误；该校验仍用于阻止无效物理 target 进入 event kernel。

## 覆盖

- runtime contract test 使用彼此分离的 logical object 与 `FakeTarget`。
- adapter-base 测试覆盖 late target、view target replacement、解绑与 route owner DOM projection。
- 真实 ReactDOM 与 Vue renderer 测试覆盖 nested Base Button mount 和单次 activation。
- Web Component Dialog 测试覆盖 Dialog Trigger 内嵌 Button 的 Enter 与 click activation。
- view epoch owner 测试覆盖初始化失败后重试。

## 边界

`Button > Button` 可作为 runtime 不应崩溃的回归结构，但若 adapter 把两者都渲染为原生 `<button>`，最终 DOM 仍不符合 HTML interactive-content nesting 约束。本轮保证的是 Proto UI logical trigger composition 与 event route；不会引入已明确省略的 Radix-style `asChild` API，也不会把自动 route merging 责任交给组件调用者。
