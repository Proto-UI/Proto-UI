# Overlay 编目前的 Escape 仲裁问题

日期：2026-09-09。基线：`f4782c8d`。本文是待维护者决策的观察与建议，不修改现有 draft 契约，不接纳新语义。

## 已确认的事实

`C-AS-OVERLAY-0001-I`（draft）规定 Escape opt-in 并直接消费 Event；`-F` 规定 Boundary stack 跟随 logical open。它们没有规定多个 Overlay 对同一次 Escape 的仲裁。Boundary 的 top/sample 规则治理 outside classification，不能自动扩展为 Escape 规则。

`packages/modules/overlay/src/impl.ts` 的 `installDismissSampling()` 为每个实例独立安装 global `key.down` 回调。最小 Runtime 观察同时创建两个 defaultOpen、closeOnEscape 实例，共用一个 EventTarget；一次 `key.down { key: 'Escape' }` 使 `[true, true]` 变为 `[false, false]`。观察测试已运行通过，未把此现状固化为新 conformance。现有 `packages/runtime/test/contract/overlay.v0.contract.test.ts` 的 `OVERLAY-0550` 仅覆盖单实例。

多实例事实已复现；真实嵌套 Dialog/Dropdown 的完整焦点与 Root request 旅程尚未验证，不能直接把该观察等同于全部组件行为。部分 Prototype 还有自己的 Event/Root request 路径，改 Overlay 一处不等于完成全库迁移。

## 可选语义

1. **保留广播**：所有 open 且 closeOnEscape 的 Overlay 都处理同一次 Escape。兼容当前实现，但嵌套浮层可能同时关闭。
2. **一次只交给一个候选（建议）**：在当前激活、已开启 Escape dismissal 的 Overlay 中按明确的逻辑激活顺序选一个；同一 sample 不因它关闭而继续落到下一个。未启用 Escape dismissal 的 Overlay 不进入候选集。
3. **最上层阻断**：先选择最上层逻辑 Overlay；即使它未启用 Escape dismissal，也阻止下面的 Overlay 处理。需要进一步区分装饰 mask、Tooltip、内容层等参与资格，不能直接套用 z-index 或所有 Boundary registration。

建议先确认第 2 项作为目标方向。它不要求现在指定新公共 API，也不把 CSS z-index 等同于逻辑顺序。具体共享仲裁归属需单独设计；Event 继续传输输入，Overlay/相关协调层决定 dismiss 候选，不能把 keyboard 输入伪装成 Boundary outside sample。

## 若采纳，后续工作边界

这是多消费者仲裁语义的扩展，应遵循批量编目规则单独处理架构变更；不能在本批普通 M/HC/A 编目中偷偷改变所有 Escape 行为。现有单 Overlay guarantee 可继续有界编目，多 Overlay 仲裁保留显式未决项；是否在本批先完成这种有界编目，也由后续方向决定。

拟议的证据图：扩展 `C-AS-OVERLAY-0001` 的有界 criterion；`T-AS-OVERLAY-0001` 增加双实例/嵌套、候选退出、同 sample 不穿透、未启用候选、detach/leave、受控 Root request，以及四 Adapter tests。检查 Dialog、Dropdown、Tooltip 等直接消费者和其自有 Escape listener，避免只修自动 close 而遗漏 Root owner 路径。

本决策不授权改造 Focus、Hit Participation、Portal、z-index 排序、Modal policy 或全局 Event 广播语义，也不提升实体 lifecycle。

## 其它发现，尚未纳入保证

- 四 Adapter 的 modal bridge 把 overflow 原值保存在 `document.body.__proto_ui_original_overflow`，多 owner 会覆盖共享快照；需要独立的拥有权/清理回归证据。这里仅为源码观察，尚未运行多 modal 复现。
- `entry`、`restore`、`closeOnAnchorPress`、`closeOnTriggerPress` 在 Overlay 实现中为配置保存，不能据字段存在宣称通用自动策略已实现；Focus outside 已由 `C-AS-OVERLAY-0001-I` 明确 deferred。
- layer scheduler 当前是 sequence 加 role offset 的 z-index 投射，不是任意嵌套层级仲裁。其已有两元素测试不能证明长期 sequence 增长后的绝对 role 排序。

在选择新仲裁语义前保留这些事实，不把临时实现直接提升成通用 HC baseline。
