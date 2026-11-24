# Sprint 7：确定性投影与独立生成 Button 的实际比较

对应 [#749](https://github.com/Proto-UI/Proto-UI/issues/749)。Agent 按当前用户“补完 Sprint 7”的请求执行。本文记录一轮已经运行的有界实验，不改变任何 draft 定义的生命周期，也不代表完整 Button、Compiler 或 Adapter 接受。

## 结果与解释

正式共同范围的结果是 **Compiler 3/3、独立生成 3/3 均通过**。每轮有 10 个关联检查点、5 个输入观察段；统计单位是整条生产构建旅程，不能将 60 个检查点当作 60 个独立样本。六轮的观察窗口中均未出现共同契约的首次失败，修复轮次均为 0。样本内整条旅程正确率均为 1，二元结果方差均为 0；三个重复不足以估计稀有故障或总体可靠性。

这轮**没有观察到确定性路线的正确性优势**。它提供了同一 source、Compiler 和依赖解析环境下的逐字节输出重现证据；生成式路线提供了同一需求下三个分别生成且通过的实现。二者的源码表示、体积和 Space 触发边缘不同，这些差异分别记录，不压成一个优劣总分。对“本样本中的确定性投影更可靠”的判断为 **weakened**；对更广泛可靠性、其他宿主和长期维护为 **inconclusive / unmeasured**。

## 准入、冻结与同一输入

真实 producer 使用官方未缩减的 Base Button 源码及现有 `compileFile` / `writeCompilation`，不是手写 Compiler fixture。源和 Compiler 均固定到 `d0eb81d3c61c3d3e93e46c4151e78031273d6116`，直接输入 SHA-256 为 `806891994e6b141ca3f76dce3288a056064eadfb0c4be0c7d8860bb001923ee8`。独立产物准入已实际发布并回读：[准入评论](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-7111867656)。它是独立 Agent 的有界准入评论，**不是 GitHub 原生 APPROVE**。

| 冻结对象 | 值 |
| --- | --- |
| 正式范围版本 | `issue749-react-button-common-development-study-v2` |
| 初版冻结 | 2026-11-23 20:24:21 UTC；保留 `freeze.json` |
| 清理输入后的正式冻结 | 2026-11-23 20:38:14.792638 UTC；`primary-freeze-v2.json` SHA `eda8ab6d22db447eb82483e4560c15a1ef7d280941551a1150148cd910303299` |
| 实际共同 oracle | SHA `91d6604b33732c7596e33a36af6c0996ac0dc8cb27c00b27d3e91bd9db615937` |
| 独立 oracle 校准接受 | SHA `ffa4a8f4a8ca1418970acf49bbdbbfa4dfca50bca2282d3497fa1925662c89d3` |
| 任务 | SHA `cf2be86543ff3f49b66c757d9183cc97cdcba7561b729c161eb9911654cd2cdf` |
| 实际 npm lock | SHA `eb05de3d6a314e1f385cfed6494844e91696a8cc68541950a91cf0ace9426fdb` |
| 共同目标 | React / react-dom 19.2.6、TypeScript 5.9.3、Vite 6.4.1 |
| 实际执行工具 | Node 24.22.3、npm 11.19.1、Playwright 1.58.2、Linux x64、Chromium 145.0.7632.6 |
| 浏览器边界 | sandbox=true；960×720；相同生产 fixture、输入次序与 250ms 观察窗 |
| Agent | 本会话配置 GPT-6 Astra Pro，继承相同配置，三个 fresh `fork_turns:none`，未覆写模型 |
| 未提供的模型参数 | 精确后端 snapshot、seed、token 和账单计数均为 null，并保留原因；不是 0 |

两条路线使用同一 consumer fixture、lock、默认内容与样式。生成式参与者只得到任务、固定项目和占位组件，可读取普通公共 React / WAI-ARIA 文档，不能读取完成的编译输出或其他参与者。三份正式交付均记录未访问外部文档。这里是共享环境中指令约束的公开开发比较，不声称安全盲测。

冻结文件字段澄清：v2 原样继承了初版的 `beforeAnyGenerativeRelease:true`，但 v2 冻结前原暴露样本已经交付，所以这个继承字段不能按 v2 的时间重新解释。v2 的精确时序由 `beforeAnyCleanGenerativeRelease:true`、实际 20:38:14 冻结和三份 clean release/首命令回执证明。此处追加勘误，保留冻结字节及其 SHA，不回写有误的历史字段。

预算预先固定为初次 10 分钟 / 40 次工具调用；实际反馈后最多 3 轮，每轮 5 分钟 / 20 次调用；首条完整成功旅程即停止。没有为了产生“修复效果”注入参与者缺陷。现有 #734 数据集的实际 primitive 是 Tabs / Dialog / Select，未提供同一 Button case；本轮用冻结的稳定 case ID 及原始事件、产物和结果清单绑定 Button，不把其他 primitive 的样本混入。

## 共同语义与独立判定

独立 reviewer 根据 [W3C Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)、任务中的应用侧期望和各固定定义的适用范围审查 oracle。原型及相关契约仍以各自 draft / active 状态为准。匹配已有 Adapter 不是本实验的判据。

| 范围 | 本轮实际接受的判定 | 限制 |
| --- | --- | --- |
| 可访问识别 | 固定文本派生 button role/name | 未做读屏、contrast 或全 children 类型矩阵 |
| 输入 | 真实 driver pointer、Tab、Enter、完整 Space 手势；每次正确增加一次计数 | 有限 250ms 观察，不证明任意迟到回调 |
| fresh document | 重新加载后 activation count 回到 0 | 不代表同 owner rebind 或完整 dispose |
| 受控 disabled | false→true→false；语义随 host 更新，禁用时 pointer 不激活，恢复后可激活 | 只测一个往返周期 |
| 禁用键盘 | 若 action 仍有焦点才发送并判定；拒绝/退休焦点则记录未发送 | 六个正式样本均未保留禁用焦点，不能宣称都执行并通过了 disabled Enter/Space |
| 产物 | index、script、stylesheet 及实际响应内容绑定冻结清单；无 runtime error | 不是可访问性、业务需求或全生命周期证明 |

尚未比较的维度明确保留：任意/动态 children、事件 payload/currentTarget、callback replacement、focus restoration、视觉焦点、dismissal、Presence、stale callable、完整 cleanup、SSR、非 Web、其他 Web host、native/generated mixing。#733 的 expanded lifecycle 仍是以后扩展这些声明的前提，本轮不以缺测冒充通过。

oracle 校准先于正式参与者浏览器观察完成。最终保留 3 个合法正例和 10 个预期拒绝反例，覆盖 delayed duplicate、disabled 漏洞、fresh count 泄漏、缺少 role、未列入清单的资源、双重/缺失 Space、不可达 Tab、禁用键盘泄漏与 re-enable 卡死。原先把 ARIA disabled 的焦点退休误判为失败的 oracle 版本，以及随后端口占用导致未进入页面的运行都保留；它们不是产品失败。`missing-role` 和 `reset-leak` 是进入页面后的语义等待失败，不是浏览器启动失败。完整校准接受说明位于 `oracle-review/`。

## 六轮真实结果

以下时间均为 2026-11-23 UTC，来自实际执行回执。

| 正式样本 | 浏览器执行区间 | 整条旅程 | 检查点 / 输入段 | Space 实测 | 观察后代码修复 |
| --- | --- | --- | --- | --- | --- |
| deterministic-1 | 20:52:02.101–20:52:12.706 | pass | 10 / 5 | keydown | 0 |
| clean-generative-1 | 20:52:12.707–20:52:21.242 | pass | 10 / 5 | keyup-or-later | 0 |
| deterministic-2 | 20:52:21.242–20:52:27.535 | pass | 10 / 5 | keydown | 0 |
| clean-generative-2 | 20:52:27.535–20:52:37.094 | pass | 10 / 5 | keyup-or-later | 0 |
| deterministic-3 | 20:52:37.095–20:52:43.760 | pass | 10 / 5 | keydown | 0 |
| clean-generative-3 | 20:52:43.761–20:52:56.019 | pass | 10 / 5 | keyup-or-later | 0 |

共同 oracle 允许完整 Space 手势在按下或释放边缘激活一次。三个 Agent 都明确选择原生按钮的 keyup；观察器记录 `keyup-or-later`，不能将该标签进一步提升为精确浏览器事件时间证明。表示差异从 initial checkpoint 已可见：编译产物是 role=button 的 DIV，三个生成实现为原生 BUTTON；二者都有实际命名、几何和命中。未出现共同条件的首次失败，因此没有生产分歧重现器可伪造；校准反例分别保留其真实首次失败。

三个 Compiler 运行都实际完成 prepare → 独立空依赖项目安装 → strict type/Vite build/closure verify，所有命令 exit 0。三份完整生成清单摘要均为 `6705b19e96b27aa8dd1a5ff87e26241b655f7bb20c3980ac735ebd73472fb009`，与先前准入产物相同。产生三个相同输出是固定输入下的可重现证据；不等于多 source、多 target 的确定性保证。

三份 Agent 交付都实际 `npm ci` 和生产 build 成功，固定输入哈希不变。首命令至交付分别为 20:38:47–20:39:59.884643、20:38:53–20:40:24.955947、20:40:52–20:42:28。此墙钟包含实现、命令、整理和等待，不能与已有完整 Compiler 的单次 prepare 耗时作相同开发成本比较。Compiler 三次 prepare 实际约 3.125、2.458、2.913 秒；其工程开发、安装准备、校准及 evaluator 工作均没有被算成零。

## 依赖、源码与构建体积

`metrics.json` 从真实冻结构建文件计算字节数，用 TypeScript AST 读取 import。下表的生产 JS 含相同应用及 React，gzip 为 Python gzip 默认 level 9、mtime=0 的离线字节计数；它不是网络、内存或运行时性能测试。

| 样本 | Component 源码字节 | 生成目录 TS/TSX 文件 / 总字节 | 生产 JS 字节 | gzip 字节 |
| --- | ---: | ---: | ---: | ---: |
| Compiler 每一轮 | 57,184 | 10 / 237,914 | 270,111 | 85,548 |
| 生成 1 | 435 | 1 / 435 | 195,063 | 61,071 |
| 生成 2 | 522 | 1 / 522 | 195,063 | 61,071 |
| 生成 3 | 534 | 1 / 534 | 195,145 | 61,121 |

Compiler 的完整分发还包括 map 与 provenance，共 12 个输出对象；实际支持文件包含 Context、style、interaction、focus、ownership、control-label 等传递闭包。干净消费者的 target closure 没有 `@proto.ui/*` 内部包。独立实现仅直接 import React；两条应用都使用固定 react-dom。生成式三份 Component 源码哈希各异，前两份最终 JS 相同，第三份因自身最小几何样式不同而不同。

在这个固定 fixture 中，Compiler 构建的 JS 字节数确实较大，应保留这一结果。原型编译产物覆盖了比本次 oracle 更多的能力，不能把上述字节差直接外推为同等完整 Button 功能的效率胜负；同样不能把未测的额外能力当作已经证明的收益。

## 所有尝试与偏差保留

| 尝试 | 处置 |
| --- | --- |
| 首批 deterministic 3 轮 | 实际生成/安装/构建均保留。producer worktree 借用了依赖链接，导致 provenance 的 sourceResolution package 证据为空，与准入上下文不一致；在浏览器比较前排除为 operator setup mismatch。11 个代码/helper/map 对象未被伪装成新的行为失败 |
| 修正后的 deterministic 3 轮 | 固定源码 worktree 真实 frozen-lock pnpm 安装后重新生成；解析上下文与准入产物逐项相同；正式纳入 |
| 原 generative-1 | 初始包误带未使用的 Compiler metadata / negative-control 文件，参与者实际阅读后报告。未泄露完成实现，但已发生非预期信息暴露；在任何该样本浏览器结果之前排除并保留 |
| 三个 clean-generative | 重新建立相同的干净任务/fixture/lock包，三位 fresh Agent 分别实现；正式纳入 |
| 原 generative-2/3 空包 | 未发出、未实施，不计作参与者失败或重复 |
| 浏览器启动命令 | 设备要求二次确认，队列等待/确认不匹配和过期均未产生测试结果；随后通过设备规定的确认接口执行原命令，六轮真实结果才进入分母 |

这些准备故障、信息暴露和等待也是实验工作的一部分；排除规则在正式浏览器结果出现前记录，没有选择性保留有利样本。没有将 warm cache、相同机器排队或缺失 provider 计数换算成准确成本。

## 原条件映射与可复查材料

| 原条件 | 本轮证据与接受边界 |
| --- | --- |
| issue.749.001：真实准入、共同范围、独立 oracle、版本、同输入 | 实际生成与干净消费者；公开准入；两版冻结、完整独立校准、相同 fixture/lock；未知 provider 参数显式 null |
| issue.749.002：保留全部轮次、失败、排除、seed 与方差 | 两批 deterministic、原暴露样本、三份 clean primary、所有校准和正式 traces；seed 不可获取，未编造；样本内正确性方差 0 |
| issue.749.003：可靠性、故障及跨 host 有限结论 | n=3/arm 的共同旅程平局；源/表示/体积差异单列；其他 host、稀有失败、AT 和完整生命周期未测 |
| issue.749.004：混杂与假设分类 | 本文的 weakened / inconclusive 解释；校准偏差、依赖准备和非安全盲测均保留 |
| issue.749.005：不提前声明 native mixing | 不作该声明，不要求为完成这一轮新增 #733 范围 |

证据目录：[2026-11-24-button-projection-study](evidence/2026-11-24-button-projection-study/)。其中：

- `primary-native-evidence.tar.gz`：实际生产 source/dist、60 张 PNG、6 份 trace、结果、运行命令与响应绑定；SHA `80b784725d25d7e9f716019a7f8ff0b8101796cb599293dad774b5c8e568a8db`。
- `source-and-command-evidence.tar.xz` 与 manifest：包括被排除尝试、参与者全部源码/命令、固定 Compiler 输入和 producer 日志，保留 1,693 份文件。
- `oracle-calibration.tar.gz` 与 `oracle-review/`：早期失败、最终 3 正例 / 10 反例及独立接受。
- `primary-input-manifest.json`、`primary-results.json`、`metrics.json`：可程序复核的输入、逐轮结果和字节计数。

重放时先验证 archive/hash，按原 runner 解包固定 source/dist，用归档中实际 oracle 字节及其同版本 browser harness / asset-binding / evidence 支持文件；安装锁定的运行工具并顺序提供独立的本地生产静态服务。保留 sandbox、版本、输入序列和时限。新运行必须写新目录和真实时钟，不覆盖本轮原始回执。已有冻结 oracle 不因未来排版或实现改动而重标版本。

实验结果与独立接受完成后仍需实际 PR 整合及 Issue 回填。这里不把候选文件的存在当作已合入，不提前勾选平台条件。
