# Sprint 7 · #734 三路径 Tabs 知识比较实际结果

## 结论与范围

本次实际运行了 **9 个独立 Agent 初始实现：成熟库、附带 Proto 知识、普通要求三条路径各 3 次**。所有初始实现均在同一个冻结的生产浏览器序列中达到 **22/22**，无运行时或清理错误，均未进入实现修复轮次。预先指定的三个首轮实现随后完成同一项维护修改，全部再次达到 **22/22**；要求的链接和计数文案也已按源码及实际 DOM 单独核对。

在这个公开、有限的 React Tabs 任务上，**没有观测到附带知识在正确性或修复次数方面的优势**。对“这个任务中可观察到知识收益”的假设，分类为 **weakened**；对总体知识价值、准确耗时和 token／账单优势，分类为 **inconclusive**。这是允许的中性结果，不通过增加事后门槛或制造失败来追求有利结论。

观察单位是完整实现旅程。22 项断言彼此相关，不是 22 个独立样本；3 次重复也不代表 3 种任务。维护观察使用先前实现，不是额外独立初始样本。本报告与 [#751 压力场景](2026-11-24-sprint7-zero-marginal-cost-study.md)复用同一批轨迹，不把它们当作两次独立实验。

## 冻结输入与实际暴露

协议在 **2026-11-23 19:40:12.235609 UTC** 冻结，早于第一份参与任务的发出请求；完整输入见 [freeze.json](evidence/2026-11-24-knowledge-value-study/freeze.json) 和 [packets.json](evidence/2026-11-24-knowledge-value-study/packets.json)。

| 项目 | 实际固定值 |
| --- | --- |
| 任务 | 四个水平 Tabs；手动激活；显式循环；disabled 跳过；Home/End；唯一选中项／可见 panel／roving stop；相互命名关系；移除 fixture 后宿主按钮继续计数 |
| 任务 SHA-256 | `4aee6df56c7ee6a2e998e867ecbf1b507e9f4f8989c986415415fed8fe9fa155` |
| 知识 SHA-256 | `b45c258a5f6407aa8943d4dde6bec100a2feca704b68ce334a074fa70461cc16` |
| 目标 | React／ReactDOM 18.3.1；Vite 6.4.1；Radix Tabs 1.1.13 可供所有路径使用 |
| 锁文件 SHA-256 | `ecc57929f0f6759784f818c2405306ac8e2c1d10aa6f96b91bf555635c21dc66` |
| Operator | Node 24.22.3；Playwright Core 1.58.2；Chromium 145.0.7632.6；Linux x64；sandbox 开启 |
| 冻结 oracle SHA-256 | `cc7161a66a30f87eeedaa18e28f759c31583e1e7309da6b01ed400d94f71710b` |
| Agent | 相同声明配置 GPT-6 Astra Pro；每份初始实现使用 fresh fork，无模型覆盖 |
| 预算 | 初始 10 分钟／40 调用；最多 3 轮修复，每轮 5 分钟／20 调用；达到完整正确性目标即停止 |
| 维护 | 每条路径的第 1 个实现；同一修改；5 分钟／20 调用，最多一次反馈修复 |

成熟库路径实际使用固定的 Radix Tabs。普通要求路径没有接收 Proto 知识包，三个实现都采用自定义 React；附带知识路径获得 5 条有来源的交互事实，三个实现也都采用自定义 React。后三者没有获得最终 Proto 实现或 oracle。相同任务明确要求手动激活和循环，因此这些内容不是知识路径独占的信息。普通要求路径也允许访问公开生态文档；“普通要求”不表示模型没有预训练知识。

三位成熟库参与者查阅了公共 Radix／APG 材料及固定安装版本的声明；知识组查阅了 APG，其中 knowledge-2 还查阅 React 文档。普通要求组三位记录为没有检索公共 URL。材料清单、实际读取、失败和工具自述均保留在 [participant-records.tar.gz](evidence/2026-11-24-knowledge-value-study/participant-records.tar.gz)。安装依赖在各包的 npm ci 中实际执行；原固定 manifest 和 lock 在全部 12 个观察中保持相同。当前公开文档版本与固定安装版本的差异已由参与者记录，未把新文档版本替换进依赖。

这是共享环境中的指令隔离，不是安全隔离或正式盲测。服务端精确模型 snapshot、seed、token、计算量及账单不可取得，均记为 `null` 并说明原因，没有用零代替。

## 原始结果与工作量

下表时间只表示参与者自行记录的“首条命令到初次交付”，包含其局部操作，不包含其后排队等候独立浏览器的时间；不能据此推断账单或评估者工时。两项缺失没有补造。逐项原始出处和实际浏览器起止见 [results.json](evidence/2026-11-24-knowledge-value-study/results.json)。

| 路径 | 初始重复 | 干净安装／构建 | 首次独立浏览器 | 实现修复 | 已记录秒数 |
| --- | --- | --- | --- | --- | --- |
| 成熟库 | library-1 | 0／0 | 22/22 | 0 | 未知：缺初次交付时间 |
| 成熟库 | library-2 | 0／0 | 22/22 | 0 | 253.95 |
| 成熟库 | library-3 | 0／0 | 22/22 | 0 | 未知：缺首条命令时间 |
| 附带知识 | knowledge-1 | 0／0 | 22/22 | 0 | 285.43 |
| 附带知识 | knowledge-2 | 0／0 | 22/22 | 0 | 201.81 |
| 附带知识 | knowledge-3 | 0／0 | 22/22 | 0 | 245.93 |
| 普通要求 | unassisted-1 | 0／0 | 22/22 | 0 | 216.36 |
| 普通要求 | unassisted-2 | 0／0 | 22/22 | 0 | 234.89 |
| 普通要求 | unassisted-3 | 0／0 | 22/22 | 0 | 171.71 |

全部原始生成源码、完整锁文件、生产输出、命令 stdout／stderr、实际退出码、失败浏览器脚本与日志都保留。库路径 `main.jsx` 为 58／75／88 行，知识路径为 143／116／142 行，普通要求路径为 168／137／117 行。这些数值包含不同的文案与布局选择，并且成熟库把行为代码放在依赖中，因此只作为可检查的源码规模，不作为开发成本或总复杂度排名。

独立生产观察的首次开始为 19:52:38.800 UTC，最后维护观察完成为 20:46:22.245 UTC。不同提交在同一台设备顺序观察；观察调度等待不是参与者实现延迟。未取得所有参与者统一口径的权威工具调用计数，不据自述的不同计数方法排名。已记录的首条命令到交付均在初始时间预算以内；library-1 的完整交付预算合规情况因缺时间不能独立证明。

### 预定维护

修改要求是在每个渲染的活动 panel 内加入 `More information`、`href="#reference-information"` 的普通链接，并把计数文案改成 `Completed actions: N`，保留全部原行为和依赖。

| 实现 | 代码修改 | 首命令至交付 | 浏览器 | 单独维护核对 |
| --- | --- | --- | --- | --- |
| library-1 | `main.jsx` 三处：链接、计数、已有帮助段落的锚点 | 59.20 秒 | 22/22 | 初始与切换后活动 panel 的实际链接；同 live region 0→1 |
| knowledge-1 | `main.jsx` 两处：链接、计数 | 47.40 秒 | 22/22 | 相同 |
| unassisted-1 | `main.jsx` 两处：链接、计数 | 60.30 秒 | 22/22 | 相同 |

普通要求维护任务的发送精确时刻没有记录，保留其真实接收／首命令时刻，不回填发送时间。三份原始 before／after／diff 和维护交付记录均在参与者 archive 中。独立分析读取了维护源码和初始／激活后 DOM；三个来源绑定的实际截图也作了视觉核对。这里接受的是所要求的链接及文案和原序列回归，不额外声称链接目的地导航、长期维护、升级传播或跨宿主一致性。

## Oracle 校准、失败与发现

冻结前最终校准包括 3 个合法实例（宽屏、窄屏暗色、合法结构变体），均达到 22/22；6 个实际破坏对照均在对应条件失败：automatic 在 focus-only navigation，relationship 在初始关系，removal 在移除，duplicate-panel 在重复选择，live-off 和 unrelated-count 在同一个 live-region 的 0→1。

全部早期记录保留在 [raw-tabs-evidence.tar.xz](evidence/2026-11-24-knowledge-value-study/raw-tabs-evidence.tar.xz)：`results` 与 `results-03` 共 10 次页面创建前的浏览器启动失败；`results-04` 对合法初始容器代理焦点的错误限制导致 2 个正例误报，其余 3 个负例也在目标变异之前被同一限制挡住，不能算有效负控。后续 `results-05`、最终 `results-06` 及所有中间 evaluator 文件均保留，冻结后没有更换 oracle 来适配参与者。

全部参与者本地浏览器尝试都未获得有效页面行为结果，原因包括 socket 权限错误或缺少可执行文件；library-2 另有 preview 子进程使外层 harness 超时的记录。这些是环境／harness 失败，不被统计成组件缺陷或修复轮次，也没有因后续远程成功而删除。实际行为结论来自另行记录的 Chrome145 生产观察。

本次独立来源审查还找到一项真实知识入口缺口：第四条事实引用 `P-BASE-TABS-CONTENT-ROLE-CONTENT`，但冻结源 `0607c6c5c386b8a932ab850e92a8873b2121dc45` 实际 ID 为 **`P-BASE-TABS-CONTENT-ROLE-PANEL`**。该事实的语义受 `ROLE-PANEL`、`CURRENT-DERIVED` 和 `A11Y-LABELLEDBY-TARGET` 支持，问题是错误引用锚点。修复仅针对今后可发现的 `knowledge.md`；原实验包及其 SHA 不变。[修正证据](evidence/2026-11-24-knowledge-value-study/knowledge-reference-correction.json)记录原源文件 SHA `4a1d1a7e74ed60bc21bd6a6883f0e52221dcb36ae27500fdc098c340571d11a5` 与前后文件摘要。

可转移的测试知识是：初次入焦可接受合法容器代理；条件 panel 与保留的隐藏 panel 应按 owner／关系接受；panel 内普通可聚焦内容不应自动判为 Tab 错误；计数必须来自同一个 connected polite region，允许正常文案且不能借用无关数字。它们已进入本次冻结 oracle 及对照，不由此次比较推导成完整 Proto 协议或业务场景保证。

## 独立复核与结清边界

[/root/s7_tabs_results 的独立只读审查](evidence/2026-11-24-knowledge-value-study/independent-audit.json)核对了：1,401 个 archive 文件 SHA／字节数，12 份观察的 60 份源码绑定、204 份捕获产物、36 份 HTTP 文件摘要、12 个 trace ZIP CRC，以及 trace 中 24 个 HTML／CSS 响应正文。12 个 JS 响应正文没有被 Playwright trace 保存；其绑定来自静态服务器实际读取摘要、保留的 dist 与 trace 请求／200 响应记录，**不声称已有浏览器 JS 响应正文哈希**。冻结 oracle、任务、锁文件及初始／维护快照均匹配。

这是对已执行实验和材料的独立接受，不是 GitHub 原生 APPROVE，也不代替最终 PR 合入回读。#734 仍需把旧的“未执行／旧 automatic 校准失败”正文与这些真实后继结果对齐，并以最终合入提交记录知识入口修正及报告；原有历史失败不改写。无需补一个有利结果、第二个框架或 36+9 个样本才接受本次有限结论。

## 复现载体

- [原始浏览器／校准／提交证据](evidence/2026-11-24-knowledge-value-study/raw-tabs-evidence.tar.xz)：发布容器 SHA-256 `18504111a3a891fca9097517f5a1b523f4e458658e3b904cd6aaabea04c8d4f2`，9,821,220 bytes。原 gzip 导出 SHA 为 `04d53ec535e60ea78cbfe95e8f3aa4d565fd32005715a78932cae977de3708b4`、20,077,292 bytes；无损重压缩逐份验证所有 1,401 份证据及其 manifest 的路径、长度、SHA 不变，见 `archive-recompression.json`。
- [参与者完整记录与固定知识源](evidence/2026-11-24-knowledge-value-study/participant-records.tar.gz)：SHA-256 `34240aafc47d636233281b2885179a5a674bedd89d31e29a8772f2e3d01b4d84`，2,005,949 bytes；344 个参与者文件另有 manifest，安装目录不打包。
- 提取任一提交的 `project`，按其真实记录运行固定锁 `npm ci` 与 `npm run build`；在独立静态生产服务器下，以冻结 evaluator 的 `--project`、`--url`、`--out` 参数观察。需要安装协议中固定的浏览器和 Playwright；不要将本地缺浏览器当成行为通过。
- 新模型运行只可作为新的重复，不能重建原 seed、账单或缺失时间。复核既有结果可直接使用 report、source、DOM、ARIA、截图、trace、HTTP 摘要及 manifests，不需重跑生成。
