# 九槽 implementation 批次：实际执行结果与停止记录

日期：2026-10-05。性质：用户授权的本地探索性实验记录，不是 Proto 规范、外部发布或条件等效结论。记录来源为本批冻结材料、实际 HTTP/接收器/评分证据及窄范围独立复核。

## 结论与实际覆盖

本批计划三条件各三次，但实际只完成 **4 次客户端 dispatch：3 次可评分、1 次失败不可评分；其余 5 槽未运行**。前三次分别为普通文档、无额外文档、Proto 文档，各自新功能 6/6、回归 9/9、完整 15/15，全通过。客户端重试和补位均为 0。不能将本批称为九次成功运行，不能将 15 项检查当作独立样本。

用户已明确接受 yvxi 实际费用可能超过 USD 1、接受实验耗尽 token/配额，并移除费用限制。费用停止条件已在执行前修订冻结中关闭；本次停止不是 USD 1 阈值造成，也没有证据证明配额耗尽。

## 授权、冻结与隔离

保留父 frozen-v1（SHA-256 `93bfa977097698b6c15048a5db33ed8dd606a7ac6ee0a3716cc92aaa298d6be5`）和准备期 frozen-v1.1（`6bfc7e984c3c4d53a8676bc116a7d0570f76a4392dcd7e18236eddd940605f9d`）。本次实际使用 frozen-v1.2（`19c22b29dd5df723efa8f268f7fbf175524b168294e9d201393c0b8696691639`），绑定本次授权、执行器、配置和移除费用限制的政策。

固定 seed 为 `16597d472e33eea7593cb5f8ea260a3829dc08234dce762d37771068625e94f6`。平衡顺序为 ordinary / none / proto → proto / ordinary / none → none / proto / ordinary，每个条件在每块及每个块内位置各出现一次。任务、起始代码、三条件文档、八条语义 claims、15 项指标、receiver、oracle、Proto 规范均未改变。Round0 和既有记录不追溯改写。

每次请求只使用冻结的共同任务、起始代码和对应条件材料；不发送前次输出、评分反馈、协调器或审查代理上下文，不提供工具。none/ordinary 不注入 Proto 文档；执行后审计核对四次请求与各自冻结 wire 字节完全相同。fresh-context 独立审查不构成受测样本。

## 九槽逐次结果

— 表示未知或未执行，不是零 token、零费用或语义失败。请求耗时含该次 HTTP/接收过程；评分耗时为 worker 时间；槽总时间含归档开销。第 4 槽“failed”是接收失败，不是 15 项行为测试失败。实际费用每一槽均未知。

| 次序 | 槽 | 条件 | 接收 | 可评分 | 新功能 | 回归 | 完整15 | 全通过 | 请求秒 | 评分秒 | 槽总秒 | usage入/出 | 参考USD | 异常/停止 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | block-1-ordinary | ordinary | completed | 是 | 6/6 | 9/9 | 15/15 | 是 | 82.190 | 5.966 | 88.162 | 2620/1828 | 0.023520 |  |
| 2 | block-1-none | none | completed | 是 | 6/6 | 9/9 | 15/15 | 是 | 77.413 | 5.126 | 82.543 | 2100/1796 | 0.022160 |  |
| 3 | block-1-proto | proto | completed | 是 | 6/6 | 9/9 | 15/15 | 是 | 82.092 | 5.263 | 87.361 | 2695/1788 | 0.023270 |  |
| 4 | block-2-proto | proto | failed | 否 | —/6 | —/9 | —/15 | 不可评分 | 21.144 | — | 21.148 | —/— | — | usage-ambiguity-stop |
| 5 | block-2-ordinary | ordinary | not-run | 否 | —/6 | —/9 | —/15 | 不可评分 | — | — | — | —/— | — |  |
| 6 | block-2-none | none | not-run | 否 | —/6 | —/9 | —/15 | 不可评分 | — | — | — | —/— | — |  |
| 7 | block-3-none | none | not-run | 否 | —/6 | —/9 | —/15 | 不可评分 | — | — | — | —/— | — |  |
| 8 | block-3-proto | proto | not-run | 否 | —/6 | —/9 | —/15 | 不可评分 | — | — | — | —/— | — |  |
| 9 | block-3-ordinary | ordinary | not-run | 否 | —/6 | —/9 | —/15 | 不可评分 | — | — | — | —/— | — |  |

## 第四次失败与停止的因果链

第 4 槽 `block-2-proto` 的 HTTP 状态为 200，完整原始正文为 151 bytes，包含 `: PING` 和以下错误对象：

```json
{
  "error": {
    "message": "Encountered invalidated oauth token for user, failing request",
    "type": "upstream_error",
    "param": "",
    "code": "token_revoked"
  }
}
```

这证明上游报告 OAuth token 失效，不证明本地 API key 被撤销、费用阈值触发或配额耗尽。传输归档完成，但没有 terminal response、可组装交付或 usage；receiver 报 `HTTP SSE missing terminal response`，不接纳为语义评分输入。ledger 按既有缺失 usage 政策记录 `usage-ambiguity-stop` 并停止。

因此保留第 4 槽 raw、失败组装、exchange 和空评分；不虚构 terminal/assembled response、usage 或 HTML。剩余五槽保留为 `not-run`，无重试、补位、换路线、改认证或额外 discovery。既有非费用停止政策没有因本次费用授权而取消。本批停止后不自动继续；供应商认证恢复和后续批次属于另行决定。

## 完整 15 项结果

下列列号对应上述九槽。`pass` 为执行并通过；`untested` 为没有可评分执行，不能当成 fail 或 pass。

| 指标 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| initial-structure | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| settings-defaults | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| horizontal-clamp | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| horizontal-wrap | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| orientation-live | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| vertical-clamp | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| vertical-wrap | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| home-end | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| manual-focus | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| enter-activation | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| space-activation | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| pointer-repeat | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| disabled-suppression | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| retained-relationships | pass | pass | pass | untested | untested | untested | untested | untested | untested |
| cleanup-after | pass | pass | pass | untested | untested | untested | untested | untested | untested |

## 模型、参数与可复现性

请求及前三次返回的 alias 均为 `gpt-6.1-sol`，经用户授权的 `yvxi` 路线发送至本地 `/v1/responses` 代理。请求 `stream=true`、`max_output_tokens=8192`、`store=false`、`tools=[]`、`tool_choice=none`；未发送 temperature、top_p、reasoning、service_tier 或 seed（顺序 seed 不是模型 seed）。

前三次返回设置一致：`temperature=1`、`top_p=0.98`、`reasoning={context:all_turns, effort:medium, mode:standard, summary:null}`、`service_tier=default`、`max_output_tokens=null`。这是本次响应可见设置，不是已认证的全部实际参数或不可变模型版本。旧模型列表中的 default high 不能替代这三次返回的 medium；前三次没有观察到返回设置变化。第 4 次没有返回可确认的模型或设置。

实际 token cap 是否执行、未返回的默认参数、不可变版本、内部缓存、gateway/upstream retry 来源和计费仍为 unknown。代理配置 `maxRetries=3`、`autoFailover=0`；本批四次客户端 dispatch 不能认证只有四次 upstream invocation。返回 cached/reasoning tokens 为 0，不证明内部完全未使用缓存或推理。

## 时间、usage 与费用

实际批次开始 `2026-10-05T13:22:55.384Z`，结束 `2026-10-05T13:27:35.057Z`（上海时间 2026-10-05 21:22:55.384 至 21:27:35.057）。整批墙钟 **279.673 秒，即 4 分 39.673 秒**；不含前置工程准备或后续复核。

| 可评分槽 | 输入 token | 输出 token | total token | 返回 cached token | 返回 reasoning token | 历史参考 USD | 实际 USD |
| --- | --: | --: | --: | --: | --: | --: | --- |
| block-1-ordinary | 2620 | 1828 | 4448 | 0 | 0 | 0.023520 | unknown |
| block-1-none | 2100 | 1796 | 3896 | 0 | 0 | 0.022160 | unknown |
| block-1-proto | 2695 | 1788 | 4483 | 0 | 0 | 0.023270 | unknown |
| **已知三次合计** | **7415** | **5412** | **12827** | **0** | **0** | **0.068950** | **unknown** |

usage 覆盖仅 **3/4 dispatch**；第四次缺失不能按 0 计入，所以 12827 不是整批完整消耗。历史参考计算为非 cached input USD 2/M、cached input USD 0.10/M、output USD 10/M；USD 0.06895 只是已知三次的参考值，不是当前 yvxi 报价、账单、实际算力费用或整批费用上限。当前路线没有已验证结算价目/账单；实际金额和第四次潜在计费未知。

## 验证和独立复核

- 本轮聚焦执行器/计划测试 31/31 通过，0 fail、0 skip；包含旧费用停止默认行为与显式禁用后的高合成 usage 不停止测试。合成输入不是受测模型结果。
- 前置离线真实传输＋浏览器演练和失败停止演练是准备期证据，明确标记为离线/合成；不是本批模型样本，也没有冒称本轮重跑。
- 执行前窄审查 APPROVE，39 项 frozen inventory、30 个 source pins、授权与路线绑定检查通过。
- 执行后窄审查 APPROVE，核对请求、raw、组装、receiver、外层评分资格及清理凭据、完整向量、总量、失败/未运行与停止政策。审查未新增网络、模型或浏览器调用，也不认证广泛 oracle 有效性。
- 协调器 exit 0 仅表示它正常按政策结束，不表示第四次 participant 成功或九次已完成。
- 驱动器报告扫描执行归档 234 个文件，`secretAbsent=true`；独立复核仅核对扫描元数据和文件计数，未读取凭据值或另行做 secret-value 扫描。凭据仅用于认证，不进入 packet 或证据包。
- 实际执行环境为 Node v24.21.0、pnpm 10.32.1、macOS Google Chrome；用户附带旧 guide/旧记录中 Node22 的历史说明不回写。本次实际环境由新证据明确记录。
- 产品全仓库 tests/types/spec regeneration 未运行：没有产品实现、规范或公开投影变化，不扩展为全仓库 conformance 建设。报告收束的文档/Agent 检查以独立 `documentation-validation.json` 为准。

## 能得出及不能得出的结论

第一块的三个条件各一个成功可评分样本，均为 15/15；本批尚未观察到核心行为分数差异。Proto 第二次尝试是上游接收失败，不应归因于文档质量。样本量未达到每条件三次，不能证明条件等效、Proto 无价值、显著优势或因果效果；也不根据中间同分新增调用。

后续最小前提是恢复或确认供应商上游认证，并另行决定新批次；本报告不授权补跑或延续本批。仓库/source/freeze/任务/oracle 的更宽建设不在本次交付范围。

## 证据索引

- 冻结 manifest：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/plan/frozen-v1.2/manifest.json`。
- 用户费用决定：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/user-decision.json`。
- 执行授权：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/authorization.json`。
- 原始 ledger：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/execution/ledger.json`。
- 结构化结果：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/results.json`。
- 原逐次报告：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/RESULTS.zh-CN.md`。
- 执行前复核：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/review-live/verdict.json`。
- 执行后复核：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/review-live/result-verdict.json`。
- 执行后扫描：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/live-finish.json`。
- 聚焦测试：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1/scoped-tests.log`。

每个实际 dispatch 的 raw/request/exchange/assembly 和可得 browser PNG、DOM、AX、评分、receipt 位于上述 evidence root 的 execution 对应槽目录。不成功响应不虚构组装；本地 capture 不冒称外部上传。未 commit/push，未外部发布。
