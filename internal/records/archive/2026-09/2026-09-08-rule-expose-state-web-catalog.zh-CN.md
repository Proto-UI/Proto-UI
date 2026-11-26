# Rule Expose State Web 部分支持编目

日期：2026-09-08。基线 `70612955`，分支 `codex/module-host-adapter-catalog-batch`。承接 Collection 与 Expose State Web 的未提交本地候选；本文记录工程事实与未决方向，不替代 spec。

## 本轮范围

新增 draft `M-RULE-EXPOSE-STATE-WEB-0001` 与 `T-RULE-EXPOSE-STATE-WEB-0001`。四个 Adapter 的 supports 使用 `partial-module`。Module 组合 Rule、Expose State Web 与 Feedback，无新增 HC；native variant policy 是既有 host 配置边界，实际 DOM 输出仍经 Feedback 与 Web projection 负责。

`C-RULE-EXTENSION-0001-C` 与 `C-RULE-RUNTIME-0001-E` 要求优化承担等价执行责任。本轮不能把生成 selector token 当作已经全面满足该要求。已编目的是受限候选条件、失败回退、内部 contribution 归属及 view 生命周期。

## 已复现并修复

1. 原实现忽略 `useStyleUnsafe()` 的 disposer，optimized ID 与贡献跨 detach 保留。Module 测试复现 unmounting 后仍有 contribution；实际 Runtime 测试复现 detach 后 Rule 仍被过滤，默认 Plan 为空。现在 unmounting/detach 撤销自有 contribution 和过滤 ID，remount 按新的 binding 重建；terminal disposal 清空缓存并阻止重新应用。
2. 原实现直接 `String(literal)`，导致 string State 与 number literal 等严格比较被误降成相等的属性字符串。现在先检查 literal 类型。
3. 非 data 属性及含空白/selector delimiter 的 literal 不能直接进入当前 whole-token pipeline。现在保留默认 Plan；没有引入通用 escaping 或扩大作者 token 语法。

## 可执行证据

- 直接 Module：重复应用去重、view cleanup、默认规则恢复、回退条件、policy denial 与 pure-dark、类型/编码防线。
- 实际 Runtime：保留同一 State/setup 经过两个 remount，使用新名称映射重建 selector；detach 时恢复默认 Rule 评估。
- React、Vue3、Vue2、Web Component：真实 owner 上验证正/负联合 selector、standalone negative、range 与 Props 默认路径，State 前后变化、user class/child identity、无需额外 Proto structural render，以及 fresh-owner baseline。
- CLI 现有 extractor/renderer 与 canonical variant order 是编译侧证据。DOM token 与 attribute 断言不等于 computed CSS 或真实浏览器视觉验收。

## 尚未闭合的等价执行问题

### 同一 view 内的动态重规划

接纳后的 optimized ID 保持至 view teardown。Expose State Web mapping 丢失/改变，或 native policy 改变时，旧 selector 与 ID 过滤可能继续保留。RulePort 目前只提供 evaluate/extension registration，没有显式“更新优化集合并重新应用当前 Plan”的操作。

下一步需确定 extension invalidation 与 Rule driver/Feedback contribution 的协调点：在同一受控步骤撤销旧优化、恢复默认评估并替换样式，避免只取消 selector 却留下空 Plan。该方向涉及跨 Module 执行协议，本轮没有擅自新增 API。对应 `M-RULE-EXPOSE-STATE-WEB-0001-Q-REPLANNING`。

### 完整 CSS 与原生语义等价

- legacy `@interaction/hovered` 等 State 若可被独立写入，未必等于浏览器 `:hover`/`:active`；policy 是选择依据，不能自行证明真值相等。
- optimized 与默认 Rule 的相同样式属性可能受 CSS specificity/order 影响，token 顺序检查不足以证明声明顺序等价。
- Runtime 输出 token 不证明宿主 stylesheet 已生成对应规则；custom mapping 与任意 literal 的 compiler/runtime 编码协调仍需设计。
- `meta(colorScheme=dark)` 的既有路径保留，不因此稳定整个 Rule Meta API。

这些问题记录于 `M-RULE-EXPOSE-STATE-WEB-0001-Q-EQUIVALENCE`，不通过降低既有 Contract 要求来掩盖。因此本 slice 的结果是已编目、部分验证，不是全面 conformance。

## 后续安排

第一波 Collection → Expose State Web → Rule Expose State Web 已有编目落点。当前建议先整理三个独立 commit 到同一批量 PR；动态重规划协议与全面等价性另作明确设计任务。普通编目队列的下一项为 Trigger，之后 Focus、Boundary、Hit Participation。当前用户尚未要求 commit/push，本轮仅保留本地改动。
