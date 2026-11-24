# #749 Button 比较实验：独立结果接受记录

## 结论

**接受本轮已冻结的共同支持范围内的实际比较结果（adequate-for-declared-first-round-comparison）。无未解决的范围内阻塞发现。** Compiler 3/3 与 clean-generative 3/3 的完整生产旅程均通过；这六条旅程每条包含 10 个关联 checkpoint 和 5 个输入观察段。统计单位是完整旅程，不能记作 60 个独立样本。

本记录由独立审查者 `/root/s7_button_results_review` 完成。我不是本轮 producer、生成式参与者或 oracle 作者；只读既存源码、命令、产物、截图及 trace，并重新计算归档、绑定及体积数据。未重新运行浏览器、安装或构建，未更改实验代码和冻结文件，未写入 GitHub。此记录是实验结果的有限接受，**不是 GitHub 原生 APPROVE，也不证明 PR 已合入或 Issue 已回填**。

审查对象为 `internal/records/2026-11-24-button-projection-comparison.md`，SHA-256 `283632f7759fb243262855557137e09a1c9d33d9a4978406710078049646017e`；正式范围 ID 为 `issue749-react-button-common-development-study-v2`。完整机器可读核对见同目录 `review.json`、`verification.json` 与 `fixed-revision-verification.json`。

## 前提与冻结

真实 producer 的入口使用现有 `compileFile` / `writeCompilation` 与官方未缩减 Base Button source。对保留的 1 份入口 source、196 份 Compiler source 和 repository pnpm lock 做了固定 Git revision 对照，均匹配 `d0eb81d3c61c3d3e93e46c4151e78031273d6116`。两批各三次实际 prepare/install/verify 的 18 份命令收据和 36 份 stdout/stderr 摘要均保留且吻合。

正式三次完整输出清单均与先前准入的 12 个输出对象相同，inventory SHA 为 `6705b19e96b27aa8dd1a5ff87e26241b655f7bb20c3980ac735ebd73472fb009`。这支持固定 source、Compiler、依赖解析环境下的逐字节重现；它不证明任意 source 或其他目标也确定。

[实际准入评论](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-7111867656)及其保留回读明确是独立 Agent 的 bounded artifact admission，不是 native review。我读取了保留的实际评论和独立准入材料，未另行发出新的 live GitHub 查询。

最终独立 oracle 校准接受的摘要与 freeze 引用相同；实际执行的 observer SHA-256 为 `91d6604b33732c7596e33a36af6c0996ac0dc8cb27c00b27d3e91bd9db615937`。正式 runner 在执行前断言该摘要，并使用六轮相同生产 fixture、锁、顺序、viewport 和 250ms 观察边界。校准先于正式释放完成：最终 3 个合法正例通过、10 个预期反例被拒；早先的焦点分支误报和端口占用未被改写成产品失败或成功。

### 已解决发现 S7-749-REVIEW-01：v2 的继承时序字段

`primary-freeze-v2.json` 保留 `beforeAnyGenerativeRelease:true`，但原暴露样本在 20:33:44 已释放，并在 v2 20:38:14 冻结前交付。将这个继承字段当作 v2 的“早于所有生成”证明，会错误表达实际时间线。

最窄修正是追加报告澄清，不重写冻结字节。负责人已完成：报告指出它是初版历史字段，正式干净组以 `beforeAnyCleanGenerativeRelease:true` 和实际 release/首命令回执为准。三个 clean release 为 20:38:33.178547、20:38:33.178654、20:40:42.262860，均晚于 v2 冻结并早于首个正式浏览器运行 20:52:02.101302。冻结 SHA 仍是 `eda8ab6d22db447eb82483e4560c15a1ef7d280941551a1150148cd910303299`。该发现已解决，不要求重跑。

## 产物、真实响应与截图/trace 绑定

| 独立核对项 | 实际结果 |
| --- | --- |
| source-and-command archive | 1,693 个 regular 文件；逐个 path、bytes、SHA 匹配 manifest；没有重复成员 |
| 原 gzip 与发布 xz | 解压后的 tar 字节完全相同；它们是同一数据集的压缩编码，不能重复统计 |
| native archive | 203 个文件与提取现场逐字节相同 |
| primary-input manifest | 六轮 120 条文件引用与实际浏览器输入相符；生成组原 `project/` 到 staging `clean-consumer/` 的文件字节相同 |
| 相同 fixture | package、lock、HTML、TypeScript config 与四个 app/style/storage/entry 文件的各组六轮摘要相同 |
| 生产文件 | 六轮 18 个 index/JS/CSS 文件摘要全部匹配 |
| observer 实际响应 | 24 条 JS/CSS HTTP 200 response-body 绑定匹配冻结生产文件 |
| 图片与 trace | 60 张已命名 PNG 签名有效、6 份 trace ZIP CRC 正常，含真实 snapshot 和 screencast |
| trace 内的实际正文 | 24 条 HTML/CSS 正文重新计算摘要，全部匹配生产文件 |

**直接 trace 正文的边界：**另 12 条 JS network 记录没有内嵌 response body，不能说已经从 ZIP 重新计算所有 JS 正文。JS 绑定依赖实际运行的冻结 observer 对 `response.body()` 计算并写入的摘要，该摘要与保留 production 文件及 frozen inventory 一致；这里分别陈述两层证据。

我还直接查看了 deterministic-1 与 clean-generative-3 的 `09-enabled-again.png`：两者都显示固定内容和 activation count 3，实际控件表示/几何不同。这个有限查看不建立视觉质量、contrast 或可见焦点接受。

## 正式结果与解释边界

| 正式处理 | 完整旅程 | Space 观察 | disabled keyboard | 观察后修复 |
| --- | --- | --- | --- | --- |
| deterministic-1/2/3 | 3/3 pass | keydown | 三轮均退休/拒绝焦点，未派发 Enter/Space | 0 |
| clean-generative-1/2/3 | 3/3 pass | keyup-or-later | 三轮均退休/拒绝焦点，未派发 Enter/Space | 0 |

共同 oracle 接受完整 Space 手势的一次激活，所以两种边缘是被测差异而非预设失败。`keyup-or-later` 不应提升为浏览器事件时间的精确证明。六轮均未出现共同契约的首次失败；不需要为平局制造产品故障重现器。校准中真实 first divergence 仍被单独保留。

每条处理的二元正确性均值为 1、样本内方差为 0。三次生成不足以估计稀有错误或总体可靠性；相同模型/基础设施和指令分离也不等于安全盲测或 provider-level sampling independence。报告对“本样本中确定性更可靠”使用 weakened、对更广结论保留 inconclusive/unmeasured，是合理的有限解释。精确 provider snapshot、seed、token 与 cost 缺失保留 null，不能换算为零或虚构精确模型排序。

### 源码、helper 与构建体积

六轮体积均从保留的实际字节重新计算，和 `metrics.json` 相同：Compiler 每轮 Component 57,184 bytes、10 个 TS/TSX 共 237,914 bytes、生产 JS 270,111 bytes、离线 gzip 85,548 bytes；生成式三轮 Component 分别为 435/522/534 bytes，生产 JS 为 195,063/195,063/195,145 bytes，gzip 为 61,071/61,071/61,121 bytes。gzip 是 Python 默认 level 9、mtime=0 的离线计数。

Compiler 完整分发另含 map/provenance，共 12 个对象，保留 Context/style/interaction/focus/ownership/control-label 等支持闭包；生成式直接实现只依赖普通 React 组件路径。生产应用还包含相同 fixture 和 React/react-dom，不能将 bundle 字节称作单组件净运行成本。本轮接受“固定 fixture 下 Compiler 构建较大”这个实测结果，同时保留实现能力覆盖不同的混杂；不接受同等完整 Button 功能的效率结论，也不把未测额外能力算成收益。

## 排除与失败没有混入分母

| 保留对象 | 审查处置 |
| --- | --- |
| 首批三个 deterministic | 20:30:03 的 setup-mismatch 已先于浏览器记录：借用依赖链接导致 sourceResolution packages 为空。真实代码、helper、map、安装/构建命令仍在；排除不是行为失败 |
| original-generative-1 | 参与者实际材料记录承认读到 supplied compiler metadata；20:38:14 在任何该样本浏览器结果前排除。未报告读取完成输出；非预期信息暴露不能忽略 |
| 原 generative-2/3 | 只保留未释放的空包，不计参与者失败或有效重复 |
| 三个 clean-generative | 相同清理后的 task/fixture/lock、分别 fresh 交付；实际 npm ci/build exit 0，原始 source 和 logs 保留 |
| 先前 oracle 误报、端口错误及最终反例 | 分开保留；校准反例是有意写出的 independent controls，不是正式生成式失败；fail-fast 后未到达的阶段不计通过 |

本审查最初的核对脚本错误地将 staging `clean-consumer/` 路径直接附加到原生成式目录，产生 missing-path 诊断。随后仅修正审查脚本的 `project/` 映射，并保留原诊断于 `verification-initial-path-assumption.json`。这属于 reviewer 自身路径假设错误，不能被算作实验环境或产品失败；没有修改任何被审查字节。

## 原条件的有限接受

| #749 原条件 | 本次接受 |
| --- | --- |
| issue.749.001 前提、共同范围、独立 oracle、版本和同输入 | 有真实 pipeline/clean consumer、公开有限准入、实际冻结与校准、同 fixture/lock 和明确未暴露参数 |
| issue.749.002 保留 runs/failures/exclusions/seeds/variance | 已保留两批 compiler、原暴露生成、三个 clean primary、全部现有校准与正式 traces；未知 seed 保留 null，统计单位正确 |
| issue.749.003 可靠性及跨 host 限定 | 六轮共同旅程的平局可接受；其他 host 和稀有错误未测，不当作 pass |
| issue.749.004 混杂与 hypothesis classification | 信息暴露、setup mismatch、oracle 纠正、规模与能力不等价、模型参数和成本限制都保留；平局解释有边界 |
| issue.749.005 native mixing/lifecycle 不提前声明 | 保持 #733 后续前提；本轮未声称 native mixing 或扩展生命周期已测 |

本接受只覆盖固定文本 role/name、非零几何与初始命中、driver pointer/Tab/Enter/完整 Space、fresh document 计数复位、一个 controlled disabled 往返、有限 250ms 计数约束，以及冻结资产与 runtime-error 检查。AT、物理输入、SSR、其他 host、任意/动态 children、payload/currentTarget、callback replacement、focus restoration、dismissal、Presence、完整 cleanup、stale callable 和完整 Button/Compiler/Adapter 仍无本轮接受。

负责人可将此有限审查与真实证据整合，随后按实际 PR/Issue 状态完成已授权的回填。此记录不要求额外可选浏览器重跑，亦不代替平台 CI/DCO、独立 native review 或合入回执。
