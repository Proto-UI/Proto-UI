# Sprint 2：首次托管回归后的集合与表单修复

状态：**源码修复及定向负控已完成；候选的原生浏览器重跑仍待完成。** 本记录不把源码测试、CSS 静态构建或观察器分类记成原生通过，也不覆盖首轮失败。

## 原始来源与失败

[Run 45029016292](https://github.com/Proto-UI/Proto-UI/actions/runs/45029016292) 在 clean head `f8e7d12ebe64343b8caec71a7f23a6b9761b6ef7` 上执行。完整原始文件及 artifact `14757716300` 的下载与摘要校验由整合记录 [首轮原生回归修复](2026-11-22-sprint2-native-repair.zh-CN.md) 和 [artifact manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-native-round1/artifact-manifest.json) 保留。本路直接读取完整 `collections/report.json`、`form-select/report.json` 和各自运行日志后归并：

| 对象 | 首轮结果 | 观测与责任层 |
| --- | --- | --- |
| Tree，3 家族 × 4 宿主 | 12 FAIL | 折叠后原生非交互目标的 `tabindex` 属性为 `null`；旧观察器错误要求属性字面值 `-1`。 |
| DataTable，Base / Brutalist × 4 宿主 | 8 FAIL | 隐藏 Header 的同类属性字面值假设。 |
| DataTable，Shadcn × 4 宿主 | 4 FAIL | 隐藏列仍具有真实可见几何；无条件 `table-cell` 与 Base 的 `hidden` 显示投影冲突。 |
| VirtualList，3 家族 × 4 宿主 | 12 FAIL | 初始窗口为 `unavailable`；独立 runner 缺公开消费者的 `h-64`、`overflow-auto` 等站点 Tailwind 样式。 |
| Form，3 家族 × 4 宿主 | 12 FAIL | 旧结果按钮之后显示 `pending value="lin" held=2`；合法的离焦 `change` 报告在旧结果之后启动新校验，覆盖共用文字面板。 |
| Select / Field choices，3 家族 × WC | 6 FAIL | 场景断言完成后，全局输入观察器把 WC Button 对外 `CustomEvent('click')` 误计成合成物理输入。 |

首轮集合为 **0/36**、Form/Select 为 **18/36**。这里没有因归因为观察器而把原失败改成通过。

## 修复及保持的保证

### DataTable 与严格 Hook 声明

`C-DATA-TABLE-RECIPES-0001-VISIBILITY` 已要求隐藏列和空行保持结构而不参与显示、隐藏 Header 不参与焦点。Shadcn 的 `table-row` / `table-cell` 现在只在同一 Base owner 的 `hidden=false` 时出现；Base 的隐藏状态保持唯一来源。Cell/Header 的既有 `hidden` handle 补入公共 Hook 类型，家族不建立平行状态。

公开 DataTable recipe 的行布局也改为 `aria-[hidden=false]:grid`。真实站点 `utilities` 层位于 `proto-ui` 之后，无条件 `grid` 会再次覆盖隐藏；修复的是消费者自己的布局条件，runner 保持站点原层顺序。

严格 Hook 检查仍比较完整字段集合并验证标量域。补齐已存在的 Tree direction / relationshipKey、Group hidden、DataTable pageSelection 与新公共方法，以及 Cell/Header hidden；不允许额外未知字段，也没有改成部分匹配。

### 隐藏焦点与真实 CSS

`HC-FOCUS-TARGET-0001-B` 与 `C-AS-FOCUSABLE-0001` 区分顺序导航、程序化焦点和禁用目标。非原生且不可程序化聚焦的元素可以移除 `tabindex`。runner 保留隐藏几何断言，并改为同时验证 DOM `tabIndex=-1`、实际 `.focus()` 拒绝和真实 Tab 跨过隐藏节点。Tree 还验证公开 `focusSelf` 拒绝、展开后的键盘聚焦恢复；DataTable 验证显示恢复后 Header 可聚焦。它们不是仅把属性读取换成 DOM property。

CSS helper 把既有 Form 的真实站点 Tailwind 编译和字体嵌入提取为共用实现，集合入口列出实际的 9 个公开 recipe 与共享源。静态回执见 [consumer-css.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-collections-native-repair/consumer-css.json)：原 Form CSS 的字节摘要不变，新集合 CSS 包含实际视口高度、overflow 和可见行布局候选。该静态步骤未运行浏览器。新 runner 在原 `committed` / 有界窗口断言之外，还要求实际 `clientHeight>0`、`scrollHeight>clientHeight`、可滚动 overflow，以及可信 wheel 后 `scrollTop` 确实增加。

### Form：结果回执与新请求各自保留

公开 recipe 增加独立 `validationResults` 面板，保存每次真实 `resolveValidation` 的返回值、请求 id、请求值，以及交付前后的当前请求和 validity。原 pending 面板仍可被后来的合法请求更新，没有延迟或抑制真实 `change`。

源码测试通过公开 input 的 `change`→按钮 click→queued report 顺序复现原失败。修复后仍明确要求原先的 `pending value="lin" held=2` 出现，同时验证每个旧请求的实际返回值为 `false`、不包含受控拒绝的值、不等于仍 pending 的当前请求，且交付前后当前请求与 validity 完全一致。测试和原生 fixture 都只观察、转发实际 `api.call`，结果面板必须逐个对应观察到的真实返回。

首次错误结果之后，旅程还通过公开按钮送达被晚到 change 替换的余下旧请求，验证错误状态保持不变；随后两次提交场景继续保留精确的单个 `old-results stale` 断言。成功、失败重试、取消、readOnly、嵌套 disabled、复位和退休断言均保留。

### WC：对外信号与物理输入分别观察

`C-EXPOSE-EVENT-0001-D/E` 和实际 WC `createExposeEventSink` 定义对外信号可经同名 `CustomEvent` 传输，但不是 User→Component 输入。观察器只把**当前公开 recipe 中明确的 Button ref**、已注册 WC owner、`click:void`、`bubbles` / `cancelable` 均匹配的实际 `CustomEvent` 分为 outward signal。它不修改产品事件，不按 `isTrusted=false` 放行，也不把任意 CustomEvent 忽略。

所有原始记录继续保留；物理 Mouse / Pointer / Keyboard / Input / Touch / Wheel 仍要求全部可信且至少存在一个可信输入；未知事件必须为空。新增负控包括同一个合法 WC owner 发出的合成 `MouseEvent`、Keyboard/Input、泛 Event、错误 payload/type、后代目标和已退休 owner。实际 Base Button 的源码挂载还验证真实 WC bridge 能被区分，同时其测试调用 `.click()` 产生的合成源输入仍被拒绝。这是源码验证，不是浏览器输入通过。

## 定向运行与来源边界

原始日志以无损 gzip 保存，压缩文件及解压字节 SHA-256 都在 [evidence-index.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-collections-native-repair/evidence-index.json)。

| 原始日志 | 真实终态 | 解释 |
| --- | --- | --- |
| `table-hook-red.log` | 5 FAIL / 8 PASS | 新 Shadcn 隐藏行断言在四宿主均红；严格 Hook Root 清单另有 1 个既有遗漏。 |
| `table-hook-first-fix.log` | 1 FAIL / 12 PASS | 12 个公开 DataTable 配方已绿；严格 Hook 检查继续发现 Item 的遗漏 relationshipKey，没有放宽字段集合。 |
| `form-result-red.log` | 12 FAIL | 三家族四宿主完整复现原 pending 面板覆盖。 |
| `recipes-second-fix.log` | 25 PASS | DataTable 12、Form 12、严格 Hook 1，均无 skip。 |
| `input-classifier-first.log` | 3 FAIL / 1 PASS | 新测试错误假设 Happy DOM 的 `isTrusted=false`；实际为 `undefined`。仅修源码测试为“不得为 true”，保留观测值，不能将此日志称为产品旧实现负控。 |
| `input-classifier-second.log` | 5 PASS | 合法对外载体、合成输入拒绝、错误载体及实际 Base Button bridge 正反例。 |

执行基线为 `f8e7d12` 加逐步工作树修改。最终索引的 20 份源码摘要绑定经格式化和一个 `ObservedStateHandle` 泛型参数更正后的评审候选；不倒填为早先运行时的提交 SHA。两个 runner 与验证 helper 的 `node --check`、`git diff --check` 通过。整合者将按最终提交再执行 workspace types 与原有完整原生队列；本路未启动第二个浏览器或扩大重型验证范围。

## 后续验收

- 原集合 36、Form/Select 36 应在最终整合提交上重跑，尤其核实真实隐藏、Tab 顺序、VirtualList 滚动与异步校验顺序；本记录不预填绿色。
- Shenko / Verdant 的实际消费者范围与原 inventory 不变；不把公开 recipe 或此处 Happy DOM 测试记成这些应用的集合组件使用证据。
- 原物理设备、辅助技术、非 Web、Compiler 额外后端、Harness 完整应用旅程仍由原 Issue 条件和后续 Sprint 承接。

## 整合类型反馈：保留独立 Base 状态 owner

整合 head `9f7c4d500b3defa2fc0a7d614c0418335f54431b` 的 workspace types 揭示本修复新增的 2 个 `TS2345`：`setupDataTableCell` 错把 Base Cell/Header 隐藏状态的 `watch/run Props` 与 Shadcn 投影的 `styleProfile` Props 绑定为同一泛型。修复增加独立 `StateOwnerProps`，保持 `ObservedStateHandle<boolean, StateOwnerProps>` 的完整观察类型；未用 `any`、类型强转、弱化 watch 或增加未声明依赖。

只包含实际 Shadcn `data-table.proto.ts` 及其真实依赖的 strict TypeScript 定向检查已 **exit 0、零诊断**。原整合 2 错、实际命令/配置及最终 3 份相关源码摘要在 [类型反馈回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-collections-native-repair/data-table-owner-types.json)；完整 workspace types 和原生矩阵仍由最终整合执行，不以此小检查代替。
