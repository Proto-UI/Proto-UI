# 不依赖 Compiler：六次补充执行结果

日期：2026-10-08（Asia/Shanghai）。性质：当前用户授权的本地探索性实验记录，不是规范、PR 审批、外部发布或条件等效结论。

## 本阶段交付与历史边界

本次补充批次完成 **6/6 次新 dispatch，6 次成功接收、可评分且全通过**，没有触发停止政策。六次均为新功能 **6/6**、回归 **9/9**、完整 **15/15**。重试、补位、新增 discovery 均为零；任务、起始代码、三条件材料、八条 claims、15 项指标、receiver、oracle、Proto 规范均未改变。

原批次保留 **4 次 dispatch：3 次可评分全通过、1 次 `token_revoked` 失败不可评分**，以及原来的 5 个 not-run。原第 4 次没有覆盖；补充第 1 次是针对原槽 4 的新尝试。两批共有 **10 次真实受测尝试，9 次可评分**，而不是修复成连续九次尝试。Round0、2026-10-05 和 2026-10-07 记录未改写。诊断与离线合成输入不作为受测样本。

## 授权与最小准备

用户于 2026-10-08 明确回复「继续，我给予授权」。沿用 yvxi，不修改认证、不重置 Codex 登录、不切路线、不充值。已接受费用可能超过 USD 1 和配额耗尽，移除费用限制；原非费用停止政策仍生效。授权至多一次修正版非实验诊断及六次补充请求，不是允许无限重试或追加任务。

此前 2026-10-07 的诊断 HTTP400 是 Agent 使用字符串 `input` 而路线要求列表导致，失败原档保留。本次唯一列表输入诊断于上海时间 **2026-10-08 00:43:28.166～00:43:31.473** 成功返回 `OK`：耗时 **3.307 秒**，provider 报告 **10 input / 5 output / 15 total**，参考 USD **0.000070**，实际费用未知。它只证明该次同路线成功，不证明整个上游凭据池稳定或用户报告的 reset 已经被独立验证；没有再次诊断。

原九次执行器/计划有九槽硬约束且已被原冻结 pin，因此新增五个 supplemental 文件，不修改原 source pins：

- `scripts/benchmark/participant/supplement-plan.mjs`
- `scripts/benchmark/participant/supplement-runner.mjs`
- `scripts/benchmark/participant/supplement-live.mjs`
- `scripts/benchmark/participant/supplement-rehearsal.mjs`
- `scripts/benchmark/participant/supplement.test.mjs`

新执行器沿用接收/评分流程，只派发六槽后缀；第一槽对照原三次设置基线。诊断和补充返回的 `reasoning` 对象仅 JSON 键序变化，旧字符串比较会误判设置漂移：仅新增 runner 改用结构相等比较，实际值变化仍停止，旧 runner/结果不改。

离线 focused tests：**210 collected / 202 passed / 0 failed / 8 skipped**；8 个旧 nine-runner 用例因 fixture 环境变量门控未运行，不当作通过。新六次本地 HTTP + receiver + Chrome/oracle E2E 已实际跑通，正负控制、不可评分/无效交付、host error、malformed SSE 及中断、超时、模型变化、超 cap、缺 usage 停止均保留。费用参考超过 USD 1 的合成演练仍派发六次，证明费用不再停止。演练明确标记 synthetic，外部模型调用 **0**；`SYNTHETIC-live-policy-no-provider` 为本地合成 live 分支探针，其内部计数不可汇入真实 provider 调用。准备时错写测试路径及缺 `review-input` 的两次路由失误日志保留。

fresh-context 独立本地准入复核 `APPROVE`：核对父/source pin、原槽 4～9、请求隔离、停止与费用政策、离线证据。不是 GitHub PR v5 审批，不伪造平台身份/权限。执行使用单独六次 grant，绑定该独立报告和真实 E2E digest。

## 冻结与隔离

保留 frozen-v1、v1.1、v1.2。原实际 v1.2 SHA-256：`19c22b29dd5df723efa8f268f7fbf175524b168294e9d201393c0b8696691639`。

补充 `supplement-v1` SHA-256：`7c13157de003159a271b824619d84defceb6a32de781a914b5980403ef2170a3`。原 ledger SHA-256：`8ca8d0609f6b8a37cf490b7815a01d29cfb8b34d05ef9b576c33c74b3e06d596`，报告生成时再次验证未变。

沿用原 seed `16597d472e33eea7593cb5f8ea260a3829dc08234dce762d37771068625e94f6` 与后缀顺序：proto / ordinary / none / none / proto / ordinary。补充六次 request SHA 与对应原冻结 wire 完全相同。每次只发送共同任务、starter、对应条件材料；无历史响应、评分、诊断、协调器或审查代理上下文，无工具。none/ordinary 不追加 Proto 材料。

## 六次逐次结果（主体）

执行窗口：上海时间 **2026-10-08 01:22:55.290～01:29:23.933**（UTC 2026-10-07 17:22:55.290～17:29:23.933），**388.643 秒，约 6 分 29 秒**。请求耗时包含 HTTP/接收过程；worker 为评分耗时；总时间含每槽归档。每行实际费用均未知。

| 新尝试 | 原槽 | 条件 | 接收/可评分 | 新功能 | 回归 | 完整15/全通过 | 请求秒 | worker秒 | 总秒 | usage入/出/总 | 参考USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | proto | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 35.197 | 6.519 | 41.722 | 2695/1828/4523 | 0.023670 |
| 2 | 5 | ordinary | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 76.663 | 3.472 | 80.139 | 2620/1831/4451 | 0.023550 |
| 3 | 6 | none | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 54.390 | 3.733 | 58.128 | 2100/1858/3958 | 0.022780 |
| 4 | 7 | none | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 77.530 | 9.731 | 87.264 | 2100/1855/3955 | 0.022750 |
| 5 | 8 | proto | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 74.842 | 3.686 | 78.532 | 2695/1783/4478 | 0.023220 |
| 6 | 9 | ordinary | completed / 是 | 6/6 | 9/9 | 15/15 / 是 | 38.874 | 3.494 | 42.373 | 2620/1795/4415 | 0.023190 |

完整 15 项矩阵以及原批次九槽表见下方本地报告；原第 4 次所有检查保持 `untested`，不是零分或语义失败。

## 两批合并的探索性描述

合并只能描述认证中断前后的观察，不是连续执行的原平衡实验。

| 条件 | 实际尝试 | 可评分 | 全通过 | 已报告 input/output/total | 已知参考USD |
| --- | --- | --- | --- | --- | --- |
| 无额外文档 | 3 | 3 | 3 | 6300/5509/11809 | 0.067690 |
| 等信息普通文档 | 3 | 3 | 3 | 7860/5454/13314 | 0.070260 |
| Proto 文档 | 4（含原失败） | 3 | 3 | 8085/5399/13484（另一次未知） | 0.070160（另一次未知） |

补充六次 usage **14830 input / 10950 output / 25780 total**，参考 **USD 0.139160**。两批九次可得 usage 合计 **22245 input / 16362 output / 38607 total**，已知参考 **USD 0.208110**；原认证失败的 token/费用未知，不能将已知合计称为全部消耗。

参考费率仍是历史捕获 input $2/M、cached input $0.10/M、output $10/M，不是当前 yvxi 费率认证、账单或硬上限。诊断另计；真实算力/GPU 时间、实际金额、失败请求成本、协调器/审查子代理独立 token 与费用均无可靠可得统计，不能当作零。

## 模型、参数、可复现性限制

- requested/returned alias：`gpt-6.1-sol`；不可变 snapshot unknown。
- 每次请求：`stream=true`、`max_output_tokens=8192`、`store=false`、`tools=[]`、`tool_choice=none`；未指定 temperature、top_p、reasoning、service_tier、seed。
- 九次成功返回的可得设置结构一致：temperature 1、top_p 0.98、reasoning effort medium / context all_turns / mode standard / summary null、service_tier default、tools 空、tool_choice none、store false。`max_output_tokens` 返回 null，有效 cap 未认证。每次完整设置与 usage 原对象均归档。
- 报告 cached/reasoning token 不代表认证了供应商内部 cache/reasoning 行为。客户端 retries=0；配置 proxyMaxRetries=3、autoFailover=0，实际 upstream retry 来源/计费未知，客户端 dispatch 不等于 upstream 调用数。
- 原冻结执行配置沿用 Node v24.21.0、pnpm 10.32.1 和已绑定 Chrome 路径，不宣称仓库 Node 22 CI 或全仓库 suite 已通过。独立 reviewer 的只读检查使用 Node v22.23.2。
- 凭据仅 HTTP 认证，未写证据包。调用方对 execution 中 447 个文件执行所用凭据值扫描，值未出现；这是调用方检查，不是 reviewer 读取凭据后的独立认证。

## 证据与交付

本地证据根：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-08-noncompiler-supplement-v1`。

- `RESULTS.zh-CN.md`：补充逐次表、原九槽表、完整 15 项 × 10 尝试矩阵、耗时/usage/费用依据与限制。
- `results.json`：原与补充逐次完整数据、每次模型/参数/usage、分条件描述、逐次档案 hash 审计。
- `execution/ledger.json`、各槽 `http/`、`exchange.json`、`submission.html`、`assessment.json`、`browser/`：原始 SSE、terminal、组装响应、receipt、独立浏览器评分和 DOM/AX/截图/trace。
- `frozen-supplement-v1/`、`live-authorization-six.json`、`review-live/verdict.json`、`offline-e2e/rehearsal-result.json`、`live-evidence/`：冻结、授权、独立准入、离线演练与每槽路线观察。
- `diagnostic-http/`、`diagnostic-result.json`：单独非实验诊断；不混入受测样本。

三条件在本任务的冻结 15 项检查上，九次可评分提交全通过，**没有观察到行为得分差异**。这不能证明条件等效，也不能证明 Proto UI 没有价值；15 个检查不是 15 个样本。耗时/token 差异仅描述，不作因果/显著性结论。服务恢复后跨时间合并、模型版本/内部行为未知均限制外推。本阶段结束后不自动追加调用或 discovery，不扩大为 conformance 建设，不 commit/push/外部发布。
