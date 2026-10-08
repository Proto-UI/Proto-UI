# 补充批次前的一次认证诊断：请求格式拒绝并停止

日期：2026-10-07。性质：非实验诊断及停止记录，不是新的受测结果，也不是认证恢复证明。

## 授权与实际执行

用户确认 yvxi 上游由组织成员维护，报告服务应该稳定、用量 reset 后 token 充足。这是用户提供的状态信息；本阶段未独立认证 reset 或服务端修复操作。

用户回复「嗯，没问题」，授权最多一次同路线、同模型的非实验诊断，通过后才补齐最小六次执行器、离线演练、窄范围复核与冻结并执行最多六次补充尝试。费用限制保持移除，接受配额耗尽；没有授权重试、补位、discovery、认证变更、换路线、充值或外部发布。

实际只执行 **1 次诊断，0 次受测 dispatch，0 次客户端重试**。诊断未通过，已停止；没有实现或冻结六次执行器，也没有运行六次离线端到端演练。

## 诊断结果与责任

- 模型 alias：`gpt-6.1-sol`；provider：`yvxi`。
- 路线 fingerprint：`20ce7fea8ee549cd72fc524b1c09a80b78d3a2bea9c8b0d956c14f89952d554e`，执行前仍与原冻结一致。
- 请求输入仅 `Reply exactly OK.`；`stream=true`、`max_output_tokens=8192`、`store=false`、`tools=[]`、`tool_choice=none`，其他原省略参数仍省略。
- 开始：2026-10-07 19:01:19.862，结束：19:01:33.889，均为 Asia/Shanghai；对应 UTC 为 `2026-10-07T11:01:19.862Z` 至 `2026-10-07T11:01:33.889Z`。
- 诊断总耗时 **14,027 ms**，HTTP **400**，完整 raw **350 bytes**。
- 错误 type/code：`bad_response_status_code`。脱敏消息报告 `upstream_status: HTTP 400; cause: Input must be a list`。
- 没有 terminal response、assembled response 或 usage；**token 和实际费用 unknown，不按零计算**。本次没有可计算的 token 参考费用。

**诊断驱动采用了字符串形式的 `input`，当前路线返回不接受该形式。这是本次 Agent 的诊断请求格式问题，不是实验材料、接收器或 oracle 的缺陷。** 原冻结受测请求本来使用列表形式的 `input`，未发生这个变更。

这一次不是原来的 `token_revoked`，也没有配额耗尽证据；不能据此判断上游认证仍失效或已经恢复。HTTP 400 包含的代理错误说明仅是本次响应证据，不能认证内部实际失败 hop、模型执行或计费。一次客户端 dispatch 不等于可认证的一次 upstream 调用，内部重试来源仍 unknown。

## 保留与离线检查

原 2026-10-05 批次仍为 4 次 dispatch、3 次可评分、1 次接收失败；原第 4 次失败不覆盖。旧 ledger、frozen-v1/v1.1/v1.2、任务、文档、八条 claims、15 项指标、oracle、receiver 和 Round0 未改。

本阶段已有离线检查通过：原冻结 inventory 与源码 pins、原 ledger SHA、诊断 raw/request 的 hash 和完整性，以及修正版请求的列表形状。修正版仅把字符串输入转换为单个 user `input_text` 列表，其他 wire 字段不变；仅含 `Reply exactly OK.`，不含实验材料、Proto 文档或历史结果。

这是 **零网络调用的离线形状检查**，不是认证诊断通过，也不是六次执行器 E2E。修正版 proposal 为 `approved=false`、`executable=false`，原一次诊断授权已用完；没有自动再发送。

凭据仅在本机用于认证、错误投影脱敏和归档 secret-value 扫描，不输出或写入证据。可信调用方对 diagnostic-http 的 3 个文件扫描未发现所使用的 credential 值；这不是独立审查者的 secret-value 扫描。

## 后续最小决策

需要用户另行授权 **最多一次列表输入形式的诊断**，不修改或覆盖本次失败，不自动重试。若该诊断通过，此前六次补充授权仍按条件适用：先完成最小执行器、离线 E2E、独立窄复核与新冻结，再按原第 4～9 槽顺序执行最多六次新尝试；本记录不新增这些权限。

下一次若诊断失败仍停止，不循环探测。原补充条件顺序仍为 `proto → ordinary → none → none → proto → ordinary`，零客户端重试、零补位、零 discovery，继承原非费用停止政策，不重设 USD 1 限制。

证据根：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-07-noncompiler-supplement-v1`。

关键文件：`user-authorization.json`、`diagnostic-admission.json`、`diagnostic-http/request.json`、`diagnostic-http/response.raw`、`diagnostic-http/transport.json`、`diagnostic-result.json`、`diagnostic-error-projection.json`、`diagnostic-secret-scan.json`、`offline-verification.json`、`corrected-diagnostic-proposal.json`。
