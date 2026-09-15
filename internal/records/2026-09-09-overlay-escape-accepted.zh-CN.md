# Overlay Escape 仲裁方向确认

日期：2026-09-09。基线：`16da51b5`。用户已明确接受 `2026-09-09-overlay-escape-decision.zh-CN.md` 的第 2 项建议。本文记录已确认方向与后续交付边界，不改写旧决策记录，不表示现有实现已满足该方向，也不提升 draft lifecycle。

## 已确认方向

一次 Escape 只交给最近激活且启用了 Escape dismissal 的活跃 Overlay。未开启 Escape dismissal 的 Overlay 不进入候选集，也不阻挡下面的合格候选。同一次输入选定候选后，即使候选关闭、退出或同步重新打开，也不得继续交给下一层。

逻辑激活顺序不是 CSS z-index 顺序。Event 继续负责输入传输，Escape 不成为 Boundary outside sample；不改变一般 Event 广播行为。此确认不扩展 Modal、Focus、Portal 或 Hit Participation 的职责。

## 已进一步核实的消费者

`packages/prototypes/base/src/dialog/content.proto.ts`、`packages/prototypes/base/src/dropdown/content.proto.ts` 与 `packages/prototypes/base/src/tooltip/content.proto.ts` 都监听 Overlay open 的 `reason: escape`，将其转为各自 Root request；受控 owner 尚未接受关闭时，会调用 `overlay.openOverlay('controlled.sync')`。因此不能仅通过检查当前 open 值实现同 sample 的单次仲裁，必须保留该次输入已选候选的事实。

Dropdown Content 另一个 global key.down listener 当前只处理 Tab，不能误删或将它改为 Escape 仲裁入口。Dialog Command 等其它独立 keyboard 协议应保持各自边界，不能因为共享键名就迁移。

## 实现与验收计划

1. 在独立架构变更中扩展 `C-AS-OVERLAY-0001` 和 `T-AS-OVERLAY-0001`，保持 draft；补充 M/必要 HC/A 的关联，避免用 Record 作为永久规范。
2. 由 Overlay 的协调边界管理候选的激活、退出与输入归属。实现时核实 Event sample identity 在各 Adapter 之间的可用性与作用域，不借用 DOM z-index 或直接复用 Boundary outside stack。
3. Runtime 覆盖双实例、反向注册/激活顺序、未启用候选、关闭与再次激活、detach/terminal cleanup、同 sample 不穿透及受控同步 reopen。
4. 四 Adapter 覆盖真实输入翻译，消费者覆盖嵌套 Dialog/Dropdown 与受控 Root request。验证一次 Escape 只产生选定 owner 的关闭请求，并保持现有焦点恢复责任。
5. 保留单 Overlay 行为、Portal/Transition leaving 生命周期及非 Escape 输入；不顺带处理多 modal overflow 或 layer scheduler 的独立问题。

其中协调对象的具体放置、input domain 的实现形式和测试工具属于实现设计，不应从本记录推断新增公共 API。若 trace 暴露新的跨宿主语义选择，再单独提出具体问题。

## 批次安排

遵循用户先前确认的架构拆分顺序，以及 `spec/MODULE-HOST-CAP-ADAPTER-CATALOGING.zh-CN.md` 第 10.1 节：先完成并合入当前可独立成立的编目 PR，再单独推进仲裁架构变更；依赖仲裁的新编目随后继续。当前方向已确认，状态不再是等待 Escape 策略选择，而是等待前置批次交付。

本次只读查询 `codex/module-host-adapter-catalog-batch` 的 GitHub PR 列表为空。该观察为当前时点事实；后续交付需重新核实，不据此推导发布、push 或 merge 授权。
