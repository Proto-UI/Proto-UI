# #750 真实消费实验：独立有界结果审查

## 审查结论

**接受本次真实消费实验的有界观察结果。** `consumer-02` 在原任务、React 19.2.6、原 60 分钟窗口和真实完整目录分发下完成五阶段旅程；证据支持“没有隐藏 Proto 内部 onboarding 的 fresh Agent 能完成这一项偏好设置任务”。没有发现阻断这项限定结论的证据缺失或封存内容漂移。

这是 `/root/s7_consumer_results_review` 的本地独立源码与证据审查，不是 GitHub 原生 `APPROVE`、canonical PR review packet、整合收据或 Issue 关闭。审查者不是 producer、参与者或 native operator；本次未运行任何新增浏览器、安装、构建或 native 交互，也未作外部写入。源码及封存证据未改动，审查输出单独保存。

`consumer-01` 的实际 9 检查点成功与源码/失败/解释保留为补充证据。其 operator 单调时钟缺失尾段，不能补造 `endedMs`，不能归为参与者或产品失败，也不能加入严格 2/2 成功率。严格主样本是 **1 次尝试、1 次完成**；这是单个描述性观察，不是一般成功概率。

## 精确审查对象

- source / Compiler：`d0eb81d3c61c3d3e93e46c4151e78031273d6116`。
- 原协议 SHA-256：`a54dc7579bb3334d48dfb67b4fddb303013a8efc8408cffea818b71dfb5a2ee2`；任务和七份初始文件未改。
- 封存 inventory SHA-256：`6706ebce99adc9b301f61b626db0c892b81c4fea26fdff09ecf342d7bc324992`，**751 文件**。
- packet SHA-256：`2c09d4dc137fdb77f89e897ab739e7175bfdd79088c1ce6eb7deee7826646bd5`。
- 实际准入来源：[原 #750 独立 Agent 准入评论](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-7111867656)。本审查读的是保留的完整 Issue/comment 快照；没有另外取代根任务的 live readback。

原 Issue 条件逐字保留在 `review.json`。精确结果、命令、哈希和被审查主记录摘要分别在 `collector-result.json`、`hash-audit.json` 与 `review.json`。

## 原五条件的判断

| 原条件 | 有界判断与证据 |
| --- | --- |
| `issue.750.001` 真实产物、范围/provenance、可复现消费者 | 接受。1 个 Base Button 源与 196 个 Compiler 文件全部与固定 Git 版本逐字一致；12 个输出对象和 hidden helpers 保留。真实 generation、干净安装/构建/closure、普通 USAGE、原 starter/lock/recipe 和公开独立准入形成完整材料。审查者未把重建当作已经再次执行。 |
| `issue.750.002` discovery 到 ship 的完整测量 | 接受。42 条原事件、五阶段、实际 release/finish、1 次信息需求、0 条记录到的 escape hatch、5 个源改动、2 份解释、4 个生产文件和真实 native 观察保留。失败和等待没有删去。阶段时长仅代表 receipt 边界；初始阅读与 operator 等待仍在总窗。 |
| `issue.750.003` 包含内部学习需求/无法完成的情况，无偏好要求 | 接受观察结果的完整保留义务。实际样式信息缺口、普通源码检查、生成源定制、preview/HTTP 失败与 recorder 故障全部呈现；没有强制偏好或满意度。没有观察到“必须读取隐藏 Proto 内部文档”的样本，也没有得到终态组件任务失败，不能为了满足措辞补造这些反例。此判断不宣称已获取人为强制的内部学习/失败样本。 |
| `issue.750.004` 限制与有界结论 | 接受。只支持这一份可编辑目录、这项 React 偏好任务、这批 Agent 的可行性。一般框架知识、品牌名暴露、可读 provenance、共享环境指令隔离、计时和观察等待都限制外推。人类体验、全库成熟度、真实需求、采用、相对优势和维护经济学未测。 |
| `issue.750.005` 前提未满足则保持 staged/blocked | 条件保障保留。本次 prerequisite 已有真实、绑定、公开的独立准入，因此不再属于未满足前提；历史 blocked fixture 与原失败继续保留。前置 operator 结果仍不是消费者样本，collector 仍不自行关闭 Issue。 |

## 实际复核结果

原 `inspectStudy` 在 Node `v24.22.3` 下重算成功，返回 `observations-recorded`、`observedRuns=1`、`primaryRuns=1`、`attempted=1`、`completed=1`，并保留 **`originalCriteriaComplete:false`**。这一布尔值是工具的刻意边界，不应改成自动接受。

751 个文件通过完整 inventory/seal 验证，无缺失、额外成员、符号链接替代或哈希变化。197 个 source/Compiler 文件与固定 Git 源一致。42 条 normalized 事件与原始事件在允许的路径前缀、唯一派生 build 引用之外全等；42 条 `received.jsonl` 的 event 与 `events.json` 全等，并且每个 offset 都能从实际 `systemMonotonicNs` 减 release 值准确重算。

派生 build receipt 的 `argv`、`cwd`、开始/结束、exit/signal/error 和日志哈希与原件一致。其仅改变 stdout/stderr 定位，并增加 `originalReceipt` 和 `derivation` 元数据。没有新增执行。`hash-audit.json` 也保留了整对象因这两项追加元数据而不等、执行字段仍全等的区别。

最终生成目录与原分发均为 12 文件，只有 `Component.tsx` 改变。改动是 optional `className` 类型与 host 转发，以及将旧 source map 引用改为历史说明；其余生成 helper、原 map/provenance 未改。最终 App/CSS/Component 与各自 after 快照一致，新生产 sourcemap 的 `sourcesContent` 包含实际编辑后组件。应用 in-flight ref、disabled、try/catch/finally 属于普通异步业务处理，没有替换按钮或绕过它的激活路径。

四个 dist 文件哈希与 handoff、完成事件一致。实际浏览器的四次 JS/CSS HTTP 200 response-body 摘要与当前 dist 对应字节一致。observer 源摘要与原结果中的 `observerSha256` 一致。trace ZIP 的 54 成员可读；其中 CSS 和 HTML 的保留 body 与 dist 相同。trace 未嵌入两次 JavaScript 响应 body，不能称其完整包含所有响应字节；JS body 绑定依据是实际 observer 的 `response.body()` 计算与原结果收据。

逐张、逐相邻状态审看 consumer-02 的 9 张 1100×800 原图：初始可操作按钮，保存中禁用处理，pointer 保存，金色焦点环，Enter、Space 保存，红色注入错误及恢复后的启用，重试成功，重载后的已保存名称，均与 source/ARIA/result 相符。截图只支持这些捕获状态；没有推导对比度认证、AT、其他 viewport 或完整视觉家族接受。

真实失败没有藏掉：第一次 Vite preview 子进程出现 `uv_interface_addresses` 错误，spawn wrapper 的 exit 0 不能表示服务启动成功；其子进程最终 exit 未取得。后续 HTTP 连接失败 exit 1 保留，静态服务恢复 HTTP 200。注入的 storage error 是任务条件，不能重标为 Button 产品故障。

## 时序与知识暴露的必要边界

| 时间或数量 | 本次可解释的含义 |
| --- | --- |
| release `20:25:42.838254Z` → finish `21:04:05.429189Z` | `2302590.915032ms`，38 分 22.591 秒；含整个记录总窗和等待 |
| release → 首阶段 start | `54950.357772ms`；期间初始 date/list/doc 读取发生在 recorder wrapper 前，原 consulted-materials 已披露 |
| discover-install 的 `21863.233952ms` | 首 start 到该阶段 completed 的 receipt 间隔，不能包括所有初始阅读，也不是纯工作时长 |
| browser `20:46:26.281–20:46:32.555Z` | 实际独立生产观察区间 |
| root 收到 `20:51:17.244973Z` | 原 operator feedback 接收记录 |
| participant 确认 `21:00:56.652435Z` | `2113814.160046ms` 的实际反馈确认，未回填 |
| successful-use 事件 | `2302469.801595ms`；审阅反馈后的记录偏移，不是 browser 首次动作时刻 |
| 1 条 internals 事件 | 样式 host/prop 信息需求；靠随包可编辑源码解决，不能写成完全零源码知识 |
| 0 条 escape-hatch 事件 | 没有记录到替换组件/绕激活/依赖旁路；不等于零改码 |

参与者的 experience 明说初始 user context 已出现 **Proto-UI 名称**。因此本实验是“无隐藏内部 onboarding”，不是“完全不知道项目存在”。生成 source/provenance 不可避免地暴露实现标识；参与者的一般 React/TypeScript 知识可用。共享环境中的指令隔离不能证明安全盲法，也无法认证不存在模型预训练知识。

两名 Agent 不等于普通人类开发者样本；只有一个完整严格计时样本。provider snapshot、seed、tokens、billing 和 cost 均不可得且保持 null。当前选择的是实验供应的普通任务，没有独立真实用户需求来源、可观测自愿采用或对照经济学结果。

## 主记录与后续边界

已重读根任务的 `internal/records/2026-11-24-generated-button-consumption.md`，确认两项非阻断说明均已处理：明确起始 user context 已出现 Proto-UI 名称，区分无内部 onboarding 与品牌盲法；明确 release 到首个阶段 start 的 54.950357772 秒包含实际初始读取，计入总时钟但不在 21.863 秒的阶段间隔内。当前主记录继续保留单严格样本、真实信息需求、消费者改码、失败和 collector 非自动接受边界，结论与证据相称，剩余文字补充为 0。

本次跟进仅重读主记录并刷新处理状态，未重跑 collector、构建、安装或浏览器，也未改动冻结或原证据。当前记录 SHA-256 为 `11267119297c827277b6925e04295e078fb108edba2595b1494697b436b1020d`；该值与前次生成审查文件时绑定的值相同，如实保留而不制造新的摘要变化。

根任务可据此继续已经授权的真实整合与原条件回填，绑定实际 merge/发布位置及 Issue 回读。当前审查没有查验新的 live PR identity、CI、DCO、权限或 native approval，也未执行任何平台状态更改；本地技术接受不能替代那些真实条件。
