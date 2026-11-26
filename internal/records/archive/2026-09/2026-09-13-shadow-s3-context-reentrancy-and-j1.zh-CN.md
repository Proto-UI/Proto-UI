# S3 受控 Tabs 的 Context 重入问题与 J1 决策包

日期：2026-09-13。状态：observed evidence / proposed decision，non-normative。J1 尚未批准；本节点不修改 Context 调度规则。

## 已完成与尚未交付

- `31453912`：I1 exact hidden / relative 分类、生成式物理 recipe、旧 artifact 原子拒绝、生命周期独立性和浏览器证据。
- `a5d89d8a`：完整 Tabs 暴露的 intrinsic sizing 修正。静态 inline-flex/flex-1/whitespace-nowrap 组合使用内部单子项 flex shell，不强制外部 min-width、不改变 flex-basis。
- S1 的 5 项、S2 的 4 项真实网站浏览器测试通过；I1 的 11 阶段、H1 的 204 帧、14 组基本 Tabs 准入与 4 组隐藏轴诊断通过。intrinsic 新增 8 项单元测试和 12 组原生几何对照通过。类型、Astro、Agent snapshot 与 58 项 Agent operations 检查通过。
- 本轮 WC/CLI/spec 共 356 项首次运行有一项 evidence-path 检查失败，原因是新证据尚未加入 Git index；精确暂存后该文件 3 项全部通过。不是生产行为失败。
- S3 场景和完整 journey 为研究脚手架，尚未连接 demo-matrix，不能视为人工验收入口。完整 journey 通过初始尺寸检查后在第一个 automatic ArrowRight 的选中断言失败，后续路径尚未验证。

## 最小复现：不是 Shadow 专属，也不是额外 update 调用

`scripts/analysis/shadow-s3-controlled-audit.mjs` 使用 public dist、完整 Shadcn Tabs 与网站 CLI companion，运行 Light / full split × 默认 L1 / keepMounted × 非受控 / 同步 echo / microtask echo，共 12 组。只有两个 Trigger 和对应 Content，没有 S2 设置内容，也不调用额外的 `update()`。

从 A 开始，原生 ArrowRight 请求 B，ArrowLeft 请求 A：

| 消费方式 | Root 暴露值 | Trigger / Content 的最终投影 |
| --- | --- | --- |
| 非受控 | B → A | 正确 B → A |
| 受控，valueChange 内同步 setElementProps | B → A | 留在上一项；默认 L1 反向切换时甚至可无可见面板 |
| 受控，microtask 回写 props | B → A | 正确 B → A |

每条路径每次请求只发出一个 valueChange，所有实例移除后主题订阅归零，无 pageerror。此脚本验证观察结果，不把同步 echo 的失败当作通过的 Tabs conformance。

鼠标点击的最初诊断没有复现：focus 与随后的 press 会产生额外 context 更新，让投影重新对齐。改用单次原生方向键才稳定复现。因此此前 A→B→A click 准入通过，不能代替键盘证据。

## 信息路径与下层证据

1. Trigger focused.watch 在 automatic 模式请求 B。
2. Tabs Root 的 Context callback 接收请求，向 Maker 发出 valueChange。
3. Maker 同步写入 value=b；Root props watch 更新 state 并发布新 Context。
4. `packages/modules/context/src/center.ts` 的 dispatch 递归派发新 transition，随后继续旧 transition 的剩余订阅者。
5. Trigger/Content 收到新 b 后又收到旧 a，最终投影落后于 Root 的当前值；L1 的 view 揭示还可能产生额外同步，使错误表现更复杂。

独立 ContextCenter 的两订阅者诊断也观察到相同顺序：first 收到 0→1 后更新到 2；first 收到 1→2；last 收到 1→2；最后 last 收到 0→1。provider 当前值为 2，last 最后处理的 next 却为 1。该诊断不依赖 DOM、Tabs、Shadow 或共享 singleton。

`packages/runtime/src/instance/instance.ts` 当前使用 recipient 的 CallbackScope.runNoSync 派发 Context callback；这保留了运行作用域，但未串行化重入 transition。尚未实施任何队列修正，不能声称单加 FIFO 已证明可用。

## 为什么需要边界决策

- draft `P-BASE-TABS` 的 CONTROLLED-VALUE / CONTEXT-SYNC 和 `P-BASE-TABS-TRIGGER`、`P-BASE-TABS-CONTENT` 要求受控输入、选中状态和当前面板一致。当前浏览器行为是待修复缺陷。
- draft `C-CONTEXT-0010` A/B/C/D/E 与 `D-CONTEXT-NOTIFICATION-SCHEDULING-0001` 要求 transition 不丢失、不错误合并、next/prev 正确、顺序确定，并允许 Runtime/Adapter 调度差异。
- 它们没有规定同通路重入时是深度优先还是按提交先后送达；C-CONTEXT-0010-Q-SCHEDULING 明确保留更强调度规则为开放问题。递归顺序虽然确定，却让新值先于旧值抵达部分消费者。
- 改为排队意味着嵌套 update 返回时，其回调可能尚未执行。这个可观察时序变化影响全部 Context 消费者，不能只作为 I1 内部样式修正默默提交。

## 推荐 J1：治理同通路重入的顺序，再修复并继续 S3

建议批准一个有界语义与实现节点：

1. 同一 provider + ContextKey 的成功更新，向持续有效、绑定该 owner 的订阅者送达时保持提交先后顺序，不让较早 transition 在较新 transition 之后覆盖消费者投影。
2. 保留每个 transition 的 next/prev 和 recipient callback scope，不用合并／丢弃中间通知实现“只剩最新值”。provider 当前值、read 与 update 返回后的可见性、unsubscribe/dispose/rebind、callback 抛错后的清理必须明确并测试。
3. 允许同通路嵌套更新的 callback 在当前 transition 的 delivery 之后执行；不要求所有 Adapter 使用 microtask，不规定不同 Key／不同 provider 的全局总顺序，也不新增作者 API。
4. 实现优先在 Context/Runtime 协作边界修正，核验 Tabs Root 的 request/validation version 对历史通知是否安全。不能以简单 FIFO 队列的存在当作已完成证明；如暴露另一个 owner/API/lifecycle 选择，再单独提交决定。
5. 加入 Context 最小重入测试、真实 Runtime callback-scope/资源测试、四个 Web Adapter 的受控组合回归，以及 S3 原生方向键与同步 props echo。通过后回到完整 S3 journey，再交付 demo-matrix。

批准包括相关 draft 决策/契约和实现/测试/记录的有界修改，以及本地分节点提交；不提升 draft、不改 slot 所有权、不扩大 Shadow token 范围，不授权 push/merge/publish/release。

## 备选

- J2：只让 Tabs 等当前值消费者在通知时重新 read 最新 Context。可能保持基础调度不变，但会让部分原型忽略刚送达的 transition payload，且不能普遍修正 Context 派生状态的倒退；需要明确“transition 观察”与“当前值投影”的区别。不建议仅为了 S3 在所有 part 里补偿。
- J3：S3 消费者统一 microtask echo 或改为非受控，保留同步受控缺陷。可继续探索其他路径，但缩窄验收边界，不能宣称完整受控行为已修复；不作为默认推荐。

## 证据图与残余风险

建议 `C-CONTEXT-0010` / `D-CONTEXT-NOTIFICATION-SCHEDULING-0001` → ContextCenter / Runtime callback integration → `T-CONTEXT-0001`、`T-CONTEXT-0002`、四个 Web Adapter 的隔离测试 → `T-BASE-TABS-0001` 与 S3 原生键盘证据。实际测试 ID 与锚点在批准后的 spec transition 核对，不借此改动工作区已有的 Context 编目暂存文件。

残余风险包括订阅者主动重入、无限 feedback、跨通路更新、通知期间 owner 解绑／销毁、错误传播、重复 requestVersion 和 view reveal。J1 的批准不是这些路径已经通过验证的声明。

当前所需的最小人工决定：是否采用 J1，明确同通路重入通知顺序及上述兼容时序边界，再继续既定 S3 目标。
