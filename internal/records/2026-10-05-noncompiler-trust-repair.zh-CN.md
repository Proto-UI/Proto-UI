# 2026-10-05：非 Compiler 实验可信度修复与下一批冻结计划

本记录非规范，不更改 Proto 语义或 entity lifecycle。用户授权本阶段只做正常接收器、下一批核心任务所需的语义检查、执行政策、正负控制、独立复核与已有输出离线复评。**新增受测模型调用为 0；未提交、推送或进行 GitHub 写入。** 不执行原四格各三次方案，不新增 discovery 调用，不把 semantic oracle 当作整个实验的终点。

工作区为 `/Users/yangguangliang/.codex/worktrees/noncompiler-value-experiments/Proto-UI`；主线 HEAD 仍为 `dc8bf26cd903223f2dd4c8fc5fd37b8eb5227125`，候选改动未提交。原 checkout 与 Round0 原始记录保留。证据根为 `/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/trust-repair-v1`。

## 修复边界

### 正常接收路径

`response-stream.mjs` 将之前独立诊断的 completed-item 完整性检查接入 `http-transport.mjs`。只在 response 身份、顺序、item/content 完整集合、done/part/text/delta 一致性全部成立时，从 completed assistant item 取正文。delta 仅作完整性见证，不构造答案。非空 terminal output 必须与 assembled items 一致；空 terminal 异常明确留档。未知事件族、工具、拒绝、不完整、重复、错配、截断等仍 fail closed。

原始 stream、原 terminal、assembled response、assembly provenance 分开保存。仅显式 opt-in 可接收旧 terminal-only 合成样例，不能把畸形 lifecycle 降级救活。`batch-plan.mjs` 的 source inventory 补入接收器新增依赖，避免对 decoder 缺少 hash 绑定；旧矩阵依然不代表新九格方案。

四份已有 raw stream 离线重放经正常路径成功提取，正文与已审查的 v2 诊断提取器逐字节相同。此为 receiver replay，不是四次新增调用，也不把原 primary receipt 的失败改成成功。

### 有界 semantic oracle

`tabs-oracle.mjs` 不再要求 `role` 属性文本恰好等于 `tabpanel`；使用包含 hidden 的 resolved role locator。接受 `tabpanel region` 和未知前缀 fallback，拒绝以 `region` 作为首个支持 role 的 `region tabpanel`。

cleanup 接受已恢复到 surviving After 的焦点；否则从明确聚焦的 surviving Remove 测 Tab 可达性，不凭空规定必须自动恢复到特定控件。破坏移除与 surviving Tab trap 仍被负控制拒绝。修复前有效正控制 3 项失败，修复后 8 个正控制、15 个负控制及来源边界检查共 24 项通过。最初控制作者遗漏内联 `variant` 值导致 page error；失败证据保留，修复 fixture 后重跑 red，未把它误归因于模型或 oracle。

不建设全仓 conformance，不修改 spec。内部 Context、controlled state、身份、跨 Adapter、screen reader 等仍不覆盖。role 误判修复不等于解决 draft relationship-budget 的语义张力。

## 已有输出的探索性离线复评

输入是 `protocol-recovery-v2/execution` 下原有两份 implementation 的 `participant.txt`，没有重新向模型发送任何请求。通过带外总时限的 browser worker，保存新的输入/hash、Chrome DOM/AX/trace/截图、检查与清理 receipt。新政策单独版本化，原 Round0 ledger、报告和旧 exclusion 均不追溯改写。

两份输出所有修复后 check status 相同。原 cleanup fail 消失；同时继续保留宽 relationship 排除，不能借 role 修复默默认定整个关系政策已无争议。

| 层                      | 无额外文档的原输出    | 原 knowledge-assisted 输出 |
| ----------------------- | --------------------- | -------------------------- |
| platform（保守解释）    | 15 pass / 13 disputed | 15 pass / 13 disputed      |
| journey                 | 53 pass               | 53 pass                    |
| draft Proto（保守解释） | 23 pass / 13 disputed | 23 pass / 13 disputed      |
| evidence                | 1 pass                | 1 pass                     |
| scope                   | 6 untested            | 6 untested                 |

未应用关系排除的 raw 新观察分别为 platform 28 pass、journey 53 pass、draft Proto 36 pass、evidence 1 pass。不同层有重叠，**不求和成独立分数**。disputed/untested 不算 pass。同分只是这个受限 journey 未观察到差异，不证明语义等价，更不证明 Proto 无价值或有价值。旧 pilot 没有等信息普通文档条件、每条件只一份恢复输出且 primary protocol failure，因此不提供因果效果估计。

## 下一批：真实修改与回归，不原样重复

固定一个 standalone Tabs 修改任务：从现有 horizontal manual、总是循环的代码出发，新增实时 Orientation 与 Wrap navigation 设置，默认不循环；检验新功能及 selection/disabled/activation/relationships/cleanup 回归。三个条件共享任务、起始代码和所有外部要求，每条件三个独立请求：无额外文档、等信息普通文档、Proto-derived 结构化文档。

八条 claim 的正文、限定和限制完全相同；普通文档使用 prose，Proto-derived 文档使用 structured criteria。canonical source IDs、spec 与私有 crosswalk 不进入受测请求。此实验只衡量有界来源投影的表达/标签，不将结果推广为完整协议、Compiler、内部所有权或跨 Adapter 架构的价值。词数/token 数不保证相同，必须逐请求记录。

详细冻结政策见 `benchmarks/interaction/trust-repair-next-batch.md`。材料、共同 prompt、request、15 个核心 grouped criteria、receiver/worker/oracle/controls、来源与 SHA-256、随机种子、块内顺序、预算及失败政策均由 `trust-repair-v1/plan` 的离线准备保留。每个块含三个条件各一次，共三块；不按结果改顺序、替换失败或 best-of。没有执行器自动开始新调用。

下一任务明确要求 retained panels 和完整 reciprocal IDs，其检查由共同 task 承担，不替 Proto draft 的 detach/预算语义作裁决。旧 re-entry selected-vs-last-focus 未定政策不评分；Space 默认动作防止只在新的明确任务中检查，不反过来宣称 Round0 已验证。

## 冻结前独立复核发现与有界修复

下一任务的初始控制套件曾为 28/28 green，但这不是完成可靠语义检查的充分条件。独立复核构造了三种共同 task 已禁止的行为：Wrap 切换重置非初始 selection、Vertical 下 disabled trigger 仍导航、pointer 未聚焦 disabled trigger 时逃过键盘抑制检查。初始 oracle 将这些错误提交仍判为 15/15 pass，冻结因此未执行。

追加修复只加强新任务内的 setting 状态保留和两种 orientation 的 disabled 键盘检查；不改变 task、等信息材料、15 个核心 grouped criterion IDs 或 Proto 规范。原先 v1 控制 green/报告/hash 和复核反例保留为被后续验证取代的候选证据；最终修复结果和 source binding 由独立复核报告及最终 `validation.json` 给出，不能继续引用过时的 all-green 作为最终可信度依据。

## 最终修复与实际冻结收束

有界修复后的完整控制为 **31/31 pass、0 fail、0 skip，124.985 秒**：3 个 unit checks、4 个正控制、21 个负向变异、1 个应失败 starter、1 个 host-error、1 个 deadline 控制。26 个提交可评分，其中 22 个正确识别为任务失败，不能把负控制从评分分母排除。独立复核用同一份保留的正控制和三个反例重测：正控制 15/15；Wrap 重置反例 13 pass/2 fail，其余两个各 14 pass/1 fail；三个反例均仍 scoringEligible。独立复核没有再跑完整 31 项 author suite；这些证据不可叠加成独立样本。

离线冻结于 2026-10-05 19:25:51.700（Asia/Shanghai）生成在外部证据根的 `plan/frozen-v1/manifest.json`。SHA-256 为 `93bfa977097698b6c15048a5db33ed8dd606a7ac6ee0a3716cc92aaa298d6be5`。29 项清单包括 23 份 source captures、3 份 packets 和 3 份 request bytes；共同 task/starter、两种等信息材料、15 项指标及 6 新功能/9 回归划分、source/test/scoring、预算和失败政策均已实际绑定。

冻结块内顺序为：块 1 `proto → none → ordinary`；块 2 `proto → none → ordinary`；块 3 `ordinary → none → proto`。前两块相同 permutation 是预先固定随机方法的合法结果，不重抽。独立冻结复核确认实际 receipt、全部 hash/size/source、隔离 wire、八条等信息 claims、seed/order 与执行关闭标志；33/33 in-memory tamper 控制被拒绝（含一致重算 hash 后的语义变更）。结论为 **GO-contentfreeze integrity / NO-GO-execution**，不是未来防篡改保证或运行许可。材料如需改变，必须新版本和重新复核，不能覆盖此次冻结。

最终默认 benchmark 检查为 348 tests / 269 pass / 79 skip / 0 fail；79 skip 包括 gated browser checks 和 Darwin 上不运行的 Linux-only watchdog，不能把它们当作浏览器覆盖。显式 Chrome 控制、独立反例检查有各自证据。`check:agent-operations` 713/713、`check:agent-doc` 与 scoped Prettier 通过。环境为 Node24.21.0/Chrome154/pnpm10.32.1；Node22 CI parity 未验证，未声称全产品 types/tests/release 检查已运行。

所有 author/reviewer 控制均为 synthetic。oracle 固定的 `synthetic:false` 字段**不认证输入来源**；控制 sidecars/recipes 才记录本阶段来源，不能据该字段计为模型结果。视觉证据仅本地保留，没有上传或外部写授权。初始 red、v1 green 后 NO-GO、环境/fixture 失败及后续分类保留，不改历史。

## 计量、未知与阻断范围

本阶段新的受测模型 input/output tokens 与参考费用均为 0（因为 dispatch 为 0），不意味着本阶段总成本为 0。协调者、编码/复核子代理的分项 tokens/费用没有可用 telemetry；物理算力未测量。控制与离线 browser 的时间/环境分别记录，不能混作模型生成耗时。

下一批拟定九次以内、无 retry，单次客户端 180 秒、serial dispatch window 30 分钟、raw 4 MB/HTML 1 MB、browser 60 秒。`gpt-6.1-sol` 只是拟请求 alias，`max_output_tokens: 8192` 只是请求上限。已知旧轮 returned limit 为 null；有效执行仍未认证。参考费用 envelope USD 1.00 使用旧轮抓取的费率，不是 gateway invoice 或 hard money cap。

| 未知/门槛 | 阻断的结论或动作 |
| --- | --- |
| 新九次调用没有用户批准 | 阻断新增受测运行，不阻断本地修复和计划交付 |
| 实际计费规则、上限、失败/上游 retry 费用不明 | 阻断真实成本比较及有界付费执行；不能用参考价冒充账单 |
| 有效 output token cap 未认证 | 阻断 token/费用硬上限及相应资源结论 |
| upstream snapshot、默认参数与实际 upstream retry 不明 | 阻断精确模型复现/同一不可变设置结论；返回值只算 provider-reported |
| draft relationship budget、部分内部语义未裁决 | 阻断宽 Proto conformance；不阻断任务明确 retained-panel 的局部行为检查 |
| 无完整 AT/OS sandbox/跨 Adapter 证据 | 阻断 screen-reader、安全隔离和跨宿主通用性结论 |
| 九格执行适配与 route/grant 准入尚未提供 | 冻结计划非执行授权；不得套用旧 12-slot runner |

独立复核及最终命令、环境、hash、成功/失败/skip 数以同根的 `review`、`validation.json` 和最终交付报告为准。技术 GO 仅针对本地修复/内容冻结，不授予付费调用许可。整个价值实验仍未完成；本阶段的交付不把阶段目标冒充最终目标。
